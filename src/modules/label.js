import { field, action } from '../components/form.js';
import { heading } from '../components/view.js';
import { makeId, makePickId } from '../domain/ids.js';
import { calculateCollect, formatAr } from '../domain/money.js';
import { makeTrackingToken } from '../domain/tracking.js';
import { bytesToBase64, labelEscPos } from '../domain/escpos.js';

function emptyDraft() {
  return { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, deliveryCharge: 0, notes: '' } };
}

function labelHeading(draft) {
  const badge = document.createElement('span');
  badge.className = 'step-badge';
  badge.textContent = `Step ${draft.step} of 3`;
  return heading(draft.editParcelId ? 'Edit Label' : 'New Label', 'Customer → Parcel → Review / Print', badge);
}

function el(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function previewPickId(state, draft) {
  if (draft.editParcelId) return state.parcels.find((item) => item.id === draft.editParcelId)?.pickId || makePickId(state.parcels);
  return makePickId(state.parcels);
}

function previewDate(date = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function previewTime(date = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function tomorrow(date = new Date()) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return previewDate(next);
}

function trackingUrl(token) {
  const url = new URL(window.location.href);
  url.search = `?track=${encodeURIComponent(token)}`;
  url.hash = '#/tracking';
  return url.toString();
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value || 'LabelOnZeWay')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function finderDark(row, col, top, left) {
  if (row < top || row > top + 6 || col < left || col > left + 6) return null;
  const r = row - top;
  const c = col - left;
  const outer = r === 0 || r === 6 || c === 0 || c === 6;
  const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
  return outer || inner;
}

function qrPreview(seedValue) {
  const frame = el('div', 'thermal-qr-frame');
  const grid = el('div', 'thermal-qr-grid');
  let seed = hashSeed(seedValue);
  for (let row = 0; row < 21; row += 1) {
    for (let col = 0; col < 21; col += 1) {
      let dark = finderDark(row, col, 0, 0);
      if (dark === null) dark = finderDark(row, col, 0, 14);
      if (dark === null) dark = finderDark(row, col, 14, 0);
      if (dark === null && (row === 6 || col === 6)) dark = (row + col) % 2 === 0;
      if (dark === null) {
        seed = (Math.imul(seed ^ (row * 31 + col * 17 + 1), 1664525) + 1013904223) >>> 0;
        dark = ((seed >>> 28) & 1) === 1;
      }
      grid.append(el('i', dark ? 'is-dark' : ''));
    }
  }
  frame.append(grid);
  return frame;
}

function labelPreview(draft, state) {
  const now = new Date();
  const pickId = previewPickId(state, draft);
  const preview = el('article', 'label-preview approved-label-preview');

  const header = el('div', 'thermal-label-header');
  const brand = el('div', 'thermal-brand');
  const logo = el('div', 'thermal-logo', 'LZ');
  const brandCopy = el('div', 'thermal-brand-copy');
  brandCopy.append(el('strong', '', 'LabelOnZeWay'), el('span', '', 'Ship Smarter. Deliver Further.'));
  brand.append(logo, brandCopy);
  const stamp = el('div', 'thermal-stamp');
  stamp.append(el('span', '', previewDate(now)), el('strong', '', previewTime(now)));
  header.append(brand, stamp);

  const pickRow = el('div', 'thermal-pick-row');
  const pick = el('div', 'thermal-pick');
  pick.append(el('span', '', 'PICK'), el('strong', '', pickId));
  const qty = el('div', 'thermal-qty');
  qty.append(el('span', '', 'QTY'), el('strong', '', String(draft.parcel.qty)));
  const qr = el('div', 'thermal-qr');
  qr.append(qrPreview(pickId), el('span', '', 'SCAN POUR SUIVRE'), el('small', '', pickId));
  pickRow.append(pick, qty, qr);

  const recipient = el('div', 'thermal-recipient');
  recipient.append(el('span', 'thermal-kicker', 'DESTINATAIRE'));
  recipient.append(el('strong', 'thermal-recipient-name', draft.customer.name || 'Customer'));
  recipient.append(el('div', 'thermal-recipient-line thermal-recipient-phone', `TEL  ${draft.customer.phone || 'No phone'}`));
  recipient.append(el('div', 'thermal-recipient-line', draft.customer.address || 'No address'));

  const collect = el('div', 'thermal-collect');
  const collectMain = el('div', 'thermal-collect-main');
  collectMain.append(el('span', '', 'À COLLECTER'), el('strong', '', `${formatAr(draft.parcel.collect)} Ar`));
  const collectMeta = el('div', 'thermal-collect-meta');
  collectMeta.append(el('span', '', 'MODE'), el('strong', '', 'Espèces'));
  collectMeta.append(el('small', '', `Livraison ${formatAr(Math.max(0, Number(draft.parcel.deliveryCharge) || 0))} Ar`));
  collect.append(collectMain, collectMeta);

  const delivery = el('div', 'thermal-delivery');
  delivery.append(el('span', '', 'LIVRAISON PRÉVUE'), el('strong', '', tomorrow(now)), el('span', '', `Créé ${previewTime(now)}`));

  const footer = el('div', 'thermal-footer');
  footer.append(el('strong', '', 'Misaotra betsaka ! Merci pour votre confiance !'), el('small', '', 'LABELONZEWAY | PEOPLE. PARCELS. PROGRESS.'));

  preview.append(header, pickRow, recipient, collect, delivery);
  if (draft.parcel.notes) preview.append(el('div', 'thermal-notes', draft.parcel.notes));
  preview.append(footer);
  return preview;
}

function ocrReview(contact, targets) {
  const review = document.createElement('div');
  review.className = 'workspace-card ocr-review';
  const title = document.createElement('h2');
  title.textContent = 'Contact found in photo';
  const hint = document.createElement('p');
  hint.textContent = 'Review the extracted details before applying them.';
  const scanName = field('Name', 'ocrName', contact.name || '');
  const scanPhone = field('Phone', 'ocrPhone', contact.phone || '', { type: 'tel', inputmode: 'tel' });
  const scanAddress = field('Address', 'ocrAddress', contact.address || '', { multiline: true });
  const actions = document.createElement('div');
  actions.className = 'button-row';
  const use = action('Use scanned contact', 'primary');
  const edit = action('Edit scanned contact');
  const skip = action('Skip scan');
  edit.addEventListener('click', () => scanName.input.focus());
  use.addEventListener('click', () => {
    if (scanName.input.value.trim()) targets.name.value = scanName.input.value.trim();
    if (scanPhone.input.value.trim()) targets.phone.value = scanPhone.input.value.trim();
    if (scanAddress.input.value.trim()) targets.address.value = scanAddress.input.value.trim();
    review.replaceChildren();
    const applied = document.createElement('small');
    applied.textContent = 'Scanned contact applied.';
    review.append(applied);
  });
  skip.addEventListener('click', () => review.remove());
  actions.append(use, edit, skip);
  review.append(title, hint, scanName.wrap, scanPhone.wrap, scanAddress.wrap, actions);
  return review;
}

export function createLabelModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      const draft = state.labelDraft;
      section.append(labelHeading(draft));
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
        const reviewHost = document.createElement('div');
        reviewHost.className = 'ocr-review-host';
        scan.addEventListener('click', async () => {
          const image = photo.files?.[0];
          if (!image) { scanStatus.textContent = 'Choose or take a photo first.'; return; }
          scan.disabled = true;
          scan.textContent = 'Scanning…';
          scanStatus.textContent = 'Reading contact details…';
          reviewHost.replaceChildren();
          try {
            const contact = await services.ocr.recognize(image);
            reviewHost.append(ocrReview(contact, { name: name.input, phone: phone.input, address: address.input }));
            scanStatus.textContent = 'Scan complete. Use, edit or skip the extracted contact.';
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
        panel.append(scanCard, reviewHost, name.wrap, phone.wrap, address.wrap, next);
      }

      if (draft.step === 2) {
        const qty = field('Quantity', 'qty', draft.parcel.qty, { type: 'number', inputmode: 'numeric', min: 1 });
        const price = field('Unit price (Ar)', 'unitPrice', draft.parcel.unitPrice, { type: 'number', inputmode: 'decimal', min: 0 });
        const delivery = field('Delivery charge (Ar)', 'deliveryCharge', draft.parcel.deliveryCharge || 0, { type: 'number', inputmode: 'decimal', min: 0 });
        const notes = field('Parcel notes', 'notes', draft.parcel.notes, { multiline: true });
        const total = document.createElement('div');
        total.className = 'calculation';
        const refresh = () => {
          const collect = calculateCollect(qty.input.value, price.input.value);
          total.textContent = `Collect: ${formatAr(collect)} Ar · Delivery: ${formatAr(Math.max(0, Number(delivery.input.value) || 0))} Ar`;
        };
        qty.input.addEventListener('input', refresh);
        price.input.addEventListener('input', refresh);
        delivery.input.addEventListener('input', refresh);
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
            deliveryCharge: Math.max(0, Number(delivery.input.value) || 0),
            notes: notes.input.value.trim(),
          };
          store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 3, parcel } }));
        });
        actions.append(back, next);
        panel.append(qty.wrap, price.wrap, delivery.wrap, total, notes.wrap, actions);
      }

      if (draft.step === 3) {
        const preview = labelPreview(draft, state);
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const back = action('Edit parcel');
        const save = action(draft.editParcelId ? 'Update label' : 'Save label', 'primary');
        const print = action('Print 72mm test');
        back.addEventListener('click', () => store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2 } })));
        const materialize = (current) => {
          const existing = current.labelDraft.editParcelId ? current.parcels.find((item) => item.id === current.labelDraft.editParcelId) : null;
          return {
            ...(existing || {}),
            id: existing?.id || makeId('parcel'),
            pickId: existing?.pickId || makePickId(current.parcels),
            trackingToken: existing?.trackingToken || makeTrackingToken(),
            customerId: current.labelDraft.customerId,
            customer: current.labelDraft.customer,
            ...current.labelDraft.parcel,
            status: existing?.status || 'ready',
            createdAt: existing?.createdAt || new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          };
        };
        print.addEventListener('click', async () => {
          const parcel = materialize(store.getState());
          try {
            const result = await services.print.printWithRetry({ data: bytesToBase64(labelEscPos(parcel, { trackingUrl: trackingUrl(parcel.trackingToken) })), labels: 1 }, { attempts: 2 });
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
            const customerData = current.labelDraft.customer;
            if (!customerId) {
              const match = customers.find((item) => item.name.toLowerCase() === customerData.name.toLowerCase() && item.phone === customerData.phone);
              if (match) customerId = match.id;
              else {
                customerId = makeId('customer');
                customers = [...customers, { id: customerId, ...customerData }];
              }
            } else customers = customers.map((item) => item.id === customerId ? { ...item, ...customerData } : item);
            const parcel = { ...materialize(current), customerId };
            const parcels = current.labelDraft.editParcelId ? current.parcels.map((item) => item.id === current.labelDraft.editParcelId ? parcel : item) : [...current.parcels, parcel];
            return { ...current, customers, parcels, labelDraft: emptyDraft(), route: 'manifest' };
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
