// Stock maths and exports: pure helpers over inventory + movement records so
// replenishment suggestions and valuation reports stay testable without a DOM.
import { asNumber } from './money.js';
import { csvDocument } from './csv.js';

export const STOCK_MOVEMENT_REASONS = Object.freeze(['purchase', 'sale', 'adjustment', 'damage', 'return']);

export function lowStockItems(inventory) {
  return (inventory || []).filter((item) => asNumber(item.qty) <= asNumber(item.reorder));
}

// Order enough to reach twice the reorder level (at least one unit above it).
export function suggestReorder(item, { factor = 2 } = {}) {
  const reorder = asNumber(item?.reorder);
  const qty = asNumber(item?.qty);
  const target = Math.max(reorder * Math.max(1, Number(factor) || 1), reorder + 1, 1);
  return Math.max(0, Math.ceil(target - qty));
}

export function stockValuation(inventory) {
  return (inventory || []).reduce((sum, item) => sum + asNumber(item.qty) * asNumber(item.cost), 0);
}

export function csvStock(inventory) {
  const header = ['SKU', 'Product', 'Qty', 'Reorder', 'Cost Ar', 'Value Ar', 'Location'];
  const rows = (inventory || []).map((item) => [
    item.sku, item.product, asNumber(item.qty), asNumber(item.reorder),
    asNumber(item.cost), asNumber(item.qty) * asNumber(item.cost), item.location || '',
  ]);
  return csvDocument([header, ...rows]);
}

export function csvMovements(movements) {
  const header = ['At', 'SKU', 'Product', 'Type', 'Reason', 'Qty'];
  const rows = (movements || []).map((move) => [
    move.at, move.sku, move.product, move.type, move.reason || move.type, move.qty,
  ]);
  return csvDocument([header, ...rows]);
}
