import { action } from '../components/form.js';

export function renderProfileManager(state, store) {
  const card = document.createElement('article');
  card.className = 'workspace-card';
  const title = document.createElement('h2');
  title.textContent = 'Company Profiles';
  const help = document.createElement('p');
  help.textContent = 'Profiles saved by LabelOnZeWay 2.5.4 on this browser are imported automatically and kept available in 3.5.';
  card.append(title, help);

  const profiles = Array.isArray(state.profiles) ? state.profiles : [];
  if (!profiles.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No legacy company profiles found on this device.';
    card.append(empty);
    return card;
  }

  const list = document.createElement('div');
  list.className = 'card-list';
  for (const profile of profiles) {
    const row = document.createElement('div');
    row.className = 'card';
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = profile.name || profile.company || profile.id;
    const meta = document.createElement('small');
    const active = String(profile.id) === String(state.activeProfileId || '');
    meta.textContent = active ? 'Active profile' : (profile.migratedFrom === '2.5.4' ? 'Imported from 2.5.4' : 'Saved profile');
    copy.append(name, document.createElement('br'), meta);
    row.append(copy);
    if (!active) {
      const open = action('Open / Switch', 'primary');
      open.addEventListener('click', () => {
        const id = String(profile.id);
        localStorage.setItem('lzb2.profile', id);
        localStorage.setItem('lz.profile', id);
        store.setState({
          activeProfileId: id,
          profileSettings: { ...store.getState().profileSettings, name: profile.name || profile.company || id },
          ui: { ...store.getState().ui, notice: `Active profile: ${profile.name || profile.company || id}` },
        });
      });
      row.append(open);
    }
    list.append(row);
  }
  card.append(list);
  return card;
}
