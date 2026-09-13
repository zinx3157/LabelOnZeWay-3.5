import { createLabelModule } from './label.js';
import { createCustomersModule } from './customers.js';
import { createManifestModule } from './manifest.js';
import { createReconciliationModule } from './reconciliation.js';

function screen(title, description) {
  return {
    render() {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = `<div class="screen-heading"><div><h1>${title}</h1><p>${description}</p></div></div>`;
      return section;
    },
  };
}

export function createModules({ store, services }) {
  return {
    home: screen('Operations', 'LabelOnZeWay 3.5 standalone operations workspace.'),
    label: createLabelModule({ store, services }),
    manifest: createManifestModule({ store, services }),
    batch: screen('Batch', 'Batch preparation and dispatch.'),
    tracking: screen('Tracking', 'Parcel tracking workspace.'),
    customers: createCustomersModule({ store, services }),
    archive: screen('Archive', 'Operational archive.'),
    reconciliation: createReconciliationModule({ store, services }),
    reports: screen('Reports', 'Reports and exports.'),
    profiles: screen('Profiles', 'Company and workspace profiles.'),
    settings: screen('Settings', 'Application configuration.'),
  };
}
