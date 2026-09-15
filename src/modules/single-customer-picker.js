import { openCustomerPicker } from './batch-customer-picker.js';

function singleCustomerFields(target) {
  const flow = target.closest('.single-scan-flow');
  if (!flow) return null;
  const inputs = Array.from(flow.querySelectorAll('.scan-customer-fields input, .scan-customer-fields textarea'));
  const name = inputs.find((node) => node.name === 'name') || inputs[0];
  const phone = inputs.find((node) => node.type === 'tel') || inputs[1];
  const address = inputs.find((node) => node.tagName === 'TEXTAREA') || inputs[2];
  return name && phone && address ? { name, phone, address } : null;
}

function apply(fields, customer) {
  fields.name.value = customer.name || '';
  fields.phone.value = customer.phone || '';
  fields.address.value = customer.address || '';
  for (const node of [fields.name, fields.phone, fields.address]) node.dispatchEvent(new Event('input', { bubbles: true }));
}

export function installSingleCustomerPicker() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const fields = singleCustomerFields(target);
    if (!fields || target !== fields.name) return;
    const customers = window.__LABELONZEWAY_STORE__?.getState?.().customers || [];
    if (!customers.length) return;
    openCustomerPicker(customers, (customer) => apply(fields, customer), { title: 'Existing Customers' });
  });
}
