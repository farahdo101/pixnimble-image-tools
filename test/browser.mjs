import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Optional development-only Playwright dependency. See BROWSER.md.
const port = process.env.BROWSER_TEST_PORT || '4175';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += chunk;
});
let browser;
try {
  await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(([code]) => {
      throw new Error(`Demo server exited: ${code}\n${serverError}`);
    }),
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      timer.unref();
    }),
  ]);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    acceptDownloads: true,
  });
  const errors = [],
    externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base + '/'))
      externalRequests.push(request.url());
  });
  assert.equal((await page.goto(`${base}/demo/`)).status(), 200);
  const fixture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#7254c9';
    ctx.fillRect(50, 20, 100, 60);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('#image-file')
    .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(fixture) });
  await page.locator('#width').fill('100');
  await page.locator('#height').fill('100');
  await page.locator('#format').selectOption('image/png');
  assert.equal(await page.locator('#quality').isDisabled(), true);
  await page.getByRole('button', { name: 'Create image' }).click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.startsWith('Ready.'),
  );
  assert.match(await page.locator('#result-meta').textContent(), /100 × 50 px · PNG/);
  const pendingDownload = page.waitForEvent('download');
  await page.locator('#download').click();
  const downloaded = await pendingDownload;
  assert.equal(downloaded.suggestedFilename(), 'pixnimble-100x50.png');
  assert.equal(await downloaded.failure(), null);
  console.log('PASS browser form, fit resize, PNG quality state and download');

  const processing = await page.evaluate(async (bytes) => {
    const { transformImage } = await import('/src/browser.js');
    const source = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    const outputs = [];
    for (const format of ['image/png', 'image/webp', 'image/jpeg']) {
      const result = await transformImage(source, {
        width: 100,
        height: 100,
        format,
        mode: 'cover',
      });
      const decoded = await createImageBitmap(result.blob);
      const canvas = document.createElement('canvas');
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      const context = canvas.getContext('2d');
      context.drawImage(decoded, 0, 0);
      outputs.push({
        mime: result.blob.type,
        width: decoded.width,
        height: decoded.height,
        pixel: Array.from(context.getImageData(0, 0, 1, 1).data),
      });
      decoded.close();
    }
    const unchanged = await transformImage(source, { format: 'image/png' });
    const stretched = await transformImage(source, { width: 50, height: 80, mode: 'stretch' });
    // Exercise the image-element fallback as well as createImageBitmap.
    const bitmap = window.createImageBitmap;
    let fallback;
    try {
      window.createImageBitmap = undefined;
      fallback = await transformImage(source, { width: 60, height: 60 });
    } finally {
      window.createImageBitmap = bitmap;
    }
    const encoder = HTMLCanvasElement.prototype.toBlob;
    let unsupported = false;
    try {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        return encoder.call(this, callback, 'image/png');
      };
      await transformImage(source, { format: 'image/webp' });
    } catch (error) {
      unsupported = /cannot encode/.test(error.message);
    } finally {
      HTMLCanvasElement.prototype.toBlob = encoder;
    }
    return {
      outputs,
      original: [unchanged.width, unchanged.height],
      stretch: [stretched.width, stretched.height],
      fallback: [fallback.width, fallback.height],
      unsupported,
    };
  }, fixture);
  for (const output of processing.outputs) {
    assert.equal(output.width, 100);
    assert.equal(output.height, 100);
    if (output.mime === 'image/jpeg')
      assert.ok(
        output.pixel.every((value) => value >= 250),
        'Transparent pixels should become white in JPEG',
      );
    else assert.equal(output.pixel[3], 0, 'PNG/WebP should preserve alpha');
  }
  assert.deepEqual(processing.original, [200, 100]);
  assert.deepEqual(processing.stretch, [50, 80]);
  assert.deepEqual(processing.fallback, [60, 30]);
  assert.equal(processing.unsupported, true);
  console.log(
    'PASS all encoders, dimensions, alpha, JPEG background, decoder fallback and encoder error',
  );

  const oriented = await page.evaluate(async () => {
    const { transformImage } = await import('/src/browser.js');
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    canvas.getContext('2d').fillRect(0, 0, 80, 40);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg'));
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    // APP1 Exif, little-endian TIFF, one SHORT orientation entry with value 6.
    const exif = new Uint8Array([
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
      0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const file = new Blob([jpeg.slice(0, 2), exif, jpeg.slice(2)], { type: 'image/jpeg' });
    const result = await transformImage(file, { format: 'image/png' });
    return [result.width, result.height];
  });
  assert.deepEqual(oriented, [40, 80]);
  console.log('PASS EXIF rotation is applied before export');

  await page.locator('#width').fill('90');
  assert.equal(await page.locator('#download').isVisible(), false);
  await page
    .locator('#image-file')
    .setInputFiles({
      name: 'broken.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255, 0]),
    });
  await page.getByRole('button', { name: 'Create image' }).click();
  await page.waitForFunction(() => document.getElementById('status').dataset.error === 'true');
  assert.match(await page.locator('#status').textContent(), /decode/);
  assert.equal(await page.getByRole('button', { name: 'Create image' }).isEnabled(), true);
  await page
    .locator('#inspect-file')
    .setInputFiles({
      name: 'misleading.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(fixture),
    });
  await page.waitForFunction(() =>
    document.getElementById('inspect-result').textContent.startsWith('PNG'),
  );
  await page.locator('#source-width').fill('1080');
  await page.locator('#source-height').fill('1920');
  await page.getByRole('button', { name: 'Calculate size' }).click();
  assert.equal(await page.locator('#ratio-result').textContent(), '9:16 → 450 × 800 px');
  console.log('PASS stale-result cleanup, corrupt image, signature detection and ratio calculator');

  await page.reload();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/playground.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  // Capture a single tall viewport to avoid compositor tiling artifacts.
  await page.setViewportSize({
    width: 390,
    height: await page.evaluate(() => document.documentElement.scrollHeight),
  });
  await page.screenshot({ path: 'test-results/playground-mobile.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log('PASS mobile width, no runtime errors and no outbound HTTP requests');
  for (const path of ['/package.json', '/.env', '/src/../../package.json'])
    assert.equal((await fetch(base + path)).status, 404);
  assert.equal((await fetch(base + '/demo/', { method: 'POST' })).status, 405);
  console.log('PASS local server serves only public demo/source files and rejects uploads');
} finally {
  if (browser) await browser.close();
  server.kill();
}
