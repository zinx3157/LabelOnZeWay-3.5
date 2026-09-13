export function makePickId(existing, now = new Date()) {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const prefix = `${day}${month}${year}`;
  const count = existing.filter((item) => String(item.pickId || '').startsWith(prefix)).length + 1;
  return `${prefix}-${count}`;
}

export function makeId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}
