const QUEUE_KEY = 'lz35.audit.queue.v1';
const MAX_QUEUE = 2000;
const VERSION = '3.5';

function safeText(value, max = 80) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
  const capacitorNative = Boolean(window.Capacitor?.isNativePlatform?.());
  if (capacitorNative && /android/i.test(ua)) return 'android-apk';
  if (/iPhone|iPad|iPod/i.test(ua) && standalone) return 'iphone-pwa';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-browser';
  if (/Macintosh|Mac OS X/i.test(ua)) return window.webkit?.messageHandlers ? 'mac-app' : 'mac-web';
  if (/Android/i.test(ua)) return standalone ? 'android-pwa' : 'android-browser';
  return standalone ? 'pwa' : 'web';
}

function readQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
}

function summarizeElement(target) {
  const control = target instanceof Element ? target.closest('button,a,input,select,textarea,[role="button"]') : null;
  if (!control) return null;
  const tag = control.tagName.toLowerCase();
  const type = safeText(control.getAttribute('type') || control.getAttribute('role') || '');
  const name = safeText(control.getAttribute('name') || control.id || '');
  const label = safeText(control.getAttribute('aria-label') || control.textContent || control.getAttribute('title') || control.getAttribute('placeholder') || '');
  return { tag, type, name, label };
}

function mapById(items = []) {
  const map = new Map();
  for (const item of items) if (item?.id) map.set(item.id, item);
  return map;
}

export function createAuditService({ supabase, store, deviceId }) {
  let previousState = null;
  let flushing = false;
  const testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

  function makeEvent(action, metadata = {}, target = {}) {
    const state = store.getState();
    return {
      id: crypto.randomUUID(),
      workspace_id: state.workspace?.id || null,
      profile_id: state.workspace?.profileId || 'ps_default',
      device_id: deviceId(),
      platform: detectPlatform(),
      app_version: VERSION,
      action: safeText(action, 120),
      target_type: target.type ? safeText(target.type, 80) : null,
      target_id: target.id ? safeText(target.id, 160) : null,
      route: safeText(state.route || '', 80) || null,
      metadata,
      occurred_at: new Date().toISOString(),
    };
  }

  async function send(events) {
    const state = store.getState();
    if (testMode || !navigator.onLine || !state.session || !state.workspace?.id || !events.length) return false;
    const client = await supabase.connect();
    const rows = events.map((event) => ({ ...event, workspace_id: event.workspace_id || state.workspace.id, profile_id: event.profile_id || state.workspace.profileId || 'ps_default' }));
    const { error } = await client.from('app_action_log_v35').insert(rows);
    if (error) throw error;
    return true;
  }

  async function flush() {
    if (flushing || testMode) return { status: 'skipped' };
    const queue = readQueue();
    if (!queue.length) return { status: 'empty' };
    flushing = true;
    try {
      const sent = await send(queue);
      if (!sent) return { status: 'queued', records: queue.length };
      writeQueue([]);
      return { status: 'synced', records: queue.length };
    } catch {
      return { status: 'queued', records: queue.length };
    } finally {
      flushing = false;
    }
  }

  function record(action, metadata = {}, target = {}) {
    const event = makeEvent(action, metadata, target);
    const queue = readQueue();
    queue.push(event);
    writeQueue(queue);
    void flush();
    return event.id;
  }

  function observeState(state) {
    if (!previousState) { previousState = state; return; }
    if (state.route !== previousState.route) record('route.change', { from: previousState.route, to: state.route });
    if (state.online !== previousState.online) record(state.online ? 'network.online' : 'network.offline');
    if (state.session && !previousState.session) record('auth.session_started');
    if (!state.session && previousState.session) record('auth.session_ended');
    if (state.sync?.status !== previousState.sync?.status) record('sync.status', { from: previousState.sync?.status || null, to: state.sync?.status || null });

    const domains = [
      ['customer', previousState.customers || [], state.customers || []],
      ['parcel', previousState.parcels || [], state.parcels || []],
      ['archive', previousState.archive || [], state.archive || []],
      ['claim', previousState.claims || [], state.claims || []],
    ];
    for (const [type, beforeList, afterList] of domains) {
      const before = mapById(beforeList);
      const after = mapById(afterList);
      for (const [id, item] of after) {
        if (!before.has(id)) record(`${type}.created`, {}, { type, id });
        else if (type === 'parcel' && item.status !== before.get(id)?.status) record('parcel.status_changed', { from: before.get(id)?.status || null, to: item.status || null }, { type, id });
      }
      for (const id of before.keys()) if (!after.has(id)) record(`${type}.removed`, {}, { type, id });
    }
    previousState = state;
  }

  function installUiCapture(root = document) {
    root.addEventListener('click', (event) => {
      const control = summarizeElement(event.target);
      if (control) record('ui.click', control);
    }, true);
    root.addEventListener('change', (event) => {
      const control = summarizeElement(event.target);
      if (control) record('ui.change', control);
    }, true);
  }

  return { record, flush, observeState, installUiCapture, platform: detectPlatform, queued: () => readQueue().length };
}
