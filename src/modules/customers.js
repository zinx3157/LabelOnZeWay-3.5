import { action, field } from '../components/form.js';
import { heading } from '../components/view.js';

function shipmentHistory(state, customerId) {
  const all = [...state.parcels, ...state.archive].filter((item) => item.customerId === customerId || item.customer?.id === customerId);
  if (!all.length) return null;
  return [...all].sort((a, b) => String(b.createdAt || b.archivedAt || '').localeCompare(String(a.createdAt || a.archivedAt || '')))[0];
}

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function phoneKey(value) {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('261') && digits.length === 12 ? `0${digits.slice(3)}` : digits;
}
function textKey(value) { return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function customerKey(customer) {
  const phone = phoneKey(customer.phone);
  return phone ? `p:${phone}` : `n:${textKey(customer.name)}|a:${textKey(customer.area)}|d:${textKey(customer.address)}`;
}
function parseAddressBook(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.customers;
  if (!Array.isArray(rows)) throw new Error('No customers array found in this file.');
  return rows.map((row) => ({ name: clean(row?.name), phone: clean(row?.phone), area: clean(row?.area), address: clean(row?.address) }))
    .filter((row) => row.name && (row.phone || row.area || row.address));
}
function initials(name) {
  const parts = clean(name).split(' ').filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0,2) || '?').toUpperCase();
}
function makeText(tag, className, value) {
  const el = document.createElement(tag); el.className = className; el.textContent = value; return el;
}

