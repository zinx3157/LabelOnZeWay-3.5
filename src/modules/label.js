import { field, action } from '../components/form.js';
import { heading } from '../components/view.js';
import { makeId, makePickId } from '../domain/ids.js';
import { calculateCollect, formatAr } from '../domain/money.js';
import { makeTrackingToken } from '../domain/tracking.js';
import { bytesToBase64, labelEscPos } from '../domain/escpos.js';

function emptyDraft() {
  return { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, deliveryCharge: 0, notes: '' } };
}

function labelHeading(draft, mode = 'single') {
  const badge = document.createElement('span');
  badge.className = 'step-badge';
  badge.textContent = mode === 'batch' ? 'Batch Scan' : `Step ${draft.step} of 3`;
  return heading(draft.editParcelId ? 'Edit Label' : 'New Label', mode === 'batch' ? 'Scan → Review → Create / Print' : 'Customer → Parcel → Review / Print', badge);
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

function normalize(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '').replace(/^261/, '0');
}

function findCustomerMatch(customers, contact) {
  const phone = normalizePhone(contact.phone);
  const name = normalize(contact.name);
  return customers.find((item) => {
    const itemPhone = normalizePhone(item.phone);
    const itemName = normalize(item.name);
    return (phone && itemPhone === phone) || (name && itemName === name && normalize(item.address) === normalize(contact.address));
  }) || null;
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
  stamp.append(el('strong', '', previewTime(now)));
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
  delivery.append(el('span', '', 'LIVRAISON PRÉVUE'), el('strong', '', tomorrow(now)));
  const footer = el('div', 'thermal-footer');
  footer.append(el('strong', '', 'Misaotra betsaka ! Merci pour votre confiance !'), el('small', '', 'LABELONZEWAY | PEOPLE. PARCELS. PROGRESS.'));
  preview.append(header, pickRow, recipient, collect, delivery);
  if (draft.parcel.notes) preview.append(el('div', 'thermal-notes', draft.parcel.notes));
  preview.append(footer);
  return preview;
}

function statusPill(text, tone = '') {
  return el('span', `scan-status-pill ${tone}`.trim(), text);
}

