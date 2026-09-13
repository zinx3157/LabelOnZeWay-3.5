const initialState = Object.freeze({
  route: 'home',
  session: null,
  workspace: null,
  online: true,
  sync: { status: 'idle', conflict: false },
  ui: { modal: null, busy: false },
  customers: [],
  parcels: [],
  labelDraft: { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, notes: '' } },
});

export function createStore(seed = {}) {
  let state = structuredClone({ ...initialState, ...seed });
  const listeners = new Set();

  return {
    getState: () => structuredClone(state),
    setState(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(structuredClone(state));
    },
    update(fn) {
      const next = fn(structuredClone(state));
      if (!next || typeof next !== 'object') throw new Error('Store update must return state');
      state = next;
      for (const listener of listeners) listener(structuredClone(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
