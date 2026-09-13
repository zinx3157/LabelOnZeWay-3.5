import { formatAr } from '../domain/money.js';

export function createManifestModule() {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Manifest</h1><p>Unified operational manifest.</p></div></div>';

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-card';
      if (!state.parcels.length) {
        tableWrap.innerHTML = '<div class="empty-state">No parcels in the current manifest.</div>';
        section.append(tableWrap);
        return section;
      }

      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Pick ID</th><th>Customer</th><th>Qty</th><th>Unit</th><th>Collect</th><th>Status</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const parcel of state.parcels) {
        const row = document.createElement('tr');
        row.innerHTML = `<td data-label="Pick ID">${parcel.pickId}</td><td data-label="Customer">${parcel.customer.name}</td><td data-label="Qty">${parcel.qty}</td><td data-label="Unit">${formatAr(parcel.unitPrice)}</td><td data-label="Collect">${formatAr(parcel.collect)}</td><td data-label="Status"><span class="status-pill">${parcel.status}</span></td>`;
        body.append(row);
      }
      table.append(body);
      tableWrap.append(table);
      section.append(tableWrap);
      return section;
    },
  };
}
