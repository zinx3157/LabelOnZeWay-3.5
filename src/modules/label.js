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
      if (contact.amount) {
        store.update((current) => ({
          ...current,
          labelDraft: {
            ...current.labelDraft,
            parcel: {
              ...current.labelDraft.parcel,
              unitPrice: contact.amount,
              collect: calculateCollect(current.labelDraft.parcel?.qty || 1, contact.amount),
            },
          },
        }));
      }
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
  panel.classList.add('batch-workspace-card');
  batchState.filter ||= 'all';
  batchState.autoScan ??= true;
  batchState.autoApprove ??= false;
  batchState.processing ??= false;

  const shell = el('div', 'batch-scan-flow batch-scan-v2');
  const command = el('section', 'batch-command-center');
  const intro = el('div', 'batch-command-copy');
  intro.append(el('strong', '', 'Batch Scanner'), el('small', '', 'Capture many labels, scan automatically, review only exceptions, then create and print.'));
  const stats = el('div', 'batch-stat-grid');
  const controls = el('div', 'batch-control-row');
  const filters = el('div', 'batch-filter-row');
  const bulk = el('div', 'batch-bulk-row');
  const queue = el('div', 'batch-scan-queue');
  const footer = el('div', 'batch-sticky-actions');
  const result = el('div', 'batch-result');

  const galleryInput = document.createElement('input');
  galleryInput.type = 'file';
  galleryInput.accept = 'image/*';
  galleryInput.multiple = true;
  galleryInput.className = 'scan-file-input';
  galleryInput.setAttribute('aria-label', 'Add batch photos');

  const cameraInput = document.createElement('input');
  cameraInput.type = 'file';
  cameraInput.accept = 'image/*';
  cameraInput.setAttribute('capture', 'environment');
  cameraInput.className = 'scan-file-input';
  cameraInput.setAttribute('aria-label', 'Take batch photo');

  const addPhotos = action('Add photos', 'primary');
  const takePhoto = action('Take photo');
  const scanQueue = action('Scan queue', 'primary');
  const approveComplete = action('Approve complete');
  const selectAll = action('Select all');
  const deselectAll = action('Deselect');
  const removeSelected = action('Remove selected');
  const clearFinished = action('Clear finished');
  const createApproved = action('Create approved', 'primary');
  const createPrint = action('Create + print');
  const printCreated = action('Print selected created');

  function toggle(label, checked, handler) {
    const wrap = document.createElement('label');
    wrap.className = 'batch-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => handler(input.checked));
    wrap.append(input, el('span', '', label));
    return wrap;
  }

  const autoScan = toggle('Auto scan new photos', batchState.autoScan, (value) => { batchState.autoScan = value; });
  const autoApprove = toggle('Auto approve complete OCR', batchState.autoApprove, (value) => { batchState.autoApprove = value; });
  controls.append(addPhotos, takePhoto, scanQueue, approveComplete, autoScan, autoApprove, galleryInput, cameraInput);
  bulk.append(selectAll, deselectAll, removeSelected, clearFinished);

  const dropZone = el('button', 'batch-drop-zone batch-drop-zone-v2');
  dropZone.type = 'button';
  dropZone.append(el('strong', '', 'Drop label photos here'), el('small', '', 'Desktop: drag multiple images · Mobile: Take photo repeatedly or choose from gallery'));

  function counts() {
    const out = { total: batchState.items.length, queued: 0, scanning: 0, review: 0, approved: 0, created: 0, error: 0, skipped: 0 };
    batchState.items.forEach((item) => { if (Object.hasOwn(out, item.status)) out[item.status] += 1; });
    return out;
  }

  function complete(item) {
    return !!item.contact.name.trim() && !!(item.contact.phone.trim() || item.contact.address.trim());
  }

  function selected(predicate = () => true) {
    return batchState.items.filter((item) => item.selected && predicate(item));
  }

  function showResult(message, tone = '') {
    result.textContent = message;
    result.className = `batch-result ${tone}`.trim();
  }

  function stat(label, value, tone = '') {
    const node = el('div', `batch-stat ${tone}`.trim());
    node.append(el('strong', '', String(value)), el('small', '', label));
    return node;
  }

  function refreshStats() {
    const c = counts();
    stats.replaceChildren(
      stat('Total', c.total),
      stat('Queued', c.queued + c.scanning, c.scanning ? 'is-active' : ''),
      stat('Review', c.review, c.review ? 'is-warning' : ''),
      stat('Approved', c.approved, c.approved ? 'is-success' : ''),
      stat('Created', c.created, c.created ? 'is-success' : ''),
      stat('Errors', c.error, c.error ? 'is-danger' : ''),
    );
  }

  function statusFor(item) {
    if (item.status === 'queued') return ['Queued', ''];
    if (item.status === 'scanning') return ['Scanning…', 'warning'];
    if (item.status === 'review') return [complete(item) ? 'Ready to review' : 'Needs details', 'warning'];
    if (item.status === 'approved') return ['Approved', 'success'];
    if (item.status === 'created') return ['Created', 'success'];
    if (item.status === 'error') return ['OCR failed', 'danger'];
    return ['Skipped', ''];
  }

  function filterMatch(item) {
    if (batchState.filter === 'all') return true;
    if (batchState.filter === 'review') return item.status === 'review';
    if (batchState.filter === 'approved') return item.status === 'approved';
    if (batchState.filter === 'errors') return item.status === 'error';
    return true;
  }

  function refreshFilters() {
    const c = counts();
    filters.replaceChildren();
    [['all', `All ${c.total}`], ['review', `Review ${c.review}`], ['approved', `Approved ${c.approved}`], ['errors', `Errors ${c.error}`]].forEach(([key, text]) => {
      const button = action(text, batchState.filter === key ? 'primary' : '');
      button.classList.add('batch-filter-button');
      button.addEventListener('click', () => { batchState.filter = key; redraw(); });
      filters.append(button);
    });
  }

  function syncFields(item, fields) {
    item.contact.name = fields.name.input.value.trim();
    item.contact.phone = fields.phone.input.value.trim();
    item.contact.address = fields.address.input.value.trim();
    item.qty = Math.max(1, Number(fields.qty.input.value) || 1);
    item.unitPrice = Math.max(0, Number(fields.price.input.value) || 0);
    item.deliveryCharge = Math.max(0, Number(fields.delivery.input.value) || 0);
  }

  function rowFor(item, index) {
    const row = el('article', `batch-card status-${item.status}`);
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'batch-row-select';
    check.checked = item.selected;
    check.setAttribute('aria-label', `Select scan ${index + 1}`);
    check.addEventListener('change', () => { item.selected = check.checked; refreshActions(); });

    const visual = el('div', 'batch-card-visual');
    const image = document.createElement('img');
    image.src = item.previewUrl;
    image.alt = `Batch label ${index + 1}`;
    image.className = 'batch-scan-thumb';
    visual.append(image, el('span', 'batch-sequence', `#${index + 1}`));

    const body = el('div', 'batch-scan-body');
    const head = el('div', 'batch-row-head');
    const fileInfo = el('div', 'batch-file-identity');
    fileInfo.append(el('strong', '', item.file.name || `Photo ${index + 1}`), el('small', '', `${Math.max(1, Math.round((item.file.size || 0) / 1024))} KB`));
    const [statusText, statusTone] = statusFor(item);
    head.append(fileInfo, statusPill(statusText, statusTone));

    const grid = el('div', 'batch-fields-v2');
    const name = field('Customer', `batch-name-${item.id}`, item.contact.name, { placeholder: 'Full name' });
    const phone = field('Phone', `batch-phone-${item.id}`, item.contact.phone, { type: 'tel', inputmode: 'tel', placeholder: '03x…' });
    const address = field('Address', `batch-address-${item.id}`, item.contact.address, { multiline: true, placeholder: 'Delivery address' });
    const qty = field('Qty', `batch-qty-${item.id}`, item.qty, { type: 'number', inputmode: 'numeric', min: 1 });
    const price = field('Unit price (Ar)', `batch-price-${item.id}`, item.unitPrice, { type: 'number', inputmode: 'decimal', min: 0 });
    const delivery = field('Delivery (Ar)', `batch-delivery-${item.id}`, item.deliveryCharge, { type: 'number', inputmode: 'decimal', min: 0 });
    const fields = { name, phone, address, qty, price, delivery };
    grid.append(name.wrap, phone.wrap, address.wrap, qty.wrap, price.wrap, delivery.wrap);

    const money = el('div', 'batch-money-strip');
    const collectValue = el('strong', '', `${formatAr(calculateCollect(item.qty, item.unitPrice))} Ar`);
    const collect = el('div', 'batch-money-value');
    collect.append(el('small', '', 'COLLECT'), collectValue);
    const deliveryValue = el('strong', '', `${formatAr(item.deliveryCharge)} Ar`);
    const deliveryBox = el('div', 'batch-money-value');
    deliveryBox.append(el('small', '', 'DELIVERY'), deliveryValue);
    money.append(collect, deliveryBox);

    const matchBox = el('div', 'batch-match-box');
    const refreshMatch = () => {
      matchBox.replaceChildren();
      const match = findCustomerMatch(store.getState().customers, item.contact);
      if (match) matchBox.append(statusPill(`Address Book · ${match.name}`, 'success'));
      else if (item.contact.name) matchBox.append(statusPill('New customer'));
      if (item.error) matchBox.append(el('small', 'batch-error-text', item.error));
    };
    refreshMatch();

    Object.values(fields).forEach((entry) => entry.input.addEventListener('input', () => {
      syncFields(item, fields);
      if (item.status === 'approved') item.status = 'review';
      collectValue.textContent = `${formatAr(calculateCollect(item.qty, item.unitPrice))} Ar`;
      deliveryValue.textContent = `${formatAr(item.deliveryCharge)} Ar`;
      refreshMatch();
      refreshActions();
    }));

    const actions = el('div', 'batch-row-actions');
    const scan = action(item.status === 'error' ? 'Retry OCR' : 'Scan OCR');
    const approve = action(item.status === 'approved' ? 'Approved ✓' : 'Approve', 'primary');
    const useSaved = action('Use saved customer');
    const skip = action('Skip');
    const remove = action('Remove');
    scan.disabled = item.status === 'scanning' || item.status === 'created';
    approve.disabled = item.status === 'scanning' || item.status === 'created';
    useSaved.disabled = item.status === 'created';
    skip.disabled = item.status === 'created';
    remove.disabled = item.status === 'scanning';

    scan.addEventListener('click', async () => { syncFields(item, fields); await scanItem(item); });
    approve.addEventListener('click', () => {
      syncFields(item, fields);
      if (!item.contact.name) { name.input.focus(); showResult('Customer name is required before approval.', 'danger'); return; }
      item.status = 'approved';
      item.selected = true;
      redraw();
    });
    useSaved.addEventListener('click', () => {
      syncFields(item, fields);
      const match = findCustomerMatch(store.getState().customers, item.contact);
      if (!match) { showResult('No matching saved customer for this row.', 'warning'); return; }
      item.contact = { name: match.name || '', phone: match.phone || '', address: match.address || '' };
      item.status = 'review';
      redraw();
    });
    skip.addEventListener('click', () => { item.status = 'skipped'; item.selected = false; redraw(); });
    remove.addEventListener('click', () => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      batchState.items = batchState.items.filter((entry) => entry.id !== item.id);
      redraw();
    });
    actions.append(scan, approve, useSaved, skip, remove);
    body.append(head, grid, money, matchBox, actions);
    row.append(check, visual, body);
    return row;
  }

  function refreshActions() {
    const c = counts();
    scanQueue.disabled = batchState.processing || !(c.queued || c.error);
    approveComplete.disabled = !batchState.items.some((item) => item.status === 'review' && complete(item));
    selectAll.disabled = c.total === 0;
    deselectAll.disabled = !batchState.items.some((item) => item.selected);
    removeSelected.disabled = selected((item) => item.status !== 'scanning').length === 0;
    clearFinished.disabled = !batchState.items.some((item) => ['created', 'skipped'].includes(item.status));
    createApproved.disabled = c.approved === 0;
    createPrint.disabled = c.approved === 0 || batchState.processing;
    printCreated.disabled = selected((item) => item.status === 'created').length === 0 || batchState.processing;
  }

  function redraw() {
    refreshStats();
    refreshFilters();
    queue.replaceChildren();
    const visible = batchState.items.filter(filterMatch);
    if (!visible.length) {
      const empty = el('div', 'batch-empty-state');
      empty.append(el('strong', '', batchState.items.length ? 'Nothing in this view' : 'No label photos yet'), el('small', '', batchState.items.length ? 'Choose another filter.' : 'Add photos or take a picture to start.'));
      queue.append(empty);
    } else {
      visible.forEach((item) => queue.append(rowFor(item, batchState.items.indexOf(item))));
    }
    refreshActions();
  }

  function addFiles(files) {
    const seen = new Set(batchState.items.map((item) => `${item.file.name}|${item.file.size}|${item.file.lastModified}`));
    let added = 0;
    let duplicates = 0;
    Array.from(files || []).forEach((file) => {
      if (!file?.type?.startsWith('image/')) return;
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (seen.has(key)) { duplicates += 1; return; }
      seen.add(key);
      batchState.items.push({
        id: makeId('scan'), file, previewUrl: URL.createObjectURL(file), status: 'queued', selected: true,
        contact: { name: '', phone: '', address: '', amount: 0 }, qty: 1, unitPrice: 0, deliveryCharge: 0, parcelId: null, error: '',
      });
      added += 1;
    });
    showResult(`${added} photo${added === 1 ? '' : 's'} added${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} ignored` : ''}.`, added ? 'success' : 'warning');
    redraw();
    if (added && batchState.autoScan) scanPending();
  }

  async function scanItem(item) {
    item.status = 'scanning';
    item.error = '';
    redraw();
    try {
      const contact = await services.ocr.recognize(item.file);
      item.contact = {
        ...item.contact,
        name: contact.name || item.contact.name,
        phone: contact.phone || item.contact.phone,
        address: contact.address || item.contact.address,
        amount: contact.amount || 0,
      };
      if (contact.amount) item.unitPrice = Math.max(0, Number(contact.amount) || 0);
      item.status = batchState.autoApprove && complete(item) ? 'approved' : 'review';
      item.selected = true;
    } catch (error) {
      item.error = error?.message || 'OCR failed';
      item.status = 'error';
    }
    redraw();
  }

  async function scanPending() {
    if (batchState.processing) return;
    const pending = batchState.items.filter((item) => item.status === 'queued' || item.status === 'error');
    if (!pending.length) return;
    batchState.processing = true;
    refreshActions();
    let done = 0;
    for (const item of pending) {
      showResult(`Scanning ${done + 1} of ${pending.length}…`, 'warning');
      await scanItem(item);
      done += 1;
    }
    batchState.processing = false;
    const c = counts();
    showResult(`Scan complete · ${c.review} review · ${c.approved} approved · ${c.error} error${c.error === 1 ? '' : 's'}.`, c.error ? 'warning' : 'success');
    redraw();
  }

  function approveCompleteItems() {
    let done = 0;
    batchState.items.forEach((item) => {
      if (item.status === 'review' && complete(item)) { item.status = 'approved'; item.selected = true; done += 1; }
    });
    showResult(`${done} complete scan${done === 1 ? '' : 's'} approved.`, done ? 'success' : 'warning');
    redraw();
  }

  function createApprovedItems() {
    const approved = batchState.items.filter((item) => item.status === 'approved');
    if (!approved.length) return [];
    const created = [];
    store.update((current) => {
      let customers = [...current.customers];
      let parcels = [...current.parcels];
      approved.forEach((item) => {
        const built = buildBatchParcel(item, current, customers, parcels);
        customers = built.customers;
        parcels.push(built.parcel);
        item.parcelId = built.parcel.id;
        item.status = 'created';
        item.selected = true;
        created.push(item);
      });
      return { ...current, customers, parcels };
    });
    showResult(`${created.length} label${created.length === 1 ? '' : 's'} created and added to Ready for Dispatch.`, 'success');
    redraw();
    return created;
  }

  async function printItems(items) {
    let done = 0;
    for (const item of items) {
      const parcel = store.getState().parcels.find((entry) => entry.id === item.parcelId);
      if (!parcel) continue;
      showResult(`Printing/queueing ${done + 1} of ${items.length}…`, 'warning');
      await services.print.printWithRetry({
        data: bytesToBase64(labelEscPos(parcel, { trackingUrl: trackingUrl(parcel.trackingToken) })),
        labels: 1,
        idempotencyKey: `batch-scan-${parcel.id}-${parcel.modifiedAt}`,
      }, { attempts: 2 });
      done += 1;
    }
    showResult(`Batch print complete · ${done} label${done === 1 ? '' : 's'}.`, 'success');
  }

  addPhotos.addEventListener('click', () => galleryInput.click());
  takePhoto.addEventListener('click', () => cameraInput.click());
  galleryInput.addEventListener('change', () => { addFiles(galleryInput.files); galleryInput.value = ''; });
  cameraInput.addEventListener('change', () => { addFiles(cameraInput.files); cameraInput.value = ''; });
  dropZone.addEventListener('click', () => galleryInput.click());
  dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); addFiles(event.dataTransfer?.files); });
  scanQueue.addEventListener('click', scanPending);
  approveComplete.addEventListener('click', approveCompleteItems);
  selectAll.addEventListener('click', () => { batchState.items.forEach((item) => { item.selected = true; }); redraw(); });
  deselectAll.addEventListener('click', () => { batchState.items.forEach((item) => { item.selected = false; }); redraw(); });
  removeSelected.addEventListener('click', () => {
    const ids = new Set(selected((item) => item.status !== 'scanning').map((item) => item.id));
    batchState.items.forEach((item) => { if (ids.has(item.id) && item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    batchState.items = batchState.items.filter((item) => !ids.has(item.id));
    showResult(`${ids.size} selected item${ids.size === 1 ? '' : 's'} removed.`, ids.size ? 'success' : 'warning');
    redraw();
  });
  clearFinished.addEventListener('click', () => {
    const finished = batchState.items.filter((item) => ['created', 'skipped'].includes(item.status));
    finished.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    batchState.items = batchState.items.filter((item) => !['created', 'skipped'].includes(item.status));
    showResult(`${finished.length} finished item${finished.length === 1 ? '' : 's'} cleared.`, finished.length ? 'success' : 'warning');
    redraw();
  });
  createApproved.addEventListener('click', createApprovedItems);
  createPrint.addEventListener('click', async () => {
    createPrint.disabled = true;
    try { await printItems(createApprovedItems()); } catch (error) { showResult(`Print failed: ${error.message}`, 'danger'); }
    refreshActions();
  });
  printCreated.addEventListener('click', async () => {
    printCreated.disabled = true;
    try { await printItems(selected((item) => item.status === 'created')); } catch (error) { showResult(`Print failed: ${error.message}`, 'danger'); }
    refreshActions();
  });

  command.append(intro, stats, controls, dropZone, filters, bulk);
  footer.append(createApproved, createPrint, printCreated, result);
  shell.append(command, queue, footer);
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
