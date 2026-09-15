// Batch Address Book customer picker.
// Installed as a small independent UI layer so the batch scanner can open the
// complete approved customer list without disturbing OCR price results.

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function findCard(button) {
  return button.closest('.batch-card');
}

function fieldsFor(card) {
  if (!card) return null;
  const controls = Array.from(card.querySelectorAll('input, textarea'));
  const byId = (part) => controls.find((node) => node.id?.includes(part));
  return { name: byId('batch-name-'), phone: byId('batch-phone-'), address: byId('batch-address-') };
}

function setInput(node, value) {
  if (!node) return;
  node.value = value || '';
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
}

function customersFromState() {
  try {
    const store = window.__LABELONZEWAY_STORE__;
    const state = store?.getState?.();
    if (Array.isArray(state?.customers)) return state.customers;
  } catch { /* fallback below */ }
  return [];
}

function picker(customers, onPick) {
  const overlay = document.createElement('div');
  overlay.className = 'batch-customer-picker-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Address Book');

  const modal = document.createElement('section');
  modal.className = 'batch-customer-picker';
  const head = document.createElement('div');
  head.className = 'batch-customer-picker-head';
  const title = document.createElement('div');
  const strong = document.createElement('strong'); strong.textContent = 'Address Book';
  const small = document.createElement('small'); small.textContent = `${customers.length} approved customer${customers.length === 1 ? '' : 's'}`;
  title.append(strong, small);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'secondary'; close.textContent = 'Close';
  head.append(title, close);

  const search = document.createElement('input');
  search.type = 'search'; search.placeholder = 'Search name, phone or address…'; search.autocomplete = 'off';
  search.className = 'batch-customer-picker-search';
  const list = document.createElement('div'); list.className = 'batch-customer-picker-list';

  function render() {
    const q = normalize(search.value);
    const visible = customers.filter((c) => !q || normalize(`${c.name} ${c.phone} ${c.address}`).includes(q));
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('div'); empty.className = 'batch-customer-picker-empty'; empty.textContent = 'No customer found.'; list.append(empty); return;
    }
    visible.slice(0, 250).forEach((customer) => {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'batch-customer-picker-row';
      const name = document.createElement('strong'); name.textContent = customer.name || 'Unnamed customer';
      const meta = document.createElement('span'); meta.textContent = [customer.phone, customer.address].filter(Boolean).join(' · ');
      row.append(name, meta);
      row.addEventListener('click', () => { onPick(customer); overlay.remove(); });
      list.append(row);
    });
  }

  close.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); });
  search.addEventListener('input', render);
  modal.append(head, search, list); overlay.append(modal); document.body.append(overlay); render(); search.focus();
}

function install() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button || !button.closest('.batch-row-actions')) return;
    if (!/^(Use saved customer|Use approved customer)$/i.test(button.textContent.trim())) return;
    const card = findCard(button); const fields = fieldsFor(card); if (!fields) return;
    const customers = customersFromState();
    if (!customers.length) return;
    event.preventDefault(); event.stopPropagation();
    picker(customers, (customer) => {
      setInput(fields.name, customer.name);
      setInput(fields.phone, customer.phone);
      setInput(fields.address, customer.address);
    });
  }, true);
}

install();
