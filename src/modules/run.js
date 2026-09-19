// "Tournée du jour": the courier run sheet. One screen, thumb-sized targets,
// a sticky collected-vs-expected bar and one-tap status advancement.

import { heading } from '../components/view.js';
import { field, action } from '../components/form.js';
import { formatAr } from '../domain/money.js';
import { runStops, runTotals, runCouriers, nextRunStatus, runStatusLabel, isoDay, stopMapUrl, stopTelUrl, stopAddress } from '../domain/run.js';
import { waLink } from '../domain/notifications.js';

function linkButton(href, label) {
  const link = document.createElement('a');
  link.className = 'button button-secondary run-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = label;
  return link;
}

export function createRunModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Run Sheet', "Today's delivery run: stops in route order with one-tap status."));

      const date = field('Run date', 'runDate', isoDay(), { type: 'date' });
      const courier = document.createElement('select');
      courier.className = 'stock-reason';
      courier.setAttribute('aria-label', 'Filter run by courier');
      const all = document.createElement('option');
      all.value = '';
      all.textContent = 'All couriers';
      courier.append(all);
      for (const name of runCouriers(state)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        courier.append(option);
      }

      const summary = document.createElement('div');
      summary.className = 'run-summary';
      const list = document.createElement('div');
      list.className = 'card-list';

      const stopCard = (stop) => {
        const card = document.createElement('article');
        card.className = 'card run-stop';
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${stop.pickId || stop.id} · ${stop.customer?.name || 'Customer'}`;
        const address = document.createElement('span');
        address.textContent = stopAddress(stop) || 'No address recorded';
        const meta = document.createElement('small');
        meta.textContent = `${runStatusLabel(stop.status)}${stop.courier ? ` · ${stop.courier}` : ''} · ${formatAr(Number(stop.collect) || 0)} AR`;
        copy.append(title, address, meta);
        const controls = document.createElement('div');
        controls.className = 'button-row';
        const next = nextRunStatus(stop.status);
        if (next) {
          const advance = action(`Mark ${runStatusLabel(next)}`, 'primary');
          advance.className += ' run-advance';
          advance.addEventListener('click', () => {
            const at = new Date().toISOString();
            store.update((current) => ({
              ...current,
              parcels: (current.parcels || []).map((parcel) => (parcel.id === stop.id ? { ...parcel, status: next, statusUpdatedAt: at, modifiedAt: at } : parcel)),
            }));
            draw();
          });
          controls.append(advance);
        } else {
          const done = document.createElement('small');
          done.className = 'run-done';
          done.textContent = `Delivered · ${formatAr(Number(stop.collect) || 0)} AR collected`;
          controls.append(done);
        }
        const mapUrl = stopMapUrl(stop);
        if (mapUrl) controls.append(linkButton(mapUrl, 'Map'));
        const telUrl = stopTelUrl(stop);
        if (telUrl) controls.append(linkButton(telUrl, 'Call'));
        const phone = stop.customer?.phone;
        if (phone) controls.append(linkButton(waLink(phone, `Bonjour ${stop.customer?.name || ''}, notre coursier arrive pour le colis ${stop.pickId || ''}.`), 'WhatsApp'));
        card.append(copy, controls);
        return card;
      };

      const draw = () => {
        const current = store.getState();
        const stops = runStops(current, { date: date.input.value || isoDay(), courier: courier.value });
        const totals = runTotals(stops);
        summary.replaceChildren();
        const progress = document.createElement('strong');
        progress.textContent = `${totals.done}/${totals.total} stops`;
        const money = document.createElement('span');
        money.textContent = `${formatAr(totals.collectedAr)} / ${formatAr(totals.expectedAr)} AR`;
        summary.append(progress, money);
        list.replaceChildren();
        if (!stops.length) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No stops for this run yet.';
          list.append(empty);
          return;
        }
        for (const stop of stops) list.append(stopCard(stop));
      };

      date.input.addEventListener('input', draw);
      courier.addEventListener('change', draw);
      section.append(date.wrap, courier, summary, list);
      draw();
      return section;
    },
  };
}
