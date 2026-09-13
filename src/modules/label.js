import { field, action } from '../components/form.js';
import { makeId, makePickId } from '../domain/ids.js';
import { calculateCollect, formatAr } from '../domain/money.js';

function heading(step) {
  const wrap = document.createElement('div');
  wrap.className = 'screen-heading';
  wrap.innerHTML = `<div><h1>New Label</h1><p>Customer → Parcel → Review / Print</p></div><span class="step-badge">Step ${step} of 3</span>`;
  return wrap;
}

export function createLabelModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      const draft = state.labelDraft;
      section.append(heading(draft.step));

      const panel = document.createElement('div');
      panel.className = 'workspace-card';

      if (draft.step === 1) {
        const name = field('Customer name', 'name', draft.customer.name, { placeholder: 'Full name' });
        const phone = field('Phone', 'phone', draft.customer.phone, { type: 'tel', inputmode: 'tel', placeholder: '032 / 033 / 034 / 035 / 037 / 038 / 039' });
        const address = field('Address', 'address', draft.customer.address, { multiline: true, placeholder: 'Delivery address' });
        const next = action('Continue to parcel', 'primary');
        next.addEventListener('click', () => {
          const customer = { name: name.input.value.trim(), phone: phone.input.value.trim(), address: address.input.value.trim() };
          if (!customer.name) { name.input.focus(); return; }
          store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2, customer } }));
        });
        panel.append(name.wrap, phone.wrap, address.wrap, next);
      }

      if (draft.step === 2) {
        const qty = field('Quantity', 'qty', draft.parcel.qty, { type: 'number', inputmode: 'numeric', min: 1 });
        const price = field('Unit price (Ar)', 'unitPrice', draft.parcel.unitPrice, { type: 'number', inputmode: 'decimal', min: 0 });
        const notes = field('Parcel notes', 'notes', draft.parcel.notes, { multiline: true });
        const total = document.createElement('div');
        total.className = 'calculation';
        const refresh = () => { total.textContent = `Collect: ${formatAr(calculateCollect(qty.input.value, price.input.value))} Ar`; };
        qty.input.addEventListener('input', refresh);
        price.input.addEventListener('input', refresh);
        refresh();
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const back = action('Back');
        const next = action('Review label', 'primary');
        back.addEventListener('click', () => store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 1 } })));
        next.addEventListener('click', () => {
          const parcel = { qty: Math.max(1, Number(qty.input.value) || 1), unitPrice: Math.max(0, Number(price.input.value) || 0), collect: calculateCollect(qty.input.value, price.input.value), notes: notes.input.value.trim() };
          store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 3, parcel } }));
        });
        actions.append(back, next);
        panel.append(qty.wrap, price.wrap, total, notes.wrap, actions);
      }

      if (draft.step === 3) {
        const preview = document.createElement('article');
        preview.className = 'label-preview';
        preview.innerHTML = `<div class="label-preview-brand">LabelOnZeWay</div><strong>${draft.customer.name}</strong><span>${draft.customer.phone || ''}</span><span>${draft.customer.address || ''}</span><hr><span>Qty: ${draft.parcel.qty}</span><span>Unit: ${formatAr(draft.parcel.unitPrice)} Ar</span><b>Collect: ${formatAr(draft.parcel.collect)} Ar</b>${draft.parcel.notes ? `<small>${draft.parcel.notes}</small>` : ''}`;
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const back = action('Edit parcel');
        const save = action('Save label', 'primary');
        back.addEventListener('click', () => store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2 } })));
        save.addEventListener('click', () => {
          store.update((current) => {
            let customerId = current.labelDraft.customerId;
            let customers = current.customers;
            if (!customerId) {
              const match = customers.find((item) => item.name.toLowerCase() === current.labelDraft.customer.name.toLowerCase() && item.phone === current.labelDraft.customer.phone);
              if (match) customerId = match.id;
              else {
                customerId = makeId('customer');
                customers = [...customers, { id: customerId, ...current.labelDraft.customer }];
              }
            }
            const parcel = { id: makeId('parcel'), pickId: makePickId(current.parcels), customerId, customer: current.labelDraft.customer, ...current.labelDraft.parcel, status: 'ready', createdAt: new Date().toISOString() };
            return { ...current, customers, parcels: [...current.parcels, parcel], labelDraft: { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, notes: '' } }, route: 'manifest' };
          });
          location.hash = '#/manifest';
        });
        actions.append(back, save);
        panel.append(preview, actions);
      }

      section.append(panel);
      return section;
    },
  };
}
