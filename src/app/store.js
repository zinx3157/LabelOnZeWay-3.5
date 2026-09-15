const initialState = Object.freeze({
  route: 'home',
  session: null,
  workspace: null,
  profiles: [],
  activeProfileId: '',
  profileSettings: { name: '', manifestEmail: '' },
  online: true,
  sync: { status: 'idle', conflict: false },
  ui: { modal: null, busy: false, notice: '' },
  customers: [],
  parcels: [],
  archive: [],
  claims: [],
  labelDraft: { step: 1, customerId: null, customer: { name: '', phone: '', address: '' }, parcel: { qty: 1, unitPrice: 0, collect: 0, deliveryCharge: 0, notes: '' } },
});

export function createStore(seed = {}) {
  let state = structuredClone({ ...initialState, ...seed });
  if (!Array.isArray(state.claims)) state.claims = [];
  if (!Array.isArray(state.profiles)) state.profiles = [];
  if (typeof state.activeProfileId !== 'string') state.activeProfileId = '';
  if (!state.profileSettings || typeof state.profileSettings !== 'object') state.profileSettings = { name: '', manifestEmail: '' };
  if (!state.labelDraft?.parcel) state.labelDraft = structuredClone(initialState.labelDraft);
  if (state.labelDraft.parcel.deliveryCharge == null) state.labelDraft.parcel.deliveryCharge = 0;
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
