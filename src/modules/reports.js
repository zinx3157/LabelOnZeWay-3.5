import { heading } from '../components/view.js';
import { action } from '../components/form.js';
import { formatAr } from '../domain/money.js';

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function createReportsModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Reports', 'Exports, backup and recovery.'));
      const card = document.createElement('div');
      card.className = 'workspace-card';

      const exportCsv = action('Export manifest CSV', 'primary');
      exportCsv.addEventListener('click', () => {
        const header = ['Pick ID','Customer','Phone','Address','Qty','Unit Price','Collect','Status','Created'];
        const rows = state.parcels.map((parcel) => [parcel.pickId, parcel.customer?.name, parcel.customer?.phone, parcel.customer?.address, parcel.qty, parcel.unitPrice, parcel.collect, parcel.status, parcel.createdAt]);
        download(`labelonzeway-manifest-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8', [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n'));
      });

      const backup = action('Download JSON backup');
      backup.addEventListener('click', () => {
        const snapshot = { version: '3.5', exportedAt: new Date().toISOString(), customers: state.customers, parcels: state.parcels, archive: state.archive, workspace: state.workspace };
        download(`labelonzeway-backup-${new Date().toISOString().slice(0,10)}.json`, 'application/json', JSON.stringify(snapshot, null, 2));
      });

      const summary = document.createElement('p');
      summary.textContent = `${state.parcels.length} active parcels · ${state.archive.length} archived · ${formatAr(state.parcels.reduce((sum, item) => sum + Number(item.collect || 0), 0))} Ar active Collect`;
      const row = document.createElement('div');
      row.className = 'button-row';
      row.append(exportCsv, backup);
      card.append(summary, row);
      section.append(card);
      return section;
    },
  };
}
