import { aspectRatio, calculateResize, detectImageType } from '../src/index.js';
import { transformImage } from '../src/browser.js';

const $ = (id) => document.getElementById(id);
const size = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
let resultURL;
function clearResult() {
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = undefined;
  $('result-image').removeAttribute('src');
  $('result-image').hidden = true;
  $('download').removeAttribute('href');
  $('result-details').hidden = true;
  $('empty-state').hidden = false;
}
function clearStatus() {
  $('status').textContent = '';
  $('status').dataset.error = 'false';
}
$('image-file').addEventListener('change', () => {
  clearResult();
  clearStatus();
  const file = $('image-file').files[0];
  $('file-info').textContent = file
    ? `${file.name} · ${size(file.size)}`
    : 'Your image stays in this browser.';
});
for (const id of ['width', 'height', 'mode', 'format', 'quality'])
  $(id).addEventListener('input', () => {
    clearResult();
    clearStatus();
  });
$('quality').addEventListener('input', () => {
  $('quality-value').value = `${$('quality').value}%`;
});
$('format').addEventListener('change', () => {
  $('quality').disabled = $('format').value === 'image/png';
  $('quality-hint').textContent = $('quality').disabled
    ? 'PNG is lossless; the quality slider does not apply.'
    : 'JPEG & WebP quality. PNG is lossless.';
});
$('transform-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearResult();
  $('controls').disabled = true;
  $('status').dataset.error = 'false';
  $('status').textContent = 'Processing on your device…';
  try {
    const result = await transformImage($('image-file').files[0], {
      width: Number($('width').value),
      height: Number($('height').value),
      mode: $('mode').value,
      format: $('format').value,
      quality: Number($('quality').value) / 100,
    });
    resultURL = URL.createObjectURL(result.blob);
    $('result-image').src = resultURL;
    $('result-image').hidden = false;
    $('empty-state').hidden = true;
    $('result-details').hidden = false;
    $('result-meta').textContent =
      `${result.width} × ${result.height} px · ${result.extension.toUpperCase()} · ${size(result.blob.size)}`;
    $('download').href = resultURL;
    $('download').download = `pixnimble-${result.width}x${result.height}.${result.extension}`;
    $('status').textContent = 'Ready. Your image never left this browser.';
  } catch (error) {
    $('status').dataset.error = 'true';
    $('status').textContent = error.message;
  } finally {
    $('controls').disabled = false;
  }
});
$('ratio-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const width = Number($('source-width').value),
      height = Number($('source-height').value);
    const plan = calculateResize(
      width,
      height,
      Number($('target-width').value),
      Number($('target-height').value),
    );
    $('ratio-result').textContent =
      `${aspectRatio(width, height)} → ${plan.width} × ${plan.height} px`;
  } catch (error) {
    $('ratio-result').textContent = error.message;
  }
});
let inspection = 0;
$('inspect-file').addEventListener('change', async () => {
  const ticket = ++inspection,
    file = $('inspect-file').files[0];
  if (!file) {
    $('inspect-result').textContent = 'Waiting for a file.';
    return;
  }
  try {
    const type = await detectImageType(file);
    if (ticket === inspection)
      $('inspect-result').textContent = type
        ? `${type.format} · ${type.mime} · ${size(file.size)}`
        : 'Unknown or unsupported signature.';
  } catch (error) {
    if (ticket === inspection) $('inspect-result').textContent = error.message;
  }
});
window.addEventListener('pagehide', clearResult);
