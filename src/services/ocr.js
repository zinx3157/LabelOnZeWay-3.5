const PHONE_PREFIXES = new Set(['032','033','034','035','037','038','039']);
const ADDRESS_NOISE_SOURCE = String.raw`\b(LOT|PARCELLE|CIT[EÉ]|B\.?P\.?|RUE|AKAIKY|EN\s+FACE|À\s+CÔTÉ|A\s+COTE|ARRÊT|ARRET)\b`;
const ADDRESS_NOISE = new RegExp(ADDRESS_NOISE_SOURCE, 'gi');
const ADDRESS_NOISE_TEST = new RegExp(ADDRESS_NOISE_SOURCE, 'i');

function extractAmount(text = '') {
  const candidates = String(text).match(/(?:AR\s*)?(\d{1,3}(?:[ .]\d{3})+|\d{4,7})(?:\s*AR)?/gi) || [];
  const values = candidates.map((item) => Number(item.replace(/[^\d]/g, ''))).filter((value) => Number.isFinite(value) && value >= 1000 && value <= 100000000);
  return values.length ? Math.max(...values) : 0;
}

export function extractContact(text = '') {
  const normalized = String(text).replace(/\r/g, '\n');
  const phoneMatches = normalized.match(/(?:\+261|0)[\s.-]?(?:3[2345789])(?:[\s.-]?\d){7}/g) || [];
  const phone = phoneMatches.map((item) => item.replace(/[^+\d]/g, '')).find((item) => {
    const local = item.startsWith('+261') ? `0${item.slice(4)}` : item;
    return PHONE_PREFIXES.has(local.slice(0, 3));
  }) || '';

  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const name = lines.find((line) => {
    if (line.length < 3 || line.length > 80) return false;
    if (/\d{4,}/.test(line)) return false;
    if (/^(deliver|livraison|collect|item|mode|pick|qty|tel|telephone|phone)\b/i.test(line)) return false;
    return !ADDRESS_NOISE_TEST.test(line);
  }) || '';

  const addressLines = lines
    .filter((line) => line !== name && !phoneMatches.some((match) => line.includes(match)))
    .filter((line) => !/^(deliver|livraison|collect|item|mode|pick|qty|tel|telephone|phone)\b/i.test(line))
    .map((line) => line.replace(ADDRESS_NOISE, '').replace(/\s{2,}/g, ' ').trim())
    .filter((line) => line.length >= 3 && !/^\d[\d\s.,]*\s*(?:ar)?$/i.test(line));
  return { name, phone, address: addressLines.slice(0, 4).join(', '), amount: extractAmount(normalized), raw: normalized };
}

export function createOcrService() {
  let worker = null;
  async function ensureWorker() {
    if (worker) return worker;
    const module = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm');
    const createWorker = module.createWorker || module.default?.createWorker;
    if (typeof createWorker !== 'function') throw new Error('OCR engine failed to load. Check internet access and retry.');
    worker = await createWorker('eng');
    return worker;
  }
  async function recognize(image) {
    if (!image) throw new Error('Choose a photo first');
    const activeWorker = await ensureWorker();
    const result = await activeWorker.recognize(image);
    return extractContact(result.data?.text || '');
  }
  async function stop() {
    if (worker) await worker.terminate();
    worker = null;
  }
  return { recognize, stop };
}
