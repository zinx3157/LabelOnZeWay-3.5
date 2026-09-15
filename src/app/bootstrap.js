import { createStore } from './store.js';
import { createRouter } from './router.js';
import { createModules } from '../modules/index.js';
import { createServices } from '../services/index.js';
import { createShell } from '../components/shell.js';
import '../modules/batch-customer-picker.js';

export async function bootstrap(root) {
  if (!(root instanceof HTMLElement)) throw new Error('App root is required');

  const store = createStore({ online: navigator.onLine });
  window.__LABELONZEWAY_STORE__ = store;
  const services = createServices({ store });
  const modules = createModules({ store, services });
  const router = createRouter(store);

  const render = () => {
    const state = store.getState();
    const module = modules[state.route] || modules.home;
    const content = module.render(state);
    root.replaceChildren(createShell({ state, navigate: router.navigate, content }));
  };

  store.subscribe(render);
  services.audit.installUiCapture(document);
  addEventListener('online', () => {
    store.setState({ online: true });
    services.audit.record('network.reconnected');
    void services.audit.flush();
  });
  addEventListener('offline', () => {
    store.setState({ online: false });
    services.audit.record('network.disconnected');
  });
  addEventListener('error', (event) => services.audit.record('app.error', { message: String(event.message || 'unknown').slice(0, 160) }));
  addEventListener('unhandledrejection', (event) => services.audit.record('app.unhandled_rejection', { message: String(event.reason?.message || event.reason || 'unknown').slice(0, 160) }));

  await services.lifecycle.start();
  router.start();
  render();

  return { store, router, services, modules };
}
