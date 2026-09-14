import { action, field } from '../components/form.js';
import { heading, textStack } from '../components/view.js';

export function createArchiveModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Archive', 'Select delivered parcels to archive, search history, and restore when needed.'));

      const delivered = state.parcels.filter((parcel) => parcel.status === 'delivered');
      if (delivered.length) {
        const selected = new Set();
        const deliveredList = document.createElement('div');
        deliveredList.className = 'card-list';
        for (const item of delivered) {
          const card = document.createElement('article');
          card.className = 'card';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.setAttribute('aria-label', `Archive ${item.pickId}`);
          checkbox.addEventListener('change', () => checkbox.checked ? selected.add(item.id) : selected.delete(item.id));
          card.append(checkbox, textStack([
            ['strong', item.pickId || 'Unknown Pick ID'],
            ['span', item.customer?.name || 'Unknown customer'],
            ['span', 'Delivered · ready to archive'],
          ]));
          deliveredList.append(card);
        }
        const archiveSelected = action('Archive selected', 'primary');
        archiveSelected.addEventListener('click', () => {
          if (!selected.size) return;
          const now = new Date().toISOString();
          store.update((current) => {
            const moving = current.parcels.filter((item) => selected.has(item.id));
            return {
              ...current,
              parcels: current.parcels.filter((item) => !selected.has(item.id)),
              archive: [...current.archive, ...moving.map((item) => ({ ...item, archivedAt: now }))],
            };
          });
        });
        section.append(archiveSelected, deliveredList);
      }

      const search = field('Search archive', 'archiveSearch', '', { placeholder: 'Pick ID, customer, status' });
      section.append(search.wrap);
      const list = document.createElement('div');
      list.className = 'card-list archive-list';

      const paint = (query = '') => {
        const term = query.trim().toLowerCase();
        const matches = [...store.getState().archive].reverse().filter((item) => {
          const haystack = [item.pickId, item.customer?.name, item.customer?.phone, item.status].filter(Boolean).join(' ').toLowerCase();
          return !term || haystack.includes(term);
        });
        list.replaceChildren();
        if (!matches.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = term ? 'No archived parcel matches this search.' : 'Archive is empty.';
          list.append(empty);
          return;
        }
        for (const item of matches) {
          const card = document.createElement('article');
          card.className = 'card';
          card.dataset.archiveId = item.id;
          const restore = action('Restore');
          restore.addEventListener('click', () => {
            store.update((current) => ({
              ...current,
              archive: current.archive.filter((entry) => entry.id !== item.id),
              parcels: [...current.parcels, { ...item, archivedAt: undefined, status: item.status === 'delivered' ? 'delivery' : item.status }],
            }));
          });
          card.append(textStack([
            ['strong', item.pickId || 'Unknown Pick ID'],
            ['span', item.customer?.name || 'Unknown customer'],
            ['span', `${item.status || 'archived'} · ${item.archivedAt ? new Date(item.archivedAt).toLocaleString() : 'Unknown archive date'}`],
          ]), restore);
          list.append(card);
        }
      };

      search.input.addEventListener('input', () => paint(search.input.value));
      paint();
      section.append(list);
      return section;
    },
  };
}
