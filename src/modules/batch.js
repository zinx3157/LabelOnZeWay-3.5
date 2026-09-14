import { action } from '../components/form.js';
import { heading } from '../components/view.js';
import { updateParcelStatuses } from '../domain/manifest.js';
import { bytesToBase64, labelEscPos } from '../domain/escpos.js';

export function createBatchModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Batch', 'Prepare and print ready parcels for dispatch.'));
      const ready = state.parcels.filter((parcel) => parcel.status === 'ready');
      const card = document.createElement('div');
      card.className = 'workspace-card';
      const summary = document.createElement('div');
      summary.className = 'calculation';
      summary.textContent = `${ready.length} parcel${ready.length === 1 ? '' : 's'} ready for dispatch`;
      const result = document.createElement('p');

      const dispatch = action('Dispatch ready parcels', 'primary');
      dispatch.disabled = ready.length === 0;
      dispatch.addEventListener('click', () => store.update((current) => ({ ...current, parcels: updateParcelStatuses(current.parcels, ready.map((item) => item.id), 'dispatch') })));

      const print = action('Print ready labels');
      print.disabled = ready.length === 0;
      print.addEventListener('click', async () => {
        print.disabled = true;
        let printed = 0;
        try {
          for (const parcel of ready) {
            await services.print.printWithRetry({ data: bytesToBase64(labelEscPos(parcel)), labels: 1, idempotencyKey: `batch-${parcel.id}-${parcel.modifiedAt || parcel.createdAt || 'v1'}` }, { attempts: 2 });
            printed += 1;
            result.textContent = `Printed/queued ${printed} of ${ready.length}.`;
          }
          result.textContent = `Batch output complete: ${printed} label${printed === 1 ? '' : 's'}.`;
        } catch (error) {
          result.textContent = `Batch output stopped after ${printed}: ${error.message}`;
        } finally {
          print.disabled = ready.length === 0;
        }
      });

      const row = document.createElement('div');
      row.className = 'button-row';
      row.append(print, dispatch);
      card.append(summary, row, result);
      section.append(card);
      return section;
    },
  };
}
