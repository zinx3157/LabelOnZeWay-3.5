import {deleteManifestParcels} from '../domain/manifest-delete.js?v=51';
import { formatAr } from '../domain/money.js?v=51';
import { PARCEL_STATUSES, updateParcelStatuses } from '../domain/manifest.js?v=51';
import { bytesToBase64, manifestEscPos } from '../domain/escpos.js?v=51';
import { action } from '../components/form.js?v=51';
import { heading } from '../components/view.js?v=51';

function cell(label, value) {
  const td = document.createElement('td');
  td.dataset.label = label;
  td.textContent = value ?? '';
  return td;
}

function manifestDate(parcel) {
  const date = new Date(parcel.createdAt);
  if (Number.isNaN(date.getTime())) return 'Undated';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function createManifestModule({ store, services }) {
  let selectedDate = '';
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen manifest-screen';
      section.append(heading('Manifest', 'Daily manifests · dates use Madagascar time.'));

      if (!state.parcels.length) {
        const empty = document.createElement('div');
        empty.className = 'table-card empty-state';
        empty.textContent = 'No parcels in the current manifest.';
        section.append(empty);
        if(state.archive.some(p=>p.deletedFromManifest)){const open=action('Open Archive to restore deleted parcels');open.addEventListener('click',()=>{location.hash='#/archive'});section.append(open);}
        return section;
      }

      const dates = [...new Set(state.parcels.map(manifestDate))].sort().reverse();
      if (!dates.includes(selectedDate)) selectedDate = dates.find(date => date !== 'Undated') || dates[0];
      const dateBar = document.createElement('label');
      dateBar.className = 'manifest-date-bar';
      dateBar.append('Manifest date');
      const dateSelect = document.createElement('select');
      dateSelect.className = 'select';
      dateSelect.setAttribute('aria-label', 'Manifest date');
      for (const date of dates) {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = `${date} · ${state.parcels.filter(parcel => manifestDate(parcel) === date).length} parcels`;
        dateSelect.append(option);
      }
      dateSelect.value = selectedDate;
      dateSelect.addEventListener('change', () => { selectedDate = dateSelect.value; store.setState({}); });
      dateBar.append(dateSelect);
      section.append(dateBar);
      const visibleDate = selectedDate;
      const forDate = parcel => manifestDate(parcel) === visibleDate;
      const selected = new Set();
      const remove = ids => {
        if(!ids.length)return;
        if(!window.confirm(`Delete ${ids.length} parcel${ids.length===1?'':'s'} from the manifest? You can restore from Archive.`))return;
        store.update(current=>deleteManifestParcels(current,ids));
      };
      const deleteSelected=action('Delete selected');deleteSelected.classList.add('danger-action');deleteSelected.disabled=true;deleteSelected.addEventListener('click',()=>remove([...selected]));
      const toolbar = document.createElement('div');
      toolbar.className = 'manifest-toolbar';
      const selection = document.createElement('span');
      selection.textContent = '0 selected';
      const status = document.createElement('select');
      status.className = 'select';
      status.setAttribute('aria-label', 'Parcel status');
      PARCEL_STATUSES.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item.replace('-', ' ');
        status.append(option);
      });
      const apply = action('Update selected', 'primary');
      apply.disabled = true;
      apply.addEventListener('click', () => {
        if (!selected.size) return;
        store.update((current) => ({ ...current, parcels: updateParcelStatuses(current.parcels, [...selected], status.value) }));
      });
      toolbar.append(selection, status, apply, deleteSelected);

      const outputs = document.createElement('div');
      outputs.className = 'button-row manifest-outputs';
      const thermal = action('Print 72mm manifest');
      const a4 = action('Print A4');
      const closeDelivered = action('Close delivered');
      const outputStatus = document.createElement('span');
      outputStatus.textContent = state.ui?.notice || '';
      thermal.addEventListener('click', async () => {
        thermal.disabled = true;
        outputStatus.textContent = 'Sending manifest…';
        try {
          const parcels = store.getState().parcels.filter((parcel) => forDate(parcel) && (!selected.size || selected.has(parcel.id)));
          const mode = 'auto';
          const result = await services.print.printWithRetry({ data: bytesToBase64(manifestEscPos(parcels)), labels: 1 }, { mode, attempts: 1 });
          outputStatus.textContent = result.status === 'printed' ? '72mm manifest sent to POS80C.' : result.adapter?.startsWith('cloud') ? '72mm manifest queued in Cloud Print.' : '72mm manifest sent to POS80C.';
        } catch (error) {
          outputStatus.textContent = `Manifest print failed: ${error.message}`;
        } finally {
          thermal.disabled = false;
          store.setState({ui:{...store.getState().ui,notice:outputStatus.textContent}});
        }
      });
      a4.addEventListener('click', () => window.print());
      closeDelivered.addEventListener('click', () => {
        const delivered = store.getState().parcels.filter((parcel) => forDate(parcel) && parcel.status === 'delivered');
        if (!delivered.length) {
          outputStatus.textContent = 'No delivered parcels to close.';
          return;
        }
        const ids = new Set(delivered.map((item) => item.id));
        store.update((current) => ({
          ...current,
          parcels: current.parcels.filter((item) => !ids.has(item.id)),
          archive: [...current.archive, ...delivered.map((item) => ({ ...item, archivedAt: new Date().toISOString() }))],
        }));
      });
      outputs.append(thermal, a4, closeDelivered, outputStatus);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-card';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Select','Pick ID','Customer','Qty','Unit','Collect','Delivery','Status','Actions'].forEach((name) => {
        const th = document.createElement('th');
        th.textContent = name;
        headRow.append(th);
      });
      thead.append(headRow);
      const body = document.createElement('tbody');

      for (const parcel of state.parcels.filter(forDate)) {
        const row = document.createElement('tr');
        const choose = document.createElement('input');
        choose.type = 'checkbox';
        choose.setAttribute('aria-label', `Select ${parcel.pickId}`);
        choose.addEventListener('change', () => {
          if (choose.checked) selected.add(parcel.id); else selected.delete(parcel.id);
          selection.textContent = `${selected.size} selected`;
          apply.disabled = selected.size === 0;
          deleteSelected.disabled=selected.size===0;
        });
        const chooseCell = document.createElement('td');
        chooseCell.dataset.label = 'Select';
        chooseCell.append(choose);
        row.append(
          chooseCell,
          cell('Pick ID', parcel.pickId),
          cell('Customer', parcel.customer?.name || ''),
          cell('Qty', String(parcel.qty ?? '')),
          cell('Unit', formatAr(parcel.unitPrice)),
          cell('Collect', formatAr(parcel.collect)),
          cell('Delivery', formatAr(parcel.deliveryCharge || 0)),
        );
        const statusCell = document.createElement('td');
        statusCell.dataset.label = 'Status';
        const pill = document.createElement('span');
        pill.className = 'status-pill';
        pill.textContent = parcel.status;
        statusCell.append(pill);
        row.append(statusCell);

        const actionCell = document.createElement('td');
        actionCell.dataset.label = 'Actions';
        const edit = action('Edit label');
        edit.setAttribute('aria-label', `Edit ${parcel.pickId}`);
        edit.addEventListener('click', () => {
          store.update((current) => ({
            ...current,
            route: 'label',
            labelDraft: {
              step: 1,
              editParcelId: parcel.id,
              customerId: parcel.customerId || null,
              customer: { ...(parcel.customer || { name: '', phone: '', address: '' }) },
              parcel: {
                qty: parcel.qty ?? 1,
                unitPrice: parcel.unitPrice ?? 0,
                collect: parcel.collect ?? 0,
                deliveryCharge: parcel.deliveryCharge ?? 0,
                notes: parcel.notes || '',
                printZeroAmounts:Boolean(parcel.printZeroAmounts),
              },
            },
          }));
          location.hash = '#/label';
        });
        const pdf=action('Label PDF');pdf.setAttribute('aria-label',`Label PDF ${parcel.pickId}`);pdf.addEventListener('click',()=>services.share.downloadLabelCopy(parcel));
        const reprint=action('Reprint label');reprint.setAttribute('aria-label',`Reprint label ${parcel.pickId}`);reprint.addEventListener('click',async()=>{reprint.disabled=true;try{const result=await services.share.reprintLabelCopy(parcel,services.print);store.setState({ui:{...store.getState().ui,notice:result.status==='printed'?'Saved label sent to printer.':'Saved label queued for printing.'}})}catch(error){store.setState({ui:{...store.getState().ui,notice:error.message}})}finally{reprint.disabled=false}});
        const deleteOne=action('Delete');deleteOne.classList.add('danger-action');deleteOne.setAttribute('aria-label',`Delete ${parcel.pickId}`);deleteOne.addEventListener('click',()=>remove([parcel.id]));
        const rowActions=document.createElement('div');rowActions.className='manifest-row-actions';rowActions.append(edit,pdf,reprint,deleteOne);actionCell.append(rowActions);
        row.append(actionCell);
        body.append(row);
      }
      table.append(thead, body);
      tableWrap.append(table);
      section.append(toolbar, outputs, tableWrap);
      return section;
    },
  };
}
