import { field, action } from '../components/form.js';
import { heading, textStack } from '../components/view.js';
import { makeId } from '../domain/ids.js';
import { podViewer } from '../components/pod-view.js';

export function createClaimsModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Claims Vault', 'Parcel-linked claims, incidents and resolutions.'));

      const form = document.createElement('div');
      form.className = 'workspace-card';
      const pick = field('Pick ID', 'claimPickId', '', { placeholder: 'Pick ID' });
      const reason = field('Claim / incident', 'claimReason', '', { multiline: true, placeholder: 'Describe damage, loss, exception or customer claim' });
      const add = action('Open claim', 'primary');
      const status = document.createElement('p');
      add.addEventListener('click', () => {
        const pickId = pick.input.value.trim();
        const note = reason.input.value.trim();
        if (!pickId || !note) { status.textContent = 'Pick ID and claim details are required.'; return; }
        const parcel = [...state.parcels, ...state.archive].find((item) => String(item.pickId).toLowerCase() === pickId.toLowerCase());
        if (!parcel) { status.textContent = 'Pick ID not found.'; return; }
        const claim = {
          id: makeId('claim'),
          parcelId: parcel.id,
          pickId: parcel.pickId,
          customerName: parcel.customer?.name || '',
          reason: note,
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.update((current) => ({ ...current, claims: [...(current.claims || []), claim] }));
        pick.input.value = '';
        reason.input.value = '';
      });
      form.append(pick.wrap, reason.wrap, add, status);
      section.append(form);

      const list = document.createElement('div');
      list.className = 'card-list';
      const claims = [...(state.claims || [])].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      if (!claims.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No claims recorded.';
        list.append(empty);
      }
      for (const claim of claims) {
        const card = document.createElement('article');
        card.className = 'card';
        const details = textStack([
          ['strong', `${claim.pickId} · ${claim.status}`],
          ['span', claim.customerName || 'Unknown customer'],
          ['span', claim.reason],
          ['small', new Date(claim.updatedAt || claim.createdAt).toLocaleString()],
        ]);
        const controls = document.createElement('div');
        controls.className = 'button-row';
        const toggle = action(claim.status === 'resolved' ? 'Reopen' : 'Resolve', claim.status === 'resolved' ? 'secondary' : 'primary');
        toggle.setAttribute('aria-label', `${claim.status === 'resolved' ? 'Reopen' : 'Resolve'} claim ${claim.pickId}`);
        toggle.addEventListener('click', () => {
          store.update((current) => ({
            ...current,
            claims: (current.claims || []).map((item) => item.id === claim.id ? { ...item, status: item.status === 'resolved' ? 'open' : 'resolved', updatedAt: new Date().toISOString() } : item),
          }));
        });
        controls.append(toggle);
        const podParcel = [...state.parcels, ...state.archive].find((item) => item.id === claim.parcelId);
        card.append(details, ...(podParcel?.pod ? [podViewer(podParcel.pod)] : []), controls);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
