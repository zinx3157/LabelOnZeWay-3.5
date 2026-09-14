import { trackingMilestone } from '../domain/tracking.js';
import { heading, textStack } from '../components/view.js';
import { action, field } from '../components/form.js';

function publicTrackingUrl(token) {
  const url = new URL(location.href);
  url.searchParams.set('track', token);
  url.hash = '#/tracking';
  return url.toString();
}

function findByTracking(state, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return null;
  return [...state.parcels, ...state.archive].find((parcel) =>
    String(parcel.trackingToken || '').toLowerCase() === needle || String(parcel.pickId || '').toLowerCase() === needle
  ) || null;
}

function trackingCard(parcel, { readOnly = false, services, store } = {}) {
  const card = document.createElement('article');
  card.className = 'card';
  const copy = textStack([
    ['strong', readOnly ? parcel.pickId : `${parcel.pickId} · ${parcel.customer?.name || ''}`],
    ['span', trackingMilestone(parcel.status)],
    ['span', `Status: ${String(parcel.status || 'unknown').replace('-', ' ')}`],
    ['small', parcel.archivedAt || parcel.archived ? 'Archived shipment' : 'Active shipment'],
  ]);
  card.append(copy);
  if (readOnly) return card;

  const actions = document.createElement('div');
  actions.className = 'button-row';
  const wa = action('WhatsApp');
  const sms = action('SMS');
  const remind = action('Reminder');
  const copyLink = action('Copy tracking link');
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
  copyLink.addEventListener('click', async () => {
    const url = publicTrackingUrl(parcel.trackingToken);
    try {
      await navigator.clipboard.writeText(url);
      copyLink.textContent = 'Link copied';
    } catch {
      store.setState({ ui: { ...store.getState().ui, notice: url } });
    }
  });
  actions.append(wa, sms, remind, copyLink);
  card.append(actions);
  return card;
}

export function createTrackingModule({ services, store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      const publicToken = new URLSearchParams(location.search).get('track');
      section.append(heading(publicToken ? 'Shipment Tracking' : 'Tracking', publicToken ? 'Read-only shipment status.' : 'Parcel status and customer communication.'));

      if (publicToken) {
        const local = findByTracking(state, publicToken);
        if (local) {
          section.append(trackingCard(local, { readOnly: true }));
          return section;
        }
        const status = document.createElement('div');
        status.className = 'empty-state';
        status.textContent = 'Checking tracking ID…';
        section.append(status);
        (async () => {
          try {
            const client = await services.supabase.connect();
            const { data, error } = await client.from('public_tracking_v35')
              .select('pick_id,status,archived,updated_at')
              .eq('tracking_token', publicToken)
              .maybeSingle();
            if (error) throw error;
            if (!data) {
              status.textContent = 'Tracking ID not found.';
              return;
            }
            const parcel = { pickId: data.pick_id, status: data.status, archived: data.archived, statusUpdatedAt: data.updated_at };
            section.replaceChildren(heading('Shipment Tracking', 'Read-only shipment status.'), trackingCard(parcel, { readOnly: true }));
          } catch {
            status.textContent = 'Tracking service temporarily unavailable.';
          }
        })();
        return section;
      }

      const search = field('Find by Pick ID or tracking token', 'trackingSearch', '', { placeholder: 'Enter tracking ID' });
      const result = document.createElement('div');
      result.className = 'card-list';
      search.input.addEventListener('input', () => {
        result.replaceChildren();
        const query = search.input.value.trim();
        if (!query) return;
        const parcel = findByTracking(store.getState(), query);
        if (!parcel) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'Tracking ID not found.';
          result.append(empty);
          return;
        }
        result.append(trackingCard(parcel, { services, store }));
      });
      section.append(search.wrap, result);

      const list = document.createElement('div');
      list.className = 'card-list';
      if (!state.parcels.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No active parcels to track.';
        list.append(empty);
      }
      for (const parcel of state.parcels) list.append(trackingCard(parcel, { services, store }));
      section.append(list);
      return section;
    },
  };
}
