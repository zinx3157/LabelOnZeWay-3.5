import { heading } from '../components/view.js';
import { CSV_BOM, csvDocument } from '../domain/csv.js';
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

function validateBackup(snapshot) {
  if (!snapshot || String(snapshot.version) !== '3.5') throw new Error('This is not a LZWay 3.5 backup.');
  for (const key of ['customers','parcels','archive']) {
    if (!Array.isArray(snapshot[key])) throw new Error(`Backup field ${key} is invalid.`);
  }
  if (snapshot.claims != null && !Array.isArray(snapshot.claims)) throw new Error('Backup field claims is invalid.');
  return snapshot;
}

function activityRow(item) {
  const row = document.createElement('div');
  row.className = 'activity-log-row';
  const when = document.createElement('strong');
  when.textContent = new Date(item.occurred_at).toLocaleString();
  const actionName = document.createElement('span');
  actionName.textContent = item.action || 'action';
  const source = document.createElement('small');
  source.textContent = `${item.platform || 'unknown'} · ${item.route || 'app'} · ${String(item.device_id || '').slice(0,18)}${item.pending ? ' · pending sync' : ''}`;
  row.append(when, actionName, source);
  return row;
}

export function createReportsModule({ store, services }) {
  let restoreMessage = '';
  let activityMessage = 'Load the synchronized activity log from all devices.';
  let activityItems = [];

  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Reports', 'Exports, backup, recovery and activity audit.'));
      const card = document.createElement('div');
      card.className = 'workspace-card';

      const exportCsv = action('Export manifest CSV', 'primary');
      exportCsv.addEventListener('click', () => {
        const header = ['Pick ID','Customer','Phone','Address','Qty','Unit Price','Collect','Delivery Charge','Status','Created'];
        const rows = state.parcels.map((parcel) => [parcel.pickId, parcel.customer?.name, parcel.customer?.phone, parcel.customer?.address, parcel.qty, parcel.unitPrice, parcel.collect, parcel.deliveryCharge || 0, parcel.status, parcel.createdAt]);
        download(`lzway-manifest-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvDocument([header, ...rows]));
      });

      const backup = action('Download JSON backup');
      backup.addEventListener('click', () => {
        const snapshot = { version: '3.5', exportedAt: new Date().toISOString(), customers: state.customers, parcels: state.parcels, archive: state.archive, claims: state.claims || [], workspace: state.workspace };
        download(`lzway-backup-${new Date().toISOString().slice(0,10)}.json`, 'application/json', JSON.stringify(snapshot, null, 2));
      });

      const restoreInput = document.createElement('input');
      restoreInput.type = 'file';
      restoreInput.accept = 'application/json,.json';
      restoreInput.hidden = true;
      const restore = action('Restore JSON backup');
      const status = document.createElement('p');
      status.textContent = restoreMessage;
      restore.addEventListener('click', () => restoreInput.click());
      restoreInput.addEventListener('change', async () => {
        const file = restoreInput.files?.[0];
        if (!file) return;
        restoreInput.value = '';
        try {
          const snapshot = validateBackup(JSON.parse(await file.text()));
          restoreMessage = `Backup restored: ${snapshot.parcels.length} active parcels, ${snapshot.archive.length} archived, ${(snapshot.claims || []).length} claims.`;
          services.audit.record('backup.restore', { active: snapshot.parcels.length, archived: snapshot.archive.length, claims: (snapshot.claims || []).length });
          store.setState({ customers: snapshot.customers, parcels: snapshot.parcels, archive: snapshot.archive, claims: snapshot.claims || [], workspace: snapshot.workspace || state.workspace });
        } catch (error) {
          restoreMessage = `Restore rejected: ${error.message}`;
          services.audit.record('backup.restore_failed', { reason: String(error.message || 'invalid backup').slice(0,120) });
          status.textContent = restoreMessage;
        }
      });

      const summary = document.createElement('p');
      const collect = state.parcels.reduce((sum, item) => sum + Number(item.collect || 0), 0);
      const delivery = state.parcels.reduce((sum, item) => sum + Number(item.deliveryCharge || 0), 0);
      summary.textContent = `${state.parcels.length} active · ${state.archive.length} archived · ${(state.claims || []).length} claims · ${formatAr(collect)} Ar Collect · ${formatAr(delivery)} Ar Delivery`;
      const row = document.createElement('div');
      row.className = 'button-row';
      row.append(exportCsv, backup, restore, restoreInput);
      card.append(summary, row, status);
      section.append(card);

      const auditCard = document.createElement('div');
      auditCard.className = 'workspace-card activity-log-card';
      const auditTitle = document.createElement('h2');
      auditTitle.textContent = 'Activity Log';
      const auditHint = document.createElement('p');
      auditHint.textContent = activityMessage;
      const auditActions = document.createElement('div');
      auditActions.className = 'button-row';
      const load = action('Load latest activity', 'primary');
      const exportActivity = action('Export activity CSV');
      const list = document.createElement('div');
      list.className = 'activity-log-list';

      const paint = () => {
        list.replaceChildren();
        if (!activityItems.length) {
          const empty = document.createElement('small');
          empty.textContent = 'No activity loaded.';
          list.append(empty);
          return;
        }
        activityItems.forEach((item) => list.append(activityRow(item)));
      };
      paint();

      load.addEventListener('click', async () => {
        load.disabled = true;
        load.textContent = 'Loading…';
        activityItems = await services.audit.list({ limit: 250 });
        activityMessage = `${activityItems.length} latest actions · ${services.audit.platform()} · ${services.audit.queued()} pending local`;
        auditHint.textContent = activityMessage;
        paint();
        load.disabled = false;
        load.textContent = 'Refresh activity';
      });

      exportActivity.addEventListener('click', async () => {
        if (!activityItems.length) activityItems = await services.audit.list({ limit: 1000 });
        const header = ['Occurred At','Platform','Device','Profile','Action','Route','Target Type','Target ID','Pending'];
        const rows = activityItems.map((item) => [item.occurred_at,item.platform,item.device_id,item.profile_id,item.action,item.route,item.target_type,item.target_id,item.pending ? 'yes' : 'no']);
        download(`lzway-activity-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvDocument([header, ...rows]));
      });

      auditActions.append(load, exportActivity);
      auditCard.append(auditTitle, auditHint, auditActions, list);
      section.append(auditCard);
      return section;
    },
  };
}
