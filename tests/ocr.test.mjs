import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContact } from '../src/services/ocr.js';

test('OCR extracts Malagasy phone despite common digit glyph confusion', () => {
  const out = extractContact('RAKOTO Jean\nTEL: O34 12 345 67\nLot II M 45 Antananarivo');
  assert.equal(out.phone, '0341234567');
  assert.equal(out.name, 'RAKOTO Jean');
  assert.match(out.address, /II M 45 Antananarivo/i);
  assert.doesNotMatch(out.address, /LOT/i);
});

test('OCR prefers an anchored amount over unrelated numbers', () => {
  const out = extractContact('RABE Anna\n034 11 222 33\nRue des Fleurs 12\nPRIX: 25 OOO Ar\nRef 998877');
  assert.equal(out.phone, '0341122233');
  assert.equal(out.amount, 25000);
});

test('OCR does not mistake operational labels or address cues for the customer name', () => {
  const out = extractContact('LIVRAISON\nLOT IV F 12\nAndry Randria\nTEL 032 44 555 66\nAnkadifotsy Antananarivo');
  assert.equal(out.name, 'Andry Randria');
  assert.equal(out.phone, '0324455566');
  assert.ok(out.confidence.overall >= 0.6);
});

test('OCR returns zero amount rather than inventing one from phone or pick identifiers', () => {
  const out = extractContact('Miora R.\n039 55 666 77\nCite Analamahitsy\nPICK 140926-12');
  assert.equal(out.amount, 0);
  assert.equal(out.phone, '0395566677');
});

test('OCR classifies a product image without inventing customer data', () => {
  const out = extractContact('TOMMY HILFIGER\nS/P\nMADE IN SRI LANKA\nFABRIQUE AU SRI LANKA\nTaille: S\nPrix: 20 000 Ar');
  assert.equal(out.name, '');
  assert.equal(out.phone, '');
  assert.equal(out.address, '');
  assert.equal(out.contactDetected, false);
  assert.equal(out.amount, 20000);
  assert.equal(out.item.brand, 'TOMMY HILFIGER');
  assert.equal(out.item.size, 'S');
});

test('OCR requires price context instead of treating unrelated product numbers as money', () => {
  const out = extractContact('TOMMY HILFIGER\nSTYLE 998877\nSIZE M\nMADE IN SRI LANKA');
  assert.equal(out.amount, 0);
});

test('OCR aggressively rejects random garment and image noise', () => {
  const out = extractContact('@@@ ///\nS/P\n100% COTTON\nWASH CARE\nMADE IN CHINA\nFACEBOOK INSTAGRAM\n998877\nTOMMY HILFIGER');
  assert.equal(out.name, '');
  assert.equal(out.phone, '');
  assert.equal(out.address, '');
  assert.equal(out.amount, 0);
  assert.equal(out.item.note, '');
  assert.equal(out.contactDetected, false);
  assert.ok(out.diagnostics.noiseRejected >= 1);
});

test('OCR keeps explicit recipient while suppressing nearby unrelated text', () => {
  const out = extractContact('PROMO NEW COLLECTION\nDestinataire: Hasina Rasoa\nTEL 038 25 743 45\nRue Andavamamba Antananarivo\nMADE IN SRI LANKA\nSTYLE 998877');
  assert.equal(out.name, 'Hasina Rasoa');
  assert.equal(out.phone, '0382574345');
  assert.match(out.address, /Andavamamba Antananarivo/i);
  assert.doesNotMatch(out.address, /SRI LANKA|998877/i);
});

test('OCR does not create an address from a standalone location on a product photo', () => {
  const out = extractContact('TOMMY HILFIGER\nMADAGASCAR COLLECTION\nTaille: S\nPrix: 20 000 Ar');
  assert.equal(out.address, '');
  assert.equal(out.contactDetected, false);
});

test('OCR reads price nearest the PRIX anchor on a mixed product line', () => {
  const out = extractContact('TOMMY HILFIGER\nTaille: S Prix: 20 OOO Ar Ref 998877');
  assert.equal(out.amount, 20000);
  assert.equal(out.item.size, 'S');
  assert.equal(out.address, '');
});
