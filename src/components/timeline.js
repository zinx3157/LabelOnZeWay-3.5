// Customer-facing delivery timeline: a plain ordered list styled as a
// stepper, plus an optional WhatsApp contact button when the profile
// publishes a support number.

import { waLink, normalizeMadagascarWhatsApp } from '../domain/notifications.js';

export const TIMELINE_STEPS = [
  ['ready', 'Ready'],
  ['dispatch', 'Dispatch'],
  ['in-transit', 'In transit'],
  ['delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
];

function shortStamp(iso) {
  return typeof iso === 'string' && iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '';
}

export function timelineView(parcel, { phone = '', message = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'timeline-card workspace-card';
  const title = document.createElement('h2');
  title.textContent = 'Delivery timeline';
  const list = document.createElement('ol');
  list.className = 'timeline';
  const current = TIMELINE_STEPS.findIndex(([status]) => status === parcel?.status);
  TIMELINE_STEPS.forEach(([status, label], index) => {
    const item = document.createElement('li');
    if (current >= 0 && index <= current) item.className = 'is-done';
    const name = document.createElement('strong');
    name.textContent = label;
    const when = document.createElement('small');
    when.textContent = index === 0 ? shortStamp(parcel?.createdAt) : (index === current ? shortStamp(parcel?.statusUpdatedAt) : '');
    item.append(name, when);
    list.append(item);
  });
  wrap.append(title, list);
  if (parcel?.status === 'exception') {
    const note = document.createElement('p');
    note.className = 'pod-meta';
    note.textContent = 'This shipment hit an exception. Contact us and we will sort it out together.';
    wrap.append(note);
  }
  const normalized = normalizeMadagascarWhatsApp(phone);
  if (normalized && parcel?.status !== 'delivered') {
    const link = document.createElement('a');
    link.className = 'button button-primary timeline-contact';
    link.href = waLink(phone, message || `Bonjour, j'ai une question sur le colis ${parcel?.pickId || ''}.`);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Contact via WhatsApp';
    wrap.append(link);
  }
  return wrap;
}
