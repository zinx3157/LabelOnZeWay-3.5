const ROUTES = Object.freeze(['home','label','manifest','batch','tracking','customers','stock','archive','claims','reconciliation','reports','profiles','settings']);

export function createRouter(store) {
  function navigate(route) {
    if (!ROUTES.includes(route)) throw new Error(`Unknown route: ${route}`);
    store.setState({ route });
    history.replaceState({ route }, '', `#/${route}`);
  }

  function routeFromLocation() {
    if (new URLSearchParams(location.search).get('track')) return 'tracking';
    const route = location.hash.replace(/^#\//, '') || 'home';
    return ROUTES.includes(route) ? route : 'home';
  }

  function start() {
    navigate(routeFromLocation());
    addEventListener('hashchange', () => store.setState({ route: routeFromLocation() }));
  }

  return { navigate, start, routes: ROUTES };
}
