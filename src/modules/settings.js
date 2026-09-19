import { field, action } from '../components/form.js';
import { bytesToBase64 } from '../domain/escpos.js';
import { renderProfileManager } from './profile-manager.js';

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

function testReceipt() {
  const text = '\x1b@LZWAY\nPOS80C TEST OK\n\n\n\x1dVB\x00';
  return bytesToBase64(new TextEncoder().encode(text));
}

export function createSettingsModule({ store, services }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Settings', 'Company profiles, cloud account, workspace sync and printer status.'));
      const grid = document.createElement('div');
      grid.className = 'settings-grid';

      const profiles = renderProfileManager(state, store);

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
      printing.className = 'workspace-card printer-card';
      const top = document.createElement('div');
      top.className = 'printer-card-head';
      const identity = document.createElement('div');
      const printTitle = document.createElement('h2');
      printTitle.textContent = 'POS80C Printer';
      const printSub = document.createElement('p');
      printSub.textContent = 'Automatic local/cloud printing with PDF fallback.';
      identity.append(printTitle, printSub);
      const badge = document.createElement('span');
      badge.className = 'printer-status is-neutral';
      badge.textContent = 'Not checked';
      top.append(identity, badge);

      const result = document.createElement('p');
      result.className = 'printer-result';
      result.textContent = 'Daily printing uses the saved POS80C connection automatically.';

      const quickActions = document.createElement('div');
      quickActions.className = 'button-row';
      const test = action('Test Print', 'primary');
      const advancedToggle = action('Advanced');
      quickActions.append(test, advancedToggle);

      const advanced = document.createElement('div');
      advanced.className = 'printer-advanced';
      advanced.hidden = true;
      const defaults = services.print.defaults;
      const bridge = field('Mac bridge URL', 'bridge', localStorage.getItem('lz35.print.bridgeUrl') || defaults.bridgeUrl);
      const ip = field('Printer IP', 'printerIp', localStorage.getItem('lz35.print.printerIp') || defaults.printerIp);
      const port = field('Printer port', 'printerPort', localStorage.getItem('lz35.print.printerPort') || defaults.printerPort, { type: 'number', inputmode: 'numeric' });
      const save = action('Save advanced settings');
      const health = action('Run diagnostics');
      const advancedActions = document.createElement('div');
      advancedActions.className = 'button-row';
      advancedActions.append(save, health);
      advanced.append(bridge.wrap, ip.wrap, port.wrap, advancedActions);

      advancedToggle.addEventListener('click', () => {
        advanced.hidden = !advanced.hidden;
        advancedToggle.textContent = advanced.hidden ? 'Advanced' : 'Hide advanced';
      });
      save.addEventListener('click', () => {
        localStorage.setItem('lz35.print.bridgeUrl', bridge.input.value.trim());
        localStorage.setItem('lz35.print.printerIp', ip.input.value.trim());
        localStorage.setItem('lz35.print.printerPort', port.input.value.trim());
        result.textContent = 'Advanced printer settings saved.';
      });
      health.addEventListener('click', async () => {
        badge.textContent = 'Checking…';
        badge.className = 'printer-status is-neutral';
        const status = await services.print.health();
        if (status.bridge === 'online' && status.printer === 'online') {
          badge.textContent = 'Ready';
          badge.className = 'printer-status is-ready';
          result.textContent = 'Mac bridge and POS80C are online.';
        } else if (status.bridge === 'online') {
          badge.textContent = 'Bridge online';
          badge.className = 'printer-status is-warning';
          result.textContent = 'Mac bridge is online; printer connection is not yet confirmed.';
        } else {
          badge.textContent = 'Offline';
          badge.className = 'printer-status is-offline';
          result.textContent = `Printer path unavailable: ${status.error || 'bridge offline'}`;
        }
      });
      test.addEventListener('click', async () => {
        test.disabled = true;
        badge.textContent = 'Printing…';
        badge.className = 'printer-status is-neutral';
        try {
          const output = await services.print.printWithRetry({ data: testReceipt(), labels: 1 }, { attempts: 2 });
          badge.textContent = 'Ready';
          badge.className = 'printer-status is-ready';
          result.textContent = output.adapter === 'cloud' ? 'Test print queued through Cloud Print.' : 'Test print sent to POS80C.';
        } catch (error) {
          badge.textContent = 'Offline';
          badge.className = 'printer-status is-offline';
          result.textContent = `Test print failed: ${error.message}`;
        } finally {
          test.disabled = false;
        }
      });

      printing.append(top, result, quickActions, advanced);
      if (state.ui?.notice) { const notice = document.createElement('div'); notice.className = 'calculation'; notice.textContent = state.ui.notice; section.append(notice); }
      const tools = document.createElement('article');
      tools.className = 'workspace-card';
      const toolsTitle = document.createElement('h2');
      toolsTitle.textContent = 'Team & automation';
      const toolsRow = document.createElement('div');
      toolsRow.className = 'button-row';
      for (const [hash, label] of [['#/notify', 'Customer notifications'], ['#/settlements', 'COD settlements'], ['#/sync', 'Sync center']]) {
        const open = action(label);
        open.addEventListener('click', () => { location.hash = hash; });
        toolsRow.append(open);
      }
      tools.append(toolsTitle, toolsRow);
      grid.append(profiles, cloud, printing, tools);
      section.append(grid);
      return section;
    },
  };
}
