const DEFAULTS = Object.freeze({
  bridgeUrl: 'http://192.168.100.14:8765',
  printerIp: '192.168.100.73',
  printerPort: 9100,
});

function bridgeConfig() {
  return {
    bridgeUrl: (localStorage.getItem('lz35.print.bridgeUrl') || DEFAULTS.bridgeUrl).replace(/\/$/, ''),
    printerIp: localStorage.getItem('lz35.print.printerIp') || DEFAULTS.printerIp,
    printerPort: Number(localStorage.getItem('lz35.print.printerPort')) || DEFAULTS.printerPort,
  };
}

async function readJson(response) { return response.json().catch(() => ({})); }

function printablePayload(base64 = '') {
  try {
    const binary = atob(base64);
    let text = '';
    for (let i = 0; i < binary.length; i += 1) {
      const code = binary.charCodeAt(i);
      text += code >= 32 && code <= 126 ? binary[i] : ' ';
    }
    return text.replace(/\s+/g, ' ');
  } catch { return ''; }
}

function trackingFromJob(job, state) {
  const text = printablePayload(job?.data);
  const urlMatch = text.match(/https?:\/\/[^\s]+[?&]track=([^&#\s]+)[^\s]*/i);
  if (!urlMatch) return null;
  let token = '';
  try { token = decodeURIComponent(urlMatch[1]); } catch { token = urlMatch[1]; }
  const parcel = [...(state.parcels || []), ...(state.archive || [])].find((item) => item.trackingToken === token);
  const pickMatch = text.match(/\b\d{6}-\d+\b/);
  return {
    token,
    pickId: parcel?.pickId || pickMatch?.[0] || token.slice(0, 24),
    status: parcel?.status || 'ready',
    archived: Boolean(parcel?.archivedAt || parcel?.archived),
    updatedAt: parcel?.statusUpdatedAt || parcel?.modifiedAt || new Date().toISOString(),
  };
}

async function publishTracking({ supabase, store }, job) {
  const state = store.getState();
  if (!state.session?.user?.id || !state.workspace?.id) return { status: 'local-only' };
  const tracking = trackingFromJob(job, state);
  if (!tracking?.token) return { status: 'no-tracking-token' };
  const client = await supabase.connect();
  const { error } = await client.from('public_tracking_v35').upsert({
    tracking_token: tracking.token,
    workspace_id: state.workspace.id,
    pick_id: tracking.pickId,
    status: tracking.status,
    archived: tracking.archived,
    updated_at: tracking.updatedAt,
  }, { onConflict: 'tracking_token' });
  if (error) throw new Error(`Tracking publish failed: ${error.message}`);
  return { status: 'published', token: tracking.token };
}

async function bridgeHealth(config) {
  let lastError = null;
  const query = `?host=${encodeURIComponent(config.printerIp)}&port=${encodeURIComponent(config.printerPort)}`;
  for (const path of ['/health', '/api/health']) {
    try {
      const response = await fetch(`${config.bridgeUrl}${path}${query}`, { method: 'GET' });
      if (!response.ok) throw new Error(`Bridge health HTTP ${response.status}`);
      const body = await readJson(response);
      if (body.printer_ok === false) throw new Error(body.printer_error || 'POS80C is unreachable');
      return { endpoint: path, ...body };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Bridge is unavailable');
}

async function bridgePrint(config, job) {
  let lastError = null;
  for (const path of ['/api/print', '/print']) {
    try {
      const response = await fetch(`${config.bridgeUrl}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_ip: job.printerIp || config.printerIp, printer_port: job.printerPort || config.printerPort, data: job.data, labels: Math.max(1, Number(job.labels) || 1) }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || `Bridge print HTTP ${response.status}`);
      return { adapter: 'bridge-2.5.4', endpoint: path, ...body };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Bridge print failed');
}

async function cloudPrint({ supabase, store }, job) {
  const state = store.getState();
  if (!state.session?.user?.id || !state.workspace?.id) throw new Error('Cloud Print requires an authenticated workspace');
  const client = await supabase.connect();
  const config = bridgeConfig();
  const idempotencyKey = job.idempotencyKey || `${crypto.randomUUID()}-${Date.now()}`;
  const row = { workspace_id: state.workspace.id, profile_id: state.workspace.profileId || 'ps_default', created_by: state.session.user.id, source_device: localStorage.getItem('lz35.deviceId') || 'web-3.5', printer_ip: job.printerIp || config.printerIp, printer_port: job.printerPort || config.printerPort, label_count: Math.max(1, Number(job.labels) || 1), payload_base64: job.data, idempotency_key: idempotencyKey, status: 'queued' };
  const { data, error } = await client.from('cloud_print_jobs').insert(row).select('id,status,created_at').single();
  if (error) throw error;
  return { adapter: 'cloud-2.5.4', ...data };
}

export function createPrintService({ supabase, store }) {
  async function health() {
    const config = bridgeConfig();
    try { const result = await bridgeHealth(config); return { bridge: 'online', printer: result.printer_ok === false ? 'offline' : 'online', config, result }; }
    catch (error) { return { bridge: 'offline', printer: 'unknown', config, error: error.message }; }
  }
  async function print(job, mode = 'auto') {
    if (!job?.data) throw new Error('Print payload is empty');
    await publishTracking({ supabase, store }, job);
    if (mode === 'bridge') return bridgePrint(bridgeConfig(), job);
    if (mode === 'cloud') return cloudPrint({ supabase, store }, job);
    const state = store.getState();
    if (state.session && state.workspace?.id) {
      try { return await cloudPrint({ supabase, store }, job); }
      catch (cloudError) {
        try { return await bridgePrint(bridgeConfig(), job); }
        catch (bridgeError) { throw new AggregateError([cloudError, bridgeError], 'Cloud and 2.5.4 bridge printing both failed'); }
      }
    }
    return bridgePrint(bridgeConfig(), job);
  }
  async function printWithRetry(job, { mode = 'auto', attempts = 2 } = {}) {
    const tries = Math.max(1, Number(attempts) || 1); const idempotencyKey = job.idempotencyKey || `${crypto.randomUUID()}-${Date.now()}`; let lastError = null;
    for (let index = 0; index < tries; index += 1) { try { return await print({ ...job, idempotencyKey }, mode); } catch (error) { lastError = error; } }
    throw lastError || new Error('Print failed');
  }
  return { health, print, printWithRetry, defaults: DEFAULTS };
}
