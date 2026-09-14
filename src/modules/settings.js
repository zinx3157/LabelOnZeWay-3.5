import { field, action } from '../components/form.js';

function heading(title, description) {
  const wrap = document.createElement('div');
  wrap.className = 'screen-heading';
  const copy = document.createElement('div');
  const h1 = document.createElement('h1');
  const p = document.createElement('p');
  h1.textContent = title;
  p.textContent = description;
  copy.append(h1, p);
  wrap.append(copy);
  return wrap;
}

export function createSettingsModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Settings', 'Cloud session, workspace synchronization and local print configuration.'));
      const grid = document.createElement('div');
      grid.className = 'settings-grid';
      const cloud = document.createElement('article');
      cloud.className = 'workspace-card';
      const cloudTitle = document.createElement('h2');
      cloudTitle.textContent = 'Cloud';
      cloud.append(cloudTitle);

      if (state.session?.user) {
        const signed = document.createElement('p');
        signed.textContent = `Signed in: ${state.session.user.email || state.session.user.id}`;
        const workspaceLine = document.createElement('p');
        workspaceLine.textContent = state.workspace ? `Workspace: ${state.workspace.name} · ${state.workspace.role}` : 'No accessible workspace selected.';
        const syncState = document.createElement('p');
        syncState.textContent = `Sync: ${state.sync.status}${state.sync.conflict ? ` · ${state.sync.conflicts?.length || 0} local/cloud conflict(s)` : ''}`;
        const actions = document.createElement('div');
        actions.className = 'button-row';
        const discover = action('Refresh workspace');
        const pull = action('Pull cloud');
        const push = action('Push local', 'primary');
        const out = action('Sign out');
        pull.disabled = !state.workspace;
        push.disabled = !state.workspace;
        discover.addEventListener('click', async () => {
          try { await services.workspace.ensureSelected(); store.setState({ ui: { ...store.getState().ui, notice: 'Workspace refreshed.' } }); }
          catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        pull.addEventListener('click', async () => {
          try {
            const result = await services.sync.pullSnapshot();
            const notice = result.status === 'conflict' ? `Pull stopped safely: ${result.conflicts.length} newer local record(s). Choose Keep local or Use cloud.` : `Pulled ${result.records || 0} cloud records.`;
            store.setState({ ui: { ...store.getState().ui, notice } });
          } catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        push.addEventListener('click', async () => {
          try { const result = await services.sync.pushSnapshot(); store.setState({ ui: { ...store.getState().ui, notice: `Pushed ${result.records || 0} records.` } }); }
          catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        out.addEventListener('click', async () => {
          try { await services.auth.signOut(); store.setState({ workspace: null, sync: { status: 'local-only', conflict: false } }); }
          catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        actions.append(discover, pull, push, out);
        cloud.append(signed, workspaceLine, syncState, actions);
        if (state.sync.conflict) {
          const conflictActions = document.createElement('div');
          conflictActions.className = 'button-row';
          const keepLocal = action('Keep local / Push', 'primary');
          const useCloud = action('Use cloud');
          keepLocal.addEventListener('click', async () => {
            try { const result = await services.sync.pushSnapshot(); store.setState({ ui: { ...store.getState().ui, notice: `Conflict resolved with local data: ${result.records || 0} records pushed.` } }); }
            catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
          });
          useCloud.addEventListener('click', async () => {
            try { const result = await services.sync.pullSnapshot({ force: true }); store.setState({ ui: { ...store.getState().ui, notice: `Conflict resolved with cloud data: ${result.records || 0} records pulled.` } }); }
            catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
          });
          conflictActions.append(keepLocal, useCloud);
          cloud.append(conflictActions);
        }
      } else {
        const email = field('Email', 'email', '', { type: 'email' });
        const password = field('Password', 'password', '', { type: 'password' });
        const signin = action('Sign in', 'primary');
        signin.addEventListener('click', async () => {
          try { await services.auth.signIn(email.input.value.trim(), password.input.value); await services.workspace.ensureSelected(); store.setState({ sync: { status: 'ready', conflict: false }, ui: { ...store.getState().ui, notice: 'Cloud signed in.' } }); }
          catch (error) { store.setState({ ui: { ...store.getState().ui, notice: error.message } }); }
        });
        cloud.append(email.wrap, password.wrap, signin);
      }

      const printing = document.createElement('article');
      printing.className = 'workspace-card';
      const printTitle = document.createElement('h2');
      printTitle.textContent = 'POS80C';
      const defaults = services.print.defaults;
      const bridge = field('Mac bridge URL', 'bridge', localStorage.getItem('lz35.print.bridgeUrl') || defaults.bridgeUrl);
      const ip = field('Printer IP', 'printerIp', localStorage.getItem('lz35.print.printerIp') || defaults.printerIp);
      const port = field('Printer port', 'printerPort', localStorage.getItem('lz35.print.printerPort') || defaults.printerPort, { type: 'number', inputmode: 'numeric' });
      const save = action('Save print settings', 'primary');
      const health = action('Test bridge');
      const result = document.createElement('p');
      save.addEventListener('click', () => { localStorage.setItem('lz35.print.bridgeUrl', bridge.input.value.trim()); localStorage.setItem('lz35.print.printerIp', ip.input.value.trim()); localStorage.setItem('lz35.print.printerPort', port.input.value.trim()); result.textContent = 'Print settings saved locally.'; });
      health.addEventListener('click', async () => { const status = await services.print.health(); result.textContent = status.bridge === 'online' ? `Mac bridge online${status.printer === 'online' ? ' · POS80C online.' : ' · printer not confirmed.'}` : `Mac bridge offline: ${status.error}`; });
      const row = document.createElement('div');
      row.className = 'button-row';
      row.append(save, health);
      printing.append(printTitle, bridge.wrap, ip.wrap, port.wrap, row, result);
      if (state.ui?.notice) { const notice = document.createElement('div'); notice.className = 'calculation'; notice.textContent = state.ui.notice; section.append(notice); }
      grid.append(cloud, printing);
      section.append(grid);
      return section;
    },
  };
}
