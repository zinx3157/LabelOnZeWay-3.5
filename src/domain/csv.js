// CSV serialisation shared by every export.
// Leading = + - @ TAB CR are neutralised with a quote prefix so an exported
// cell can never become a live formula when opened in Excel or Sheets.
// (Trade-off: genuinely negative numbers export as text — acceptable for
// this dataset, which stores amounts as non-negative integers.)
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function csvEscape(value) {
  let text = String(value ?? '');
  if (FORMULA_TRIGGERS.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvDocument(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

// Byte-order mark so Excel reads accented French/Malagasy text as UTF-8.
export const CSV_BOM = '\uFEFF';
