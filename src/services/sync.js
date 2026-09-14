const ENTITY_TYPES = Object.freeze(['customer','parcel_active','parcel_archive','claim']);
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
      modified_at: item.modifiedAt || item.updatedAt || item.statusUpdatedAt || item.archivedAt || modifiedAt,
      deleted_at: null,
      device_id: sourceDevice,
    });
    const rows = [
      ...state.customers.map((item) => row('customer', item)),
      ...state.parcels.map((item) => row('parcel_active', item)),
      ...state.archive.map((item) => row('parcel_archive', item)),
      ...(state.claims || []).map((item) => row('claim', item)),
    ];
    store.setState({ sync: { status: 'syncing', conflict: false } });
    if (rows.length) {
      const { data, error } = await client.rpc('apply_sync_changes', { p_workspace_id: state.workspace.id, p_changes: rows });
      if (error) { store.setState({ sync: { status: 'error', conflict: false } }); throw error; }
      const trackingRows = [
        ...state.parcels.map((item) => ({ item, archived: false })),
        ...state.archive.map((item) => ({ item, archived: true })),
      ].filter(({ item }) => item.trackingToken).map(({ item, archived }) => ({
        tracking_token: item.trackingToken,
        workspace_id: state.workspace.id,
        pick_id: item.pickId,
        status: item.status || 'ready',
        archived,
        updated_at: item.statusUpdatedAt || item.archivedAt || item.modifiedAt || modifiedAt,
      }));
      if (trackingRows.length) {
        const { error: trackingError } = await client.from('public_tracking_v35').upsert(trackingRows, { onConflict: 'tracking_token' });
        if (trackingError) { store.setState({ sync: { status: 'error', conflict: false } }); throw trackingError; }
      }
      store.setState({ sync: { status: 'synced', conflict: false } });
      return { status: 'synced', records: Number(data ?? rows.length), tracking: trackingRows.length };
    }
    store.setState({ sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: 0, tracking: 0 };
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
    if (error) { store.setState({ sync: { status: 'error', conflict: false } }); throw error; }
    const customers = [];
    const parcels = [];
    const archive = [];
    const claims = [];
    for (const cloudRow of data || []) {
      if (cloudRow.entity_type === 'customer') customers.push(cloudRow.payload);
      if (cloudRow.entity_type === 'parcel_active') parcels.push(cloudRow.payload);
      if (cloudRow.entity_type === 'parcel_archive') archive.push(cloudRow.payload);
      if (cloudRow.entity_type === 'claim') claims.push(cloudRow.payload);
    }
    store.setState({ customers, parcels, archive, claims, sync: { status: 'synced', conflict: false } });
    return { status: 'synced', records: (data || []).length };
  }

  return { pushSnapshot, pullSnapshot, deviceId };
}
