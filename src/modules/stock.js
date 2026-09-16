import { heading } from '../components/view.js';
import { field, action } from '../components/form.js';
import { formatAr } from '../domain/money.js';

function profileId(state) {
  return String(state.activeProfileId || state.workspace?.profileId || 'ps_default');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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
  function adjust(item, delta, type) {
    const current = store.getState();
    const pid = profileId(current);
    const qty = number(delta);
    if (!qty) return;
    const existing = current.inventory.find((row) => row.id === item.id && row.profileId === pid);
    if (!existing) return;
    const signed = type === 'out' ? -Math.min(qty, number(existing.qty)) : qty;
    if (!signed) return;
    const inventory = current.inventory.map((row) => row.id === item.id && row.profileId === pid ? { ...row, qty: number(row.qty) + signed, updatedAt: new Date().toISOString() } : row);
    const stockMovements = [{ id: crypto.randomUUID(), profileId: pid, itemId: item.id, sku: item.sku, product: item.product, type, qty: Math.abs(signed), at: new Date().toISOString() }, ...(current.stockMovements || [])].slice(0, 500);
    store.setState({ inventory, stockMovements });
  }

  return {
    render(state) {
      const pid = profileId(state);
      const inventory = (state.inventory || []).filter((item) => String(item.profileId || 'ps_default') === pid);
      const movements = (state.stockMovements || []).filter((item) => String(item.profileId || 'ps_default') === pid);
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Stock Management', 'Inventory, replenishment and stock movements.'));

      const metrics = document.createElement('div');
      metrics.className = 'metric-grid';
      const units = inventory.reduce((sum, item) => sum + number(item.qty), 0);
      const low = inventory.filter((item) => number(item.qty) <= number(item.reorder)).length;
      const value = inventory.reduce((sum, item) => sum + number(item.qty) * number(item.cost), 0);
      metrics.append(metric('SKUs', inventory.length), metric('Units on hand', units), metric('Low / out', low), metric('Stock value', `${formatAr(value)} Ar`));
      section.append(metrics);

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
      form.append(formTitle, sku.wrap, product.wrap, qty.wrap, reorder.wrap, cost.wrap, location.wrap, add);
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
      for (const item of inventory) {
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
        const stockIn = action('Stock In', 'primary');
        const stockOut = action('Stock Out');
        const remove = action('Delete');
        stockIn.addEventListener('click', () => adjust(item, amount.input.value, 'in'));
        stockOut.addEventListener('click', () => adjust(item, amount.input.value, 'out'));
        remove.addEventListener('click', () => {
          const current = store.getState();
          store.setState({ inventory: current.inventory.filter((row) => row.id !== item.id) });
        });
        controls.append(amount.wrap, stockIn, stockOut, remove);
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
        title.textContent = `${move.product || move.sku} · ${String(move.type).toUpperCase()} ${move.qty}`;
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
