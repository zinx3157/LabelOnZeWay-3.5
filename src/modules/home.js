import { heading } from '../components/view.js';
import { reconciliationTotals } from '../domain/manifest.js';
import { formatAr } from '../domain/money.js';

export function createHomeModule() {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Operations', 'Today at a glance.'));
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
        ['Delivery', statuses.delivery || 0],
        ['Exceptions', statuses.exception || 0],
        ['Outstanding Collect', `${formatAr(totals.outstandingCollect)} Ar`],
      ];
      for (const [label, value] of metrics) {
        const card = document.createElement('article');
        card.className = 'metric-card';
        const name = document.createElement('span');
        name.textContent = label;
        const result = document.createElement('strong');
        result.textContent = String(value);
        card.append(name, result);
        grid.append(card);
      }
      section.append(grid);
      return section;
    },
  };
}
