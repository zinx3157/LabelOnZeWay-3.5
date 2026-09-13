import { field, action } from '../components/form.js';
import { heading, textStack } from '../components/view.js';
import { makeId, makePickId } from '../domain/ids.js';
import { calculateCollect, formatAr } from '../domain/money.js';
import { makeTrackingToken } from '../domain/tracking.js';
import { bytesToBase64, labelEscPos } from '../domain/escpos.js';

function labelHeading(step) {
  const badge = document.createElement('span');
  badge.className = 'step-badge';
  badge.textContent = `Step ${step} of 3`;
  return heading('New Label', 'Customer → Parcel → Review / Print', badge);
}

function labelPreview(draft) {
  const preview = document.createElement('article');
  preview.className = 'label-preview';
  const brand = document.createElement('div');
  brand.className = 'label-preview-brand';
  brand.textContent = 'LabelOnZeWay';
  const identity = textStack([
    ['strong', draft.customer.name],
    ['span', draft.customer.phone || ''],
    ['span', draft.customer.address || ''],
  ]);
  const rule = document.createElement('hr');
  const details = textStack([
    ['span', `Qty: ${draft.parcel.qty}`],
    ['span', `Unit: ${formatAr(draft.parcel.unitPrice)} Ar`],
    ['b', `Collect: ${formatAr(draft.parcel.collect)} Ar`],
  ]);
  preview.append(brand, identity, rule, details);
  if (draft.parcel.notes) {
    const notes = document.createElement('small');
    notes.textContent = draft.parcel.notes;
    preview.append(notes);
  }
  return preview;
}

export function createLabelModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      const draft = state.labelDraft;
      section.append(labelHeading(draft.step));
      const panel = document.createElement('div');
      panel.className = 'workspace-card';

      if (draft.step === 1) {
        const name = field('Customer name', 'name', draft.customer.name, { placeholder: 'Full name' });
        const phone = field('Phone', 'phone', draft.customer.phone, { type: 'tel', inputmode: 'tel', placeholder: '032 / 033 / 034 / 035 / 037 / 038 / 039' });
        const address = field('Address', 'address', draft.customer.address, { multiline: true, placeholder: 'Delivery address' });

        const scanCard = document.createElement('div');
        scanCard.className = 'scan-row';
        const photo = document.createElement('input');
        photo.type = 'file';
        photo.accept = 'image/*';
        photo.setAttribute('capture', 'environment');
        photo.setAttribute('aria-label', 'Customer address photo');
        const scan = action('Scan photo');
        const scanStatus = document.createElement('small');
        scanStatus.textContent = 'OCR loads only when you scan.';
        scan.addEventListener('click', async () => {
          const image = photo.files?.[0];
          if (!image) { scanStatus.textContent = 'Choose or take a photo first.'; return; }
          scan.disabled = true;
          scan.textContent = 'Scanning…';
          scanStatus.textContent = 'Reading contact details…';
          try {
            const contact = await services.ocr.recognize(image);
            if (contact.name && !name.input.value.trim()) name.input.value = contact.name;
            if (contact.phone) phone.input.value = contact.phone;
            if (contact.address) address.input.value = contact.address;
            scanStatus.textContent = 'Scan complete. Check the extracted details before continuing.';
          } catch (error) {
            scanStatus.textContent = `Scan failed: ${error.message}`;
          } finally {
            scan.disabled = false;
            scan.textContent = 'Scan photo';
          }
        });
        scanCard.append(photo, scan, scanStatus);

        const next = action('Continue to parcel', 'primary');
        next.addEventListener('click', () => {
          const customer = { name: name.input.value.trim(), phone: phone.input.value.trim(), address: address.input.value.trim() };
          if (!customer.name) { name.input.focus(); return; }
          store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2, customer } }));
        });
        panel.append(scanCard, name.wrap, phone.wrap, address.wrap, next);
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
          const parcel = {
            qty: Math.max(1, Number(qty.input.value) || 1),
            unitPrice: Math.max(0, Number(price.input.value) || 0),
            collect: calculateCollect(qty.input.value, price.input.value),
            notes: notes.input.value.trim(),
          };
          store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 3, parcel } }));
        });
        actions.append(back, next);
        panel.append(qty.wrap, price.wrap, total, notes.wrap, actions);
      }

      if (draft.step === 3) {
        const preview = labelPreview(draft);
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const back = action('Edit parcel');
        const save = action('Save label', 'primary');
        const print = action('Print test');
        back.addEventListener('click', () => store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2 } })));
        const materialize = (current) => ({
          id: makeId('parcel'),
          pickId: makePickId(current.parcels),
          trackingToken: makeTrackingToken(),
          customerId: current.labelDraft.customerId,
          customer: current.labelDraft.customer,
          ...current.labelDraft.parcel,
          status: 'ready',
          createdAt: new Date().toISOString(),
        });
        print.addEventListener('click', async () => {
          const parcel = materialize(store.getState());
          try {
            const result = await services.print.print({ data: bytesToBase64(labelEscPos(parcel)), labels: 1 });
            print.textContent = result.adapter === 'cloud' ? 'Queued to cloud' : 'Printed';
          } catch (error) {
            print.textContent = 'Print failed';
            store.setState({ ui: { ...store.getState().ui, notice: error.message } });
          }
        });
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
            const parcel = { ...materialize(current), customerId };
            return {
              ...current,
              customers,
              parcels: [...current.parcels, parcel],
              labelDraft: { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, notes: '' } },
              route: 'manifest',
            };
          });
          location.hash = '#/manifest';
        });
        actions.append(back, print, save);
        panel.append(preview, actions);
      }
      section.append(panel);
      return section;
    },
  };
}
