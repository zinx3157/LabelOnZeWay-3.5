import { createStorageService } from './storage.js';
import { createSupabaseService } from './supabase.js';
import { createAuthService } from './auth.js';
import { createSyncService } from './sync.js';
import { createPrintService } from './print.js';

export function createServices({ store }) {
  const storage = createStorageService();
  const supabase = createSupabaseService();
  const auth = createAuthService({ supabase, store });
  const sync = createSyncService({ supabase, store });
  const print = createPrintService({ supabase, store });

  const lifecycle = {
    async start() {
      const local = storage.load();
      if (Object.keys(local).length) store.setState(local);
      store.subscribe((state) => storage.save(state));
      try {
        await auth.start();
        store.setState({ sync: { status: 'ready', conflict: false } });
      } catch (error) {
        console.warn('Cloud start failed; continuing locally', error);
        store.setState({ sync: { status: 'offline', conflict: false } });
      }
    },
  };

  return {
    lifecycle,
    storage,
    supabase,
    auth,
    sync,
    print,
    ocr: { async start() { return { status: 'not-configured' }; } },
    messaging: { async start() { return { status: 'not-configured' }; } },
  };
}