function renderSingleScan({ panel, draft, services, store }) {
  const shell = el('div', 'single-scan-flow');
  const photoSection = el('section', 'scan-section');
  const photoHead = el('div', 'scan-section-head');
  const photoTitle = el('div', 'scan-title-wrap');
  photoTitle.append(el('span', 'scan-number', '1'), el('div', '', ''));
  photoTitle.lastChild.append(el('strong', '', 'Photo / Scan'), el('small', '', 'Upload or take a photo of the label/address'));
  photoHead.append(photoTitle);

  const upload = el('div', 'scan-upload-card');
  const thumb = el('div', 'scan-thumb');
  thumb.append(el('span', '', 'PHOTO'));
  const uploadInfo = el('div', 'scan-upload-info');
  const fileName = el('strong', '', 'No photo selected');
  const fileMeta = el('small', '', 'JPEG / PNG · camera supported');
  uploadInfo.append(fileName, fileMeta);
  const controls = el('div', 'button-row');
  const photo = document.createElement('input');
  photo.type = 'file';
  photo.accept = 'image/*';
  photo.setAttribute('capture', 'environment');
  photo.className = 'scan-file-input';
  photo.setAttribute('aria-label', 'Customer address photo');
  const choose = action('Choose photo');
  const scan = action('Scan photo', 'primary');
  const scanBadge = statusPill('Ready to scan');
  controls.append(choose, scan, scanBadge);
  upload.append(thumb, uploadInfo, controls, photo);

  const customerSection = el('section', 'scan-section');
  const customerHead = el('div', 'scan-section-head');
  const customerTitle = el('div', 'scan-title-wrap');
  customerTitle.append(el('span', 'scan-number', '2'), el('div', '', ''));
  customerTitle.lastChild.append(el('strong', '', 'Customer Information'), el('small', '', 'Verify and edit the extracted information'));
  customerHead.append(customerTitle);

  const name = field('Full name', 'name', draft.customer.name, { placeholder: 'Full name' });
  const phone = field('Phone', 'phone', draft.customer.phone, { type: 'tel', inputmode: 'tel', placeholder: '032 / 033 / 034 / 035 / 037 / 038 / 039' });
  const address = field('Address', 'address', draft.customer.address, { multiline: true, placeholder: 'Delivery address' });
  const fields = el('div', 'scan-customer-fields');
  fields.append(name.wrap, phone.wrap, address.wrap);
  const detected = el('aside', 'scan-detected-card');
  detected.append(el('strong', '', 'OCR Detected'), el('p', '', 'Scan a photo to populate detected customer details.'));
  const infoGrid = el('div', 'scan-customer-grid');
  infoGrid.append(fields, detected);

  let currentPhoto = null;
  choose.addEventListener('click', () => photo.click());
  photo.addEventListener('change', () => {
    currentPhoto = photo.files?.[0] || null;
    if (!currentPhoto) return;
    fileName.textContent = currentPhoto.name;
    fileMeta.textContent = `${Math.max(1, Math.round(currentPhoto.size / 1024))} KB · Uploaded`;
    const url = URL.createObjectURL(currentPhoto);
    thumb.replaceChildren();
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Selected label';
    thumb.append(image);
    scanBadge.textContent = 'Ready to scan';
    scanBadge.className = 'scan-status-pill';
  });

  scan.addEventListener('click', async () => {
    const image = currentPhoto || photo.files?.[0];
    if (!image) { scanBadge.textContent = 'Choose a photo first'; return; }
    scan.disabled = true;
    scan.textContent = 'Scanning…';
    scanBadge.textContent = 'OCR running';
    scanBadge.className = 'scan-status-pill warning';
    try {
      const contact = await services.ocr.recognize(image);
      if (contact.name) name.input.value = contact.name;
      if (contact.phone) phone.input.value = contact.phone;
      if (contact.address) address.input.value = contact.address;
      detected.replaceChildren();
      detected.append(el('strong', '', 'OCR Detected'));
      detected.append(el('p', '', contact.name || 'Name not detected'));
      detected.append(el('p', '', contact.phone || 'Phone not detected'));
      detected.append(el('p', '', contact.address || 'Address not detected'));
      if (contact.amount) detected.append(el('p', 'scan-detected-amount', `${formatAr(contact.amount)} Ar detected`));
      const existing = findCustomerMatch(store.getState().customers, contact);
      if (existing) detected.append(statusPill(`Saved customer match: ${existing.name}`, 'success'));
      detected.append(el('small', '', 'Information detected. Verify and edit if needed.'));
      scanBadge.textContent = '✓ OCR Complete';
      scanBadge.className = 'scan-status-pill success';
    } catch (error) {
      scanBadge.textContent = `Scan failed: ${error.message}`;
      scanBadge.className = 'scan-status-pill danger';
    } finally {
      scan.disabled = false;
      scan.textContent = 'Scan photo';
    }
  });

  const next = action('Continue to parcel →', 'primary');
  next.classList.add('scan-primary-cta');
  next.addEventListener('click', () => {
    const customer = { name: name.input.value.trim(), phone: phone.input.value.trim(), address: address.input.value.trim() };
    if (!customer.name) { name.input.focus(); return; }
    store.update((current) => ({ ...current, labelDraft: { ...current.labelDraft, step: 2, customer } }));
  });

  photoSection.append(photoHead, upload);
  customerSection.append(customerHead, infoGrid, next);
  shell.append(photoSection, customerSection);
  panel.append(shell);
}

