// COD settlement sheets: pure maths over parcels so cash reconciliation is
// testable without a DOM. A settlement records what a courier was expected to
// bring back for a given day versus what was actually counted.
import { asNumber } from './money.js';
import { csvDocument } from './csv.js';
import { makeId } from './ids.js';

// Statuses where the collect amount has turned (or is turning) into cash.
export const COD_STATUSES = Object.freeze(['delivered', 'delivery']);

function parcelDay(parcel) {
  return String(parcel?.statusUpdatedAt || parcel?.createdAt || '').slice(0, 10);
}

export function settlementParcels(state, { date = '', courier = '' } = {}) {
  const needle = String(courier || '').trim().toLowerCase();
  return (state?.parcels || []).filter((parcel) => {
    if (date && parcelDay(parcel) !== String(date)) return false;
    if (needle && String(parcel.courier || '').trim().toLowerCase() !== needle) return false;
    return COD_STATUSES.includes(String(parcel.status || '')) && asNumber(parcel.collect) > 0;
  });
}

export function buildSettlementSheet(state, { date = '', courier = '' } = {}) {
  const rows = settlementParcels(state, { date, courier }).map((parcel) => ({
    parcelId: parcel.id,
    pickId: parcel.pickId || '',
    customer: parcel.customer?.name || '',
    status: String(parcel.status || ''),
    collect: asNumber(parcel.collect),
  }));
  const expectedAr = rows.reduce((sum, row) => sum + row.collect, 0);
  return { date: String(date || ''), courier: String(courier || '').trim(), rows, expectedAr };
}

export function createSettlement(sheet, { collectedAr, method = 'cash', note = '', by = '', now = new Date() } = {}) {
  const expected = asNumber(sheet?.expectedAr);
  const collected = asNumber(collectedAr);
  return {
    id: makeId('settle'),
    date: String(sheet?.date || ''),
    courier: String(sheet?.courier || ''),
    expectedAr: expected,
    collectedAr: collected,
    varianceAr: collected - expected,
    method: String(method || 'cash'),
    note: String(note || ''),
    by: String(by || ''),
    parcelCount: (sheet?.rows || []).length,
    parcels: (sheet?.rows || []).map((row) => row.pickId),
    createdAt: now.toISOString(),
  };
}

export function settlementIsBalanced(settlement) {
  return Math.abs(asNumber(settlement?.varianceAr)) < 1;
}

export function csvSettlements(settlements) {
  const header = ['Date', 'Courier', 'Parcels', 'Expected Ar', 'Collected Ar', 'Variance Ar', 'Method', 'Note', 'By', 'Created'];
  const rows = (settlements || []).map((item) => [
    item.date, item.courier, item.parcelCount ?? (item.parcels || []).length,
    item.expectedAr, item.collectedAr, item.varianceAr, item.method, item.note, item.by, item.createdAt,
  ]);
  return csvDocument([header, ...rows]);
}
