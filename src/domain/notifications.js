// Customer notification engine: pure queue building over parcel state.
// WhatsApp deep-links (wa.me) cost nothing and need no API keys — the app
// composes the message, the operator taps send. Templates live in
// profileSettings.notifyTemplates so they sync across devices with the profile.

export function normalizeMadagascarWhatsApp(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('261')) return digits;
  if (digits.startsWith('0')) return `261${digits.slice(1)}`;
  return digits;
}

export const DEFAULT_NOTIFY_TEMPLATES = Object.freeze({
  reminder: 'Bonjour {name}, rappel LZWay pour votre colis {pick}. Statut: {status}.',
  update: 'Bonjour {name}, mise à jour LZWay: colis {pick}, statut {status}.',
  aging: 'Bonjour {name}, votre colis {pick} vous attend depuis {days} jour(s). Merci de passer le recuperer. LZWay',
  exception: 'Bonjour {name}, un incident concerne votre colis {pick} (statut: {status}). Contactez LZWay, nous vous aidons.',
});

export const NOTIFY_KINDS = Object.freeze(['reminder', 'update', 'aging', 'exception']);
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function parcelStatusText(parcel) {
  return String(parcel?.status || 'processing').replace('-', ' ');
}

export function renderTemplate(template, parcel, extra = {}) {
  const ageDays = extra.days != null ? extra.days : ageInDays(parcel, extra.now);
  return String(template || '')
    .replaceAll('{name}', parcel?.customer?.name || 'Client')
    .replaceAll('{pick}', parcel?.pickId || '')
    .replaceAll('{status}', parcelStatusText(parcel))
    .replaceAll('{days}', String(ageDays));
}

export function waLink(phone, text) {
  const normalized = normalizeMadagascarWhatsApp(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(String(text || ''))}`;
}

export function ageInDays(parcel, now = new Date()) {
  const created = Date.parse(parcel?.createdAt || '');
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / 86400000));
}

export function lastNotifiedAt(parcel, kind) {
  const entries = Array.isArray(parcel?.notifyLog) ? parcel.notifyLog.filter((entry) => entry?.kind === kind) : [];
  return entries.reduce((latest, entry) => Math.max(latest, Date.parse(entry.at) || 0), 0);
}

export function shouldNotify(parcel, kind, { now = new Date() } = {}) {
  const last = lastNotifiedAt(parcel, kind);
  return !last || now.getTime() - last >= COOLDOWN_MS;
}

export function agingParcels(state, { agingDays = 3, now = new Date() } = {}) {
  const days = Math.max(0, Number(agingDays) || 0);
  return (state?.parcels || []).filter((parcel) => String(parcel.status) === 'ready' && ageInDays(parcel, now) >= days);
}

export function buildNotificationQueue(state, { agingDays = 3, now = new Date(), templates = {} } = {}) {
  const tpl = { ...DEFAULT_NOTIFY_TEMPLATES, ...(templates || {}) };
  const items = [];
  for (const parcel of state?.parcels || []) {
    if (!parcel?.customer?.phone) continue;
    const days = ageInDays(parcel, now);
    let kind = '';
    if (String(parcel.status) === 'exception' && shouldNotify(parcel, 'exception', { now })) kind = 'exception';
    else if (String(parcel.status) === 'ready' && days >= Math.max(0, Number(agingDays) || 0) && shouldNotify(parcel, 'aging', { now })) kind = 'aging';
    if (!kind) continue;
    items.push({
      parcelId: parcel.id,
      pickId: parcel.pickId || '',
      name: parcel.customer?.name || 'Client',
      phone: parcel.customer.phone,
      kind,
      days,
      message: renderTemplate(tpl[kind], parcel, { days, now }),
    });
  }
  return items
    .map((item) => ({ ...item, waUrl: waLink(item.phone, item.message) }))
    .filter((item) => item.waUrl)
    .sort((a, b) => b.days - a.days);
}
