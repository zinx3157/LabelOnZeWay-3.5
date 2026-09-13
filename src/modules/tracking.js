import { trackingMilestone } from '../domain/tracking.js';

export function createTrackingModule() {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Tracking</h1><p>Read-only parcel status view.</p></div></div>';
      const list = document.createElement('div');
      list.className = 'card-list';
      if (!state.parcels.length) list.innerHTML = '<div class="empty-state">No active parcels to track.</div>';
      for (const parcel of state.parcels) {
        const card = document.createElement('article');
        card.className = 'card';
        const text = document.createElement('div');
        text.innerHTML = `<strong>${parcel.pickId} · ${parcel.customer?.name || ''}</strong><span>${trackingMilestone(parcel.status)}</span><small>${parcel.trackingToken || 'Tracking token pending'}</small>`;
        card.append(text);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
