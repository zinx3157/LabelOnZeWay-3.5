const PRIMARY = [
  ['home','Home'],['label','New Label'],['manifest','Manifest'],['batch','Batch'],['tracking','Tracking'],['customers','Customers']
];
const SECONDARY = [
  ['archive','Archive'],['reconciliation','Reconciliation'],['reports','Reports'],['profiles','Profiles'],['settings','Settings']
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
  brand.innerHTML = '<strong>LabelOnZeWay</strong><span>3.5</span>';

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
  status.innerHTML = `<span class="status-dot ${state.online ? 'is-online' : 'is-offline'}"></span><span>${state.online ? 'Online' : 'Offline'}</span><span class="status-sep">•</span><span>Sync: ${state.sync.status}</span>`;
  header.append(status);

  const stage = document.createElement('main');
  stage.className = 'stage';
  stage.append(content);

  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.setAttribute('aria-label','Mobile');
  [['home','Home'],['label','Label'],['manifest','Manifest'],['customers','Customers'],['settings','More']]
    .forEach(([route,label]) => mobileNav.append(navButton(route,label,state.route,navigate)));

  main.append(header, stage, mobileNav);
  shell.append(sidebar, main);
  return shell;
}
