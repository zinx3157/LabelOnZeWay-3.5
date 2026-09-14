const PHONE_PREFIXES = new Set(['032','033','034','035','037','038','039']);
const OPERATION_WORDS = /\b(deliver(?:y)?|livraison|collect(?:er)?|item|mode|pick|qty|quantit[eé]|tel(?:ephone)?|phone|tracking|exp[eé]dition|colis|parcel|sender|exp[eé]diteur|total|prix|price|cod|montant)\b/i;
const CONTACT_ANCHOR = /\b(destinataire|recipient|receiver|client|customer|nom|name|deliver\s+to|livrer\s+[àa]|tel(?:ephone)?|phone)\b/i;
const ADDRESS_CUES = /\b(lot|parcelle|cit[eé]|b\.?p\.?|rue|route|avenue|av\.?|quartier|fokontany|commune|district|village|immeuble|bloc|appartement|apt\.?|akaiky|akaiki|en\s+face|[àa]\s+c[oô]t[eé]|arr[eê]t|pr[eè]s\s+de|chez)\b/i;
const ADDRESS_CUES_GLOBAL = /\b(lot|parcelle|cit[eé]|b\.?p\.?|rue|route|avenue|av\.?|quartier|fokontany|commune|district|village|immeuble|bloc|appartement|apt\.?|akaiky|akaiki|en\s+face|[àa]\s+c[oô]t[eé]|arr[eê]t|pr[eè]s\s+de|chez)\b/gi;
const AMOUNT_ANCHOR = /\b(prix|price|collect(?:er)?|[àa]\s*collecter|cod|total|montant)\b/i;
const SIZE_ANCHOR = /\b(taille|size|pointure)\b/i;
const LOCATION_HINTS = /\b(antananarivo|tana|madagascar|toamasina|tamatave|antsirabe|fianarantsoa|mahajanga|toliara|diego|antsiranana)\b/i;
const MANUFACTURING_NOISE = /\b(made\s+in|fabriqu[eé]\s+(?:au|en)|manufactured\s+in|sri\s+lanka|china|bangladesh|vietnam|india|cambodia|turkey|mauritius)\b/i;
const DIGIT_CONFUSIONS = Object.freeze({ O:'0', o:'0', Q:'0', D:'0', I:'1', l:'1', '|':'1', Z:'2', z:'2', S:'5', s:'5', B:'8', G:'6', b:'6', g:'9', q:'9' });

