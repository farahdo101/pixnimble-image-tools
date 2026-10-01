/** Pure image utilities. Work in browsers and Node.js without dependencies. */
export const LIMITS = Object.freeze({
  maxFileBytes: 40 * 1024 * 1024,
  maxPixels: 32_000_000,
  maxSide: 8192,
});

function dimension(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
    throw new RangeError(`${name} must be an integer from 1 to 1,000,000.`);
  }
  return value;
}

/** Return a reduced aspect ratio, e.g. aspectRatio(1920, 1080) -> "16:9". */
export function aspectRatio(width, height) {
  dimension(width, 'Width');
  dimension(height, 'Height');
  let a = width,
    b = height;
  while (b) [a, b] = [b, a % b];
  return `${width / a}:${height / a}`;
}

/** Calculate output size and a centered source crop; no pixels are allocated. */
export function calculateResize(
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  mode = 'contain',
) {
  for (const [name, value] of Object.entries({
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  }))
    dimension(value, name);
  if (!['contain', 'cover', 'stretch'].includes(mode))
    throw new TypeError('Mode must be contain, cover or stretch.');
  let width = targetWidth,
    height = targetHeight;
  const crop = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  if (mode === 'contain') {
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    width = Math.max(1, Math.min(targetWidth, Math.round(sourceWidth * scale)));
    height = Math.max(1, Math.min(targetHeight, Math.round(sourceHeight * scale)));
  } else if (mode === 'cover') {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    crop.width = targetWidth / scale;
    crop.height = targetHeight / scale;
    crop.x = (sourceWidth - crop.width) / 2;
    crop.y = (sourceHeight - crop.height) / 2;
  }
  return { width, height, crop };
}

/** Inspect header bytes, not the filename or a client-supplied MIME label.
 * Returns null for unknown/truncated headers. This is NOT full file validation.
 * Reads the leading ftyp box for AVIF/HEIC; a 256-byte prefix is sufficient for
 * typical files, but brands beyond that prefix are not detected by detectImageType.
 */
export function detectImageSignature(input) {
  const bytes =
    input instanceof Uint8Array
      ? input
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : null;
  if (!bytes) throw new TypeError('Expected Uint8Array or ArrayBuffer.');
  const has = (...signature) =>
    bytes.length >= signature.length && signature.every((value, i) => bytes[i] === value);
  const ascii = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
  const result = (format, mime, extension) => ({ format, mime, extension });
  if (has(0xff, 0xd8, 0xff)) return result('JPEG', 'image/jpeg', 'jpg');
  if (has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return result('PNG', 'image/png', 'png');
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP')
    return result('WebP', 'image/webp', 'webp');
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6)))
    return result('GIF', 'image/gif', 'gif');
  if (bytes.length >= 16 && ascii(4, 4) === 'ftyp') {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    // Extended-size and malformed boxes are deliberately unsupported.
    if (boxSize < 16 || boxSize % 4 !== 0) return null;
    const brands = [ascii(8, 4)];
    for (let i = 16; i + 4 <= Math.min(bytes.length, boxSize); i += 4) brands.push(ascii(i, 4));
    if (brands.some((brand) => ['avif', 'avis'].includes(brand)))
      return result('AVIF', 'image/avif', 'avif');
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx'].includes(brand)))
      return result('HEIC', 'image/heic', 'heic');
    // mif1/msf1 alone identify a generic HEIF container, not necessarily HEIC.
  }
  return null;
}

export async function detectImageType(blob) {
  if (!(blob instanceof Blob)) throw new TypeError('Expected a Blob or File.');
  return detectImageSignature(await blob.slice(0, 256).arrayBuffer());
}
