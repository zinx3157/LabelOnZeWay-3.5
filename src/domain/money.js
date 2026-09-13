export function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateCollect(qty, unitPrice) {
  return Math.max(0, asNumber(qty)) * Math.max(0, asNumber(unitPrice));
}

export function formatAr(value) {
  return new Intl.NumberFormat('fr-MG', { maximumFractionDigits: 0 }).format(asNumber(value));
}
