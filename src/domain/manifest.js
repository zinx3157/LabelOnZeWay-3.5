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
    const deliveryCharge = asNumber(parcel.deliveryCharge);
    totals.parcels += 1;
    totals.quantity += asNumber(parcel.qty);
    totals.collect += collect;
    totals.deliveryRevenue += deliveryCharge;
    totals.totalReceivable += collect + deliveryCharge;
    if (parcel.status === 'delivered') {
      totals.deliveredCollect += collect;
      totals.deliveredDeliveryRevenue += deliveryCharge;
    } else {
      totals.outstandingCollect += collect;
      totals.outstandingDeliveryRevenue += deliveryCharge;
    }
    return totals;
  }, {
    parcels: 0,
    quantity: 0,
    collect: 0,
    deliveryRevenue: 0,
    totalReceivable: 0,
    deliveredCollect: 0,
    deliveredDeliveryRevenue: 0,
    outstandingCollect: 0,
    outstandingDeliveryRevenue: 0,
  });
}
