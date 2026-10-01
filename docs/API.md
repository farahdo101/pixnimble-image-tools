# API reference

## Pure utilities — `src/index.js`

### `aspectRatio(width, height): string`

Positive integer dimensions from 1 to 1,000,000. Returns the reduced ratio (`1920, 1080` → `16:9`). Throws `RangeError` on invalid dimensions.

### `calculateResize(sourceWidth, sourceHeight, targetWidth, targetHeight, mode = 'contain')`

All dimensions must be integers from 1 to 1,000,000. Returns:

```js
{
  width: 800,
  height: 450,
  crop: { x: 0, y: 0, width: 1920, height: 1080 }
}
```

`crop` uses source-image coordinates; fractional crop coordinates are allowed. `contain` fits inside the target with no padding. `cover` crops the source centrally to fill the target. `stretch` stretches the complete source. Upscaling is allowed. Whole-pixel rounding may slightly change the effective ratio, especially for extreme proportions. Unknown modes throw `TypeError`.

### `detectImageSignature(bytes): { format, mime, extension } | null`

Accepts a `Uint8Array` (including a Node.js `Buffer`) or an `ArrayBuffer`. Header support:

| Format | MIME         | Extension |
| ------ | ------------ | --------- |
| JPEG   | `image/jpeg` | `jpg`     |
| PNG    | `image/png`  | `png`     |
| WebP   | `image/webp` | `webp`    |
| GIF    | `image/gif`  | `gif`     |
| AVIF   | `image/avif` | `avif`    |
| HEIC   | `image/heic` | `heic`    |

AVIF/HEIC detection examines aligned major and compatible brands in a leading, ordinary-size `ftyp` box. AVIF takes precedence if both families are advertised. Generic `mif1`/`msf1` alone do not prove HEIC encoding. Extended-size boxes are not supported. Returns `null` for unknown or insufficient header bytes. It does not inspect the complete image structure, pixel data, animation, EXIF or malware.

### `await detectImageType(blob)`

Accepts a `Blob` or `File`; reads at most the first 256 bytes, then calls `detectImageSignature`. The file name and supplied MIME are ignored. Returns the same descriptor or `null`. Compatible brands beyond this prefix are not examined.

### `LIMITS`

Frozen object: `{ maxFileBytes: 41943040, maxPixels: 32000000, maxSide: 8192 }`. Used by the browser transform, not the pure geometry calculator.

## Browser transforms — `src/browser.js`

### `await transformImage(file, options = {})`

`file`: a nonempty JPEG, PNG or WebP `Blob`/`File`, at most 40 MiB.

| Option            | Default            | Accepted values                                                                |
| ----------------- | ------------------ | ------------------------------------------------------------------------------ |
| `width`, `height` | Decoded image size | Supply both or neither; positive integers, ≤ 8192 per side and ≤ 32 megapixels |
| `mode`            | `contain`          | `contain`, `cover`, `stretch`                                                  |
| `format`          | `image/webp`       | `image/jpeg`, `image/png`, `image/webp`                                        |
| `quality`         | `0.85`             | Number from 0 to 1; ignored by PNG encoder                                     |

Returns `{ blob, width, height, mime, extension }`. Both decoded input and requested output bounds are checked against pixel limits. The decoder must allocate pixels before its dimensions can be checked.

Browser DOM and Canvas APIs are required; this function is not a Node.js image encoder. `createImageBitmap` is preferred, with an `HTMLImageElement` fallback. Temporary decoder resources are released. Unsupported encoder output, decode failures and invalid inputs reject the promise with an error.

For downloads/previews, create an object URL for `result.blob` and revoke it when the result is replaced or the view is disposed. See [`demo/app.js`](../demo/app.js).

The encoder exports a still image without original metadata. JPEG uses white behind transparent pixels. PNG/WebP preserve transparency where the browser supports it. Canvas rendering can change colors; no output-byte target or file-size reduction is promised.
