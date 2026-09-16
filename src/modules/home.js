import { heading } from '../components/view.js';
import { reconciliationTotals } from '../domain/manifest.js';
import { formatAr } from '../domain/money.js';

function card(label, value) {
  const item = document.createElement('article');
  item.className = 'metric-card';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.textContent = String(value);
  item.append(name, result);
  return item;
}

export function createHomeModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Operations Dashboard', 'Parcels, collections, stock and system readiness.'));
      const totals = reconciliationTotals(state.parcels);
      const statuses = state.parcels.reduce((acc, parcel) => {
        acc[parcel.status] = (acc[parcel.status] || 0) + 1;
        return acc;
      }, {});
      const grid = document.createElement('div');
      grid.className = 'metric-grid';
      const metrics = [
        ['Active parcels', totals.parcels],
        ['Ready', statuses.ready || 0],
        ['In transit', (statuses.dispatch || 0) + (statuses['in-transit'] || 0)],
        ['Delivered', (statuses.delivery || 0) + (statuses.delivered || 0)],
        ['Exceptions', statuses.exception || 0],
        ['Outstanding Collect', `${formatAr(totals.outstandingCollect)} Ar`],
      ];
      for (const [label, value] of metrics) grid.append(card(label, value));
      section.append(grid);

      const pid = String(state.activeProfileId || state.workspace?.profileId || 'ps_default');
      const inventory = (state.inventory || []).filter((item) => String(item.profileId || 'ps_default') === pid);
      const units = inventory.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
      const low = inventory.filter((item) => (Number(item.qty) || 0) <= (Number(item.reorder) || 0)).length;
      const value = inventory.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.cost) || 0), 0);
      const stock = document.createElement('div');
      stock.className = 'workspace-card';
      const stockTitle = document.createElement('h2');
      stockTitle.textContent = 'Stock overview';
      const stockGrid = document.createElement('div');
      stockGrid.className = 'metric-grid';
      stockGrid.append(card('SKUs', inventory.length), card('Units', units), card('Low / out', low), card('Value', `${formatAr(value)} Ar`));
      const openStock = document.createElement('button');
      openStock.type = 'button';
      openStock.className = 'button button-primary';
      openStock.textContent = 'Open Stock Management';
      openStock.addEventListener('click', () => { location.hash = '#/stock'; });
      stock.append(stockTitle, stockGrid, openStock);
      section.append(stock);

      const readiness = document.createElement('div');
      readiness.className = 'workspace-card';
      const readinessTitle = document.createElement('h2');
      readinessTitle.textContent = 'System readiness';
      const readinessGrid = document.createElement('div');
      readinessGrid.className = 'metric-grid';
      readinessGrid.append(card('Network', state.online ? 'Online' : 'Offline'), card('Sync', state.sync?.status || 'idle'), card('Profiles', (state.profiles || []).length), card('Open claims', (state.claims || []).length));
      readiness.append(readinessTitle, readinessGrid);
      section.append(readiness);
      return section;
    },
  };
}
