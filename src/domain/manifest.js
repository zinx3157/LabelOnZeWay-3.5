import { asNumber } from './money.js';

export const PARCEL_STATUSES = Object.freeze(['ready','dispatch','in-transit','delivery','delivered','exception']);

export function updateParcelStatuses(parcels, ids, status) {
  if (!PARCEL_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  const selected = new Set(ids);
  return parcels.map((parcel) => selected.has(parcel.id) ? { ...parcel, status, statusUpdatedAt: new Date().toISOString() } : parcel);
}

export function reconciliationTotals(parcels) {
  return parcels.reduce((totals, parcel) => {
    const collect = asNumber(parcel.collect);
    totals.parcels += 1;
    totals.quantity += asNumber(parcel.qty);
    totals.collect += collect;
    if (parcel.status === 'delivered') totals.deliveredCollect += collect;
    else totals.outstandingCollect += collect;
    return totals;
  }, { parcels: 0, quantity: 0, collect: 0, deliveredCollect: 0, outstandingCollect: 0 });
}
