import { trackingMilestone } from '../domain/tracking.js';
import { heading, textStack } from '../components/view.js';
import { action } from '../components/form.js';

export function createTrackingModule({ services, store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Tracking', 'Parcel status and customer communication.'));
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
        const copy = textStack([
          ['strong', `${parcel.pickId} · ${parcel.customer?.name || ''}`],
          ['span', trackingMilestone(parcel.status)],
          ['small', parcel.trackingToken || 'Tracking token pending'],
        ]);
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const wa = action('WhatsApp');
        const sms = action('SMS');
        const remind = action('Reminder');
        const notify = (channel, kind) => {
          try {
            services.messaging[channel](parcel, kind);
            store.setState({ ui: { ...store.getState().ui, notice: `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} opened for ${parcel.pickId}.` } });
          } catch (error) {
            store.setState({ ui: { ...store.getState().ui, notice: error.message } });
          }
        };
        wa.addEventListener('click', () => notify('whatsapp', 'status'));
        sms.addEventListener('click', () => notify('sms', 'status'));
        remind.addEventListener('click', () => notify('whatsapp', 'reminder'));
        actions.append(wa, sms, remind);
        card.append(copy, actions);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
