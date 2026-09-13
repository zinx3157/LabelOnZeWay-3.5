import { heading } from '../components/view.js';
import { field, action } from '../components/form.js';

export function createProfilesModule({ store }) {
  return {
    render(state) {
      const section = document.createElement('section');
      section.className = 'screen';
      section.append(heading('Profiles', 'Company/workspace identity used by labels, sync and printing.'));
      const card = document.createElement('div');
      card.className = 'workspace-card';
      const workspace = document.createElement('p');
      workspace.textContent = state.workspace ? `Workspace: ${state.workspace.name}` : 'No cloud workspace selected.';
      const profile = field('Profile ID', 'profileId', state.workspace?.profileId || 'ps_default', { placeholder: 'ps_default' });
      const save = action('Use profile', 'primary');
      const status = document.createElement('p');
      save.addEventListener('click', () => {
        const id = profile.input.value.trim() || 'ps_default';
        const current = store.getState();
        if (!current.workspace) {
          status.textContent = 'Sign in and select a workspace before changing the cloud profile.';
          return;
        }
        store.setState({ workspace: { ...current.workspace, profileId: id } });
        status.textContent = `Profile ${id} selected.`;
      });
      card.append(workspace, profile.wrap, save, status);
      section.append(card);
      return section;
    },
  };
}
