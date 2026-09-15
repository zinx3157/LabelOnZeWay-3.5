import { extractContact } from './ocr.js';

function resultScore(item = {}) {
  let score = item.confidence?.overall || 0;
  if (item.amount) score += 1.25 + (item.confidence?.amount || 0) * .5;
  if (item.phone) score += .25;
  if (item.name) score += .08;
  if (item.address) score += .08;
  return score;
}

function bestOf(current, candidate) {
  if (!current) return candidate;
  return resultScore(candidate) > resultScore(current) ? candidate : current;
}

async function bitmapFor(source) {
  if (typeof createImageBitmap !== 'function') return null;
  return createImageBitmap(source);
}

function canvasFrom(bitmap, { cropRight = 1, rotate = 0, scale = 1 } = {}) {
  if (typeof document === 'undefined') return null;
  const sourceWidth = Math.max(1, Math.round(bitmap.width * cropRight));
  const sx = bitmap.width - sourceWidth;
  const sw = sourceWidth;
  const sh = bitmap.height;
  const quarterTurn = Math.abs(rotate) % 180 === 90;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((quarterTurn ? sh : sw) * scale));
  canvas.height = Math.max(1, Math.round((quarterTurn ? sw : sh) * scale));
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  if (rotate === 90) {
    ctx.translate(sh, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotate === 180) {
    ctx.translate(sw, sh);
    ctx.rotate(Math.PI);
  } else if (rotate === 270) {
    ctx.translate(0, sw);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(bitmap, sx, 0, sw, sh, 0, 0, sw, sh);
  ctx.restore();
  return canvas;
}

function enhance(canvas) {
  const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  try {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114);
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
      d[i] = contrasted;
      d[i + 1] = contrasted;
      d[i + 2] = contrasted;
    }
    ctx.putImageData(image, 0, 0);
  } catch { /* enhancement is optional */ }
  return canvas;
}

export function createOcrService() {
  let worker = null;

  async function ensureWorker() {
    if (worker) return worker;
    const module = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm');
    const createWorker = module.createWorker || module.default?.createWorker;
    if (typeof createWorker !== 'function') throw new Error('OCR engine failed to load. Check internet access and retry.');
    worker = await createWorker('eng');
    if (typeof worker.setParameters === 'function') {
      await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '220', tessedit_pageseg_mode: '6' });
    }
    return worker;
  }

  async function run(activeWorker, image, mode = 6, pass = 'scan') {
    if (typeof activeWorker.setParameters === 'function') {
      await activeWorker.setParameters({ tessedit_pageseg_mode: String(mode), preserve_interword_spaces: '1' });
    }
    const output = await activeWorker.recognize(image);
    return { ...extractContact(output.data?.text || ''), scanPass: pass };
  }

  async function recognize(image) {
    if (!image) throw new Error('Choose a photo first');
    const activeWorker = await ensureWorker();
    let best = await run(activeWorker, image, 6, 'primary');

    // Shipping/contact photos should remain fast when the primary pass is already decisive.
    if (best.phone && best.name && best.address) return best;

    let bitmap = null;
    try {
      bitmap = await bitmapFor(image);
      if (!bitmap) return best;

      // Seller/product photos consistently place the price panel on the right. Crop it first,
      // enlarge it, rotate both directions, and OCR sparse text. This prevents garment labels,
      // years, sizes and background text from competing with the actual PRIX value.
      const pricePasses = [
        { cropRight: .36, rotate: 90, scale: 1.8, pass: 'price-panel-90' },
        { cropRight: .36, rotate: 270, scale: 1.8, pass: 'price-panel-270' },
        { cropRight: .36, rotate: 0, scale: 1.8, pass: 'price-panel-0' },
      ];

      for (const spec of pricePasses) {
        const canvas = enhance(canvasFrom(bitmap, spec));
        const candidate = await run(activeWorker, canvas, 11, spec.pass);
        best = bestOf(best, candidate);
        if (candidate.amount && (candidate.confidence?.amount || 0) >= .65) return candidate;
      }

      // Generic fallback for photos whose text is not in the seller's usual right-side panel.
      for (const rotate of [90, 270, 180]) {
        const canvas = canvasFrom(bitmap, { cropRight: 1, rotate, scale: 1.15 });
        const candidate = await run(activeWorker, canvas, 11, `full-${rotate}`);
        best = bestOf(best, candidate);
        if (candidate.amount && (candidate.confidence?.amount || 0) >= .65) break;
      }
    } catch {
      // Keep the strongest successful OCR result rather than failing the whole batch item.
    } finally {
      bitmap?.close?.();
      try {
        if (typeof activeWorker.setParameters === 'function') await activeWorker.setParameters({ tessedit_pageseg_mode: '6' });
      } catch { /* no-op */ }
    }
    return best;
  }

  async function stop() {
    if (worker) await worker.terminate();
    worker = null;
  }

  return { recognize, stop };
}
