import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/app/store.js';
import { createPrintService } from '../src/services/print.js';
import { createSyncService } from '../src/services/sync.js';
import { createStorageService } from '../src/services/storage.js';

function memoryStorage() { const data = new Map(); return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key), clear: () => data.clear() }; }
globalThis.localStorage = memoryStorage();

test('2.5.4 bridge health falls back from /health to /api/health and probes POS80C', async () => {
  const calls = []; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { const target = String(url); calls.push(target); if (new URL(target).pathname === '/health') throw new Error('not found'); return new Response(JSON.stringify({ ok: true, printer_ok: true, version: '2.0' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try { const result = await createPrintService({ supabase: {}, store: createStore() }).health(); assert.equal(result.bridge, 'online'); assert.equal(result.printer, 'online'); assert.match(calls[0], /\/health\?host=192\.168\.100\.73&port=9100$/); assert.match(calls[1], /\/api\/health\?host=192\.168\.100\.73&port=9100$/); } finally { globalThis.fetch = originalFetch; }
});

test('2.5.4 bridge printing falls back from /api/print to /print and retries safely', async () => {
  const calls = []; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { const target = String(url); calls.push(target); if (target.endsWith('/api/print')) return new Response(JSON.stringify({ error: 'temporary route failure' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); return new Response(JSON.stringify({ ok: true, bytes_sent: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try { const result = await createPrintService({ supabase: {}, store: createStore() }).printWithRetry({ data: 'AA==', labels: 1 }, { mode: 'bridge', attempts: 2 }); assert.equal(result.adapter, 'bridge-2.5.4'); assert.equal(result.endpoint, '/print'); assert.deepEqual(calls.slice(0, 2), ['http://192.168.100.14:8765/api/print', 'http://192.168.100.14:8765/print']); } finally { globalThis.fetch = originalFetch; }
});

test('sync push includes customers active archive claims settings and public tracking projection', async () => {
  const rpcCalls = []; const trackingUpserts = [];
  const client = { rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: args.p_changes.length, error: null }; }, from: (table) => ({ upsert: async (rows) => { trackingUpserts.push({ table, rows }); return { error: null }; } }) };
  const store = createStore({ session: { user: { id: 'user-1' } }, workspace: { id: 'workspace-1', profileId: 'ps_default' }, profileSettings: { name: 'UAT Company', manifestEmail: 'ops@example.com' }, customers: [{ id: 'customer-1', name: 'A' }], parcels: [{ id: 'parcel-1', pickId: 'P1', trackingToken: 'T1', status: 'dispatch' }], archive: [{ id: 'parcel-2', pickId: 'P2', trackingToken: 'T2', status: 'delivered', archivedAt: '2026-09-14T00:00:00Z' }], claims: [{ id: 'claim-1', pickId: 'P1', reason: 'Damage', status: 'open', updatedAt: '2026-09-14T01:00:00Z' }] });
  const result = await createSyncService({ supabase: { connect: async () => client }, store }).pushSnapshot();
  assert.equal(result.records, 5); assert.equal(result.tracking, 2); assert.equal(rpcCalls[0].name, 'apply_sync_changes'); assert.deepEqual(rpcCalls[0].args.p_changes.map((row) => row.entity_type).sort(), ['claim','customer','parcel_active','parcel_archive','profile_settings_v35']); assert.equal(rpcCalls[0].args.p_changes.find((row) => row.entity_type === 'profile_settings_v35').payload.manifestEmail, 'ops@example.com'); assert.equal(trackingUpserts[0].table, 'public_tracking_v35'); assert.equal(trackingUpserts[0].rows.find((row) => row.tracking_token === 'T2').archived, true);
});

function pullClient(cloudRows) { const chain = { select() { return this; }, eq() { return this; }, in() { return this; }, is() { return this; }, order() { return { data: cloudRows, error: null }; } }; return { from: () => chain }; }

test('sync pull restores active archived claim and profile settings records independently', async () => {
  const cloudRows = [{ entity_type: 'customer', entity_id: 'c1', payload: { id: 'c1', name: 'Cloud' } }, { entity_type: 'parcel_active', entity_id: 'p1', payload: { id: 'p1', pickId: 'P1' } }, { entity_type: 'parcel_archive', entity_id: 'p2', payload: { id: 'p2', pickId: 'P2', archivedAt: 'x' } }, { entity_type: 'claim', entity_id: 'cl1', payload: { id: 'cl1', pickId: 'P1', reason: 'Cloud claim', status: 'open' } }, { entity_type: 'profile_settings_v35', entity_id: 'ps_default', payload: { id: 'ps_default', name: 'Cloud Co', manifestEmail: 'cloud@example.com' } }];
  const store = createStore({ session: { user: { id: 'u' } }, workspace: { id: 'w', profileId: 'ps_default' } });
  const result = await createSyncService({ supabase: { connect: async () => pullClient(cloudRows) }, store }).pullSnapshot();
  assert.equal(result.records, 5); const state = store.getState(); assert.equal(state.customers[0].name, 'Cloud'); assert.equal(state.parcels[0].pickId, 'P1'); assert.equal(state.archive[0].pickId, 'P2'); assert.equal(state.claims[0].reason, 'Cloud claim'); assert.equal(state.profileSettings.manifestEmail, 'cloud@example.com');
});

test('sync pull stops before overwriting a newer local record and force pull resolves with cloud', async () => {
  localStorage.clear(); localStorage.setItem('lz35.deviceId', 'dev-local');
  const cloudRows = [{ entity_type: 'customer', entity_id: 'c1', payload: { id: 'c1', name: 'Older Cloud', modifiedAt: '2026-09-14T09:00:00Z' }, modified_at: '2026-09-14T09:00:00Z', device_id: 'dev-other' }];
  const store = createStore({ session: { user: { id: 'u' } }, workspace: { id: 'w', profileId: 'ps_default' }, customers: [{ id: 'c1', name: 'Newer Local', modifiedAt: '2026-09-14T10:00:00Z' }] });
  const sync = createSyncService({ supabase: { connect: async () => pullClient(cloudRows) }, store });
  const blocked = await sync.pullSnapshot(); assert.equal(blocked.status, 'conflict'); assert.equal(blocked.conflicts.length, 1); assert.equal(store.getState().customers[0].name, 'Newer Local'); assert.equal(store.getState().sync.conflict, true);
  const forced = await sync.pullSnapshot({ force: true }); assert.equal(forced.status, 'synced'); assert.equal(store.getState().customers[0].name, 'Older Cloud'); assert.equal(store.getState().sync.conflict, false);
});

test('Pre-rebrand local state migrates to the LZWay key and stays mirrored', () => {
  localStorage.clear();
  const legacy = { customers: [{ id: 'c1', name: 'Legacy Customer' }], parcels: [], archive: [], claims: [] };
  localStorage.setItem('labelonzeway.3.5.state.v1', JSON.stringify(legacy));
  const storage = createStorageService();
  const loaded = storage.load();
  assert.equal(loaded.customers.length, 1, 'data written by the previous brand must load');
  assert.equal(loaded.customers[0].name, 'Legacy Customer');
  storage.save({ ...loaded, customers: loaded.customers });
  assert.ok(localStorage.getItem('lzway.3.5.state.v1'), 'new key is written');
  assert.ok(localStorage.getItem('labelonzeway.3.5.state.v1').includes('Legacy Customer'), 'legacy key mirrored for rollback safety');
});