function cleanLine(value = '') {
  return String(value).replace(/[\u00a0\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function deconfuseNumeric(value = '') {
  return String(value).replace(/[OoQDI|lZzSsBGbgq]/g, (char) => DIGIT_CONFUSIONS[char] ?? char);
}

function numericShape(value = '') {
  return deconfuseNumeric(value).replace(/[^\d+]/g, '');
}

function normalizePhone(value = '') {
  const compact = numericShape(value);
  if (compact.startsWith('+261')) return `0${compact.slice(4)}`;
  if (compact.startsWith('261')) return `0${compact.slice(3)}`;
  return compact;
}

function phoneCandidates(text = '') {
  const candidates = String(text).match(/(?:\+?[ \t]*261|0|[OoQDI|l])(?:[ \t.\-/]*[0-9OoQDI|lZzSsBGbgq]){8,12}/g) || [];
  const seen = new Set();
  return candidates.map((raw) => ({ raw, local: normalizePhone(raw) }))
    .filter(({ local }) => local.length === 10 && PHONE_PREFIXES.has(local.slice(0, 3)))
    .filter(({ local }) => !seen.has(local) && seen.add(local));
}

function parseAmountToken(value = '') {
  const digits = deconfuseNumeric(value).replace(/[^\d]/g, '');
  const amount = Number(digits);
  return Number.isFinite(amount) && amount >= 1000 && amount <= 100000000 ? amount : 0;
}

function extractAmount(lines = [], phones = []) {
  const phoneSet = new Set(phones.map((item) => item.local));
  const matches = [];
  lines.forEach((line, lineIndex) => {
    const lineHasPhone = phones.some(({ raw, local }) => line.includes(raw) || normalizePhone(line).includes(local));
    if (lineHasPhone) return;
    const anchored = AMOUNT_ANCHOR.test(line);
    const hasCurrency = /\b(?:ar|mga)\b/i.test(line);
    if (OPERATION_WORDS.test(line) && !anchored && !hasCurrency) return;
    if (!anchored && !hasCurrency) return;
    const tokens = line.match(/(?:AR\s*)?[0-9OoQDI|lZzSsBGbgq]{1,3}(?:[ .,'-][0-9OoQDI|lZzSsBGbgq]{3})+(?:\s*(?:AR|MGA))?|(?:AR\s*)?[0-9OoQDI|lZzSsBGbgq]{4,8}(?:\s*(?:AR|MGA))?/gi) || [];
    for (const token of tokens) {
      const value = parseAmountToken(token);
      if (!value || phoneSet.has(normalizePhone(token))) continue;
      const tokenHasCurrency = /\b(?:ar|mga)\b/i.test(token) || hasCurrency;
      const score = (anchored ? 6 : 0) + (tokenHasCurrency ? 3 : 0) + (value >= 5000 ? 1 : 0) - (lineIndex > 8 ? 0.25 : 0);
      matches.push({ value, score, lineIndex });
    }
  });
  matches.sort((a, b) => b.score - a.score || b.value - a.value);
  return matches[0] || { value: 0, score: 0, lineIndex: -1 };
}

function scoreName(line = '', index = -1, phoneLineIndex = -1) {
  if (line.length < 3 || line.length > 80) return -99;
  if (OPERATION_WORDS.test(line) || ADDRESS_CUES.test(line) || MANUFACTURING_NOISE.test(line) || SIZE_ANCHOR.test(line)) return -99;
  const digits = (line.match(/\d/g) || []).length;
  if (digits >= 3) return -99;
  const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters < 3) return -99;
  const words = line.split(/\s+/).filter(Boolean).length;
  let score = letters / Math.max(1, line.length) * 4;
  if (words >= 2 && words <= 5) score += 3;
  if (/\b(mr|mme|m|madame|monsieur)\.?\b/i.test(line)) score += 1;
  if (phoneLineIndex >= 0 && index === phoneLineIndex - 1) score += 3;
  else if (phoneLineIndex >= 0 && index < phoneLineIndex && phoneLineIndex - index <= 2) score += 1;
  if (CONTACT_ANCHOR.test(line)) score += 2;
  if (LOCATION_HINTS.test(line)) score -= 3;
  return score;
}

function scoreAddress(line = '') {
  if (line.length < 3 || OPERATION_WORDS.test(line) || AMOUNT_ANCHOR.test(line) || MANUFACTURING_NOISE.test(line) || SIZE_ANCHOR.test(line)) return -99;
  let score = 0;
  if (ADDRESS_CUES.test(line)) score += 5;
  if (/\d/.test(line) && /[A-Za-zÀ-ÿ]/.test(line)) score += 2;
  if (LOCATION_HINTS.test(line)) score += 3;
  if (line.length >= 12 && (ADDRESS_CUES.test(line) || LOCATION_HINTS.test(line))) score += 1;
  if (/[,;/-]/.test(line) && (ADDRESS_CUES.test(line) || LOCATION_HINTS.test(line))) score += .5;
  return score;
}

function cleanAddressLine(line = '') {
  return cleanLine(line.replace(ADDRESS_CUES_GLOBAL, ' ').replace(/\s*[,;]\s*/g, ', '));
}

function extractSize(lines = []) {
  for (const line of lines) {
    if (!SIZE_ANCHOR.test(line)) continue;
    const match = line.match(/(?:taille|size|pointure)\s*[:\-]?\s*([A-Z]{1,4}|\d{1,3})\b/i);
    if (match) return match[1].toUpperCase();
  }
  return '';
}

function likelyBrandLine(line = '') {
  if (line.length < 3 || line.length > 50) return false;
  if (OPERATION_WORDS.test(line) || CONTACT_ANCHOR.test(line) || ADDRESS_CUES.test(line) || AMOUNT_ANCHOR.test(line) || SIZE_ANCHOR.test(line) || MANUFACTURING_NOISE.test(line) || LOCATION_HINTS.test(line)) return false;
  if (/\d/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return false;
  const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return letters >= 3 && letters / Math.max(1, line.length) > .65;
}

function extractItem(lines = [], excluded = new Set()) {
  const size = extractSize(lines);
  const brandLine = lines.find((line, index) => !excluded.has(index) && likelyBrandLine(line)) || '';
  return { brand: brandLine, size, note: [brandLine, size ? `Size ${size}` : ''].filter(Boolean).join(' · ') };
}

function confidenceScore(result) {
  let score = 0;
  if (result.name) score += .30;
  if (result.phone) score += .38;
  if (result.address) score += .24;
  if (result.amount) score += .08;
  return Math.min(1, score);
}

export function extractContact(text = '') {
  const normalized = String(text).replace(/\r/g, '\n').replace(/[\u00a0\t]+/g, ' ');
  const lines = normalized.split(/\n+/).map(cleanLine).filter(Boolean);
  const phones = phoneCandidates(normalized);
  const phone = phones[0]?.local || '';
  const phoneLineIndex = lines.findIndex((line) => phones.some(({ raw, local }) => line.includes(raw) || normalizePhone(line).includes(local)));
  const hasContactEvidence = Boolean(phone) || lines.some((line) => CONTACT_ANCHOR.test(line) || ADDRESS_CUES.test(line) || LOCATION_HINTS.test(line));

  const rankedNames = lines.map((line, index) => ({ line, index, score: scoreName(line, index, phoneLineIndex) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const nameCandidate = rankedNames[0] || null;
  const name = hasContactEvidence ? (nameCandidate?.line || '') : '';

  const amountMatch = extractAmount(lines, phones);
  const addressCandidates = lines.map((line, index) => ({ line, index, score: scoreAddress(line) }))
    .filter((item) => item.line !== name)
    .filter((item) => !phones.some(({ raw, local }) => item.line.includes(raw) || normalizePhone(item.line).includes(local)))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .sort((a, b) => a.index - b.index);
  const address = addressCandidates.map((item) => cleanAddressLine(item.line)).filter(Boolean).join(', ');

  const excluded = new Set(addressCandidates.map((item) => item.index));
  if (nameCandidate && name) excluded.add(nameCandidate.index);
  if (phoneLineIndex >= 0) excluded.add(phoneLineIndex);
  if (amountMatch.lineIndex >= 0) excluded.add(amountMatch.lineIndex);
  const item = extractItem(lines, excluded);

  const result = {
    name,
    phone,
    address,
    amount: amountMatch.value,
    item,
    raw: normalized,
    confidence: {
      name: name ? Math.min(1, (nameCandidate?.score || 0) / 10) : 0,
      phone: phone ? 1 : 0,
      address: address ? Math.min(1, addressCandidates.reduce((sum, itemValue) => sum + itemValue.score, 0) / 10) : 0,
      amount: amountMatch.value ? Math.min(1, amountMatch.score / 10) : 0,
      item: item.note ? .8 : 0,
    },
  };
  result.confidence.overall = confidenceScore(result);
  result.contactDetected = Boolean(result.name || result.phone || result.address);
  return result;
}

function betterResult(a, b) {
  const score = (item) => (item.confidence?.overall || 0) + (item.phone ? .08 : 0) + (item.name ? .04 : 0) + (item.address ? .04 : 0) + (item.amount ? .03 : 0) + (item.item?.note ? .02 : 0);
  return score(b) > score(a) ? b : a;
}

async function rotateImage270(source) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const context = canvas.getContext('2d', { alpha: false });
  context.translate(0, canvas.height);
  context.rotate(-Math.PI / 2);
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

export function createOcrService() {
  let worker = null;

  function canSetParameters(activeWorker) {
    return typeof activeWorker?.setParameters === 'function';
  }

  async function setPageMode(activeWorker, mode) {
    if (!canSetParameters(activeWorker)) return;
    await activeWorker.setParameters({ tessedit_pageseg_mode: String(mode) });
  }

  async function ensureWorker() {
    if (worker) return worker;
    const module = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm');
    const createWorker = module.createWorker || module.default?.createWorker;
    if (typeof createWorker !== 'function') throw new Error('OCR engine failed to load. Check internet access and retry.');
    worker = await createWorker('eng');
    if (canSetParameters(worker)) await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '150', tessedit_pageseg_mode: '6' });
    return worker;
  }

  async function recognize(image) {
    if (!image) throw new Error('Choose a photo first');
    const activeWorker = await ensureWorker();
    const primary = await activeWorker.recognize(image);
    let best = extractContact(primary.data?.text || '');
    const usefulNonContact = best.amount && best.confidence?.amount >= .8 && (best.item?.size || best.item?.brand);
    if ((best.confidence?.overall || 0) >= .68 || (best.phone && best.name && best.address) || usefulNonContact) return { ...best, scanPass: 'primary' };

    try {
      const rotated = await rotateImage270(image);
      if (rotated) {
        await setPageMode(activeWorker, 11);
        const fallback = await activeWorker.recognize(rotated);
        best = betterResult(best, extractContact(fallback.data?.text || ''));
        await setPageMode(activeWorker, 6);
        return { ...best, scanPass: 'adaptive' };
      }
    } catch {
      try { await setPageMode(activeWorker, 6); } catch { /* keep primary result */ }
    }
    return { ...best, scanPass: 'primary-low-confidence' };
  }

  async function stop() {
    if (worker) await worker.terminate();
    worker = null;
  }
  return { recognize, stop };
}
