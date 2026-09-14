import { action, field } from '../components/form.js';
import { heading, textStack } from '../components/view.js';

function shipmentHistory(state, customerId) {
  const all = [...state.parcels, ...state.archive].filter((item) => item.customerId === customerId || item.customer?.id === customerId);
  if (!all.length) return null;
  return [...all].sort((a, b) => String(b.createdAt || b.archivedAt || '').localeCompare(String(a.createdAt || a.archivedAt || '')))[0];
}

export function createCustomersModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Customers', 'Saved customers and address book.'));

      const selected = new Set();
      const toolbar = document.createElement('div');
      toolbar.className = 'button-row';
      const removeSelected = action('Delete selected');
      removeSelected.disabled = true;
      removeSelected.addEventListener('click', () => {
        store.update((current) => ({ ...current, customers: current.customers.filter((item) => !selected.has(item.id)) }));
      });
      toolbar.append(removeSelected);
      section.append(toolbar);

      const list = document.createElement('div');
      list.className = 'card-list';
      if (!state.customers.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No saved customers yet.';
        list.append(empty);
      }

      for (const customer of state.customers) {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.customerId = customer.id;

        const chooser = document.createElement('input');
        chooser.type = 'checkbox';
        chooser.setAttribute('aria-label', `Select ${customer.name}`);
        chooser.addEventListener('change', () => {
          if (chooser.checked) selected.add(customer.id);
          else selected.delete(customer.id);
          removeSelected.disabled = selected.size === 0;
        });

        const history = shipmentHistory(state, customer.id);
        const text = textStack([
          ['strong', customer.name],
          ['span', customer.phone || 'No phone'],
          ['span', customer.address || 'No address'],
          ...(history ? [['small', `Previous shipment: ${history.pickId || 'unknown'} · ${history.status || 'unknown'}`]] : []),
        ]);

        const buttons = document.createElement('div');
        buttons.className = 'button-row';
        const use = action('Use for label', 'primary');
        const edit = action('Edit');

        use.addEventListener('click', () => {
          store.update((next) => ({ ...next, route: 'label', labelDraft: { ...next.labelDraft, step: 2, customerId: customer.id, customer: { name: customer.name, phone: customer.phone, address: customer.address } } }));
          location.hash = '#/label';
        });

        edit.addEventListener('click', () => {
          const form = document.createElement('div');
          form.className = 'workspace-card';
          const name = field('Name', 'customerEditName', customer.name);
          const phone = field('Phone', 'customerEditPhone', customer.phone || '', { inputmode: 'tel' });
          const address = field('Address', 'customerEditAddress', customer.address || '', { multiline: true });
          const save = action('Save customer', 'primary');
          const cancel = action('Cancel');
          const row = document.createElement('div');
          row.className = 'button-row';
          save.addEventListener('click', () => {
            const nextName = name.input.value.trim();
            if (!nextName) return;
            store.update((current) => ({
              ...current,
              customers: current.customers.map((item) => item.id === customer.id ? { ...item, name: nextName, phone: phone.input.value.trim(), address: address.input.value.trim(), modifiedAt: new Date().toISOString() } : item),
            }));
          });
          cancel.addEventListener('click', () => store.setState({ ui: { ...store.getState().ui, notice: '' } }));
          row.append(save, cancel);
          form.append(name.wrap, phone.wrap, address.wrap, row);
          card.replaceChildren(form);
        });

        buttons.append(use, edit);
        card.append(chooser, text, buttons);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
