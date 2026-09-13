import { createLabelModule } from './label.js';
import { createCustomersModule } from './customers.js';
import { createManifestModule } from './manifest.js';
import { createReconciliationModule } from './reconciliation.js';
import { createBatchModule } from './batch.js';
import { createTrackingModule } from './tracking.js';
import { createArchiveModule } from './archive.js';
import { createSettingsModule } from './settings.js';

function screen(title, description) {
  return { render() { const section = document.createElement('section'); section.className = 'screen'; section.innerHTML = `<div class="screen-heading"><div><h1>${title}</h1><p>${description}</p></div></div>`; return section; } };
}

export function createModules({ store, services }) {
  return {
    home: screen('Operations', 'LabelOnZeWay 3.5 standalone operations workspace.'),
    label: createLabelModule({ store, services }),
    manifest: createManifestModule({ store, services }),
    batch: createBatchModule({ store, services }),
    tracking: createTrackingModule({ store, services }),
    customers: createCustomersModule({ store, services }),
    archive: createArchiveModule({ store, services }),
    reconciliation: createReconciliationModule({ store, services }),
    reports: screen('Reports', 'Reports and exports.'),
    profiles: screen('Profiles', 'Company and workspace profiles.'),
    settings: createSettingsModule({ store, services }),
  };
}
