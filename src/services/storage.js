const KEY = 'labelonzeway.3.5.state.v1';

export function createStorageService() {
  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return {
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          parcels: Array.isArray(parsed.parcels) ? parsed.parcels : [],
          archive: Array.isArray(parsed.archive) ? parsed.archive : [],
          claims: Array.isArray(parsed.claims) ? parsed.claims : [],
          workspace: parsed.workspace || null,
        };
      } catch {
        return {};
      }
    },
    save(state) {
      const snapshot = {
        customers: state.customers || [],
        parcels: state.parcels || [],
        archive: state.archive || [],
        claims: state.claims || [],
        workspace: state.workspace || null,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    },
  };
}
