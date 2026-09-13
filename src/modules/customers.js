import { action } from '../components/form.js';
import { heading, textStack } from '../components/view.js';

export function createCustomersModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Customers', 'Saved customers and address book.'));

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
        const text = textStack([
          ['strong', customer.name],
          ['span', customer.phone || 'No phone'],
          ['span', customer.address || 'No address'],
        ]);
        const use = action('Use for label', 'primary');
        use.addEventListener('click', () => {
          store.update((next) => ({ ...next, route: 'label', labelDraft: { ...next.labelDraft, step: 2, customerId: customer.id, customer: { name: customer.name, phone: customer.phone, address: customer.address } } }));
          location.hash = '#/label';
        });
        card.append(text, use);
        list.append(card);
      }
      section.append(list);
      return section;
    },
  };
}
