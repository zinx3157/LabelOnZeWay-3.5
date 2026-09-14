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

function validateBackup(snapshot) {
  if (!snapshot || String(snapshot.version) !== '3.5') throw new Error('This is not a LabelOnZeWay 3.5 backup.');
  for (const key of ['customers','parcels','archive']) {
    if (!Array.isArray(snapshot[key])) throw new Error(`Backup field ${key} is invalid.`);
  }
  return snapshot;
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

      const restoreInput = document.createElement('input');
      restoreInput.type = 'file';
      restoreInput.accept = 'application/json,.json';
      restoreInput.hidden = true;
      const restore = action('Restore JSON backup');
      const status = document.createElement('p');
      restore.addEventListener('click', () => restoreInput.click());
      restoreInput.addEventListener('change', async () => {
        const file = restoreInput.files?.[0];
        if (!file) return;
        restoreInput.value = '';
        try {
          const snapshot = validateBackup(JSON.parse(await file.text()));
          store.setState({ customers: snapshot.customers, parcels: snapshot.parcels, archive: snapshot.archive, workspace: snapshot.workspace || state.workspace });
          status.textContent = `Backup restored: ${snapshot.parcels.length} active parcels, ${snapshot.archive.length} archived.`;
        } catch (error) {
          status.textContent = `Restore rejected: ${error.message}`;
        }
      });

      const summary = document.createElement('p');
      summary.textContent = `${state.parcels.length} active parcels · ${state.archive.length} archived · ${formatAr(state.parcels.reduce((sum, item) => sum + Number(item.collect || 0), 0))} Ar active Collect`;
      const row = document.createElement('div');
      row.className = 'button-row';
      row.append(exportCsv, backup, restore, restoreInput);
      card.append(summary, row, status);
      section.append(card);
      return section;
    },
  };
}
