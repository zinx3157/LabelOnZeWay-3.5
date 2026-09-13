import { createStore } from './store.js';
import { createRouter } from './router.js';
import { createModules } from '../modules/index.js';
import { createServices } from '../services/index.js';

export async function bootstrap(root) {
  if (!(root instanceof HTMLElement)) throw new Error('App root is required');

  const store = createStore({ online: navigator.onLine });
  const services = createServices({ store });
  const modules = createModules({ store, services });
  const router = createRouter(store);

  const render = () => {
    const state = store.getState();
    const module = modules[state.route] || modules.home;
    root.replaceChildren(module.render(state));
  };

  store.subscribe(render);
  addEventListener('online', () => store.setState({ online: true }));
  addEventListener('offline', () => store.setState({ online: false }));

  await services.lifecycle.start();
  router.start();
  render();

  return { store, router, services, modules };
}
