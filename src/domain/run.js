// Pure helpers for the daily courier run sheet ("tournée du jour").
// A run is the set of stops a courier works on a given day: every active
// parcel plus the parcels delivered that day, ordered the way a courier
// actually drives them (furthest along the lifecycle first).

export const RUN_STATUS_ORDER = ['ready', 'dispatch', 'in-transit', 'delivery', 'delivered'];

// Work order: finish what is already out before starting new drops.
const WORK_ORDER = ['delivery', 'in-transit', 'dispatch', 'ready'];

const LABELS = {
  ready: 'Ready',
  dispatch: 'Dispatch',
  'in-transit': 'In transit',
  delivery: 'Out for delivery',
  delivered: 'Delivered',
};

export function runStatusLabel(status) {
  return LABELS[status] || String(status || '');
}

export function nextRunStatus(status) {
  const index = RUN_STATUS_ORDER.indexOf(status);
  if (index < 0 || index >= RUN_STATUS_ORDER.length - 1) return '';
  return RUN_STATUS_ORDER[index + 1];
}

// Same day key as settlements: UTC date part of the status timestamp.
export function isoDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function dayOf(parcel) {
  return String(parcel?.statusUpdatedAt || parcel?.createdAt || '').slice(0, 10);
}

export function runCouriers(state) {
  const names = new Set();
  for (const parcel of state?.parcels || []) {
    if (parcel?.courier) names.add(String(parcel.courier));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function runStops(state, { date = isoDay(), courier = '' } = {}) {
  const wanted = String(courier || '').trim().toLowerCase();
  const stops = (state?.parcels || []).filter((parcel) => {
    if (!parcel || !parcel.id) return false;
    if (wanted && String(parcel.courier || '').toLowerCase() !== wanted) return false;
    if (parcel.status === 'delivered') return dayOf(parcel) === date;
    if (['exception', 'returned', 'cancelled'].includes(parcel.status)) return false;
    return RUN_STATUS_ORDER.includes(parcel.status);
  });
  return stops.sort((a, b) => {
    const done = (a.status === 'delivered' ? 1 : 0) - (b.status === 'delivered' ? 1 : 0);
    if (done !== 0) return done;
    const work = WORK_ORDER.indexOf(a.status) - WORK_ORDER.indexOf(b.status);
    if (work !== 0) return work;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

export function runTotals(stops = []) {
  let done = 0;
  let expectedAr = 0;
  let collectedAr = 0;
  for (const stop of stops) {
    const collect = Number(stop?.collect) || 0;
    if (collect > 0) expectedAr += collect;
    if (stop?.status === 'delivered') {
      done += 1;
      collectedAr += collect;
    }
  }
  return { total: stops.length, done, expectedAr, collectedAr };
}

export function stopAddress(stop) {
  return String(stop?.customer?.address || stop?.address || '').trim();
}

export function stopMapUrl(stop) {
  const address = stopAddress(stop);
  if (!address) return '';
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
}

export function stopTelUrl(stop) {
  const digits = String(stop?.customer?.phone || '').replace(/[^0-9+]/g, '');
  if (!digits) return '';
  return `tel:${digits.startsWith('+') ? digits : `+${digits}`}`;
}
