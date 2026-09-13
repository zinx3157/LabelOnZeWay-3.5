export function createWorkspaceService({ supabase, store }) {
  async function list() {
    const state = store.getState();
    if (!state.session?.user?.id) return [];
    const client = await supabase.connect();
    const { data: memberships, error: memberError } = await client
      .from('workspace_members')
      .select('workspace_id,role')
      .eq('user_id', state.session.user.id);
    if (memberError) throw memberError;
    const ids = (memberships || []).map((item) => item.workspace_id);
    if (!ids.length) return [];
    const { data: workspaces, error: workspaceError } = await client
      .from('workspaces')
      .select('id,name,created_at')
      .in('id', ids)
      .order('created_at', { ascending: true });
    if (workspaceError) throw workspaceError;
    const roleById = new Map((memberships || []).map((item) => [item.workspace_id, item.role]));
    return (workspaces || []).map((item) => ({ ...item, role: roleById.get(item.id) || 'viewer' }));
  }

  async function select(workspace) {
    if (!workspace?.id) throw new Error('Workspace is required');
    const current = store.getState();
    store.setState({ workspace: { id: workspace.id, name: workspace.name || 'Workspace', role: workspace.role || 'viewer', profileId: current.workspace?.profileId || 'ps_default' } });
    return store.getState().workspace;
  }

  async function ensureSelected() {
    const available = await list();
    const state = store.getState();
    const current = available.find((item) => item.id === state.workspace?.id);
    if (current) return select(current);
    if (available.length) return select(available[0]);
    store.setState({ workspace: null });
    return null;
  }

  return { list, select, ensureSelected };
}
