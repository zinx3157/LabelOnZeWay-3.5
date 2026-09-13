const ENTITY_TYPES = Object.freeze(['customer','parcel_active']);
const DEVICE_KEY = 'lz35.deviceId';

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (value) return value;
  value = `dev-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_KEY, value);
  return value;
}

export function createSyncService({ supabase, store }) {
  async function pushSnapshot() {
    const state = store.getState();
    if (!state.session || !state.workspace?.id) return { status: 'local-only' };
    const client = await supabase.connect();
    const profileId = state.workspace.profileId || 'ps_default';
    const modifiedAt = new Date().toISOString();
    const sourceDevice = deviceId();
    const row = (entityType, item) => ({
      workspace_id: state.workspace.id,
      profile_id: profileId,
      entity_type: entityType,
      entity_id: item.id,
      payload: item,
      modified_at: modifiedAt,
      deleted_at: null,
      device_id: sourceDevice,
    });
    const rows = [
      ...state.customers.map((item) => row('customer', item)),
      ...state.parcels.map((item) => row('parcel_active', item)),
    ];
    store.setState({ sync: { status: 'syncing', conflict: false } });
    if (!rows.length) {
      store.setState({ sync: { status: 'synced', conflict: false } });
      return { status: 'synced', records: 0 };
    }
    const { data, error } = await client.rpc('apply_sync_changes', {
      p_workspace_id: state.workspace.id,
      p_changes: rows,
    });
    if (error) {
      store.setState({ sync: { status: 'error', conflict: false } });
      throw error;
    }
    store.setState({ sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: Number(data ?? rows.length) };
  }

  async function pullSnapshot() {
    const state = store.getState();
    if (!state.session || !state.workspace?.id) return { status: 'local-only' };
    const client = await supabase.connect();
    const profileId = state.workspace.profileId || 'ps_default';
    store.setState({ sync: { status: 'syncing', conflict: false } });
    const { data, error } = await client.from('sync_entities')
      .select('entity_type,entity_id,payload,modified_at,deleted_at,device_id')
      .eq('workspace_id', state.workspace.id)
      .eq('profile_id', profileId)
      .in('entity_type', ENTITY_TYPES)
      .is('deleted_at', null)
      .order('modified_at', { ascending: true });
    if (error) {
      store.setState({ sync: { status: 'error', conflict: false } });
      throw error;
    }
    const customers = [];
    const parcels = [];
    for (const cloudRow of data || []) {
      if (cloudRow.entity_type === 'customer') customers.push(cloudRow.payload);
      if (cloudRow.entity_type === 'parcel_active') parcels.push(cloudRow.payload);
    }
    store.setState({ customers, parcels, sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: (data || []).length };
  }

  return { pushSnapshot, pullSnapshot, deviceId };
}
