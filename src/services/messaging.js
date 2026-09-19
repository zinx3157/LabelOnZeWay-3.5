import { normalizeMadagascarWhatsApp, renderTemplate, DEFAULT_NOTIFY_TEMPLATES } from '../domain/notifications.js';

function messageFor(parcel, kind = 'status', templates) {
  const tpl = { ...DEFAULT_NOTIFY_TEMPLATES, ...(templates || {}) };
  return renderTemplate(kind === 'reminder' ? tpl.reminder : tpl.update, parcel);
}

export function createMessagingService() {
  function whatsapp(parcel, kind = 'status', templates) {
    const phone = normalizeMadagascarWhatsApp(parcel.customer?.phone);
    if (!phone) throw new Error('Customer phone is missing');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageFor(parcel, kind, templates))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return url;
  }

  function sms(parcel, kind = 'status', templates) {
    const phone = String(parcel.customer?.phone || '').trim();
    if (!phone) throw new Error('Customer phone is missing');
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    const url = `sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(messageFor(parcel, kind, templates))}`;
    location.href = url;
    return url;
  }

  return { whatsapp, sms, messageFor };
}
