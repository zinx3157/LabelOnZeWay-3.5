import { field, action } from '../components/form.js';

export function createSettingsModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.innerHTML = '<div class="screen-heading"><div><h1>Settings</h1><p>Cloud session and local print configuration.</p></div></div>';
      const grid = document.createElement('div');
      grid.className = 'settings-grid';

      const cloud = document.createElement('article');
      cloud.className = 'workspace-card';
      const cloudTitle = document.createElement('h2');
      cloudTitle.textContent = 'Cloud';
      cloud.append(cloudTitle);
      if (state.session?.user) {
        const signed = document.createElement('p'); signed.textContent = `Signed in: ${state.session.user.email || state.session.user.id}`;
        const out = action('Sign out');
        out.addEventListener('click', () => services.auth.signOut().catch((error) => store.setState({ ui: { ...state.ui, notice: error.message } })));
        cloud.append(signed, out);
      } else {
        const email = field('Email','email','',{ type:'email' });
        const password = field('Password','password','',{ type:'password' });
        const signin = action('Sign in','primary');
        signin.addEventListener('click', async () => {
          try { await services.auth.signIn(email.input.value.trim(), password.input.value); store.setState({ ui: { ...store.getState().ui, notice: 'Cloud signed in' } }); }
          catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        cloud.append(email.wrap,password.wrap,signin);
      }

      const printing = document.createElement('article');
      printing.className = 'workspace-card';
      const printTitle = document.createElement('h2'); printTitle.textContent = 'POS80C';
      const defaults = services.print.defaults;
      const bridge = field('Mac bridge URL','bridge',localStorage.getItem('lz35.print.bridgeUrl') || defaults.bridgeUrl);
      const ip = field('Printer IP','printerIp',localStorage.getItem('lz35.print.printerIp') || defaults.printerIp);
      const port = field('Printer port','printerPort',localStorage.getItem('lz35.print.printerPort') || defaults.printerPort,{ type:'number', inputmode:'numeric' });
      const save = action('Save print settings','primary');
      const health = action('Test bridge');
      const result = document.createElement('p');
      save.addEventListener('click', () => {
        localStorage.setItem('lz35.print.bridgeUrl', bridge.input.value.trim());
        localStorage.setItem('lz35.print.printerIp', ip.input.value.trim());
        localStorage.setItem('lz35.print.printerPort', port.input.value.trim());
        result.textContent = 'Print settings saved locally.';
      });
      health.addEventListener('click', async () => {
        const status = await services.print.health();
        result.textContent = status.bridge === 'online' ? 'Mac bridge online.' : `Mac bridge offline: ${status.error}`;
      });
      const row = document.createElement('div'); row.className = 'button-row'; row.append(save,health);
      printing.append(printTitle,bridge.wrap,ip.wrap,port.wrap,row,result);

      grid.append(cloud,printing);
      section.append(grid);
      return section;
    },
  };
}
