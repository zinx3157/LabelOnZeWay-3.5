import { heading } from '../components/view.js';
import { field, action } from '../components/form.js';
import { formatAr } from '../domain/money.js';
import { lowStockItems, suggestReorder, csvStock, csvMovements, STOCK_MOVEMENT_REASONS } from '../domain/stock.js';
import { CSV_BOM } from '../domain/csv.js';

function profileId(state) {
  return String(state.activeProfileId || state.workspace?.profileId || 'ps_default');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function metric(label, value) {
  const card = document.createElement('article');
  card.className = 'metric-card';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.textContent = String(value);
  card.append(name, result);
  return card;
}

export function createStockModule({ store }) {
  function adjust(item, delta, type, reason) {
    const current = store.getState();
    const pid = profileId(current);
    const qty = number(delta);
    if (!qty) return;
    const existing = current.inventory.find((row) => row.id === item.id && row.profileId === pid);
    if (!existing) return;
    const signed = type === 'out' ? -Math.min(qty, number(existing.qty)) : qty;
    if (!signed) return;
    const inventory = current.inventory.map((row) => row.id === item.id && row.profileId === pid ? { ...row, qty: number(row.qty) + signed, updatedAt: new Date().toISOString() } : row);
    const stockMovements = [{ id: crypto.randomUUID(), profileId: pid, itemId: item.id, sku: item.sku, product: item.product, type, reason: reason || type, qty: Math.abs(signed), at: new Date().toISOString() }, ...(current.stockMovements || [])].slice(0, 500);
    store.setState({ inventory, stockMovements });
  }

  return {
    render(state) {
      const pid = profileId(state);
      const inventory = (state.inventory || []).filter((item) => String(item.profileId || 'ps_default') === pid);
      const movements = (state.stockMovements || []).filter((item) => String(item.profileId || 'ps_default') === pid);
      const lowOnly = state.ui?.stockFilter === 'low';
      const visible = lowOnly ? lowStockItems(inventory) : inventory;
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Stock Management', 'Inventory, replenishment and stock movements.'));
      if (lowOnly) {
        const banner = document.createElement('div');
        banner.className = 'button-row';
        const info = document.createElement('span');
        info.textContent = `Showing ${visible.length} low / out-of-stock item(s).`;
        const showAll = action('Show all stock', 'primary');
        showAll.addEventListener('click', () => store.setState({ ui: { ...store.getState().ui, stockFilter: '' } }));
        banner.append(info, showAll);
        section.append(banner);
      }

      const metrics = document.createElement('div');
      metrics.className = 'metric-grid';
      const units = inventory.reduce((sum, item) => sum + number(item.qty), 0);
      const low = inventory.filter((item) => number(item.qty) <= number(item.reorder)).length;
      const value = inventory.reduce((sum, item) => sum + number(item.qty) * number(item.cost), 0);
      metrics.append(metric('SKUs', inventory.length), metric('Units on hand', units), metric('Low / out', low), metric('Stock value', `${formatAr(value)} Ar`));
      section.append(metrics);
      const exportRow = document.createElement('div');
      exportRow.className = 'button-row';
      const exportStock = action('Export stock CSV');
      exportStock.addEventListener('click', () => download(`lzway-stock-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvStock(inventory)));
      const exportMoves = action('Export movements CSV');
      exportMoves.addEventListener('click', () => download(`lzway-stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvMovements(movements)));
      exportRow.append(exportStock, exportMoves);
      section.append(exportRow);

      const form = document.createElement('form');
      form.className = 'workspace-card';
      const formTitle = document.createElement('h2');
      formTitle.textContent = 'Add product';
      const sku = field('SKU / Barcode', 'stock-sku');
      const product = field('Product', 'stock-product');
      const qty = field('Opening quantity', 'stock-qty', '0', { type: 'number', inputmode: 'numeric', min: 0 });
      const reorder = field('Reorder level', 'stock-reorder', '0', { type: 'number', inputmode: 'numeric', min: 0 });
      const cost = field('Cost / unit (Ar)', 'stock-cost', '0', { type: 'number', inputmode: 'numeric', min: 0 });
      const location = field('Location / Bin', 'stock-location');
      const add = action('Add to stock', 'primary');
      add.type = 'submit';
      const scanRow = document.createElement('div');
      scanRow.className = 'button-row';
      const scan = action('Scan barcode');
      const scanStatus = document.createElement('small');
      const video = document.createElement('video');
      video.className = 'scan-video';
      video.muted = true;
      video.playsInline = true;
      let scanStream = null;
      let scanFrame = 0;
      const stopScan = () => {
        if (scanStream) { for (const track of scanStream.getTracks()) track.stop(); scanStream = null; }
        if (scanFrame) cancelAnimationFrame(scanFrame);
        scanFrame = 0;
        video.remove();
      };
      scan.addEventListener('click', async () => {
        if (scanStream) { stopScan(); scan.textContent = 'Scan barcode'; return; }
        if (!('BarcodeDetector' in window)) { scanStatus.textContent = 'Barcode scanning needs Chrome or the Android build.'; return; }
        try {
          scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          video.srcObject = scanStream;
          await video.play();
          form.append(video);
          scan.textContent = 'Stop scanning';
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'itf', 'qr_code'] });
          const tick = async () => {
            if (!scanStream) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length) {
                sku.input.value = String(codes[0].rawValue || '');
                scanStatus.textContent = `Scanned: ${sku.input.value}`;
                stopScan();
                scan.textContent = 'Scan barcode';
                return;
              }
            } catch { /* frame not ready */ }
            scanFrame = requestAnimationFrame(tick);
          };
          scanFrame = requestAnimationFrame(tick);
        } catch (error) {
          scanStatus.textContent = `Camera error: ${error.message}`;
          stopScan();
          scan.textContent = 'Scan barcode';
        }
      });
      scanRow.append(scan, scanStatus);
      form.append(formTitle, sku.wrap, product.wrap, qty.wrap, reorder.wrap, cost.wrap, location.wrap, scanRow, add);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const current = store.getState();
        const active = profileId(current);
        const skuValue = sku.input.value.trim();
        const productValue = product.input.value.trim();
        if (!skuValue || !productValue) return;
        const duplicate = (current.inventory || []).some((item) => item.profileId === active && item.sku.toLowerCase() === skuValue.toLowerCase());
        if (duplicate) return;
        const item = { id: crypto.randomUUID(), profileId: active, sku: skuValue, product: productValue, qty: number(qty.input.value), reorder: number(reorder.input.value), cost: number(cost.input.value), location: location.input.value.trim(), createdAt: new Date().toISOString() };
        const movement = item.qty ? { id: crypto.randomUUID(), profileId: active, itemId: item.id, sku: item.sku, product: item.product, type: 'opening', qty: item.qty, at: new Date().toISOString() } : null;
        store.setState({ inventory: [...(current.inventory || []), item], stockMovements: movement ? [movement, ...(current.stockMovements || [])] : (current.stockMovements || []) });
      });
      section.append(form);

      const list = document.createElement('div');
      list.className = 'card-list';
      if (!inventory.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No stock items yet.';
        list.append(empty);
      }
      for (const item of visible) {
        const card = document.createElement('article');
        card.className = 'card';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${item.product} · ${item.sku}`;
        const detail = document.createElement('span');
        detail.textContent = `On hand ${number(item.qty)} · Reorder ${number(item.reorder)} · ${item.location || 'No bin'} · ${formatAr(number(item.cost))} Ar/unit`;
        info.append(title, detail);
        const controls = document.createElement('div');
        controls.className = 'button-row';
        const amount = field('Qty', `adjust-${item.id}`, '1', { type: 'number', inputmode: 'numeric', min: 1 });
        const reason = document.createElement('select');
        reason.className = 'stock-reason';
        reason.setAttribute('aria-label', `Movement reason for ${item.sku}`);
        for (const value of STOCK_MOVEMENT_REASONS) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          reason.append(option);
        }
        reason.value = 'adjustment';
        const stockIn = action('Stock In', 'primary');
        const stockOut = action('Stock Out');
        const remove = action('Delete');
        stockIn.addEventListener('click', () => adjust(item, amount.input.value, 'in', reason.value));
        stockOut.addEventListener('click', () => adjust(item, amount.input.value, 'out', reason.value));
        remove.addEventListener('click', () => {
          const current = store.getState();
          store.setState({ inventory: current.inventory.filter((row) => row.id !== item.id) });
        });
        const suggestion = suggestReorder(item);
        if (number(item.qty) <= number(item.reorder) && suggestion > 0) {
          const order = action(`Order ${suggestion}`, 'primary');
          order.addEventListener('click', () => adjust(item, suggestion, 'in', 'purchase'));
          controls.append(order);
        }
        controls.append(amount.wrap, reason, stockIn, stockOut, remove);
        card.append(info, controls);
        list.append(card);
      }
      section.append(list);

      const ledger = document.createElement('div');
      ledger.className = 'workspace-card';
      const ledgerTitle = document.createElement('h2');
      ledgerTitle.textContent = 'Recent movements';
      ledger.append(ledgerTitle);
      for (const move of movements.slice(0, 20)) {
        const row = document.createElement('div');
        row.className = 'card';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${move.product || move.sku} · ${String(move.type).toUpperCase()} ${move.qty}${move.reason && move.reason !== move.type ? ` · ${move.reason}` : ''}`;
        const time = document.createElement('small');
        time.textContent = new Date(move.at).toLocaleString();
        info.append(title, time);
        row.append(info);
        ledger.append(row);
      }
      if (!movements.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No stock movements yet.';
        ledger.append(empty);
      }
      section.append(ledger);
      return section;
    },
  };
}
