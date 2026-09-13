import { action } from '../components/form.js';

export function createCustomersModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Customers</h1><p>Saved customers and address book.</p></div></div>';

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
        const text = document.createElement('div');
        text.innerHTML = `<strong>${customer.name}</strong><span>${customer.phone || 'No phone'}</span><span>${customer.address || 'No address'}</span>`;
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
