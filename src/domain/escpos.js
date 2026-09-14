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

function leftRight(left, right, width = 42) {
  const a = asciiText(left).trim();
  const b = asciiText(right).trim();
  const gap = Math.max(1, width - a.length - b.length);
  return `${a}${' '.repeat(gap)}${b}`.slice(0, width);
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
  inverseOn: new Uint8Array([0x1d,0x42,0x01]),
  inverseOff: new Uint8Array([0x1d,0x42,0x00]),
  feed1: new Uint8Array([0x1b,0x64,0x01]),
  cut: new Uint8Array([0x1d,0x56,0x42,0x00]),
};

function line(text = '') { return encodeText(`${text}\n`); }

function qrCommands(data) {
  const body = encodeText(data);
  const storeLength = body.length + 3;
  return concat(
    new Uint8Array([0x1d,0x28,0x6b,0x04,0x00,0x31,0x41,0x32,0x00]),
    new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x43,0x06]),
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
  return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}` };
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
  const stamp = localStamp(created);
  const qrData = options.trackingUrl || parcel.trackingUrl || parcel.trackingToken || parcel.pickId || 'LabelOnZeWay';
  const addressLines = wrap(parcel.customer?.address || '', 42, 3);
  const collect = Number(parcel.collect || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const delivery = Number(parcel.deliveryCharge || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const paymentMode = asciiText(parcel.paymentMode || 'Especes');
  const divider = '------------------------------------------';

  const parts = [CMD.init, CMD.left, CMD.normal];

  // Header mirrors the browser preview: brand left, date/time right.
  parts.push(CMD.boldOn, line(leftRight('LABELONZEWAY', stamp.date)), CMD.boldOff);
  parts.push(line(leftRight('Ship Smarter. Deliver Further.', stamp.time)), line(divider));

  // Pick + quantity block kept on the same visual row.
  parts.push(CMD.boldOn, line(leftRight('PICK', 'QTY')));
  parts.push(CMD.double, line(leftRight(parcel.pickId, String(parcel.qty), 21)), CMD.normal, CMD.boldOff);
  parts.push(line(divider));

  // Tracking QR sits high on the label, directly after the identity block.
  parts.push(CMD.center, qrCommands(qrData), CMD.boldOn, line('SCAN POUR SUIVRE'), CMD.boldOff, CMD.left, line(divider));

  // Recipient hierarchy.
  parts.push(CMD.boldOn, line('DESTINATAIRE'), CMD.doubleWidth, line(clip(parcel.customer?.name || '', 21)), CMD.normal, CMD.boldOff);
  if (parcel.customer?.phone) parts.push(CMD.boldOn, line(`TEL  ${parcel.customer.phone}`), CMD.boldOff);
  for (const addressLine of addressLines) parts.push(line(addressLine));
  parts.push(line(divider));

  // Collect block with strong visual emphasis.
  parts.push(CMD.center, CMD.boldOn, line('A COLLECTER'), CMD.double, line(`${collect} Ar`), CMD.normal, CMD.boldOff);
  parts.push(line(`Mode ${paymentMode}`));
  if (Number(parcel.deliveryCharge || 0) > 0) parts.push(line(`Livraison ${delivery} Ar`));
  parts.push(CMD.left, line(divider));

  // Delivery block.
  parts.push(CMD.boldOn, line(leftRight('LIVRAISON PREVUE', nextDay(created))), CMD.boldOff);
  parts.push(line(leftRight('Cree', stamp.time)), line(divider));

  if (parcel.notes) {
    parts.push(CMD.boldOn, line('NOTES'), CMD.boldOff);
    for (const noteLine of wrap(parcel.notes, 42, 2)) parts.push(line(noteLine));
    parts.push(line(divider));
  }

  parts.push(CMD.center, CMD.boldOn, line('Misaotra betsaka !'), line('Merci pour votre confiance !'), CMD.boldOff);
  parts.push(line('LABELONZEWAY | PEOPLE. PARCELS. PROGRESS.'), line(''), line(''), CMD.cut);
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
