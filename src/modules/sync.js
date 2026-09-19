import { heading, textStack } from '../components/view.js';
import { action } from '../components/form.js';

function summarize(payload) {
  if (!payload || typeof payload !== 'object') return '—';
  const label = payload.name || payload.pickId || payload.reason || payload.id || 'record';
  const stamp = payload.modifiedAt || payload.updatedAt || payload.statusUpdatedAt || payload.archivedAt || payload.createdAt || '';
  return `${label}${stamp ? ` · ${String(stamp).slice(0, 19).replace('T', ' ')}` : ''}`;
}

export function createSyncModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Sync Center', 'Outbox, conflict review and the devices sharing this workspace.'));

      const notice = document.createElement('p');
      notice.className = 'pod-meta';
      notice.textContent = state.ui?.notice || '';

      const statusCard = document.createElement('div');
      statusCard.className = 'workspace-card';
      const statusTitle = document.createElement('h2');
      statusTitle.textContent = 'Sync status';
      statusCard.append(statusTitle, textStack([
        ['span', `Status: ${state.sync?.status || 'idle'}`],
        ['span', `Last success: ${state.sync?.lastSuccess ? new Date(state.sync.lastSuccess).toLocaleString() : 'never'}`],
        ['span', `Queued pushes: ${state.sync?.pending || 0}`],
        ['small', `This device: ${services.sync.deviceId()}`],
      ]));
      const controls = document.createElement('div');
      controls.className = 'button-row';
      const run = (label, task) => {
        const button = action(label);
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const result = await task();
            notice.textContent = `${label}: ${result?.status || 'done'}${result?.records != null ? ` · ${result.records} record(s)` : ''}`;
          } catch (error) {
            notice.textContent = `${label}: ${error.message}`;
          } finally {
            button.disabled = false;
            store.setState({ ui: { ...store.getState().ui, notice: '' } });
          }
        });
        return button;
      };
      controls.append(
        run('Push now', () => services.sync.pushSnapshot({ reason: 'sync-center' })),
        run('Pull now', () => services.sync.pullSnapshot()),
        run('Force pull (cloud wins)', () => {
          if (!window.confirm('Replace newer local records with cloud copies?')) return Promise.resolve({ status: 'cancelled' });
          return services.sync.pullSnapshot({ force: true });
        }),
      );
      statusCard.append(controls);
      section.append(statusCard, notice);

      const pendingCard = document.createElement('div');
      pendingCard.className = 'workspace-card';
      const pendingTitle = document.createElement('h2');
      pendingTitle.textContent = 'Changes waiting to sync';
      pendingCard.append(pendingTitle);
      const changes = services.sync.pendingChanges(100);
      if (!changes.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Everything is synced.';
        pendingCard.append(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'card-list';
        for (const change of changes) {
          list.append(textStack([
            ['span', `${change.type} · ${change.label}`],
            ['small', change.modifiedAt ? String(change.modifiedAt).slice(0, 19).replace('T', ' ') : 'undated'],
          ]));
        }
        pendingCard.append(list);
      }
      section.append(pendingCard);

      const conflictCard = document.createElement('div');
      conflictCard.className = 'workspace-card sync-conflict';
      const conflictTitle = document.createElement('h2');
      conflictTitle.textContent = 'Conflicts';
      conflictCard.append(conflictTitle);
      const conflicts = Array.isArray(state.sync?.conflicts) ? state.sync.conflicts : [];
      if (!conflicts.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No conflicts. Pulls merge automatically; disagreements are listed here.';
        conflictCard.append(empty);
      } else {
        const radios = new Map();
        for (const conflict of conflicts) {
          const row = document.createElement('div');
          row.className = 'card';
          row.append(textStack([
            ['strong', `${conflict.entityType} · ${conflict.entityId}`],
            ['span', `Local: ${summarize(conflict.localPayload)} (${String(conflict.localModifiedAt).slice(0, 19).replace('T', ' ') || '—'})`],
            ['span', `Cloud: ${summarize(conflict.cloudPayload)} (${String(conflict.cloudModifiedAt).slice(0, 19).replace('T', ' ') || '—'})`],
          ]));
          const choice = document.createElement('div');
          choice.className = 'button-row';
          for (const [value, label] of [['local', 'Keep local'], ['cloud', 'Take cloud']]) {
            const option = document.createElement('label');
            option.className = 'sync-choice';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `conflict-${conflict.entityType}-${conflict.entityId}`;
            radio.value = value;
            if (value === 'local') radio.checked = true;
            option.append(radio, document.createTextNode(` ${label}`));
            choice.append(option);
            radios.set(`${conflict.entityType}:${conflict.entityId}`, radio);
          }
          row.append(choice);
          conflictCard.append(row);
        }
        const apply = action('Apply resolutions', 'primary');
        apply.addEventListener('click', async () => {
          const resolutions = [];
          for (const conflict of conflicts) {
            const key = `${conflict.entityType}:${conflict.entityId}`;
            const radio = radios.get(key);
            resolutions.push({ entityType: conflict.entityType, entityId: conflict.entityId, choice: radio?.value === 'cloud' ? 'cloud' : 'local' });
          }
          try {
            const result = await services.sync.resolveConflicts(resolutions);
            notice.textContent = `Conflicts resolved: ${result.local} kept local, ${result.cloud} taken from cloud. Push to publish kept-local records.`;
          } catch (error) {
            notice.textContent = `Resolution failed: ${error.message}`;
          }
        });
        conflictCard.append(apply);
      }
      section.append(conflictCard);

      const deviceCard = document.createElement('div');
      deviceCard.className = 'workspace-card';
      const deviceTitle = document.createElement('h2');
      deviceTitle.textContent = 'Devices in this workspace';
      deviceCard.append(deviceTitle);
      const devices = Array.isArray(state.sync?.devices) ? state.sync.devices : [];
      const self = services.sync.deviceId();
      if (!devices.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Devices appear after the first cloud pull.';
        deviceCard.append(empty);
      } else {
        for (const device of devices) {
          const row = document.createElement('div');
          row.className = 'sync-device-row';
          const id = document.createElement('span');
          id.textContent = `${String(device.id).slice(0, 24)}${device.id === self ? ' · this device' : ''}`;
          const seen = document.createElement('small');
          seen.textContent = device.lastSeen ? String(device.lastSeen).slice(0, 19).replace('T', ' ') : '—';
          row.append(id, seen);
          deviceCard.append(row);
        }
      }
      section.append(deviceCard);
      return section;
    },
  };
}
