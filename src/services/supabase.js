export function createSupabaseService() {
  let client = null;
  let config = null;

  async function loadConfig() {
    const response = await fetch('./public/sync-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cloud configuration unavailable');
    config = await response.json();
    if (!/^https:\/\//.test(config.supabaseUrl || '') || String(config.supabaseAnonKey || '').length < 20) {
      throw new Error('Cloud configuration invalid');
    }
    return config;
  }

  async function connect() {
    if (client) return client;
    if (!config) await loadConfig();
    const library = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client = library.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return client;
  }

  return { loadConfig, connect, get client() { return client; }, get config() { return config; } };
}
