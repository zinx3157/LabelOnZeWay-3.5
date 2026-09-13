import { heading } from '../components/view.js';
import { reconciliationTotals } from '../domain/manifest.js';
import { formatAr } from '../domain/money.js';

export function createReconciliationModule() {
  return {
    render(state) {
      const totals = reconciliationTotals(state.parcels);
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Reconciliation', 'One financial model shared with the manifest.'));
      const grid = document.createElement('div');
      grid.className = 'metric-grid';
      const metrics = [
        ['Parcels', totals.parcels],
        ['Quantity', totals.quantity],
        ['Total Collect', `${formatAr(totals.collect)} Ar`],
        ['Delivered Collect', `${formatAr(totals.deliveredCollect)} Ar`],
        ['Outstanding', `${formatAr(totals.outstandingCollect)} Ar`],
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
