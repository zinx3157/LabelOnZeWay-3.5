import { createLabelModule } from './label.js?v=48';
import { createCustomersModule } from './customers.js?v=48';
import { createManifestModule } from './manifest.js?v=48';
import { createReconciliationModule } from './reconciliation.js?v=48';
import { createBatchModule } from './batch.js?v=48';
import { createTrackingModule } from './tracking.js?v=48';
import { createArchiveModule } from './archive.js?v=48';
import { createClaimsModule } from './claims.js?v=48';
import { createSettingsModule } from './settings.js?v=48';
import { createHomeModule } from './home.js?v=48';
import { createReportsModule } from './reports.js?v=48';
import { createProfilesModule } from './profiles.js?v=48';
import { createStockModule } from './stock.js?v=48';
import { createRunModule } from './run.js?v=48';
import { createNotifyModule } from './notify.js?v=48';
import { createSettlementsModule } from './settlements.js?v=48';
import { createSyncModule } from './sync.js?v=48';

export function createModules({ store, services }) {
  return {
    home: createHomeModule({ store, services }),
    label: createLabelModule({ store, services }),
    manifest: createManifestModule({ store, services }),
    batch: createBatchModule({ store, services }),
    tracking: createTrackingModule({ store, services }),
    customers: createCustomersModule({ store, services }),
    stock: createStockModule({ store, services }),
    run: createRunModule({ store }),
    archive: createArchiveModule({ store, services }),
    claims: createClaimsModule({ store, services }),
    reconciliation: createReconciliationModule({ store, services }),
    reports: createReportsModule({ store, services }),
    profiles: createProfilesModule({ store, services }),
    settings: createSettingsModule({ store, services }),
    notify: createNotifyModule({ store }),
    settlements: createSettlementsModule({ store, services }),
    sync: createSyncModule({ store, services }),
  };
}
