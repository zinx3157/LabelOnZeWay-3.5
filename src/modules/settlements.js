import { heading, textStack } from '../components/view.js';
import { field, action } from '../components/form.js';
import { formatAr } from '../domain/money.js';
import { buildSettlementSheet, createSettlement, csvSettlements, settlementIsBalanced } from '../domain/settlements.js';
import { settlementEscPos, bytesToBase64 } from '../domain/escpos.js';
import { CSV_BOM } from '../domain/csv.js';

const METHODS = ['cash', 'mobile money', 'bank'];

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createSettlementsModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('COD Settlements', 'Count courier cash against expected collections, print the sheet, keep the books straight.'));

      const createCard = document.createElement('div');
      createCard.className = 'workspace-card';
      const createTitle = document.createElement('h2');
      createTitle.textContent = 'New settlement';
      const date = field('Collection date', 'settleDate', today(), { type: 'date' });
      const courier = field('Courier (optional)', 'settleCourier', '', { placeholder: 'Courier name' });
      const loadSheet = action('Load sheet', 'primary');
      const preview = document.createElement('div');
      const collected = field('Collected amount (Ar)', 'settleCollected', '0', { type: 'number', inputmode: 'numeric', min: 0 });
      const methodWrap = document.createElement('label');
      methodWrap.className = 'field';
      const methodLabel = document.createElement('span');
      methodLabel.textContent = 'Payment method';
      const method = document.createElement('select');
      method.name = 'settleMethod';
      for (const option of METHODS) {
        const node = document.createElement('option');
        node.value = option;
        node.textContent = option;
        method.append(node);
      }
      methodWrap.append(methodLabel, method);
      const note = field('Note', 'settleNote', '', { placeholder: 'Discrepancy explanation, mobile money reference…' });
      const save = action('Save settlement', 'primary');
      const createStatus = document.createElement('p');
      createStatus.className = 'pod-meta';
      let sheet = null;

      loadSheet.addEventListener('click', () => {
        sheet = buildSettlementSheet(store.getState(), { date: date.input.value, courier: courier.input.value });
        preview.replaceChildren();
        if (!sheet.rows.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No COD parcels for this day/courier.';
          preview.append(empty);
          return;
        }
        collected.input.value = String(sheet.expectedAr);
        preview.append(textStack([
          ['strong', `${sheet.rows.length} parcel(s) · expected ${formatAr(sheet.expectedAr)} Ar`],
        ]));
        const rows = document.createElement('div');
        rows.className = 'card-list';
        for (const row of sheet.rows) {
          rows.append(textStack([
            ['span', `${row.pickId} · ${row.customer} · ${row.status} · ${formatAr(row.collect)} Ar`],
          ], ));
        }
        preview.append(rows);
      });

      save.addEventListener('click', () => {
        if (!sheet || !sheet.rows.length) {
          createStatus.textContent = 'Load a sheet with at least one COD parcel first.';
          return;
        }
        const record = createSettlement(sheet, {
          collectedAr: Number(collected.input.value) || 0,
          method: method.value,
          note: note.input.value.trim(),
          by: store.getState().workspace?.name || '',
        });
        store.update((current) => ({ ...current, settlements: [record, ...(current.settlements || [])] }));
        createStatus.textContent = settlementIsBalanced(record)
          ? `Settlement saved — balanced at ${formatAr(record.collectedAr)} Ar.`
          : `Settlement saved — variance ${formatAr(record.varianceAr)} Ar recorded.`;
        sheet = null;
        preview.replaceChildren();
      });

      createCard.append(createTitle, date.wrap, courier.wrap, loadSheet, preview, collected.wrap, methodWrap, note.wrap, save, createStatus);
      section.append(createCard);

      const listCard = document.createElement('div');
      listCard.className = 'workspace-card';
      const listTitle = document.createElement('h2');
      listTitle.textContent = 'Saved settlements';
      const exportAll = action('Export settlements CSV');
      exportAll.addEventListener('click', () => {
        download(`lzway-settlements-${today()}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvSettlements(store.getState().settlements || []));
      });
      const listRow = document.createElement('div');
      listRow.className = 'button-row';
      listRow.append(exportAll);
      const list = document.createElement('div');
      list.className = 'card-list';
      const settlements = state.settlements || [];
      if (!settlements.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No settlements recorded yet.';
        list.append(empty);
      }
      for (const record of settlements) {
        const card = document.createElement('article');
        card.className = 'card';
        const varianceClass = record.varianceAr > 0 ? 'settle-variance is-pos' : record.varianceAr < 0 ? 'settle-variance is-neg' : 'settle-variance';
        card.append(textStack([
          ['strong', `${record.date || 'Undated'} · ${record.courier || 'No courier'}`],
          ['span', `Expected ${formatAr(record.expectedAr)} Ar · Collected ${formatAr(record.collectedAr)} Ar · ${record.method}`],
          ['span', `Variance ${formatAr(record.varianceAr)} Ar`, varianceClass],
          ['small', `${record.parcelCount ?? (record.parcels || []).length} parcel(s)${record.note ? ` · ${record.note}` : ''} · ${new Date(record.createdAt).toLocaleString()}`],
        ]));
        const controls = document.createElement('div');
        controls.className = 'button-row';
        const print = action('Print', 'primary');
        print.addEventListener('click', async () => {
          try {
            const result = await services.print.print({ data: bytesToBase64(settlementEscPos(record)), labels: 1 });
            store.setState({ ui: { ...store.getState().ui, notice: `Settlement printed (${result.adapter || result.endpoint || 'printer'}).` } });
          } catch (error) {
            store.setState({ ui: { ...store.getState().ui, notice: error.message } });
          }
        });
        const csv = action('CSV');
        csv.addEventListener('click', () => {
          download(`lzway-settlement-${record.date || today()}.csv`, 'text/csv;charset=utf-8', CSV_BOM + csvSettlements([record]));
        });
        const remove = action('Delete');
        remove.addEventListener('click', () => {
          store.update((current) => ({ ...current, settlements: (current.settlements || []).filter((item) => item.id !== record.id) }));
        });
        controls.append(print, csv, remove);
        card.append(controls);
        list.append(card);
      }
      listCard.append(listTitle, listRow, list);
      section.append(listCard);
      return section;
    },
  };
}
