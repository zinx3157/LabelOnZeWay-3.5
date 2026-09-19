// Pure read models for the inline SVG charts. Everything here derives from
// the local parcel list so no new storage or sync surface is introduced.

import { isoDay } from './run.js';

function deliveredRecords(state) {
  return [...(state?.parcels || []), ...(state?.archive || [])].filter((parcel) => parcel && parcel.status === 'delivered');
}

function dayOf(parcel) {
  return String(parcel?.statusUpdatedAt || parcel?.archivedAt || parcel?.createdAt || '').slice(0, 10);
}

// One entry per calendar day, oldest first: delivered count + COD collected.
export function dailySeries(state, { days = 7, now = new Date() } = {}) {
  const records = deliveredRecords(state);
  const series = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const key = isoDay(new Date(now.getTime() - back * 86400000));
    let delivered = 0;
    let codAr = 0;
    for (const parcel of records) {
      if (dayOf(parcel) === key) {
        delivered += 1;
        codAr += Number(parcel.collect) || 0;
      }
    }
    series.push({ date: key, delivered, codAr });
  }
  return series;
}

const BUCKETS = [
  { label: '0-2d', max: 2 },
  { label: '3-5d', max: 5 },
  { label: '6-10d', max: 10 },
  { label: '11d+', max: Infinity },
];

export function agingBuckets(state, { now = new Date() } = {}) {
  const counts = BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
  for (const parcel of state?.parcels || []) {
    if (!parcel || ['delivered', 'returned', 'cancelled'].includes(parcel.status)) continue;
    const created = Date.parse(parcel.createdAt || '');
    if (!Number.isFinite(created)) continue;
    const age = Math.floor((now.getTime() - created) / 86400000);
    const index = BUCKETS.findIndex((bucket) => age <= bucket.max);
    counts[Math.max(0, index)].count += 1;
  }
  return counts;
}

export function exceptionRate(state) {
  const parcels = (state?.parcels || []).filter((parcel) => parcel && parcel.id);
  const exceptions = parcels.filter((parcel) => parcel.status === 'exception').length;
  const total = parcels.length;
  const rate = total ? Math.round((exceptions / total) * 100) : 0;
  return { exceptions, total, rate };
}
