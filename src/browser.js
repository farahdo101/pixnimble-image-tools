import { calculateResize, detectImageType, LIMITS } from './index.js';

function checkSize(width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > LIMITS.maxSide ||
    height > LIMITS.maxSide ||
    width * height > LIMITS.maxPixels
  ) {
    throw new RangeError('Images must be at most 8,192 pixels per side and 32 megapixels.');
  }
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* Try the browser's image element decoder. */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('The browser could not decode this image. It may be damaged or unsupported.');
  }
}

/** Resize and/or convert a JPEG, PNG or WebP Blob locally using Canvas.
 * Omit both dimensions to preserve the decoded size. Returns a Blob + dimensions.
 * JPEG uses an opaque white background. PNG/WebP retain transparency.
 */
export async function transformImage(file, options = {}) {
  if (!(file instanceof Blob)) throw new TypeError('Expected a Blob or File.');
  if (!file.size || file.size > LIMITS.maxFileBytes)
    throw new RangeError('Choose a nonempty image up to 40 MiB.');
  const { format = 'image/webp', quality = 0.85, mode = 'contain' } = options;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(format))
    throw new TypeError('Output must be image/jpeg, image/png or image/webp.');
  if (!Number.isFinite(quality) || quality < 0 || quality > 1)
    throw new RangeError('Quality must be between 0 and 1.');
  if (!['contain', 'cover', 'stretch'].includes(mode))
    throw new TypeError('Mode must be contain, cover or stretch.');
  if (options.width !== undefined || options.height !== undefined)
    checkSize(options.width, options.height);
  const type = await detectImageType(file);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime))
    throw new TypeError('This demo processes JPEG, PNG and WebP images only.');
  const image = await decode(file);
  let canvas;
  try {
    checkSize(image.width, image.height);
    const width = options.width ?? image.width,
      height = options.height ?? image.height;
    const plan = calculateResize(image.width, image.height, width, height, mode);
    canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    if (format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const crop = plan.crop;
    context.drawImage(
      image.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      plan.width,
      plan.height,
    );
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('The browser could not encode this image.')),
        format,
        quality,
      ),
    );
    if (blob.type !== format)
      throw new Error(`This browser cannot encode ${format}. Try PNG or JPEG.`);
    return {
      blob,
      width: plan.width,
      height: plan.height,
      mime: blob.type,
      extension: format === 'image/jpeg' ? 'jpg' : format.split('/')[1],
    };
  } finally {
    image.close();
    if (canvas) canvas.width = canvas.height = 1;
  }
}
