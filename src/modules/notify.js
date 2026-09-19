import { heading, textStack } from '../components/view.js';
import { field, action } from '../components/form.js';
import { buildNotificationQueue, DEFAULT_NOTIFY_TEMPLATES, NOTIFY_KINDS } from '../domain/notifications.js';

export function createNotifyModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Customer Notifications', 'WhatsApp reminders driven by parcel status and aging. Templates sync with the profile.'));

      const settingsCard = document.createElement('div');
      settingsCard.className = 'workspace-card';
      const settingsTitle = document.createElement('h2');
      settingsTitle.textContent = 'Rules & templates';
      const agingDays = field('Remind after (days waiting)', 'notifyAgingDays', String(state.profileSettings?.notifyAgingDays ?? 3), { type: 'number', inputmode: 'numeric', min: 0 });
      const templates = { ...DEFAULT_NOTIFY_TEMPLATES, ...(state.profileSettings?.notifyTemplates || {}) };
      const templateFields = NOTIFY_KINDS.map((kind) => field(`${kind} template`, `notifyTemplate-${kind}`, templates[kind] || '', { multiline: true }));
      const saveSettings = action('Save rules', 'primary');
      const settingsStatus = document.createElement('p');
      settingsStatus.className = 'pod-meta';
      saveSettings.addEventListener('click', () => {
        const nextTemplates = {};
        NOTIFY_KINDS.forEach((kind, index) => { nextTemplates[kind] = templateFields[index].input.value; });
        store.update((current) => ({
          ...current,
          profileSettings: {
            ...current.profileSettings,
            notifyAgingDays: Math.max(0, Number(agingDays.input.value) || 0),
            notifyTemplates: nextTemplates,
          },
        }));
        settingsStatus.textContent = 'Rules saved to this profile.';
      });
      settingsCard.append(settingsTitle, agingDays.wrap, ...templateFields.map((item) => item.wrap), saveSettings, settingsStatus);
      section.append(settingsCard);

      const queueCard = document.createElement('div');
      queueCard.className = 'workspace-card';
      const queueTitle = document.createElement('h2');
      queueTitle.textContent = 'Message queue';
      const hint = document.createElement('p');
      const list = document.createElement('div');
      list.className = 'card-list';
      const refresh = action('Refresh queue', 'primary');
      const headerRow = document.createElement('div');
      headerRow.className = 'button-row';
      headerRow.append(refresh);

      function paint() {
        const current = store.getState();
        const queue = buildNotificationQueue(current, {
          agingDays: Number(current.profileSettings?.notifyAgingDays ?? 3),
          templates: current.profileSettings?.notifyTemplates || {},
        });
        hint.textContent = queue.length
          ? `${queue.length} customer(s) need a message. Open WhatsApp per row, then mark it sent.`
          : 'No customers need a message right now.';
        list.replaceChildren();
        if (!queue.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'Queue is empty — aging threshold not reached and no open exceptions.';
          list.append(empty);
          return;
        }
        for (const item of queue) {
          const card = document.createElement('article');
          card.className = 'card notify-row';
          card.append(textStack([
            ['strong', `${item.pickId} · ${item.kind}${item.days ? ` · ${item.days}d waiting` : ''}`],
            ['span', `${item.name} · ${item.phone}`],
            ['small', item.message],
          ]));
          const controls = document.createElement('div');
          controls.className = 'button-row';
          const open = action('Open WhatsApp', 'primary');
          open.addEventListener('click', () => { window.open(item.waUrl, '_blank', 'noopener,noreferrer'); });
          const sent = action('Mark sent');
          sent.addEventListener('click', () => {
            store.update((latest) => ({
              ...latest,
              parcels: (latest.parcels || []).map((parcel) => parcel.id === item.parcelId
                ? { ...parcel, notifyLog: [...(Array.isArray(parcel.notifyLog) ? parcel.notifyLog : []), { kind: item.kind, at: new Date().toISOString(), channel: 'whatsapp' }] }
                : parcel),
            }));
          });
          controls.append(open, sent);
          card.append(controls);
          list.append(card);
        }
      }
      refresh.addEventListener('click', paint);
      paint();
      queueCard.append(queueTitle, hint, headerRow, list);
      section.append(queueCard);
      return section;
    },
  };
}
