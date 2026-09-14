import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContact } from '../src/services/ocr.js';

test('OCR extracts Malagasy phone despite common digit glyph confusion', () => {
  const out = extractContact('RAKOTO Jean\nTEL: O34 12 345 67\nLot II M 45 Antananarivo');
  assert.equal(out.phone, '0341234567');
  assert.equal(out.name, 'RAKOTO Jean');
  assert.match(out.address, /Lot II M 45 Antananarivo/i);
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
