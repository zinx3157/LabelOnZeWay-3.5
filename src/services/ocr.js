const PHONE_PREFIXES = new Set(['032','033','034','035','037','038','039']);
const ADDRESS_NOISE_SOURCE = String.raw`\b(LOT|PARCELLE|CIT[EÉ]|B\.?P\.?|RUE|AKAIKY|EN\s+FACE|À\s+CÔTÉ|A\s+COTE|ARRÊT|ARRET)\b`;
const ADDRESS_NOISE = new RegExp(ADDRESS_NOISE_SOURCE, 'gi');
const ADDRESS_NOISE_TEST = new RegExp(ADDRESS_NOISE_SOURCE, 'i');

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
    return !ADDRESS_NOISE_TEST.test(line);
  }) || '';

  const addressLines = lines
    .filter((line) => line !== name && !phoneMatches.some((match) => line.includes(match)))
    .map((line) => line.replace(ADDRESS_NOISE, '').replace(/\s{2,}/g, ' ').trim())
    .filter((line) => line.length >= 3);
  return { name, phone, address: addressLines.slice(0, 4).join(', '), raw: normalized };
}

export function createOcrService() {
  let worker = null;
  async function ensureWorker() {
    if (worker) return worker;
    const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
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
