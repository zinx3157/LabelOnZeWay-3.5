import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCollect } from '../src/domain/money.js';
import { makePickId } from '../src/domain/ids.js';
import { PARCEL_STATUSES, reconciliationTotals, updateParcelStatuses } from '../src/domain/manifest.js';
import { bytesToBase64, manifestEscPos } from '../src/domain/escpos.js';
import { labelPdfBytes } from '../src/domain/pdf.js';
import { extractContact } from '../src/services/ocr.js';

test('Collect is quantity multiplied by unit price', () => {
  assert.equal(calculateCollect(3, 12500), 37500);
  assert.equal(calculateCollect(-1, 100), 0);
});

test('Pick IDs are date based and sequential', () => {
  const now = new Date('2026-09-13T10:00:00Z');
  assert.equal(makePickId([], now), '130926-1');
  assert.equal(makePickId([{ pickId: '130926-1' }], now), '130926-2');
});

test('Every operational status is accepted and invalid statuses are rejected', () => {
  for (const status of PARCEL_STATUSES) {
    const output = updateParcelStatuses([{ id: 'a', status: 'ready' }], ['a'], status);
    assert.equal(output[0].status, status);
    assert.ok(output[0].statusUpdatedAt);
  }
  assert.throws(() => updateParcelStatuses([{ id: 'a', status: 'ready' }], ['a'], 'lost-in-space'), /Invalid status/);
});

test('Bulk status updates preserve unselected parcels', () => {
  const input = [{ id: 'a', status: 'ready' }, { id: 'b', status: 'ready' }];
  const output = updateParcelStatuses(input, ['a'], 'dispatch');
  assert.equal(output[0].status, 'dispatch');
  assert.equal(output[1].status, 'ready');
});

test('Reconciliation uses one consistent financial model', () => {
  const totals = reconciliationTotals([
    { qty: 2, collect: 1000, status: 'delivered' },
    { qty: 3, collect: 2500, status: 'ready' },
  ]);
  assert.deepEqual(totals, { parcels: 2, quantity: 5, collect: 3500, deliveredCollect: 1000, outstandingCollect: 2500 });
});

test('OCR contact parser accepts Madagascar mobile prefixes and filters address noise', () => {
  const contact = extractContact('Rakoto Jean\nLOT 22 RUE Andraharo\n034 12 345 67\nAntananarivo');
  assert.equal(contact.name, 'Rakoto Jean');
  assert.equal(contact.phone, '0341234567');
  assert.match(contact.address, /Andraharo/);
  assert.doesNotMatch(contact.address, /LOT|RUE/i);
});

test('Dependency-free label PDF is structurally valid', () => {
  const bytes = labelPdfBytes({ pickId: '130926-1', customer: { name: 'Rakoto' }, qty: 2, unitPrice: 1000, collect: 2000, status: 'ready' });
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /xref/);
  assert.match(text, /PICK 130926-1/);
  assert.match(text, /%%EOF$/);
});

test('72mm manifest ESC/POS contains rows and cut command', () => {
  const bytes = manifestEscPos([{ pickId: '130926-1', customer: { name: 'Rakoto Jean' }, qty: 2, collect: 2000, status: 'dispatch' }]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /130926-1/);
  assert.match(text, /Rakoto Jean/);
  assert.equal(bytes.at(-4), 0x1d);
  assert.equal(bytes.at(-3), 0x56);
  assert.ok(bytesToBase64(bytes).length > 20);
});

test('Repeated status/reconciliation loop remains deterministic', () => {
  let parcels = Array.from({ length: 50 }, (_, index) => ({ id: String(index), qty: 1, collect: 100, status: 'ready' }));
  for (let cycle = 0; cycle < 200; cycle += 1) {
    const selected = parcels.filter((_, index) => index % 2 === cycle % 2).map((item) => item.id);
    parcels = updateParcelStatuses(parcels, selected, cycle % 3 === 0 ? 'dispatch' : 'delivery');
    const totals = reconciliationTotals(parcels);
    assert.equal(totals.parcels, 50);
    assert.equal(totals.collect, 5000);
  }
});
