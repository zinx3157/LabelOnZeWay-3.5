import { reconciliationTotals } from '../domain/manifest.js';
import { formatAr } from '../domain/money.js';

export function createReconciliationModule() {
  return {
    render(state) {
      const totals = reconciliationTotals(state.parcels);
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Reconciliation</h1><p>One financial model shared with the manifest.</p></div></div>';
      const grid = document.createElement('div');
      grid.className = 'metric-grid';
      const metrics = [
        ['Parcels', totals.parcels],
        ['Quantity', totals.quantity],
        ['Total Collect', `${formatAr(totals.collect)} Ar`],
        ['Delivered Collect', `${formatAr(totals.deliveredCollect)} Ar`],
        ['Outstanding', `${formatAr(totals.outstandingCollect)} Ar`],
      ];
      for (const [label,value] of metrics) {
        const card = document.createElement('article');
        card.className = 'metric-card';
        card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
        grid.append(card);
      }
      section.append(grid);
      return section;
    },
  };
}
