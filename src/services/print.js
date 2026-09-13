const DEFAULTS = Object.freeze({
  bridgeUrl: 'http://192.168.100.14:8765',
  printerIp: '192.168.100.73',
  printerPort: 9100,
});

function bridgeConfig() {
  return {
    bridgeUrl: localStorage.getItem('lz35.print.bridgeUrl') || DEFAULTS.bridgeUrl,
    printerIp: localStorage.getItem('lz35.print.printerIp') || DEFAULTS.printerIp,
    printerPort: Number(localStorage.getItem('lz35.print.printerPort')) || DEFAULTS.printerPort,
  };
}

async function bridgeHealth(config) {
  const response = await fetch(`${config.bridgeUrl}/api/health`, { method: 'GET' });
  if (!response.ok) throw new Error(`Bridge health HTTP ${response.status}`);
  return response.json();
}

async function bridgePrint(config, job) {
  const response = await fetch(`${config.bridgeUrl}/api/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printer_ip: job.printerIp || config.printerIp,
      printer_port: job.printerPort || config.printerPort,
      data: job.data,
      labels: job.labels || 1,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Bridge print HTTP ${response.status}`);
  return { adapter: 'bridge', ...body };
}

async function cloudPrint({ supabase, store }, job) {
  const state = store.getState();
  if (!state.session?.user?.id || !state.workspace?.id) throw new Error('Cloud Print requires an authenticated workspace');
  const client = await supabase.connect();
  const config = bridgeConfig();
  const idempotencyKey = job.idempotencyKey || `${crypto.randomUUID()}-${Date.now()}`;
  const row = {
    workspace_id: state.workspace.id,
    profile_id: state.workspace.profileId || 'ps_default',
    created_by: state.session.user.id,
    source_device: localStorage.getItem('lz35.deviceId') || 'web-3.5',
    printer_ip: job.printerIp || config.printerIp,
    printer_port: job.printerPort || config.printerPort,
    label_count: Math.max(1, Number(job.labels) || 1),
    payload_base64: job.data,
    idempotency_key: idempotencyKey,
    status: 'queued',
  };
  const { data, error } = await client.from('cloud_print_jobs').insert(row).select('id,status,created_at').single();
  if (error) throw error;
  return { adapter: 'cloud', ...data };
}

export function createPrintService({ supabase, store }) {
  async function health() {
    const config = bridgeConfig();
    try {
      const result = await bridgeHealth(config);
      return { bridge: 'online', config, result };
    } catch (error) {
      return { bridge: 'offline', config, error: error.message };
    }
  }

  async function print(job, mode = 'auto') {
    if (!job?.data) throw new Error('Print payload is empty');
    if (mode === 'bridge') return bridgePrint(bridgeConfig(), job);
    if (mode === 'cloud') return cloudPrint({ supabase, store }, job);
    const state = store.getState();
    if (state.session && state.workspace?.id) {
      try { return await cloudPrint({ supabase, store }, job); } catch (cloudError) {
        try { return await bridgePrint(bridgeConfig(), job); } catch (bridgeError) {
          throw new AggregateError([cloudError, bridgeError], 'Cloud and bridge printing both failed');
        }
      }
    }
    return bridgePrint(bridgeConfig(), job);
  }

  return { health, print, defaults: DEFAULTS };
}
