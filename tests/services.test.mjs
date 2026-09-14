import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/app/store.js';
import { createPrintService } from '../src/services/print.js';
import { createSyncService } from '../src/services/sync.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

globalThis.localStorage = memoryStorage();

test('bridge health falls back from /health to /api/health', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target === 'http://192.168.100.14:8765/health') throw new Error('not found');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const print = createPrintService({ supabase: {}, store: createStore() });
    const result = await print.health();
    assert.equal(result.bridge, 'online');
    assert.equal(calls[0], 'http://192.168.100.14:8765/health');
    assert.equal(calls[1], 'http://192.168.100.14:8765/api/health');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bridge printing retries after a recoverable failure', async () => {
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return new Response(JSON.stringify({ error: 'printer unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const print = createPrintService({ supabase: {}, store: createStore() });
    const result = await print.printWithRetry({ data: 'AA==', labels: 1 }, { mode: 'bridge', attempts: 2 });
    assert.equal(result.adapter, 'bridge');
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sync push includes customers active archive claims settings and public tracking projection', async () => {
  const rpcCalls = [];
  const trackingUpserts = [];
  const client = {
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: args.p_changes.length, error: null }; },
    from: (table) => ({ upsert: async (rows) => { trackingUpserts.push({ table, rows }); return { error: null }; } }),
  };
  const supabase = { connect: async () => client };
  const store = createStore({
    session: { user: { id: 'user-1' } },
    workspace: { id: 'workspace-1', profileId: 'ps_default' },
    profileSettings: { name: 'UAT Company', manifestEmail: 'ops@example.com' },
    customers: [{ id: 'customer-1', name: 'A' }],
    parcels: [{ id: 'parcel-1', pickId: 'P1', trackingToken: 'T1', status: 'dispatch' }],
    archive: [{ id: 'parcel-2', pickId: 'P2', trackingToken: 'T2', status: 'delivered', archivedAt: '2026-09-14T00:00:00Z' }],
    claims: [{ id: 'claim-1', pickId: 'P1', reason: 'Damage', status: 'open', updatedAt: '2026-09-14T01:00:00Z' }],
  });
  const sync = createSyncService({ supabase, store });
  const result = await sync.pushSnapshot();
  assert.equal(result.records, 5);
  assert.equal(result.tracking, 2);
  assert.equal(rpcCalls[0].name, 'apply_sync_changes');
  assert.deepEqual(rpcCalls[0].args.p_changes.map((row) => row.entity_type).sort(), ['claim','customer','parcel_active','parcel_archive','profile_settings_v35']);
  const settings = rpcCalls[0].args.p_changes.find((row) => row.entity_type === 'profile_settings_v35');
  assert.equal(settings.payload.manifestEmail, 'ops@example.com');
  assert.equal(trackingUpserts[0].table, 'public_tracking_v35');
  assert.equal(trackingUpserts[0].rows.find((row) => row.tracking_token === 'T2').archived, true);
});

test('sync pull restores active archived claim and profile settings records independently', async () => {
  const cloudRows = [
    { entity_type: 'customer', payload: { id: 'c1', name: 'Cloud' } },
    { entity_type: 'parcel_active', payload: { id: 'p1', pickId: 'P1' } },
    { entity_type: 'parcel_archive', payload: { id: 'p2', pickId: 'P2', archivedAt: 'x' } },
    { entity_type: 'claim', payload: { id: 'cl1', pickId: 'P1', reason: 'Cloud claim', status: 'open' } },
    { entity_type: 'profile_settings_v35', payload: { id: 'ps_default', name: 'Cloud Co', manifestEmail: 'cloud@example.com' } },
  ];
  const chain = {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    is() { return this; },
    order() { return { data: cloudRows, error: null }; },
  };
  const supabase = { connect: async () => ({ from: () => chain }) };
  const store = createStore({ session: { user: { id: 'u' } }, workspace: { id: 'w', profileId: 'ps_default' } });
  const sync = createSyncService({ supabase, store });
  const result = await sync.pullSnapshot();
  assert.equal(result.records, 5);
  const state = store.getState();
  assert.equal(state.customers[0].name, 'Cloud');
  assert.equal(state.parcels[0].pickId, 'P1');
  assert.equal(state.archive[0].pickId, 'P2');
  assert.equal(state.claims[0].reason, 'Cloud claim');
  assert.equal(state.profileSettings.manifestEmail, 'cloud@example.com');
});
