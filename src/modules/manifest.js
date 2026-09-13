import { formatAr } from '../domain/money.js';
import { PARCEL_STATUSES, updateParcelStatuses } from '../domain/manifest.js';
import { action } from '../components/form.js';
import { heading } from '../components/view.js';

function cell(label, value) {
  const td = document.createElement('td');
  td.dataset.label = label;
  td.textContent = value ?? '';
  return td;
}

export function createManifestModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Manifest', 'Unified operational manifest with bulk status updates.'));

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
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Select','Pick ID','Customer','Qty','Unit','Collect','Status'].forEach((name) => {
        const th = document.createElement('th');
        th.textContent = name;
        headRow.append(th);
      });
      thead.append(headRow);
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
        const chooseCell = document.createElement('td');
        chooseCell.dataset.label = 'Select';
        chooseCell.append(choose);
        row.append(
          chooseCell,
          cell('Pick ID', parcel.pickId),
          cell('Customer', parcel.customer?.name || ''),
          cell('Qty', String(parcel.qty ?? '')),
          cell('Unit', formatAr(parcel.unitPrice)),
          cell('Collect', formatAr(parcel.collect)),
        );
        const statusCell = document.createElement('td');
        statusCell.dataset.label = 'Status';
        const pill = document.createElement('span');
        pill.className = 'status-pill';
        pill.textContent = parcel.status;
        statusCell.append(pill);
        row.append(statusCell);
        body.append(row);
      }
      table.append(thead, body);
      tableWrap.append(table);
      section.append(toolbar, tableWrap);
      return section;
    },
  };
}
