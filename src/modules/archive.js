import { action } from '../components/form.js';

export function createArchiveModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Archive</h1><p>Closed parcels remain accessible inside the app.</p></div></div>';

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
      if (!state.archive.length) list.innerHTML = '<div class="empty-state">Archive is empty.</div>';
      for (const item of [...state.archive].reverse()) {
        const card = document.createElement('article');
        card.className = 'card';
        const text = document.createElement('div');
        text.innerHTML = `<strong>${item.pickId}</strong><span>${item.customer?.name || ''}</span><span>${item.status} · ${new Date(item.archivedAt).toLocaleString()}</span>`;
        card.append(text);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
