import { formatAr } from '../domain/money.js';
import { PARCEL_STATUSES, updateParcelStatuses } from '../domain/manifest.js';
import { action } from '../components/form.js';

export function createManifestModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Manifest</h1><p>Unified operational manifest with bulk status updates.</p></div></div>';

      if (!state.parcels.length) {
        const empty = document.createElement('div');
        empty.className = 'table-card empty-state';
        empty.textContent = 'No parcels in the current manifest.';
        section.append(empty);
        return section;
      }

      const selected = new Set();
      const toolbar = document.createElement('div');
      toolbar.className = 'manifest-toolbar';
      const selection = document.createElement('span');
      selection.textContent = '0 selected';
      const status = document.createElement('select');
      status.className = 'select';
      PARCEL_STATUSES.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item.replace('-', ' ');
        status.append(option);
      });
      const apply = action('Update selected', 'primary');
      apply.disabled = true;
      apply.addEventListener('click', () => {
        if (!selected.size) return;
        store.update((current) => ({ ...current, parcels: updateParcelStatuses(current.parcels, [...selected], status.value) }));
      });
      toolbar.append(selection, status, apply);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-card';
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Select</th><th>Pick ID</th><th>Customer</th><th>Qty</th><th>Unit</th><th>Collect</th><th>Status</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const parcel of state.parcels) {
        const row = document.createElement('tr');
        const choose = document.createElement('input');
        choose.type = 'checkbox';
        choose.setAttribute('aria-label', `Select ${parcel.pickId}`);
        choose.addEventListener('change', () => {
          if (choose.checked) selected.add(parcel.id); else selected.delete(parcel.id);
          selection.textContent = `${selected.size} selected`;
          apply.disabled = selected.size === 0;
        });
        const cell = document.createElement('td');
        cell.dataset.label = 'Select';
        cell.append(choose);
        row.append(cell);
        for (const [label,value] of [
          ['Pick ID', parcel.pickId],['Customer',parcel.customer.name],['Qty',parcel.qty],['Unit',formatAr(parcel.unitPrice)],['Collect',formatAr(parcel.collect)]
        ]) {
          const td = document.createElement('td'); td.dataset.label = label; td.textContent = value; row.append(td);
        }
        const statusCell = document.createElement('td');
        statusCell.dataset.label = 'Status';
        statusCell.innerHTML = `<span class="status-pill">${parcel.status}</span>`;
        row.append(statusCell);
        body.append(row);
      }
      table.append(body);
      tableWrap.append(table);
      section.append(toolbar, tableWrap);
      return section;
    },
  };
}
