const PHONE_PREFIXES = new Set(['032','033','034','035','037','038','039']);
const OPERATION_WORDS = /\b(deliver(?:y)?|livraison|collect(?:er)?|item|mode|pick|qty|quantit[eé]|tel(?:ephone)?|phone|tracking|exp[eé]dition|colis|parcel|sender|exp[eé]diteur|total|prix|price|cod|montant|ref(?:erence)?)\b/i;
const CONTACT_ANCHOR = /\b(destinataire|recipient|receiver|client|customer|nom|name|deliver\s+to|livrer\s+[àa]|tel(?:ephone)?|phone)\b/i;
const ADDRESS_LABEL = /\b(adresse|address|lieu\s+de\s+livraison|delivery\s+address)\b/i;
const ADDRESS_CUES = /\b(lot|parcelle|cit[eé]|b\.?p\.?|rue|route|avenue|av\.?|quartier|fokontany|commune|district|village|immeuble|bloc|appartement|apt\.?|akaiky|akaiki|en\s+face|[àa]\s+c[oô]t[eé]|arr[eê]t|pr[eè]s\s+de|chez)\b/i;
const ADDRESS_CUES_GLOBAL = /\b(lot|parcelle|cit[eé]|b\.?p\.?|rue|route|avenue|av\.?|quartier|fokontany|commune|district|village|immeuble|bloc|appartement|apt\.?|akaiky|akaiki|en\s+face|[àa]\s+c[oô]t[eé]|arr[eê]t|pr[eè]s\s+de|chez)\b/gi;
const AMOUNT_ANCHOR = /\b(prix|price|collect(?:er)?|[àa]\s*collecter|cod|total|montant)\b/i;
const AMOUNT_ANCHOR_FUZZY = /\b(?:pr[i1l|]x|pr[i1l|]ce|c[o0]llect(?:er)?|c[o0]d|t[o0]tal|m[o0]ntant)\b/i;
const SIZE_ANCHOR = /\b(taille|size|pointure)\b/i;
const LOCATION_HINTS = /\b(antananarivo|tana|madagascar|toamasina|tamatave|antsirabe|fianarantsoa|mahajanga|toliara|diego|antsiranana|nosy\s*be|sambava|fort\s*dauphin)\b/i;
const MANUFACTURING_NOISE = /\b(made\s+in|fabriqu[eé]\s+(?:au|en)|manufactured\s+in|sri\s+lanka|china|bangladesh|vietnam|india|cambodia|turkey|mauritius|polyester|cotton|coton|viscose|elastane|washing|wash|care|composition|facebook|instagram|whatsapp|www\.|https?:\/\/)\b/i;
const GARBAGE_LINE = /^(?:[\W_]+|[A-Z0-9]{1,2}|s\/?p|rn|tm|®|©)$/i;
const DIGIT_CONFUSIONS = Object.freeze({ O:'0', o:'0', Q:'0', D:'0', I:'1', l:'1', '|':'1', Z:'2', z:'2', S:'5', s:'5', B:'8', G:'6', b:'6', g:'9', q:'9' });

