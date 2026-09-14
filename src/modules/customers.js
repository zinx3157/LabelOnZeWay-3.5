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
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  return el;
}
function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function formatPhoneHref(phone) {
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
      sortWrap.append(makeText('span', 'customers-sort-label', 'Sort by'));
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

      const areas = new Map();
      for (const customer of state.customers) {
        const area = clean(customer.area);
        if (!area) continue;
        areas.set(area, (areas.get(area) || 0) + 1);
      }
      const topAreas = [...areas.entries()].sort((a,b) => b[1] - a[1]).slice(0,4);
      const chips = document.createElement('div');
      chips.className = 'customer-filter-chips';
      const addChip = (value, label, count) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `customer-filter-chip${areaFilter === value ? ' is-active' : ''}`;
        chip.textContent = `${label} ${count}`;
        chip.addEventListener('click', () => { areaFilter = value; page = 1; refreshAll(); });
        chips.append(chip);
      };
      addChip('all', 'All', state.customers.length);
      for (const [area,count] of topAreas) addChip(area, area, count);
      const otherCount = state.customers.filter((c) => clean(c.area) && !topAreas.some(([area]) => area === clean(c.area))).length;
      if (otherCount) addChip('other', 'Other', otherCount);
      section.append(chips);

      const importStatus = document.createElement('p');
      importStatus.className = 'helper-text';
      importStatus.textContent = importMessage;
      section.append(importStatus);

      const list = document.createElement('div');
      list.className = 'customer-directory';
      section.append(list);

      const footer = document.createElement('div');
      footer.className = 'customers-footer';
      const selectionLabel = makeText('span', 'customers-selected-label', '0 selected');
      const deleteSelected = action('Delete selected');
      deleteSelected.classList.add('danger-action');
      deleteSelected.disabled = true;
      const pager = document.createElement('div');
      pager.className = 'customers-pager';
      const prev = action('‹');
      const pageLabel = makeText('span', 'customers-page-label', '1 / 1');
      const next = action('›');
      pager.append(prev, pageLabel, next);
      footer.append(selectionLabel, deleteSelected, pager);
      section.append(footer);

      function filteredRows() {
        const needle = textKey(query);
        let rows = state.customers.filter((c) => {
          const matchesQuery = !needle || [c.name,c.phone,c.area,c.address].some((v) => textKey(v).includes(needle));
          if (!matchesQuery) return false;
          if (areaFilter === 'all') return true;
          if (areaFilter === 'other') return clean(c.area) && !topAreas.some(([area]) => area === clean(c.area));
          return clean(c.area) === areaFilter;
        });
        return [...rows].sort((a,b) => {
          if (sort === 'area') return clean(a.area).localeCompare(clean(b.area));
          if (sort === 'recent') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          return clean(a.name).localeCompare(clean(b.name));
        });
      }

      function updateSelection() {
        selectionLabel.textContent = `${selected.size} selected`;
        deleteSelected.disabled = selected.size === 0;
      }

      function renderList() {
        list.replaceChildren();
        const rows = filteredRows();
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        if (page > totalPages) page = totalPages;
        const visible = rows.slice((page - 1) * pageSize, page * pageSize);
        pageLabel.textContent = `${page} / ${totalPages}`;
        prev.disabled = page <= 1;
        next.disabled = page >= totalPages;

        if (!visible.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = state.customers.length ? 'No customers match your filters.' : 'No saved customers yet.';
          list.append(empty);
          return;
        }

        for (const customer of visible) {
          const row = document.createElement('article');
          row.className = 'customer-row';
          row.dataset.customerId = customer.id;

          const chooser = document.createElement('input');
          chooser.type = 'checkbox';
          chooser.className = 'customer-check';
          chooser.checked = selected.has(customer.id);
          chooser.setAttribute('aria-label', `Select ${customer.name}`);
          chooser.addEventListener('change', () => {
            chooser.checked ? selected.add(customer.id) : selected.delete(customer.id);
            updateSelection();
          });

          const avatar = makeText('div', 'customer-avatar', initials(customer.name));
          const identity = document.createElement('div');
          identity.className = 'customer-identity';
          identity.append(makeText('strong', 'customer-name', customer.name), makeText('span', 'customer-phone', customer.phone || 'No phone'));

          const addressBlock = document.createElement('div');
          addressBlock.className = 'customer-location';
          if (customer.area) addressBlock.append(makeText('strong', 'customer-area', customer.area));
          addressBlock.append(makeText('span', 'customer-address', customer.address || 'No address'));
          const history = shipmentHistory(state, customer.id);
          if (history) addressBlock.append(makeText('small', 'customer-history', `Previous: ${history.pickId || 'unknown'} · ${history.status || 'unknown'}`));

          const buttons = document.createElement('div');
          buttons.className = 'customer-actions';
          const telHref = formatPhoneHref(customer.phone);
          if (telHref) {
            const wa = document.createElement('a');
            wa.className = 'customer-icon-action';
            wa.href = `https://wa.me/${telHref.replace('+','')}`;
            wa.target = '_blank';
            wa.rel = 'noreferrer';
            wa.setAttribute('aria-label', `WhatsApp ${customer.name}`);
            wa.textContent = 'WA';
            const call = document.createElement('a');
            call.className = 'customer-icon-action';
            call.href = `tel:${telHref}`;
            call.setAttribute('aria-label', `Call ${customer.name}`);
            call.textContent = '☎';
            buttons.append(wa, call);
          }
          const use = action('Use for label', 'primary');
          const edit = action('Edit');
          use.addEventListener('click', () => {
            store.update((nextState) => ({ ...nextState, route: 'label', labelDraft: { ...nextState.labelDraft, step: 2, customerId: customer.id, customer: { name: customer.name, phone: customer.phone, address: customer.address } } }));
            window.location.hash = '#/label';
          });
          edit.addEventListener('click', () => showEditForm(row, customer));
          buttons.append(use, edit);
          row.append(chooser, avatar, identity, addressBlock, buttons);
          list.append(row);
        }
      }

      function showEditForm(row, customer) {
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
          if (!nextName) return;
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
        row.replaceChildren(form);
      }

      function refreshAll() {
        renderList();
        for (const chip of chips.querySelectorAll('.customer-filter-chip')) chip.classList.remove('is-active');
        const chipValues = ['all', ...topAreas.map(([area]) => area), ...(otherCount ? ['other'] : [])];
        const activeIndex = chipValues.indexOf(areaFilter);
        if (activeIndex >= 0) chips.children[activeIndex]?.classList.add('is-active');
      }

      search.addEventListener('input', () => { query = search.value; page = 1; renderList(); });
      sortSelect.addEventListener('change', () => { sort = sortSelect.value; page = 1; renderList(); });
      prev.addEventListener('click', () => { page -= 1; renderList(); });
      next.addEventListener('click', () => { page += 1; renderList(); });
      deleteSelected.addEventListener('click', () => {
        store.update((current) => ({ ...current, customers: current.customers.filter((item) => !selected.has(item.id)) }));
      });
      newButton.addEventListener('click', () => {
        list.replaceChildren();
        const holder = document.createElement('article');
        holder.className = 'customer-row customer-new-row';
        list.append(holder);
        showEditForm(holder, null);
      });
      exportButton.addEventListener('click', () => {
        downloadJson('LabelOnZeWay-3.5-AddressBook.json', { version: '3.5', importType: 'customers-only', customers: state.customers.map(({ name, phone, area, address }) => ({ name, phone, area, address })) });
      });
      importButton.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        importInput.value = '';
        try {
          const incoming = parseAddressBook(JSON.parse(await file.text()));
          const existingKeys = new Set(state.customers.map(customerKey));
          const incomingKeys = new Set();
          const now = new Date().toISOString();
          const imported = [];
          let skipped = 0;
          for (const row of incoming) {
            const key = customerKey(row);
            if (existingKeys.has(key) || incomingKeys.has(key)) { skipped += 1; continue; }
            incomingKeys.add(key);
            imported.push({ id: crypto.randomUUID(), name: row.name, phone: row.phone, area: row.area, address: row.address, createdAt: now, modifiedAt: now });
          }
          importMessage = `${imported.length} customer${imported.length === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`;
          if (imported.length) store.update((current) => ({ ...current, customers: [...current.customers, ...imported] }));
          else importStatus.textContent = importMessage;
        } catch (error) {
          importMessage = `Import rejected: ${error.message}`;
          importStatus.textContent = importMessage;
        }
      });

      renderList();
      updateSelection();
      return section;
    },
  };
}
