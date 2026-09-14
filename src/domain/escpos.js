function asciiText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function encodeText(text) {
  return new TextEncoder().encode(asciiText(text));
}

function concat(...parts) {
  const length = parts.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function clip(value, width) {
  const text = asciiText(value);
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}.` : text;
}

function wrap(value, width = 42, maxLines = 3) {
  const words = asciiText(value).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line = `${line} ${word}`;
    else { lines.push(line); line = word; }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

const CMD = {
  init: new Uint8Array([0x1b,0x40]),
  left: new Uint8Array([0x1b,0x61,0x00]),
  center: new Uint8Array([0x1b,0x61,0x01]),
  boldOn: new Uint8Array([0x1b,0x45,0x01]),
  boldOff: new Uint8Array([0x1b,0x45,0x00]),
  normal: new Uint8Array([0x1d,0x21,0x00]),
  doubleWidth: new Uint8Array([0x1d,0x21,0x10]),
  double: new Uint8Array([0x1d,0x21,0x11]),
  cut: new Uint8Array([0x1d,0x56,0x42,0x00]),
};

function line(text = '') { return encodeText(`${text}\n`); }

function qrCommands(data) {
  const body = encodeText(data);
  const storeLength = body.length + 3;
  return concat(
    new Uint8Array([0x1d,0x28,0x6b,0x04,0x00,0x31,0x41,0x32,0x00]),
    new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x43,0x05]),
    new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x45,0x31]),
    new Uint8Array([0x1d,0x28,0x6b,storeLength & 0xff,(storeLength >> 8) & 0xff,0x31,0x50,0x30]), body,
    new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x51,0x30]),
  );
}

function localStamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function nextDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + 1);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

export function labelEscPos(parcel, options = {}) {
  const created = parcel.createdAt ? new Date(parcel.createdAt) : new Date();
  const qrData = options.trackingUrl || parcel.trackingUrl || parcel.trackingToken || parcel.pickId || 'LabelOnZeWay';
  const addressLines = wrap(parcel.customer?.address || '', 42, 3);
  const collect = Number(parcel.collect || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const delivery = Number(parcel.deliveryCharge || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const paymentMode = asciiText(parcel.paymentMode || 'Especes');

  const parts = [CMD.init, CMD.left, CMD.normal, CMD.boldOn, line('LABELONZEWAY'), CMD.boldOff, line('Ship Smarter. Deliver Further.'), line(localStamp(created)), line('------------------------------------------')];

  parts.push(CMD.boldOn, CMD.double, line(`PICK ${parcel.pickId}`), CMD.normal, CMD.boldOff, CMD.boldOn, line(`QTY ${parcel.qty}`), CMD.boldOff, line(''));
  parts.push(CMD.boldOn, line('DESTINATAIRE'), CMD.doubleWidth, line(parcel.customer?.name || ''), CMD.normal, CMD.boldOff);
  if (parcel.customer?.phone) parts.push(CMD.boldOn, line(`TEL ${parcel.customer.phone}`), CMD.boldOff);
  for (const addressLine of addressLines) parts.push(line(addressLine));
  parts.push(line('------------------------------------------'));

  parts.push(CMD.center, CMD.boldOn, line('A COLLECTER'), CMD.double, line(`${collect} Ar`), CMD.normal, CMD.boldOff, line(`Mode ${paymentMode}`));
  if (Number(parcel.deliveryCharge || 0) > 0) parts.push(line(`Livraison ${delivery} Ar`));
  parts.push(CMD.left, line('------------------------------------------'), CMD.boldOn, line(`LIVRAISON PREVUE  ${nextDay(created)}`), CMD.boldOff, line(''));

  parts.push(CMD.center, qrCommands(qrData), CMD.boldOn, line('SCAN POUR SUIVRE'), CMD.boldOff, line(''));
  if (parcel.notes) for (const noteLine of wrap(parcel.notes, 42, 2)) parts.push(line(noteLine));
  parts.push(line('Misaotra betsaka ! Merci pour votre confiance !'), line('LABELONZEWAY | PEOPLE. PARCELS. PROGRESS.'), line(''), line(''), CMD.cut);
  return concat(...parts);
}

export function manifestEscPos(parcels, title = 'LABELONZEWAY MANIFEST') {
  const rows = [title, '-'.repeat(42)];
  for (const parcel of parcels) {
    rows.push(`${clip(parcel.pickId, 12).padEnd(12)} ${clip(parcel.customer?.name, 18).padEnd(18)} ${String(parcel.qty ?? '').padStart(3)}`);
    rows.push(`  ${clip(parcel.status, 14)}  COLLECT ${String(parcel.collect ?? 0)} AR`);
  }
  rows.push('-'.repeat(42), `${parcels.length} PARCEL${parcels.length === 1 ? '' : 'S'}`);
  return concat(CMD.init, encodeText(rows.join('\n') + '\n\n'), CMD.cut);
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