function cleanLine(value = '') {
  return String(value).replace(/[\u00a0\t]+/g, ' ').replace(/[•·]{2,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function isUsableLine(line = '') {
  if (!line || line.length > 120 || GARBAGE_LINE.test(line)) return false;
  const visible = line.replace(/\s/g, '');
  if (!visible) return false;
  const meaningful = (line.match(/[A-Za-zÀ-ÿ0-9]/g) || []).length;
  return meaningful / visible.length >= 0.55;
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

function hasAmountAnchor(line = '') {
  return AMOUNT_ANCHOR.test(line) || AMOUNT_ANCHOR_FUZZY.test(line);
}

function amountTokens(text = '') {
  const digit = '[0-9OoQDI|lZzSsBGbgq]';
  const loose = new RegExp(`(?:${digit}[\\s.,'’\\-]*){4,9}`, 'gi');
  return (String(text).match(loose) || [])
    .map((token) => token.trim())
    .filter((token) => (deconfuseNumeric(token).match(/\d/g) || []).length >= 4);
}

function extractAmount(lines = [], phones = []) {
  const candidates = [];
  const phoneSet = new Set(phones.map((item) => item.local));
  const stopLabel = /\b(?:taille|size|pointure|qty|quantit[eé]|tel|phone|ref(?:erence)?|style|sku|code)\b/i;

  const consider = (text, lineIndex, score) => {
    if (!text) return;
    for (const token of amountTokens(text)) {
      const value = parseAmountToken(token);
      if (!value || phoneSet.has(normalizePhone(token))) continue;
      const normalizedToken = deconfuseNumeric(token).replace(/[^\d]/g, '');
      if (normalizedToken.length === 10 && PHONE_PREFIXES.has(normalizedToken.slice(0, 3))) continue;
      candidates.push({ value, score, lineIndex });
    }
  };

  lines.forEach((line, lineIndex) => {
    if (phones.some(({ raw, local }) => line.includes(raw) || normalizePhone(line).includes(local))) return;

    const anchored = hasAmountAnchor(line);
    const hasCurrency = /\b(?:ar|mga)\b/i.test(line);

    if (anchored) {
      const anchor = line.match(AMOUNT_ANCHOR_FUZZY) || line.match(AMOUNT_ANCHOR);
      const after = anchor ? line.slice((anchor.index || 0) + anchor[0].length) : line;
      const sameLine = after.split(stopLabel)[0].slice(0, 48);
      consider(sameLine, lineIndex, 12 + (hasCurrency ? 3 : 0));

      if (!amountTokens(sameLine).length) {
        for (let offset = 1; offset <= 2; offset += 1) {
          const next = lines[lineIndex + offset];
          if (!next || stopLabel.test(next) || hasAmountAnchor(next)) break;
          const nextHasCurrency = /\b(?:ar|mga)\b/i.test(next);
          consider(next.slice(0, 48), lineIndex + offset, 10 - offset + (nextHasCurrency ? 3 : 0));
          if (amountTokens(next).length) break;
        }
      }
      return;
    }

    if (hasCurrency) consider(line.slice(0, 56), lineIndex, 8);
  });

  candidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
  return candidates[0] || { value: 0, score: 0, lineIndex: -1 };
}

function explicitNameFromLine(line = '') {
  const match = line.match(/(?:destinataire|recipient|receiver|client|customer|nom|name|deliver\s+to|livrer\s+[àa])\s*[:\-]?\s*(.+)$/i);
  if (!match) return '';
  const value = cleanLine(match[1]);
  return value && !OPERATION_WORDS.test(value) && !ADDRESS_CUES.test(value) && !MANUFACTURING_NOISE.test(value) ? value : '';
}

function scoreName(line = '', index = -1, phoneLineIndex = -1) {
  if (!isUsableLine(line) || line.length < 3 || line.length > 70) return -99;
  if (OPERATION_WORDS.test(line) || ADDRESS_LABEL.test(line) || ADDRESS_CUES.test(line) || MANUFACTURING_NOISE.test(line) || SIZE_ANCHOR.test(line) || AMOUNT_ANCHOR.test(line)) return -99;
  const digits = (line.match(/\d/g) || []).length;
  if (digits >= 2) return -99;
  const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const words = line.split(/\s+/).filter(Boolean).length;
  if (letters < 3 || words > 6) return -99;
  let score = letters / Math.max(1, line.length) * 4;
  if (words >= 2 && words <= 5) score += 2;
  if (/\b(mr|mme|m|madame|monsieur)\.?\b/i.test(line)) score += 1;
  if (phoneLineIndex >= 0 && index === phoneLineIndex - 1) score += 5;
  else if (phoneLineIndex >= 0 && Math.abs(index - phoneLineIndex) <= 2) score += 2;
  if (LOCATION_HINTS.test(line)) score -= 4;
  return score;
}

function scoreAddress(line = '') {
  if (!isUsableLine(line) || line.length < 4 || OPERATION_WORDS.test(line) || AMOUNT_ANCHOR.test(line) || MANUFACTURING_NOISE.test(line) || SIZE_ANCHOR.test(line)) return -99;
  let score = 0;
  if (ADDRESS_LABEL.test(line)) score += 10;
  if (ADDRESS_CUES.test(line)) score += 7;
  if (LOCATION_HINTS.test(line)) score += 2;
  if (/\d/.test(line) && /[A-Za-zÀ-ÿ]/.test(line)) score += 1;
  return score;
}

function cleanAddressLine(line = '') {
  return cleanLine(line
    .replace(/^(?:adresse|address|lieu\s+de\s+livraison|delivery\s+address)\s*[:\-]?\s*/i, '')
    .replace(ADDRESS_CUES_GLOBAL, ' ')
    .replace(/\s*[,;]\s*/g, ', ')
    .replace(/^[,:;\-\s]+|[,:;\-\s]+$/g, ''));
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
  if (!isUsableLine(line) || line.length < 3 || line.length > 40) return false;
  if (OPERATION_WORDS.test(line) || CONTACT_ANCHOR.test(line) || ADDRESS_LABEL.test(line) || ADDRESS_CUES.test(line) || AMOUNT_ANCHOR.test(line) || SIZE_ANCHOR.test(line) || MANUFACTURING_NOISE.test(line) || LOCATION_HINTS.test(line)) return false;
  if (/\d/.test(line) || /[:=]/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return false;
  const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return letters >= 4 && letters / Math.max(1, line.length) > .75;
}

function extractItem(lines = [], excluded = new Set(), amount = 0) {
  const size = extractSize(lines);
  if (!size && !amount) return { brand: '', size: '', note: '' };
  const brandLine = lines.find((line, index) => !excluded.has(index) && likelyBrandLine(line)) || '';
  return { brand: brandLine, size, note: [brandLine, size ? `Size ${size}` : ''].filter(Boolean).join(' · ') };
}

function confidenceScore(result) {
  let score = 0;
  if (result.name) score += .30;
  if (result.phone) score += .42;
  if (result.address) score += .20;
  if (result.amount) score += .08;
  return Math.min(1, score);
}

export function extractContact(text = '') {
  const normalized = String(text).replace(/\r/g, '\n').replace(/[\u00a0\t]+/g, ' ');
  const rawLines = normalized.split(/\n+/).map(cleanLine).filter(Boolean);
  const lines = rawLines.filter(isUsableLine);
  const rejectedNoise = rawLines.length - lines.length;
  const phones = phoneCandidates(lines.join('\n'));
  const phone = phones[0]?.local || '';
  const phoneLineIndex = lines.findIndex((line) => phones.some(({ raw, local }) => line.includes(raw) || normalizePhone(line).includes(local)));
  const explicitName = lines.map(explicitNameFromLine).find(Boolean) || '';
  const hasExplicitContactAnchor = lines.some((line) => CONTACT_ANCHOR.test(line));
  const contactEvidence = Boolean(phone || explicitName || hasExplicitContactAnchor);

  const rankedNames = lines.map((line, index) => ({ line, index, score: scoreName(line, index, phoneLineIndex) }))
    .filter((item) => item.score >= (phone ? 5 : 8))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const nameCandidate = rankedNames[0] || null;
  const name = explicitName || (contactEvidence ? (nameCandidate?.line || '') : '');

  const amountMatch = extractAmount(lines, phones);
  const canUseAddress = Boolean(phone || explicitName || hasExplicitContactAnchor || lines.some((line) => ADDRESS_LABEL.test(line)));
  const addressCandidates = canUseAddress ? lines.map((line, index) => ({ line, index, score: scoreAddress(line) }))
    .filter((item) => item.line !== name)
    .filter((item) => !phones.some(({ raw, local }) => item.line.includes(raw) || normalizePhone(item.line).includes(local)))
    .filter((item) => ADDRESS_LABEL.test(item.line) || ADDRESS_CUES.test(item.line) || (phone && LOCATION_HINTS.test(item.line)))
    .filter((item) => item.score >= 7)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index) : [];
  const address = addressCandidates.map((item) => cleanAddressLine(item.line)).filter((line) => line.length >= 3).join(', ');

  const excluded = new Set(addressCandidates.map((item) => item.index));
  if (nameCandidate && name) excluded.add(nameCandidate.index);
  if (phoneLineIndex >= 0) excluded.add(phoneLineIndex);
  if (amountMatch.lineIndex >= 0) excluded.add(amountMatch.lineIndex);
  const item = extractItem(lines, excluded, amountMatch.value);

  const nameConfidence = name ? (explicitName ? 1 : Math.min(1, (nameCandidate?.score || 0) / 10)) : 0;
  const addressConfidence = address ? Math.min(1, addressCandidates.reduce((sum, entry) => sum + entry.score, 0) / 14) : 0;
  const result = {
    name: nameConfidence >= .55 ? name : '',
    phone,
    address: addressConfidence >= .55 ? address : '',
    amount: amountMatch.value,
    item,
    raw: normalized,
    confidence: {
      name: nameConfidence,
      phone: phone ? 1 : 0,
      address: addressConfidence,
      amount: amountMatch.value ? Math.min(1, amountMatch.score / 12) : 0,
      item: item.note ? .8 : 0,
    },
    diagnostics: { linesRead: rawLines.length, linesAccepted: lines.length, noiseRejected: rejectedNoise },
  };
  result.confidence.overall = confidenceScore(result);
  result.contactDetected = Boolean(result.name || result.phone || result.address);
  return result;
}

function betterResult(a, b) {
  const score = (item) => (item.confidence?.overall || 0) + (item.phone ? .12 : 0) + (item.name ? .05 : 0) + (item.address ? .05 : 0) + (item.amount ? .10 : 0) + (item.item?.note ? .02 : 0);
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
    const completeContact = best.phone && best.name && best.address;
    const usefulProduct = best.amount && best.confidence?.amount >= .65;
    if (completeContact || usefulProduct || (best.confidence?.overall || 0) >= .72) return { ...best, scanPass: 'primary' };

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
