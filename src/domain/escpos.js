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

export function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
