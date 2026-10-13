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
    store.setState({ workspace: { id: workspace.id, name: workspace.name || 'Workspace', role: workspace.role || 'viewer', profileId: current.activeProfileId || current.workspace?.profileId || 'ps_default' } });
    return store.getState().workspace;
  }

  async function ensureSelected() {
    const available = await list();
    const state = store.getState();
    const current = available.find((item) => item.id === state.workspace?.id);
    if (current || available.length) {
      const chosen = current || available[0];
      await select(chosen);
      const client = await supabase.connect();
      const {data,error} = await client.from('sync_entities').select('profile_id,payload,modified_at').eq('workspace_id',chosen.id).in('entity_type',['profile','profile_catalog_v35']).is('deleted_at',null).order('modified_at',{ascending:false});
      if(!error && data?.length){
        const latest=store.getState();const catalog=new Map((latest.profiles||[]).map(p=>[String(p.id),p]));
        for(const row of data){const id=String(row.payload?.id||row.profile_id);if(!catalog.has(id))catalog.set(id,{...row.payload,id});}
        const patch={profiles:[...catalog.values()]};
        if(!latest.activeProfileId&&latest.workspace.profileId==='ps_default'&&!latest.customers.length&&!latest.parcels.length){const target=data[0].profile_id;patch.activeProfileId=target;patch.workspace={...latest.workspace,profileId:target};}
        store.setState(patch);
      }
      return store.getState().workspace;
    }
    store.setState({ workspace: null });
    return null;
  }

  return { list, select, ensureSelected };
}
