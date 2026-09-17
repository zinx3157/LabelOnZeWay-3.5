export function makePickId(existing, now = new Date()) {
  // Accepts one collection or several (e.g. [parcels, archive]) so the sequence
  // can never restart when parcels move out of the active manifest.
  const items = (Array.isArray(existing) ? existing.flat(1) : [existing]).filter(Boolean);
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const prefix = `${day}${month}${year}`;
  const taken = new Set(items.map((item) => String(item.pickId || '')));
  let count = items.filter((item) => String(item.pickId || '').startsWith(prefix)).length + 1;
  let pickId = `${prefix}-${count}`;
  while (taken.has(pickId)) { count += 1; pickId = `${prefix}-${count}`; }
  return pickId;
}

export function makeId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}
