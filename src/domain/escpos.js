function encodeText(text) {
  return new TextEncoder().encode(String(text ?? ''));
}

function concat(...parts) {
  const length = parts.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function clip(value, width) {
  const text = String(value ?? '');
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
}

export function labelEscPos(parcel) {
  const lines = [
    'LABELONZEWAY',
    `PICK ${parcel.pickId}`,
    parcel.customer?.name || '',
    parcel.customer?.phone || '',
    parcel.customer?.address || '',
    `QTY ${parcel.qty}`,
    `COLLECT ${parcel.collect} AR`,
    parcel.notes || '',
  ].filter(Boolean).join('\n');
  return concat(new Uint8Array([0x1b,0x40]), encodeText(lines + '\n\n'), new Uint8Array([0x1d,0x56,0x42,0x00]));
}

export function manifestEscPos(parcels, title = 'LABELONZEWAY MANIFEST') {
  const rows = [title, '-'.repeat(42)];
  for (const parcel of parcels) {
    rows.push(`${clip(parcel.pickId, 12).padEnd(12)} ${clip(parcel.customer?.name, 18).padEnd(18)} ${String(parcel.qty ?? '').padStart(3)}`);
    rows.push(`  ${clip(parcel.status, 14)}  COLLECT ${String(parcel.collect ?? 0)} AR`);
  }
  rows.push('-'.repeat(42), `${parcels.length} PARCEL${parcels.length === 1 ? '' : 'S'}`);
  return concat(new Uint8Array([0x1b,0x40]), encodeText(rows.join('\n') + '\n\n'), new Uint8Array([0x1d,0x56,0x42,0x00]));
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
