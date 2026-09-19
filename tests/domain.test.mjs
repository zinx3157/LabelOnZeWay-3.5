import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCollect } from '../src/domain/money.js';
import { makePickId } from '../src/domain/ids.js';
import { PARCEL_STATUSES, parcelStatusCounts, reconciliationTotals, updateParcelStatuses } from '../src/domain/manifest.js';
import { CSV_BOM, csvDocument, csvEscape } from '../src/domain/csv.js';
import { bytesToBase64, labelEscPos, manifestEscPos } from '../src/domain/escpos.js';
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

test('Reconciliation separates merchandise Collect from delivery revenue', () => {
  const totals = reconciliationTotals([
    { qty: 2, collect: 1000, deliveryCharge: 200, status: 'delivered' },
    { qty: 3, collect: 2500, deliveryCharge: 300, status: 'ready' },
  ]);
  assert.deepEqual(totals, {
    parcels: 2,
    quantity: 5,
    collect: 3500,
    deliveryRevenue: 500,
    totalReceivable: 4000,
    deliveredCollect: 1000,
    deliveredDeliveryRevenue: 200,
    outstandingCollect: 2500,
    outstandingDeliveryRevenue: 300,
  });
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

test('Approved 72mm label ESC/POS contains hierarchy, QR and cut command', () => {
  const bytes = labelEscPos({
    pickId: '140926-1',
    trackingToken: 'trk_test',
    customer: { name: 'Nadia Rapanarivo', phone: '034 14 183 34', address: 'Taxi Brousse Vatsi' },
    qty: 1,
    collect: 15000,
    deliveryCharge: 1500,
    createdAt: '2026-09-14T17:34:00+03:00',
  }, { trackingUrl: 'https://example.com/?track=trk_test#/tracking' });
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /LZWAY/);
  assert.match(text, /PICK\s+QTY/);
  assert.match(text, /140926-1\s+1/);
  assert.match(text, /Nadia Rapanarivo/);
  assert.match(text, /TEL\s+034 14 183 34/);
  assert.match(text, /Taxi Brousse Vatsi/);
  assert.match(text, /A COLLECTER/);
  assert.match(text, /15 000 Ar/);
  assert.match(text, /Livraison 1 500 Ar/);
  assert.match(text, /LIVRAISON PREVUE/);
  assert.match(text, /SCAN POUR SUIVRE/);
  assert.ok(bytes.some((value, index) => value === 0x1d && bytes[index + 1] === 0x28 && bytes[index + 2] === 0x6b), 'QR command must be present');
  assert.deepEqual(Array.from(bytes.slice(-4)), [0x1d,0x56,0x42,0x00]);
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
  let parcels = Array.from({ length: 50 }, (_, index) => ({ id: String(index), qty: 1, collect: 100, deliveryCharge: 10, status: 'ready' }));
  for (let cycle = 0; cycle < 200; cycle += 1) {
    const selected = parcels.filter((_, index) => index % 2 === cycle % 2).map((item) => item.id);
    parcels = updateParcelStatuses(parcels, selected, cycle % 3 === 0 ? 'dispatch' : 'delivery');
    const totals = reconciliationTotals(parcels);
    assert.equal(totals.parcels, 50);
    assert.equal(totals.collect, 5000);
    assert.equal(totals.deliveryRevenue, 500);
    assert.equal(totals.totalReceivable, 5500);
  }
});

test('Pick IDs never restart when parcels leave the active manifest', () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const active = [];
  for (let i = 0; i < 3; i += 1) active.push({ id: `p${i}`, pickId: makePickId(active, now) });
  assert.deepEqual(active.map((item) => item.pickId), ['150926-1', '150926-2', '150926-3']);
  // "Close delivered": the three move to the archive and the manifest empties.
  assert.equal(makePickId([[], active], now), '150926-4', 'archive must count towards the sequence');
  assert.equal(makePickId(active, now), '150926-4', 'a flat archive array behaves the same');
});

test('Pick ID generation skips sequence numbers already taken', () => {
  const now = new Date('2026-09-15T10:00:00Z');
  // count would offer -2, which is taken, so it must advance to -3
  assert.equal(makePickId([{ pickId: '150926-2' }], now), '150926-3');
  assert.equal(makePickId([{ pickId: '150926-1' }, { pickId: '150926-2' }], now), '150926-3');
});

test('Status counts cover every operational status exactly once', () => {
  const parcels = [
    { status: 'ready' }, { status: 'ready' }, { status: 'dispatch' }, { status: 'in-transit' },
    { status: 'delivery' }, { status: 'delivery' }, { status: 'delivery' },
    { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' },
    { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'exception' },
  ];
  const counts = parcelStatusCounts(parcels);
  assert.equal(counts.ready, 2);
  assert.equal(counts.dispatch + counts['in-transit'], 2);
  assert.equal(counts.delivery, 3);
  assert.equal(counts.delivered, 7, 'delivered must not fall back to the out-for-delivery count');
  assert.equal(counts.exception, 1);
  assert.equal(parcelStatusCounts([{ status: 'lost-in-space' }]).delivered, 0);
});

test('CSV export neutralises formula triggers and preserves quoting', () => {
  assert.equal(csvEscape('Rakoto'), '"Rakoto"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape(''), '""');
  assert.equal(csvEscape('=1+1'), '"\'=1+1"');
  assert.equal(csvEscape('+CMD'), '"\'+CMD"');
  assert.equal(csvEscape('-500'), '"\'-500"');
  assert.equal(csvEscape('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(CSV_BOM + csvDocument([['Pick', 'Customer'], ['150926-1', '=HYPERLINK("http://x")']]),
    '\uFEFF"Pick","Customer"\n"150926-1","\'=HYPERLINK(""http://x"")"');
});

import { buildPod, podIssues, podIsUsable, podGpsLink, POD_PHOTO_MAX_LENGTH } from '../src/domain/pod.js';

test('POD records coerce coordinates, enforce the size budget and build GPS links', () => {
  const pod = buildPod({ photo: 'data:image/jpeg;base64,x', signature: '', lat: '-18.8792', lng: '47.5079', by: 'Agency A' });
  assert.equal(pod.lat, -18.8792);
  assert.equal(pod.lng, 47.5079);
  assert.equal(podIssues(pod).length, 0);
  assert.ok(podIsUsable(pod));
  assert.match(podGpsLink(pod), /openstreetmap.*mlat=-18\.8792/);
  const huge = buildPod({ photo: 'x'.repeat(POD_PHOTO_MAX_LENGTH + 1) });
  assert.deepEqual(podIssues(huge), ['Photo exceeds the size budget']);
  assert.equal(podIsUsable(huge), false);
  assert.deepEqual(podIssues(buildPod({})), ['POD has no photo, signature or position']);
  assert.equal(podGpsLink(buildPod({ photo: 'p' })), '');
});
