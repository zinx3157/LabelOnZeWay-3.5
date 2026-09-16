import { createLabelModule } from './label.js';
import { createCustomersModule } from './customers.js';
import { createManifestModule } from './manifest.js';
import { createReconciliationModule } from './reconciliation.js';
import { createBatchModule } from './batch.js';
import { createTrackingModule } from './tracking.js';
import { createArchiveModule } from './archive.js';
import { createClaimsModule } from './claims.js';
import { createSettingsModule } from './settings.js';
import { createHomeModule } from './home.js';
import { createReportsModule } from './reports.js';
import { createProfilesModule } from './profiles.js';
import { createStockModule } from './stock.js';

export function createModules({ store, services }) {
  return {
    home: createHomeModule({ store, services }),
    label: createLabelModule({ store, services }),
    manifest: createManifestModule({ store, services }),
    batch: createBatchModule({ store, services }),
    tracking: createTrackingModule({ store, services }),
    customers: createCustomersModule({ store, services }),
    stock: createStockModule({ store, services }),
    archive: createArchiveModule({ store, services }),
    claims: createClaimsModule({ store, services }),
    reconciliation: createReconciliationModule({ store, services }),
    reports: createReportsModule({ store, services }),
    profiles: createProfilesModule({ store, services }),
    settings: createSettingsModule({ store, services }),
  };
}
