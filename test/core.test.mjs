import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aspectRatio,
  calculateResize,
  detectImageSignature,
  detectImageType,
} from '../src/index.js';
import { transformImage } from '../src/browser.js';

test('reduce common and portrait aspect ratios', () => {
  assert.equal(aspectRatio(1920, 1080), '16:9');
  assert.equal(aspectRatio(1080, 1920), '9:16');
  assert.equal(aspectRatio(511, 511), '1:1');
});
test('fit preserves proportions within bounds, including extreme ratios', () => {
  assert.deepEqual(calculateResize(1920, 1080, 800, 800), {
    width: 800,
    height: 450,
    crop: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  const portrait = calculateResize(100, 400, 120, 120);
  assert.equal(portrait.width, 30);
  assert.equal(portrait.height, 120);
  const tiny = calculateResize(1, 1_000_000, 1, 1);
  assert.equal(tiny.width, 1);
  assert.equal(tiny.height, 1);
});
test('cover crops the center in landscape and portrait', () => {
  assert.deepEqual(calculateResize(400, 200, 100, 100, 'cover'), {
    width: 100,
    height: 100,
    crop: { x: 100, y: 0, width: 200, height: 200 },
  });
  assert.deepEqual(calculateResize(200, 400, 100, 100, 'cover').crop, {
    x: 0,
    y: 100,
    width: 200,
    height: 200,
  });
});
test('stretch uses all original pixels', () => {
  assert.deepEqual(calculateResize(400, 200, 100, 100, 'stretch'), {
    width: 100,
    height: 100,
    crop: { x: 0, y: 0, width: 400, height: 200 },
  });
});
test('reject invalid dimensions and modes', () => {
  for (const invalid of [0, -1, 1.5, NaN, Infinity, '20', 1_000_001]) {
    assert.throws(() => aspectRatio(invalid, 100), RangeError);
    assert.throws(() => calculateResize(100, 100, 100, invalid), RangeError);
  }
  assert.throws(() => calculateResize(100, 100, 50, 50, 'invalid'), TypeError);
});
test('recognize JPEG, PNG, GIF and WebP header bytes', () => {
  const fixtures = [
    [[255, 216, 255], 'image/jpeg'],
    [[137, 80, 78, 71, 13, 10, 26, 10], 'image/png'],
    [Buffer.from('GIF89a'), 'image/gif'],
    [Buffer.from('GIF87a'), 'image/gif'],
    [Buffer.from('RIFF0000WEBP'), 'image/webp'],
  ];
  for (const [bytes, mime] of fixtures)
    assert.equal(detectImageSignature(new Uint8Array(bytes)).mime, mime);
});
const ftyp = (major, compatible = []) => {
  const bytes = Buffer.alloc(16 + compatible.length * 4);
  bytes.writeUInt32BE(bytes.length);
  bytes.write('ftyp', 4);
  bytes.write(major, 8);
  compatible.forEach((brand, i) => bytes.write(brand, 16 + i * 4));
  return bytes;
};
test('read aligned BMFF brands, respect box boundary and prioritize AVIF', () => {
  assert.equal(detectImageSignature(ftyp('avif')).mime, 'image/avif');
  assert.equal(detectImageSignature(ftyp('mif1', ['heic'])).mime, 'image/heic');
  assert.equal(detectImageSignature(ftyp('mif1', ['heic', 'avif'])).mime, 'image/avif');
  assert.equal(detectImageSignature(ftyp('mif1')), null);
  assert.equal(detectImageSignature(Buffer.concat([ftyp('mif1'), Buffer.from('avif')])), null);
  const minor = ftyp('mif1');
  minor.write('avif', 12);
  assert.equal(detectImageSignature(minor), null);
  const extended = ftyp('avif');
  extended.writeUInt32BE(1);
  assert.equal(detectImageSignature(extended), null);
  const padded = Buffer.concat([Buffer.from([0, 0]), ftyp('avif')]);
  assert.equal(detectImageSignature(padded.subarray(2)).mime, 'image/avif');
});
test('unknown, truncated and misleading input is not silently accepted', () => {
  for (const bytes of [
    [],
    [137, 80, 78, 71],
    [255, 216],
    Buffer.from('<svg></svg>'),
    Buffer.from('RIFF0000WAVE'),
  ])
    assert.equal(detectImageSignature(new Uint8Array(bytes)), null);
  assert.throws(() => detectImageSignature('photo.jpg'), TypeError);
  assert.equal(detectImageSignature(new Uint8Array([255, 216, 255]).buffer).format, 'JPEG');
});
test('Blob detection ignores supplied MIME and reads only a small prefix', async () => {
  assert.equal(
    (await detectImageType(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/png' })))
      .mime,
    'image/jpeg',
  );
  let range;
  class ObservedBlob extends Blob {
    slice(start, end) {
      range = [start, end];
      return super.slice(start, end);
    }
  }
  await detectImageType(new ObservedBlob([Buffer.alloc(4096)]));
  assert.deepEqual(range, [0, 256]);
  await assert.rejects(detectImageType('photo.jpg'), TypeError);
});
test('browser API rejects invalid options before allocating pixels', async () => {
  const file = new Blob([new Uint8Array([255, 216, 255])]);
  await assert.rejects(transformImage(new Blob([])), /nonempty/);
  await assert.rejects(transformImage(new Blob([new Uint8Array(40 * 1024 * 1024 + 1)])), /40 MiB/);
  await assert.rejects(transformImage(file, { format: 'image/avif' }), /Output/);
  await assert.rejects(transformImage(file, { quality: 2 }), /Quality/);
  await assert.rejects(transformImage(file, { width: 100 }), /pixels/);
  await assert.rejects(transformImage(file, { width: 8192, height: 8192 }), /megapixels/);
  await assert.rejects(transformImage(file, { mode: 'bad' }), /Mode/);
  await assert.rejects(transformImage(new Blob(['GIF89a'])), /JPEG, PNG and WebP/);
});
