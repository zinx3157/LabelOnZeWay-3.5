function pdfEscape(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)').replaceAll(/[^\x20-\x7E]/g, '?');
}

export function labelPdfBytes(parcel, brand = 'LZWay') {
  const lines = [
    brand,
    `PICK ${parcel.pickId || 'PENDING'}`,
    parcel.customer?.name || '',
    parcel.customer?.phone || '',
    parcel.customer?.address || '',
    `QTY ${parcel.qty ?? 1}`,
    `UNIT ${parcel.unitPrice ?? 0} AR`,
    `COLLECT ${parcel.collect ?? 0} AR`,
    parcel.status ? `STATUS ${String(parcel.status).toUpperCase()}` : '',
    parcel.notes || '',
  ].filter(Boolean);

  const content = ['BT', '/F1 12 Tf', '36 800 Td'];
  lines.forEach((line, index) => {
    if (index) content.push('0 -22 Td');
    content.push(`(${pdfEscape(line)}) Tj`);
  });
  content.push('ET');
  const stream = content.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
