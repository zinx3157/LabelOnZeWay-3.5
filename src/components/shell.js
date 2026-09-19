const PRIMARY = [
  ['home','Home'],['label','New Label'],['manifest','Manifest'],['batch','Batch'],['tracking','Tracking'],['customers','Customers'],['stock','Stock']
];
const SECONDARY = [
  ['archive','Archive'],['claims','Claims'],['reconciliation','Reconciliation'],['reports','Reports'],['notify','Notify'],['settlements','Settlements'],['sync','Sync Center'],['profiles','Profiles'],['settings','Settings']
];

function navButton(route, label, active, navigate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `nav-item${active === route ? ' is-active' : ''}`;
  button.dataset.route = route;
  button.textContent = label;
  button.addEventListener('click', () => navigate(route));
  return button;
}

export function createShell({ state, navigate, content }) {
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  const brand = document.createElement('div');
  brand.className = 'brand';
  const brandName = document.createElement('strong');
  brandName.textContent = state.workspace?.name || 'LZWay';
  const brandVersion = document.createElement('span');
  brandVersion.textContent = `3.5 · ${state.activeProfileId || state.workspace?.profileId || 'ps_default'}`;
  brand.append(brandName, brandVersion);
  const primary = document.createElement('nav');
  primary.className = 'nav-primary';
  primary.setAttribute('aria-label','Primary');
  PRIMARY.forEach(([route,label]) => primary.append(navButton(route,label,state.route,navigate)));
  const secondary = document.createElement('nav');
  secondary.className = 'nav-secondary';
  secondary.setAttribute('aria-label','Secondary');
  SECONDARY.forEach(([route,label]) => secondary.append(navButton(route,label,state.route,navigate)));
  sidebar.append(brand, primary, secondary);
  const main = document.createElement('div');
  main.className = 'app-main';
  const header = document.createElement('header');
  header.className = 'topbar';
  const status = document.createElement('div');
  status.className = 'status-line';
  const dot = document.createElement('span');
  dot.className = `status-dot ${state.online ? 'is-online' : 'is-offline'}`;
  const connectivity = document.createElement('span');
  connectivity.textContent = state.online ? 'Online' : 'Offline';
  const separator = document.createElement('span');
  separator.className = 'status-sep';
  separator.textContent = '•';
  const sync = document.createElement('span');
  sync.textContent = `Sync: ${state.sync.status}`;
  const profile = document.createElement('span');
  profile.className = 'status-profile';
  profile.textContent = `${state.workspace?.name || 'Local'} / ${state.activeProfileId || state.workspace?.profileId || 'ps_default'}`;
  status.append(dot, connectivity, separator, sync, separator.cloneNode(true), profile);
  header.append(status);
  const stage = document.createElement('main');
  stage.className = 'stage';
  stage.append(content);
  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.setAttribute('aria-label','Mobile');
  [['home','Home'],['label','Label'],['manifest','Manifest'],['stock','Stock'],['settings','More']]
    .forEach(([route,label]) => mobileNav.append(navButton(route,label,state.route,navigate)));
  main.append(header, stage, mobileNav);
  shell.append(sidebar, main);
  return shell;
}
