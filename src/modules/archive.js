import { action } from '../components/form.js';
import { heading, textStack } from '../components/view.js';

export function createArchiveModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Archive', 'Closed parcels remain accessible inside the app.'));

      const delivered = state.parcels.filter((parcel) => parcel.status === 'delivered');
      if (delivered.length) {
        const archiveDelivered = action(`Archive delivered (${delivered.length})`, 'primary');
        archiveDelivered.addEventListener('click', () => {
          const ids = new Set(delivered.map((item) => item.id));
          store.update((current) => ({ ...current, parcels: current.parcels.filter((item) => !ids.has(item.id)), archive: [...current.archive, ...delivered.map((item) => ({ ...item, archivedAt: new Date().toISOString() }))] }));
        });
        section.append(archiveDelivered);
      }

      const list = document.createElement('div');
      list.className = 'card-list archive-list';
      if (!state.archive.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Archive is empty.';
        list.append(empty);
      }
      for (const item of [...state.archive].reverse()) {
        const card = document.createElement('article');
        card.className = 'card';
        card.append(textStack([
          ['strong', item.pickId || 'Unknown Pick ID'],
          ['span', item.customer?.name || 'Unknown customer'],
          ['span', `${item.status || 'archived'} · ${new Date(item.archivedAt).toLocaleString()}`],
        ]));
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
