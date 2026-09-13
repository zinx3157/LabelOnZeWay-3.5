const ENTITY_TYPES = Object.freeze(['customer','parcel_active']);

export function createSyncService({ supabase, store }) {
  async function pushSnapshot() {
    const state = store.getState();
    if (!state.session || !state.workspace?.id) return { status: 'local-only' };
    const client = await supabase.connect();
    const profileId = state.workspace.profileId || 'ps_default';
    const rows = [
      ...state.customers.map((item) => ({ workspace_id: state.workspace.id, profile_id: profileId, entity_type: 'customer', entity_id: item.id, payload: item })),
      ...state.parcels.map((item) => ({ workspace_id: state.workspace.id, profile_id: profileId, entity_type: 'parcel_active', entity_id: item.id, payload: item })),
    ];
    store.setState({ sync: { status: 'syncing', conflict: false } });
    const { error } = await client.from('sync_entities').upsert(rows, { onConflict: 'workspace_id,profile_id,entity_type,entity_id' });
    if (error) {
      store.setState({ sync: { status: 'error', conflict: false } });
      throw error;
    }
    store.setState({ sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: rows.length };
  }

  async function pullSnapshot() {
    const state = store.getState();
    if (!state.session || !state.workspace?.id) return { status: 'local-only' };
    const client = await supabase.connect();
    const profileId = state.workspace.profileId || 'ps_default';
    const { data, error } = await client.from('sync_entities').select('entity_type,entity_id,payload,updated_at').eq('workspace_id', state.workspace.id).eq('profile_id', profileId).in('entity_type', ENTITY_TYPES);
    if (error) throw error;
    const customers = [];
    const parcels = [];
    for (const row of data || []) {
      if (row.entity_type === 'customer') customers.push(row.payload);
      if (row.entity_type === 'parcel_active') parcels.push(row.payload);
    }
    store.setState({ customers, parcels, sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: (data || []).length };
  }

  return { pushSnapshot, pullSnapshot };
}
