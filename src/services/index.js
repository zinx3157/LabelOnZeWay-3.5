import { createStorageService } from './storage.js';
import { createSupabaseService } from './supabase.js';
import { createAuthService } from './auth.js';
import { createWorkspaceService } from './workspace.js';
import { createSyncService } from './sync.js';
import { createPrintService } from './print.js';
import { createOcrService } from './ocr-image-v2.js';
import { createMessagingService } from './messaging.js';
import { createShareService } from './share.js';
import { createAuditService } from './audit.js';

export function createServices({ store }) {
  const storage = createStorageService();
  const supabase = createSupabaseService();
  const auth = createAuthService({ supabase, store });
  const workspace = createWorkspaceService({ supabase, store });
  const sync = createSyncService({ supabase, store });
  const audit = createAuditService({ supabase, store, deviceId: sync.deviceId });
  const print = createPrintService({ supabase, store });
  const ocr = createOcrService();
  const messaging = createMessagingService();
  const share = createShareService();

  const lifecycle = {
    async start() {
      const local = storage.load();
      if (Object.keys(local).length) store.setState(local);
      store.subscribe((state) => storage.save(state));
      store.subscribe((state) => audit.observeState(state));
      const testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
      if (testMode) {
        store.setState({ sync: { status: 'test-local', conflict: false } });
        return;
      }
      try {
        const session = await auth.start();
        if (session) await workspace.ensureSelected();
        store.setState({ sync: { status: session ? 'ready' : 'local-only', conflict: false } });
        audit.record('app.start', { platform: audit.platform() });
        await audit.flush();
      } catch (error) {
        console.warn('Cloud start failed; continuing locally', error);
        store.setState({ sync: { status: 'offline', conflict: false } });
        audit.record('app.start_offline', { reason: error?.message || 'cloud unavailable' });
      }
    },
  };

  return { lifecycle, storage, supabase, auth, workspace, sync, audit, print, ocr, messaging, share };
}
