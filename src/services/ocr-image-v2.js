import { extractContact } from './ocr.js';

function numericText(value = '') {
  return String(value)
    .replace(/[OoQD]/g, '0').replace(/[Il|]/g, '1').replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5').replace(/[Bb]/g, '8').replace(/[Gg]/g, '6')
    .replace(/[q]/g, '9');
}

function directPrice(text = '', allowPanelFallback = false) {
  const source = numericText(text).replace(/\u00a0/g, ' ');
  const candidates = [];
  const push = (token, score) => {
    const value = Number(String(token).replace(/\D/g, ''));
    if (!Number.isFinite(value) || value < 5000 || value > 5000000) return;
    // Seller prices in these product cards are normally round Ariary amounts.
    if (value % 500 !== 0) return;
    candidates.push({ value, score });
  };

  const anchored = /(?:PR\s*[I1L|]\s*X|PR\s*[I1L|]\s*CE|PRICE|PRIX|MONTANT|TOTAL|COD)\s*[:=\-]?\s*([0-9][0-9\s.,'’]{2,12}[0-9])/gi;
  let match;
  while ((match = anchored.exec(source))) push(match[1], 100);

  const currency = /([0-9][0-9\s.,'’]{2,12}[0-9])\s*(?:AR|MGA)\b/gi;
  while ((match = currency.exec(source))) push(match[1], 90);

  if (allowPanelFallback) {
    const loose = /\b([1-9][0-9](?:[\s.,'’]?[0-9]){3,6})\b/g;
    while ((match = loose.exec(source))) push(match[1], 40);
  }

  candidates.sort((a, b) => b.score - a.score || b.value - a.value);
  return candidates[0]?.value || 0;
}

function withDirectPrice(parsed, rawText, panel = false) {
  const amount = parsed.amount || directPrice(rawText, panel);
  if (!amount) return parsed;
  return {
    ...parsed,
    amount,
    confidence: { ...parsed.confidence, amount: Math.max(parsed.confidence?.amount || 0, panel ? .9 : .82) },
  };
}

function resultScore(item = {}) {
  let score = item.confidence?.overall || 0;
  if (item.amount) score += 3 + (item.confidence?.amount || 0);
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

function canvasFrom(bitmap, { left = 0, top = 0, width = 1, height = 1, rotate = 0, scale = 1, threshold = false } = {}) {
  if (typeof document === 'undefined') return null;
  const sx = Math.max(0, Math.floor(bitmap.width * left));
  const sy = Math.max(0, Math.floor(bitmap.height * top));
  const sw = Math.max(1, Math.min(bitmap.width - sx, Math.floor(bitmap.width * width)));
  const sh = Math.max(1, Math.min(bitmap.height - sy, Math.floor(bitmap.height * height)));
  const quarter = Math.abs(rotate) % 180 === 90;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((quarter ? sh : sw) * scale));
  canvas.height = Math.max(1, Math.round((quarter ? sw : sh) * scale));
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotate * Math.PI / 180);
  ctx.drawImage(bitmap, sx, sy, sw, sh, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale); ctx.restore();

  try {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
      let value = Math.max(0, Math.min(255, (gray - 128) * 1.85 + 128));
      if (threshold) value = value > 155 ? 255 : 0;
      d[i] = value; d[i + 1] = value; d[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
  } catch { /* preprocessing is best effort */ }
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
    await worker.setParameters?.({ preserve_interword_spaces: '1', user_defined_dpi: '300', tessedit_pageseg_mode: '6' });
    return worker;
  }

  async function run(activeWorker, image, { mode = 6, pass = 'scan', panel = false } = {}) {
    await activeWorker.setParameters?.({ tessedit_pageseg_mode: String(mode), preserve_interword_spaces: '1' });
    const output = await activeWorker.recognize(image);
    const text = output.data?.text || '';
    return { ...withDirectPrice(extractContact(text), text, panel), scanPass: pass, ocrText: text };
  }

  async function recognize(image) {
    if (!image) throw new Error('Choose a photo first');
    const activeWorker = await ensureWorker();
    let best = null;
    let bitmap = null;

    try {
      bitmap = await bitmapFor(image);
      if (bitmap) {
        // PRICE FIRST: seller cards are normally a narrow strip at the right edge, often rotated.
        // Try several crop widths because screenshots/camera framing move the card horizontally.
        const crops = [.22, .30, .38, .48];
        for (const cropWidth of crops) {
          for (const rotate of [90, 270, 0]) {
            for (const threshold of [false, true]) {
              const canvas = canvasFrom(bitmap, {
                left: 1 - cropWidth, width: cropWidth, rotate, scale: cropWidth <= .30 ? 2.8 : 2.2, threshold,
              });
              const candidate = await run(activeWorker, canvas, {
                mode: rotate ? 6 : 11,
                pass: `price-${Math.round(cropWidth * 100)}-${rotate}${threshold ? '-bw' : ''}`,
                panel: true,
              });
              best = bestOf(best, candidate);
              if (candidate.amount) return candidate;
            }
          }
        }
      }

      // No price found in the dedicated panel: scan the complete image in all useful orientations.
      const primary = await run(activeWorker, image, { mode: 6, pass: 'full-0' });
      best = bestOf(best, primary);
      if (primary.amount) return primary;

      if (bitmap) {
        for (const rotate of [90, 270, 180]) {
          const canvas = canvasFrom(bitmap, { rotate, scale: 1.35 });
          const candidate = await run(activeWorker, canvas, { mode: 11, pass: `full-${rotate}` });
          best = bestOf(best, candidate);
          if (candidate.amount) return candidate;
        }
      }
      return best || primary;
    } catch (error) {
      if (best) return best;
      throw error;
    } finally {
      bitmap?.close?.();
      try { await activeWorker.setParameters?.({ tessedit_pageseg_mode: '6' }); } catch { /* noop */ }
    }
  }

  async function stop() { if (worker) await worker.terminate(); worker = null; }
  return { recognize, stop };
}