export function createCustomersModule({ store }) {
  let importMessage = '';
  let query = '';
  let sort = 'name';
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen customers-screen';

      const headingWrap = document.createElement('div');
      headingWrap.className = 'customers-heading-row';
      headingWrap.append(heading('Customers', `Manage your address book · ${state.customers.length} customers`));

      const controls = document.createElement('div');
      controls.className = 'customers-controls';
      const search = document.createElement('input');
      search.className = 'customers-search';
      search.type = 'search';
      search.placeholder = 'Search customer, phone, area or address…';
      search.value = query;
      search.setAttribute('aria-label', 'Search customers');
      search.addEventListener('input', () => { query = search.value; renderList(); });

      const sortSelect = document.createElement('select');
      sortSelect.className = 'select customers-sort';
      sortSelect.innerHTML = '<option value="name">Name A → Z</option><option value="area">Area A → Z</option><option value="recent">Recently added</option>';
      sortSelect.value = sort;
      sortSelect.addEventListener('change', () => { sort = sortSelect.value; renderList(); });

      const selected = new Set();
      const removeSelected = action('Delete selected');
      removeSelected.classList.add('danger-action');
      removeSelected.disabled = true;
      removeSelected.addEventListener('click', () => {
        store.update((current) => ({ ...current, customers: current.customers.filter((item) => !selected.has(item.id)) }));
      });

      const importInput = document.createElement('input');
      importInput.type = 'file'; importInput.accept = 'application/json,.json'; importInput.hidden = true;
      importInput.setAttribute('aria-label', 'Address Book import file');
      const importButton = action('Import Address Book', 'primary');
      importButton.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0]; if (!file) return; importInput.value = '';
        try {
          const incoming = parseAddressBook(JSON.parse(await file.text()));
          const existingKeys = new Set(state.customers.map(customerKey));
          const incomingKeys = new Set(); const now = new Date().toISOString(); const imported = []; let skipped = 0;
          for (const row of incoming) {
            const key = customerKey(row);
            if (existingKeys.has(key) || incomingKeys.has(key)) { skipped += 1; continue; }
            incomingKeys.add(key);
            imported.push({ id: crypto.randomUUID(), name: row.name, phone: row.phone, area: row.area, address: row.address, createdAt: now, modifiedAt: now });
          }
          importMessage = `${imported.length} customer${imported.length === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`;
          if (imported.length) store.update((current) => ({ ...current, customers: [...current.customers, ...imported] }));
          else importStatus.textContent = importMessage;
        } catch (error) { importMessage = `Import rejected: ${error.message}`; importStatus.textContent = importMessage; }
      });

      controls.append(search, sortSelect, importButton, importInput, removeSelected);
      headingWrap.append(controls);
      section.append(headingWrap);

      const importStatus = document.createElement('p');
      importStatus.className = 'helper-text'; importStatus.textContent = importMessage;
      section.append(importStatus);

      const list = document.createElement('div');
      list.className = 'customer-directory';
      section.append(list);

      function renderList() {
        list.replaceChildren();
        const needle = textKey(query);
        let rows = state.customers.filter((c) => !needle || [c.name,c.phone,c.area,c.address].some((v) => textKey(v).includes(needle)));
        rows = [...rows].sort((a,b) => {
          if (sort === 'area') return clean(a.area).localeCompare(clean(b.area));
          if (sort === 'recent') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          return clean(a.name).localeCompare(clean(b.name));
        });
        if (!rows.length) {
          const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = state.customers.length ? 'No customers match your search.' : 'No saved customers yet.'; list.append(empty); return;
        }

        for (const customer of rows) {
          const row = document.createElement('article'); row.className = 'customer-row'; row.dataset.customerId = customer.id;
          const chooser = document.createElement('input'); chooser.type = 'checkbox'; chooser.className = 'customer-check'; chooser.setAttribute('aria-label', `Select ${customer.name}`);
          chooser.addEventListener('change', () => { chooser.checked ? selected.add(customer.id) : selected.delete(customer.id); removeSelected.disabled = selected.size === 0; });

          const avatar = makeText('div', 'customer-avatar', initials(customer.name));
          const identity = document.createElement('div'); identity.className = 'customer-identity';
          identity.append(makeText('strong', 'customer-name', customer.name), makeText('span', 'customer-phone', customer.phone || 'No phone'));

          const location = document.createElement('div'); location.className = 'customer-location';
          if (customer.area) location.append(makeText('strong', 'customer-area', customer.area));
          location.append(makeText('span', 'customer-address', customer.address || 'No address'));
          const history = shipmentHistory(state, customer.id);
          if (history) location.append(makeText('small', 'customer-history', `Previous: ${history.pickId || 'unknown'} · ${history.status || 'unknown'}`));

          const buttons = document.createElement('div'); buttons.className = 'customer-actions';
          const use = action('Use for label', 'primary'); const edit = action('Edit');
          use.addEventListener('click', () => {
            store.update((next) => ({ ...next, route: 'label', labelDraft: { ...next.labelDraft, step: 2, customerId: customer.id, customer: { name: customer.name, phone: customer.phone, address: customer.address } } }));
            location.hash = '#/label';
          });
          edit.addEventListener('click', () => {
            const form = document.createElement('div'); form.className = 'workspace-card customer-edit-card';
            const name = field('Name', 'customerEditName', customer.name);
            const phone = field('Phone', 'customerEditPhone', customer.phone || '', { inputmode: 'tel' });
            const area = field('Area', 'customerEditArea', customer.area || '');
            const address = field('Address', 'customerEditAddress', customer.address || '', { multiline: true });
            const save = action('Save customer', 'primary'); const cancel = action('Cancel'); const actions = document.createElement('div'); actions.className = 'button-row';
            save.addEventListener('click', () => {
              const nextName = name.input.value.trim(); if (!nextName) return;
              store.update((current) => ({ ...current, customers: current.customers.map((item) => item.id === customer.id ? { ...item, name: nextName, phone: phone.input.value.trim(), area: area.input.value.trim(), address: address.input.value.trim(), modifiedAt: new Date().toISOString() } : item) }));
            });
            cancel.addEventListener('click', () => renderList());
            actions.append(save, cancel); form.append(name.wrap, phone.wrap, area.wrap, address.wrap, actions); row.replaceChildren(form);
          });
          buttons.append(use, edit);
          row.append(chooser, avatar, identity, location, buttons);
          list.append(row);
        }
      }

      renderList();
      return section;
    },
  };
}
