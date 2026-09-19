import { trackingMilestone } from '../domain/tracking.js';
import { heading, textStack } from '../components/view.js';
import { action, field } from '../components/form.js';
import { podViewer, createPodCapture } from '../components/pod-view.js';
import { buildPod } from '../domain/pod.js';
import { timelineView } from '../components/timeline.js';

function publicTrackingUrl(token) {
  const url = new URL(location.href);
  url.searchParams.set('track', token);
  url.hash = '#/tracking';
  return url.toString();
}

async function lookupPublicTracking(supabase, token) {
  const client = await supabase.connect();
  // Preferred path: single-row SECURITY DEFINER lookup (docs/migrations/0001).
  try {
    const { data, error } = await client.rpc('tracking_lookup', { p_token: token });
    if (!error) return Array.isArray(data) ? (data[0] || null) : (data || null);
  } catch { /* function not deployed on this project yet */ }
  // Fallback until the migration is applied: direct table query.
  const { data, error } = await client.from('public_tracking_v35')
    .select('pick_id,status,archived,updated_at')
    .eq('tracking_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
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
  if (parcel.pod) card.append(podViewer(parcel.pod));
  if (readOnly) return card;

  const actions = document.createElement('div');
  actions.className = 'button-row';
  const wa = action('WhatsApp');
  const sms = action('SMS');
  const remind = action('Reminder');
  const share = action('Share PDF + link');
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
  share.addEventListener('click', async () => {
    try {
      const result = await services.share.shareParcel(parcel, store.getState().workspace?.name || 'LZWay');
      store.setState({ ui: { ...store.getState().ui, notice: result.mode === 'native' ? 'PDF and tracking link shared.' : `PDF downloaded; tracking link: ${result.secureLink}` } });
    } catch (error) {
      if (error?.name !== 'AbortError') store.setState({ ui: { ...store.getState().ui, notice: error.message } });
    }
  });
  copyLink.addEventListener('click', async () => {
    const url = publicTrackingUrl(parcel.trackingToken);
    try {
      await navigator.clipboard.writeText(url);
      copyLink.textContent = 'Link copied';
    } catch {
      store.setState({ ui: { ...store.getState().ui, notice: url } });
    }
  });
  const podButton = action('POD');
  const podPanel = document.createElement('div');
  podPanel.hidden = true;
  const capture = createPodCapture({
    onSave: (podData) => {
      const record = buildPod({ ...podData, by: store.getState().workspace?.name || '' });
      store.update((current) => ({
        ...current,
        parcels: current.parcels.map((item) => item.id === parcel.id ? { ...item, pod: record, modifiedAt: new Date().toISOString() } : item),
        archive: current.archive.map((item) => item.id === parcel.id ? { ...item, pod: record } : item),
      }));
    },
  });
  podPanel.append(capture.wrap);
  podButton.addEventListener('click', () => { podPanel.hidden = !podPanel.hidden; });
  actions.append(wa, sms, remind, share, copyLink, podButton);
  card.append(actions, podPanel);
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
          section.append(trackingCard(local, { readOnly: true }), timelineView(local, { phone: state.profileSettings?.supportPhone || '' }));
          return section;
        }
        const status = document.createElement('div');
        status.className = 'empty-state';
        status.textContent = 'Checking tracking ID…';
        section.append(status);
        (async () => {
          try {
            const data = await lookupPublicTracking(services.supabase, publicToken);
            if (!data) {
              status.textContent = 'Tracking ID not found.';
              return;
            }
            const parcel = { pickId: data.pick_id, status: data.status, archived: data.archived, statusUpdatedAt: data.updated_at };
            section.replaceChildren(heading('Shipment Tracking', 'Read-only shipment status.'), trackingCard(parcel, { readOnly: true }), timelineView(parcel, {}));
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
