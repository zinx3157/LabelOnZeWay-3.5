import { trackingMilestone } from '../domain/tracking.js';
import { heading, textStack } from '../components/view.js';

export function createTrackingModule() {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Tracking', 'Read-only parcel status view.'));
      const list = document.createElement('div');
      list.className = 'card-list';
      if (!state.parcels.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No active parcels to track.';
        list.append(empty);
      }
      for (const parcel of state.parcels) {
        const card = document.createElement('article');
        card.className = 'card';
        card.append(textStack([
          ['strong', `${parcel.pickId} · ${parcel.customer?.name || ''}`],
          ['span', trackingMilestone(parcel.status)],
          ['small', parcel.trackingToken || 'Tracking token pending'],
        ]));
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
