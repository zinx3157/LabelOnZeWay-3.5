function normalizeMadagascarWhatsApp(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('261')) return digits;
  if (digits.startsWith('0')) return `261${digits.slice(1)}`;
  return digits;
}

function messageFor(parcel, kind = 'status') {
  const name = parcel.customer?.name || 'Client';
  const pick = parcel.pickId || '';
  const status = String(parcel.status || 'processing').replace('-', ' ');
  if (kind === 'reminder') return `Bonjour ${name}, rappel LabelOnZeWay pour votre colis ${pick}. Statut: ${status}.`;
  return `Bonjour ${name}, mise à jour LabelOnZeWay: colis ${pick}, statut ${status}.`;
}

export function createMessagingService() {
  function whatsapp(parcel, kind = 'status') {
    const phone = normalizeMadagascarWhatsApp(parcel.customer?.phone);
    if (!phone) throw new Error('Customer phone is missing');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageFor(parcel, kind))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return url;
  }

  function sms(parcel, kind = 'status') {
    const phone = String(parcel.customer?.phone || '').trim();
    if (!phone) throw new Error('Customer phone is missing');
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    const url = `sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(messageFor(parcel, kind))}`;
    location.href = url;
    return url;
  }

  return { whatsapp, sms, messageFor };
}
