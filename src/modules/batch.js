import { action } from '../components/form.js';
import { heading } from '../components/view.js';
import { updateParcelStatuses } from '../domain/manifest.js';

export function createBatchModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Batch', 'Prepare ready parcels for dispatch.'));
      const ready = state.parcels.filter((parcel) => parcel.status === 'ready');
      const card = document.createElement('div');
      card.className = 'workspace-card';
      const summary = document.createElement('div');
      summary.className = 'calculation';
      summary.textContent = `${ready.length} parcel${ready.length === 1 ? '' : 's'} ready for dispatch`;
      const dispatch = action('Dispatch ready parcels', 'primary');
      dispatch.disabled = ready.length === 0;
      dispatch.addEventListener('click', () => store.update((current) => ({ ...current, parcels: updateParcelStatuses(current.parcels, ready.map((item) => item.id), 'dispatch') })));
      card.append(summary, dispatch);
      section.append(card);
      return section;
    },
  };
}
