export function createAuthService({ supabase, store }) {
  let unsubscribe = null;

  async function start() {
    const client = await supabase.connect();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    store.setState({ session: data.session || null });
    const listener = client.auth.onAuthStateChange((_event, session) => store.setState({ session: session || null }));
    unsubscribe = () => listener.data.subscription.unsubscribe();
    return data.session || null;
  }

  async function signIn(email, password) {
    const client = await supabase.connect();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    store.setState({ session: data.session || null });
    return data.session;
  }

  async function signOut() {
    const client = await supabase.connect();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    store.setState({ session: null });
  }

  function stop() { if (unsubscribe) unsubscribe(); unsubscribe = null; }
  return { start, stop, signIn, signOut };
}
