function screen(title, description) {
  return {
    render() {
      const section = document.createElement('section');
      section.className = 'screen';
      const h1 = document.createElement('h1');
      h1.textContent = title;
      const p = document.createElement('p');
      p.textContent = description;
      section.append(h1, p);
      return section;
    },
  };
}

export function createModules() {
  return {
    home: screen('Operations', 'LabelOnZeWay 3.5 standalone operations workspace.'),
    label: screen('New Label', 'Customer → Parcel → Review/Print.'),
    manifest: screen('Manifest', 'Unified operational manifest.'),
    batch: screen('Batch', 'Batch preparation and dispatch.'),
    tracking: screen('Tracking', 'Parcel tracking workspace.'),
    customers: screen('Customers', 'Customer and address book management.'),
    archive: screen('Archive', 'Operational archive.'),
    reconciliation: screen('Reconciliation', 'Financial reconciliation.'),
    reports: screen('Reports', 'Reports and exports.'),
    profiles: screen('Profiles', 'Company and workspace profiles.'),
    settings: screen('Settings', 'Application configuration.'),
  };
}
