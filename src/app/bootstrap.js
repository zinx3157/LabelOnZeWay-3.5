import { createStore } from './store.js?v=52';
import { createRouter } from './router.js?v=52';
import { createModules } from '../modules/index.js?v=52';
import { createServices } from '../services/index.js?v=52';
import { createShell } from '../components/shell.js?v=52';
import '../modules/batch-customer-picker.js?v=52';
import { installSingleCustomerPicker } from '../modules/single-customer-picker.js?v=52';

export async function bootstrap(root) {
  if (!(root instanceof HTMLElement)) throw new Error('App root is required');
  const store = createStore({ online: navigator.onLine });
  window.__LZWAY_STORE__ = store;
  const services = createServices({ store });
  const modules = createModules({ store, services });
  const router = createRouter(store);
  installSingleCustomerPicker();
  const render = () => { const state=store.getState(); const module=modules[state.route]||modules.home; root.replaceChildren(createShell({state,navigate:router.navigate,content:module.render(state),store})); };
  store.subscribe(render); services.audit.installUiCapture(document);
  addEventListener('online',()=>{store.setState({online:true});services.audit.record('network.reconnected');void services.audit.flush();void services.sync.flush().catch((error)=>services.audit.record('sync.replay_failed',{message:error?.message||'unknown'}));});
  addEventListener('offline',()=>{store.setState({online:false});services.audit.record('network.disconnected');});
  addEventListener('error',(event)=>services.audit.record('app.error',{message:String(event.message||'unknown').slice(0,160)}));
  addEventListener('unhandledrejection',(event)=>services.audit.record('app.unhandled_rejection',{message:String(event.reason?.message||event.reason||'unknown').slice(0,160)}));
  await services.lifecycle.start();
  if(navigator.onLine&&services.sync.pending())void services.sync.flush().catch(()=>{});
  router.start(); render(); return{store,router,services,modules};
}
