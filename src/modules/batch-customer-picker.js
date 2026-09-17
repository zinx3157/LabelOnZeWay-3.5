// Shared Address Book customer picker for Single Scan and Batch Scan.
function normalize(value = '') { return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function findCard(button) { return button.closest('.batch-card'); }
function fieldsFor(card) {
  if (!card) return null;
  const controls = Array.from(card.querySelectorAll('.batch-fields-v2 input, .batch-fields-v2 textarea'));
  const textControls = controls.filter((node) => node.tagName === 'TEXTAREA' || !['checkbox', 'number'].includes(node.type));
  const name = textControls[0] || controls[0] || null;
  const phone = textControls.find((node) => node.type === 'tel') || textControls[1] || controls[1] || null;
  const address = controls.find((node) => node.tagName === 'TEXTAREA') || textControls.find((node) => node !== name && node !== phone) || controls[2] || null;
  return { name, phone, address };
}
function customersFromState() { try { const state = window.__LZWAY_STORE__?.getState?.(); return Array.isArray(state?.customers) ? state.customers : []; } catch { return []; } }
function result(message = '', tone = '') { document.querySelectorAll('.batch-result').forEach((node) => { node.textContent = message; node.className = `batch-result ${tone}`.trim(); }); }
function setField(node, value) { node.value = value || ''; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }
function applyCustomer(fields, customer) { setField(fields.name, customer.name); setField(fields.phone, customer.phone); setField(fields.address, customer.address); result(`Address Book customer applied · ${customer.name || 'Customer'}`, 'success'); }
export function openCustomerPicker(customers, onPick, options = {}) {
  const approved = Array.isArray(customers) ? customers : [];
  const overlay = document.createElement('div'); overlay.className = 'batch-customer-picker-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Address Book');
  const modal = document.createElement('section'); modal.className = 'batch-customer-picker'; const head = document.createElement('div'); head.className = 'batch-customer-picker-head';
  const title = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = options.title || 'Existing Customers'; const small = document.createElement('small'); small.textContent = `${approved.length} saved customer${approved.length === 1 ? '' : 's'}`; title.append(strong, small);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'secondary'; close.textContent = 'Close'; head.append(title, close);
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search name, phone or address…'; search.autocomplete = 'off'; search.className = 'batch-customer-picker-search'; const list = document.createElement('div'); list.className = 'batch-customer-picker-list';
  function render() { const q = normalize(search.value); const visible = approved.filter((c) => !q || normalize(`${c.name} ${c.phone} ${c.address}`).includes(q)); list.replaceChildren(); if (!visible.length) { const empty = document.createElement('div'); empty.className = 'batch-customer-picker-empty'; empty.textContent = approved.length ? 'No customer found.' : 'No saved customers yet.'; list.append(empty); return; } visible.slice(0, 250).forEach((customer) => { const row = document.createElement('button'); row.type = 'button'; row.className = 'batch-customer-picker-row'; const name = document.createElement('strong'); name.textContent = customer.name || 'Unnamed customer'; const meta = document.createElement('span'); meta.textContent = [customer.phone, customer.address].filter(Boolean).join(' · '); row.append(name, meta); row.addEventListener('click', () => { onPick(customer); overlay.remove(); }); list.append(row); }); }
  close.addEventListener('click', () => overlay.remove()); overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); }); overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); }); search.addEventListener('input', render); modal.append(head, search, list); overlay.append(modal); document.body.append(overlay); render(); search.focus();
}
function install() { document.addEventListener('click', (event) => { const button = event.target.closest?.('button'); if (!button || !button.closest('.batch-row-actions') || !/^(Use saved customer|Use approved customer)$/i.test(button.textContent.trim())) return; event.preventDefault(); event.stopPropagation(); const fields = fieldsFor(findCard(button)); const customers = customersFromState(); if (!fields?.name || !fields?.phone || !fields?.address) { result('Unable to open Address Book for this row.', 'danger'); return; } if (!customers.length) { result('Address Book is empty.', 'warning'); return; } result(); openCustomerPicker(customers, (customer) => applyCustomer(fields, customer), { title: 'Address Book' }); }, true); }
install();
