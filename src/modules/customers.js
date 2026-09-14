import { action, field } from '../components/form.js';
import { heading } from '../components/view.js';

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function textKey(value) { return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function phoneKey(value) {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('261') && digits.length === 12 ? `0${digits.slice(3)}` : digits;
}
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
function shipmentHistory(state, customerId) {
  const all = [...state.parcels, ...state.archive].filter((item) => item.customerId === customerId || item.customer?.id === customerId);
  if (!all.length) return null;
  return [...all].sort((a, b) => String(b.createdAt || b.archivedAt || '').localeCompare(String(a.createdAt || a.archivedAt || '')))[0];
}
function initials(name) {
  const parts = clean(name).split(' ').filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : parts[0]?.slice(0, 2) || '?').toUpperCase();
}
function text(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}
function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
function phoneHref(phone) {
  const digits = clean(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return `+261${digits.slice(1)}`;
  if (digits.startsWith('261')) return `+${digits}`;
  return `+${digits}`;
}

export function createCustomersModule({ store }) {
  let importMessage = '';
  let query = '';
  let sort = 'name';
  let areaFilter = 'all';
  let page = 1;
  const pageSize = 10;

  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen customers-screen';
      const selected = new Set();

      const topbar = document.createElement('div');
      topbar.className = 'customers-topbar';
      const search = document.createElement('input');
      search.className = 'customers-search';
      search.type = 'search';
      search.placeholder = 'Search customer, phone, area or address…';
      search.value = query;
      search.setAttribute('aria-label', 'Search customers');
      const newButton = action('New customer', 'primary');
      const importButton = action('Import');
      const exportButton = action('Export');
      const importInput = document.createElement('input');
      importInput.type = 'file';
      importInput.accept = 'application/json,.json';
      importInput.hidden = true;
      importInput.setAttribute('aria-label', 'Address Book import file');
      topbar.append(search, newButton, importButton, exportButton, importInput);
      section.append(topbar);

      const titleRow = document.createElement('div');
      titleRow.className = 'customers-title-row';
      titleRow.append(heading('Customers', `Manage your address book · ${state.customers.length} customers`));
      const sortWrap = document.createElement('div');
      sortWrap.className = 'customers-sort-wrap';
      sortWrap.append(text('span', 'customers-sort-label', 'Sort by'));
      const sortSelect = document.createElement('select');
      sortSelect.className = 'select customers-sort';
      for (const [value, label] of [['name','Name A → Z'],['area','Area A → Z'],['recent','Recently added']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        sortSelect.append(option);
      }
      sortSelect.value = sort;
      sortWrap.append(sortSelect);
      titleRow.append(sortWrap);
      section.append(titleRow);

      const areaCounts = new Map();
      for (const customer of state.customers) {
        const area = clean(customer.area);
        if (area) areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
      }
      const topAreas = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const otherCount = state.customers.filter((customer) => clean(customer.area) && !topAreas.some(([area]) => area === clean(customer.area))).length;
      const chips = document.createElement('div');
      chips.className = 'customer-filter-chips';
      const chipDefs = [['all', 'All', state.customers.length], ...topAreas.map(([area, count]) => [area, area, count])];
      if (otherCount) chipDefs.push(['other', 'Other', otherCount]);
      for (const [value, label, count] of chipDefs) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `customer-filter-chip${areaFilter === value ? ' is-active' : ''}`;
        chip.textContent = `${label} ${count}`;
        chip.dataset.filter = value;
        chip.addEventListener('click', () => { areaFilter = value; page = 1; renderList(); refreshChips(); });
        chips.append(chip);
      }
      section.append(chips);

      const importStatus = text('p', 'helper-text', importMessage);
      section.append(importStatus);
      const list = document.createElement('div');
      list.className = 'customer-directory';
      section.append(list);

      const footer = document.createElement('div');
      footer.className = 'customers-footer';
      const selectedLabel = text('span', 'customers-selected-label', '0 selected');
      const deleteSelected = action('Delete selected');
      deleteSelected.classList.add('danger-action');
      deleteSelected.disabled = true;
      const pager = document.createElement('div');
      pager.className = 'customers-pager';
      const previous = action('‹');
      const pageLabel = text('span', 'customers-page-label', '1 / 1');
      const next = action('›');
      pager.append(previous, pageLabel, next);
      footer.append(selectedLabel, deleteSelected, pager);
      section.append(footer);

      function refreshChips() {
        for (const chip of chips.querySelectorAll('.customer-filter-chip')) chip.classList.toggle('is-active', chip.dataset.filter === areaFilter);
      }

      function rows() {
        const needle = textKey(query);
        return state.customers.filter((customer) => {
          const queryMatch = !needle || [customer.name, customer.phone, customer.area, customer.address].some((value) => textKey(value).includes(needle));
          if (!queryMatch) return false;
          if (areaFilter === 'all') return true;
          if (areaFilter === 'other') return clean(customer.area) && !topAreas.some(([area]) => area === clean(customer.area));
          return clean(customer.area) === areaFilter;
        }).sort((a, b) => {
          if (sort === 'area') return clean(a.area).localeCompare(clean(b.area));
          if (sort === 'recent') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          return clean(a.name).localeCompare(clean(b.name));
        });
      }

      function updateSelection() {
        selectedLabel.textContent = `${selected.size} selected`;
        deleteSelected.disabled = selected.size === 0;
      }

      function showForm(host, customer = null) {
        const form = document.createElement('div');
        form.className = 'workspace-card customer-edit-card';
        const name = field('Name', 'customerEditName', customer?.name || '');
        const phone = field('Phone', 'customerEditPhone', customer?.phone || '', { inputmode: 'tel' });
        const area = field('Area', 'customerEditArea', customer?.area || '');
        const address = field('Address', 'customerEditAddress', customer?.address || '', { multiline: true });
        const save = action(customer ? 'Save customer' : 'Add customer', 'primary');
        const cancel = action('Cancel');
        const actions = document.createElement('div');
        actions.className = 'button-row';
        save.addEventListener('click', () => {
          const nextName = name.input.value.trim();
          if (!nextName) { name.input.focus(); return; }
          const now = new Date().toISOString();
          store.update((current) => {
            if (customer) {
              return { ...current, customers: current.customers.map((item) => item.id === customer.id ? { ...item, name: nextName, phone: phone.input.value.trim(), area: area.input.value.trim(), address: address.input.value.trim(), modifiedAt: now } : item) };
            }
            return { ...current, customers: [...current.customers, { id: crypto.randomUUID(), name: nextName, phone: phone.input.value.trim(), area: area.input.value.trim(), address: address.input.value.trim(), createdAt: now, modifiedAt: now }] };
          });
        });
        cancel.addEventListener('click', () => renderList());
        actions.append(save, cancel);
        form.append(name.wrap, phone.wrap, area.wrap, address.wrap, actions);
        host.replaceChildren(form);
      }

      function renderList() {
        list.replaceChildren();
        const filtered = rows();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.min(page, totalPages);
        const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
        pageLabel.textContent = `${page} / ${totalPages}`;
        previous.disabled = page <= 1;
        next.disabled = page >= totalPages;
        if (!visible.length) {
          list.append(text('div', 'empty-state', state.customers.length ? 'No customers match your filters.' : 'No saved customers yet.'));
          return;
        }
        for (const customer of visible) {
          const row = document.createElement('article');
          row.className = 'customer-row';
          row.dataset.customerId = customer.id;
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'customer-check';
          checkbox.checked = selected.has(customer.id);
          checkbox.setAttribute('aria-label', `Select ${customer.name}`);
          checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(customer.id) : selected.delete(customer.id); updateSelection(); });
          const avatar = text('div', 'customer-avatar', initials(customer.name));
          const identity = document.createElement('div');
          identity.className = 'customer-identity';
          identity.append(text('strong', 'customer-name', customer.name), text('span', 'customer-phone', customer.phone || 'No phone'));
          const location = document.createElement('div');
          location.className = 'customer-location';
          if (customer.area) location.append(text('strong', 'customer-area', customer.area));
          location.append(text('span', 'customer-address', customer.address || 'No address'));
          const history = shipmentHistory(state, customer.id);
          if (history) location.append(text('small', 'customer-history', `Previous shipment: ${history.pickId || 'unknown'} · ${history.status || 'unknown'}`));
          const actions = document.createElement('div');
          actions.className = 'customer-actions';
          const tel = phoneHref(customer.phone);
          if (tel) {
            const wa = document.createElement('a');
            wa.className = 'customer-icon-action';
            wa.href = `https://wa.me/${tel.replace('+', '')}`;
            wa.target = '_blank';
            wa.rel = 'noreferrer';
            wa.textContent = 'WA';
            wa.setAttribute('aria-label', `WhatsApp ${customer.name}`);
            const call = document.createElement('a');
            call.className = 'customer-icon-action';
            call.href = `tel:${tel}`;
            call.textContent = '☎';
            call.setAttribute('aria-label', `Call ${customer.name}`);
            actions.append(wa, call);
          }
          const use = action('Use for label', 'primary');
          const edit = action('Edit');
          use.addEventListener('click', () => {
            store.update((current) => ({ ...current, route: 'label', labelDraft: { ...current.labelDraft, step: 2, customerId: customer.id, customer: { name: customer.name, phone: customer.phone, address: customer.address } } }));
            window.location.hash = '#/label';
          });
          edit.addEventListener('click', () => showForm(row, customer));
          actions.append(use, edit);
          row.append(checkbox, avatar, identity, location, actions);
          list.append(row);
        }
      }

      search.addEventListener('input', () => { query = search.value; page = 1; renderList(); });
      sortSelect.addEventListener('change', () => { sort = sortSelect.value; page = 1; renderList(); });
      previous.addEventListener('click', () => { page = Math.max(1, page - 1); renderList(); });
      next.addEventListener('click', () => { page += 1; renderList(); });
      deleteSelected.addEventListener('click', () => store.update((current) => ({ ...current, customers: current.customers.filter((item) => !selected.has(item.id)) })));
      newButton.addEventListener('click', () => {
        const holder = document.createElement('article');
        holder.className = 'customer-row customer-new-row';
        list.replaceChildren(holder);
        showForm(holder);
      });
      exportButton.addEventListener('click', () => downloadJson('LabelOnZeWay-3.5-AddressBook.json', { version: '3.5', importType: 'customers-only', customers: state.customers.map(({ name, phone, area, address }) => ({ name, phone, area, address })) }));
      importButton.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        importInput.value = '';
        try {
          const incoming = parseAddressBook(JSON.parse(await file.text()));
          const existing = new Set(state.customers.map(customerKey));
          const seen = new Set();
          const imported = [];
          let skipped = 0;
          const now = new Date().toISOString();
          for (const row of incoming) {
            const key = customerKey(row);
            if (existing.has(key) || seen.has(key)) { skipped += 1; continue; }
            seen.add(key);
            imported.push({ id: crypto.randomUUID(), ...row, createdAt: now, modifiedAt: now });
          }
          importMessage = `${imported.length} customer${imported.length === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}. IDs and notes ignored.`;
          importStatus.textContent = importMessage;
          if (imported.length) store.update((current) => ({ ...current, customers: [...current.customers, ...imported] }));
        } catch (error) {
          importMessage = `Import rejected: ${error.message}`;
          importStatus.textContent = importMessage;
        }
      });

      refreshChips();
      renderList();
      return section;
    },
  };
}
