from pathlib import Path
import re

label = Path('src/modules/label.js')
source = label.read_text()
start = source.index('function renderBatchScan({ panel, state, services, store, batchState }) {')
end = source.index('\nexport function createLabelModule', start)

replacement = r'''function renderBatchScan({ panel, state, services, store, batchState }) {
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
}'''

label.write_text(source[:start] + replacement + source[end:])

css = Path('src/styles/workflows.css')
text = css.read_text()
marker = '/* batch-scanner-v2 */'
if marker not in text:
    text += r'''

/* batch-scanner-v2 */
.batch-workspace-card { max-width: none; width: 100%; padding: clamp(.85rem,2vw,1.35rem); }
.batch-scan-v2 { display: grid; gap: 1rem; min-width: 0; }
.batch-command-center { display: grid; gap: .85rem; padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: linear-gradient(180deg,rgba(13,31,39,.96),rgba(8,22,28,.96)); }
.batch-command-copy { display: grid; gap: .2rem; }
.batch-command-copy strong { font-size: 1.05rem; }
.batch-command-copy small { color: var(--muted); }
.batch-stat-grid { display: grid; grid-template-columns: repeat(6,minmax(92px,1fr)); gap: .55rem; }
.batch-stat { display: grid; gap: .1rem; padding: .7rem .75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
.batch-stat strong { font-size: 1.05rem; }
.batch-stat small { color: var(--muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
.batch-stat.is-active { border-color: rgba(82,226,188,.35); }
.batch-stat.is-warning { border-color: rgba(240,200,121,.35); background: rgba(240,200,121,.05); }
.batch-stat.is-success { border-color: rgba(82,226,188,.35); background: rgba(82,226,188,.05); }
.batch-stat.is-danger { border-color: rgba(243,156,156,.35); background: rgba(243,156,156,.05); }
.batch-control-row,.batch-bulk-row,.batch-filter-row { display: flex; gap: .55rem; flex-wrap: wrap; align-items: center; }
.batch-toggle { display: inline-flex; align-items: center; gap: .45rem; min-height: 38px; padding: .45rem .65rem; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); background: rgba(255,255,255,.02); font-size: .78rem; cursor: pointer; }
.batch-toggle input { accent-color: var(--accent); }
.batch-drop-zone-v2 { width: 100%; display: grid; place-items: center; gap: .22rem; min-height: 108px; border: 1px dashed var(--border-strong); border-radius: var(--radius); background: rgba(82,226,188,.025); color: var(--text); cursor: pointer; }
.batch-drop-zone-v2 small { color: var(--muted); }
.batch-drop-zone-v2:hover,.batch-drop-zone-v2.dragging { border-color: var(--accent); background: rgba(82,226,188,.07); }
.batch-filter-button { min-height: 34px; padding: .48rem .75rem; }
.batch-scan-queue { display: grid; gap: .75rem; min-width: 0; }
.batch-card { display: grid; grid-template-columns: 24px 132px minmax(0,1fr); gap: .85rem; align-items: start; padding: .85rem; border: 1px solid var(--border); border-radius: var(--radius); background: linear-gradient(180deg,rgba(13,29,37,.98),rgba(8,21,27,.98)); box-shadow: 0 8px 22px rgba(0,0,0,.14); }
.batch-card.status-approved,.batch-card.status-created { border-color: rgba(82,226,188,.3); }
.batch-card.status-error { border-color: rgba(243,156,156,.32); }
.batch-card.status-scanning { border-color: rgba(240,200,121,.35); }
.batch-row-select { width: 18px; height: 18px; margin-top: .15rem; accent-color: var(--accent); }
.batch-card-visual { position: relative; min-width: 0; }
.batch-scan-thumb { display: block; width: 132px; height: 118px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border); background: #061016; }
.batch-sequence { position: absolute; left: .4rem; top: .4rem; padding: .18rem .4rem; border-radius: 999px; background: rgba(0,0,0,.72); color: #fff; font-size: .7rem; font-weight: 800; }
.batch-scan-body { display: grid; gap: .7rem; min-width: 0; }
.batch-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .7rem; }
.batch-file-identity { display: grid; gap: .12rem; min-width: 0; }
.batch-file-identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-file-identity small { color: var(--muted); }
.scan-status-pill { display: inline-flex; align-items: center; width: fit-content; border: 1px solid var(--border-strong); border-radius: 999px; padding: .28rem .58rem; background: var(--surface-2); color: var(--muted); font-size: .72rem; white-space: nowrap; }
.scan-status-pill.success { color: var(--accent-strong); border-color: rgba(82,226,188,.4); background: rgba(82,226,188,.08); }
.scan-status-pill.warning { color: #f0c879; border-color: rgba(240,200,121,.36); background: rgba(240,200,121,.07); }
.scan-status-pill.danger { color: #f3a0a0; border-color: rgba(243,156,156,.36); background: rgba(243,156,156,.07); }
.batch-fields-v2 { display: grid; grid-template-columns: minmax(150px,.9fr) minmax(130px,.65fr) minmax(220px,1.35fr) 82px 120px 120px; gap: .6rem; align-items: start; }
.batch-fields-v2 .field textarea { min-height: 72px; }
.batch-money-strip { display: flex; gap: .55rem; flex-wrap: wrap; }
.batch-money-value { min-width: 150px; display: grid; gap: .12rem; padding: .55rem .7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: #081318; }
.batch-money-value small { color: var(--muted); font-size: .68rem; letter-spacing: .06em; }
.batch-money-value strong { color: var(--accent-strong); font-size: .96rem; }
.batch-match-box { display: flex; align-items: center; gap: .45rem; min-height: 26px; flex-wrap: wrap; }
.batch-error-text { color: #f3a0a0; }
.batch-row-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.batch-row-actions .button { min-height: 36px; padding: .5rem .72rem; font-size: .78rem; }
.batch-empty-state { min-height: 180px; display: grid; place-items: center; align-content: center; gap: .25rem; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius); color: var(--muted); }
.batch-empty-state strong { color: var(--text); }
.batch-sticky-actions { position: sticky; bottom: .65rem; z-index: 4; display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; padding: .72rem; border: 1px solid var(--border); border-radius: var(--radius); background: rgba(7,18,24,.94); backdrop-filter: blur(14px); box-shadow: 0 -8px 26px rgba(0,0,0,.2); }
.batch-result { flex: 1 1 240px; min-height: 1.3em; color: var(--muted); font-size: .8rem; }
.batch-result.success { color: var(--accent-strong); }
.batch-result.warning { color: #f0c879; }
.batch-result.danger { color: #f3a0a0; }
@media (max-width: 1180px) {
  .batch-stat-grid { grid-template-columns: repeat(3,1fr); }
  .batch-fields-v2 { grid-template-columns: repeat(3,minmax(0,1fr)); }
}
@media (max-width: 820px) {
  .batch-command-center { padding: .8rem; }
  .batch-control-row .button { flex: 1 1 140px; }
  .batch-card { grid-template-columns: 22px 92px minmax(0,1fr); gap: .65rem; padding: .7rem; }
  .batch-scan-thumb { width: 92px; height: 92px; }
  .batch-fields-v2 { grid-template-columns: 1fr 1fr; }
  .batch-fields-v2 .field:nth-child(3) { grid-column: 1 / -1; }
  .batch-sticky-actions { position: static; }
}
@media (max-width: 560px) {
  .batch-stat-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .batch-card { grid-template-columns: 22px minmax(0,1fr); }
  .batch-card-visual { grid-column: 2; }
  .batch-scan-thumb { width: 100%; height: 150px; }
  .batch-scan-body { grid-column: 1 / -1; }
  .batch-fields-v2 { grid-template-columns: 1fr 1fr; }
  .batch-fields-v2 .field:nth-child(1),.batch-fields-v2 .field:nth-child(2),.batch-fields-v2 .field:nth-child(3) { grid-column: 1 / -1; }
  .batch-row-head { align-items: stretch; flex-direction: column; }
  .batch-row-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .batch-row-actions .button { width: 100%; }
  .batch-money-strip { display: grid; grid-template-columns: 1fr 1fr; }
  .batch-money-value { min-width: 0; }
  .batch-sticky-actions .button { flex: 1 1 100%; }
}
'''
    css.write_text(text)

sw = Path('sw.js')
sw.write_text(re.sub(r'labelonzeway-3\.5-shell-v\d+', 'labelonzeway-3.5-shell-v21', sw.read_text(), count=1))