function buildBatchParcel(item, current, customers, parcels) {
  const match = findCustomerMatch(customers, item.contact);
  let customerId = match?.id || null;
  let nextCustomers = customers;
  if (!customerId) {
    customerId = makeId('customer');
    nextCustomers = [...customers, { id: customerId, name: item.contact.name.trim(), phone: item.contact.phone.trim(), address: item.contact.address.trim() }];
  }
  const parcel = {
    id: makeId('parcel'),
    pickId: makePickId(parcels),
    trackingToken: makeTrackingToken(),
    customerId,
    customer: { name: item.contact.name.trim(), phone: item.contact.phone.trim(), address: item.contact.address.trim() },
    qty: Math.max(1, Number(item.qty) || 1),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    collect: calculateCollect(item.qty, item.unitPrice),
    deliveryCharge: Math.max(0, Number(item.deliveryCharge) || 0),
    notes: '',
    status: 'ready',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
  return { customers: nextCustomers, parcel };
}

function renderBatchScan({ panel, state, services, store, batchState }) {
  const shell = el('div', 'batch-scan-flow');
  const toolbar = el('div', 'batch-scan-toolbar');
  const summary = el('div', 'batch-progress');
  const scanned = batchState.items.filter((item) => ['review','approved','created'].includes(item.status)).length;
  summary.append(el('strong', '', `${scanned}/${batchState.items.length} scanned`), el('small', '', `${batchState.items.filter((item) => item.status === 'approved').length} approved · ${batchState.items.filter((item) => item.status === 'error').length} failed`));

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.setAttribute('capture', 'environment');
  input.className = 'scan-file-input';
  const add = action('Add photos');
  const scanAll = action('Scan queue', 'primary');
  const approveAll = action('Approve all ready');
  toolbar.append(summary, add, scanAll, approveAll, input);

  const dropZone = el('div', 'batch-drop-zone');
  dropZone.append(el('strong', '', 'Drop label photos here'), el('small', '', 'Desktop: drag multiple files · iPhone/Android: tap Add photos repeatedly to keep scanning'));
  const queue = el('div', 'batch-scan-queue');
  const actions = el('div', 'batch-final-actions');
  const createAll = action('Create approved labels', 'primary');
  const printSelected = action('Print selected');
  const printAll = action('Print all created');
  const result = el('small', 'batch-result');
  actions.append(createAll, printSelected, printAll, result);

  function addFiles(files) {
    for (const file of Array.from(files || [])) {
      if (!file.type.startsWith('image/')) continue;
      batchState.items.push({
        id: makeId('scan'), file, previewUrl: URL.createObjectURL(file), status: 'queued', selected: true,
        contact: { name: '', phone: '', address: '', amount: 0 }, qty: 1, unitPrice: 0, deliveryCharge: 0, parcelId: null,
      });
    }
    redraw();
  }

  function redraw() {
    queue.replaceChildren();
    const currentState = store.getState();
    const scannedCount = batchState.items.filter((item) => ['review','approved','created'].includes(item.status)).length;
    summary.firstChild.textContent = `${scannedCount}/${batchState.items.length} scanned`;
    summary.lastChild.textContent = `${batchState.items.filter((item) => item.status === 'approved').length} approved · ${batchState.items.filter((item) => item.status === 'error').length} failed`;

    batchState.items.forEach((item, index) => {
      const row = el('article', 'batch-scan-row');
      const select = document.createElement('input');
      select.type = 'checkbox';
      select.checked = item.selected;
      select.setAttribute('aria-label', `Select scan ${index + 1}`);
      select.addEventListener('change', () => { item.selected = select.checked; });
      const image = document.createElement('img');
      image.src = item.previewUrl;
      image.alt = `Scan ${index + 1}`;
      image.className = 'batch-scan-thumb';
      const body = el('div', 'batch-scan-body');
      const head = el('div', 'batch-row-head');
      head.append(el('strong', '', `#${index + 1} ${item.file.name}`), statusPill(item.status === 'queued' ? 'Queued' : item.status === 'scanning' ? 'Scanning…' : item.status === 'review' ? 'Review' : item.status === 'approved' ? 'Approved' : item.status === 'created' ? 'Created' : 'OCR failed', item.status === 'approved' || item.status === 'created' ? 'success' : item.status === 'error' ? 'danger' : item.status === 'scanning' ? 'warning' : ''));
      const grid = el('div', 'batch-fields-grid');
      const name = field('Name', `batch-name-${item.id}`, item.contact.name, { placeholder: 'Customer name' });
      const phone = field('Phone', `batch-phone-${item.id}`, item.contact.phone, { type: 'tel', inputmode: 'tel' });
      const address = field('Address', `batch-address-${item.id}`, item.contact.address, { multiline: true });
      const qty = field('Qty', `batch-qty-${item.id}`, item.qty, { type: 'number', inputmode: 'numeric', min: 1 });
      const price = field('Unit price (Ar)', `batch-price-${item.id}`, item.unitPrice, { type: 'number', inputmode: 'decimal', min: 0 });
      const delivery = field('Delivery (Ar)', `batch-delivery-${item.id}`, item.deliveryCharge, { type: 'number', inputmode: 'decimal', min: 0 });
      const inputs = [name, phone, address, qty, price, delivery];
      inputs.forEach((entry) => entry.input.addEventListener('input', () => {
        item.contact.name = name.input.value;
        item.contact.phone = phone.input.value;
        item.contact.address = address.input.value;
        item.qty = qty.input.value;
        item.unitPrice = price.input.value;
        item.deliveryCharge = delivery.input.value;
      }));
      grid.append(name.wrap, phone.wrap, address.wrap, qty.wrap, price.wrap, delivery.wrap);
      const match = findCustomerMatch(currentState.customers, item.contact);
      const meta = el('div', 'batch-row-meta');
      meta.append(el('span', '', `Collect ${formatAr(calculateCollect(item.qty, item.unitPrice))} Ar`));
      if (match) meta.append(statusPill(`Address Book: ${match.name}`, 'success'));
      const rowActions = el('div', 'button-row');
      const retry = action(item.status === 'error' ? 'Retry OCR' : 'Scan');
      const approve = action('Approve', 'primary');
      const edit = action('Edit');
      const skip = action('Skip');
      retry.disabled = item.status === 'scanning' || item.status === 'created';
      approve.disabled = item.status === 'created';
      edit.disabled = item.status === 'created';
      skip.disabled = item.status === 'created';
      retry.addEventListener('click', async () => { await scanItem(item); });
      approve.addEventListener('click', () => {
        item.contact.name = name.input.value.trim();
        item.contact.phone = phone.input.value.trim();
        item.contact.address = address.input.value.trim();
        item.qty = qty.input.value;
        item.unitPrice = price.input.value;
        item.deliveryCharge = delivery.input.value;
        if (!item.contact.name) { name.input.focus(); return; }
        item.status = 'approved';
        redraw();
      });
      edit.addEventListener('click', () => name.input.focus());
      skip.addEventListener('click', () => { item.status = 'skipped'; item.selected = false; redraw(); });
      rowActions.append(retry, approve, edit, skip);
      body.append(head, grid, meta, rowActions);
      row.append(select, image, body);
      queue.append(row);
    });
    createAll.disabled = batchState.items.filter((item) => item.status === 'approved').length === 0;
    printSelected.disabled = batchState.items.filter((item) => item.status === 'created' && item.selected).length === 0;
    printAll.disabled = batchState.items.filter((item) => item.status === 'created').length === 0;
  }

  async function scanItem(item) {
    item.status = 'scanning';
    redraw();
    try {
      const contact = await services.ocr.recognize(item.file);
      item.contact = { ...item.contact, ...contact };
      if (contact.amount && !Number(item.unitPrice)) item.unitPrice = contact.amount;
      item.status = 'review';
    } catch (error) {
      item.error = error.message;
      item.status = 'error';
    }
    redraw();
  }

  add.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); addFiles(event.dataTransfer?.files); });

  scanAll.addEventListener('click', async () => {
    scanAll.disabled = true;
    const pending = batchState.items.filter((item) => item.status === 'queued' || item.status === 'error');
    for (const item of pending) await scanItem(item);
    scanAll.disabled = false;
  });
  approveAll.addEventListener('click', () => {
    batchState.items.forEach((item) => {
      if (item.status === 'review' && item.contact.name) item.status = 'approved';
    });
    redraw();
  });

  createAll.addEventListener('click', () => {
    const approved = batchState.items.filter((item) => item.status === 'approved');
    if (!approved.length) return;
    store.update((current) => {
      let customers = [...current.customers];
      let parcels = [...current.parcels];
      for (const item of approved) {
        const built = buildBatchParcel(item, current, customers, parcels);
        customers = built.customers;
        parcels.push(built.parcel);
        item.parcelId = built.parcel.id;
        item.status = 'created';
      }
      return { ...current, customers, parcels };
    });
    result.textContent = `${approved.length} label${approved.length === 1 ? '' : 's'} created and added to Ready for Dispatch.`;
    redraw();
  });

  async function printItems(items) {
    let done = 0;
    const current = store.getState();
    for (const item of items) {
      const parcel = current.parcels.find((entry) => entry.id === item.parcelId);
      if (!parcel) continue;
      await services.print.printWithRetry({ data: bytesToBase64(labelEscPos(parcel, { trackingUrl: trackingUrl(parcel.trackingToken) })), labels: 1, idempotencyKey: `batch-scan-${parcel.id}-${parcel.modifiedAt}` }, { attempts: 2 });
      done += 1;
      result.textContent = `Printed/queued ${done} of ${items.length}.`;
    }
    result.textContent = `Batch print complete: ${done} label${done === 1 ? '' : 's'}.`;
  }

  printSelected.addEventListener('click', async () => {
    const items = batchState.items.filter((item) => item.status === 'created' && item.selected);
    printSelected.disabled = true;
    try { await printItems(items); } catch (error) { result.textContent = `Print failed: ${error.message}`; }
    redraw();
  });
  printAll.addEventListener('click', async () => {
    const items = batchState.items.filter((item) => item.status === 'created');
    printAll.disabled = true;
    try { await printItems(items); } catch (error) { result.textContent = `Print failed: ${error.message}`; }
    redraw();
  });

  shell.append(toolbar, dropZone, queue, actions);
  panel.append(shell);
  redraw();
}

export function createLabelModule({ store, services }) {
  const ui = { mode: 'single', batch: { items: [] } };
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      const draft = state.labelDraft;
      section.append(labelHeading(draft, ui.mode));

      if (draft.step === 1 && !draft.editParcelId) {
        const modeSwitch = el('div', 'scan-mode-switch');
        const single = action('Single Scan', ui.mode === 'single' ? 'primary' : '');
        const batch = action('Batch Scan', ui.mode === 'batch' ? 'primary' : '');
        single.addEventListener('click', () => { ui.mode = 'single'; store.setState({ ...store.getState() }); });
        batch.addEventListener('click', () => { ui.mode = 'batch'; store.setState({ ...store.getState() }); });
        modeSwitch.append(single, batch);
        section.append(modeSwitch);
      }

      const panel = document.createElement('div');
      panel.className = 'workspace-card label-workspace';

      if (draft.step === 1 && ui.mode === 'batch' && !draft.editParcelId) {
        renderBatchScan({ panel, state, services, store, batchState: ui.batch });
        section.append(panel);
        return section;
      }

      if (draft.step === 1) {
        renderSingleScan({ panel, draft, services, store });
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
