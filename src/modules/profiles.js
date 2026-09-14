import { heading } from '../components/view.js';
import { field, action } from '../components/form.js';

function profileKey(workspaceId, profileId) {
  return `lz35.profileData:${workspaceId}:${profileId}`;
}

function readProfile(workspaceId, profileId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileKey(workspaceId, profileId)) || 'null');
    if (!parsed) return { customers: [], parcels: [], archive: [] };
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      parcels: Array.isArray(parsed.parcels) ? parsed.parcels : [],
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    };
  } catch {
    return { customers: [], parcels: [], archive: [] };
  }
}

function writeProfile(workspaceId, profileId, state) {
  localStorage.setItem(profileKey(workspaceId, profileId), JSON.stringify({
    customers: state.customers || [],
    parcels: state.parcels || [],
    archive: state.archive || [],
    savedAt: new Date().toISOString(),
  }));
}

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
        const currentId = current.workspace.profileId || 'ps_default';
        if (id === currentId) {
          status.textContent = `Profile ${id} already selected.`;
          return;
        }
        writeProfile(current.workspace.id, currentId, current);
        const target = readProfile(current.workspace.id, id);
        store.setState({
          workspace: { ...current.workspace, profileId: id },
          customers: target.customers,
          parcels: target.parcels,
          archive: target.archive,
          sync: { status: current.session ? 'ready' : 'local-only', conflict: false },
        });
        status.textContent = `Profile ${id} selected. Local data isolated from ${currentId}.`;
      });
      card.append(workspace, profile.wrap, save, status);
      section.append(card);
      return section;
    },
  };
}
