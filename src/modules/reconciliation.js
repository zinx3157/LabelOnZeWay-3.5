import { heading } from '../components/view.js';
import { reconciliationTotals } from '../domain/manifest.js';
import { formatAr } from '../domain/money.js';

export function createReconciliationModule() {
  return {
    render(state) {
      const totals = reconciliationTotals(state.parcels);
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Reconciliation', 'Merchandise Collect and delivery revenue remain separate.'));
      const grid = document.createElement('div');
      grid.className = 'metric-grid';
      const metrics = [
        ['Parcels', totals.parcels],
        ['Quantity', totals.quantity],
        ['Merchandise Collect', `${formatAr(totals.collect)} Ar`],
        ['Delivery Revenue', `${formatAr(totals.deliveryRevenue)} Ar`],
        ['Total Receivable', `${formatAr(totals.totalReceivable)} Ar`],
        ['Delivered Collect', `${formatAr(totals.deliveredCollect)} Ar`],
        ['Delivered Delivery', `${formatAr(totals.deliveredDeliveryRevenue)} Ar`],
        ['Outstanding Collect', `${formatAr(totals.outstandingCollect)} Ar`],
        ['Outstanding Delivery', `${formatAr(totals.outstandingDeliveryRevenue)} Ar`],
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
