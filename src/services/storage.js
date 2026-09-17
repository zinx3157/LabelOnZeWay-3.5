const KEY = 'lzway.3.5.state.v1';
// Pre-rebrand key (LabelOnZeWay 3.5). Read once so existing installs keep their
// data; save() mirrors to it until 3.6 so a rollback build still sees updates
// (production-safety rule in docs/MIGRATION.md).
const LEGACY_BRAND_KEY = 'labelonzeway.3.5.state.v1';
const LEGACY_PROFILE_KEYS = ['lzb2.profiles', 'lz.profiles', 'sd.profiles'];
const LEGACY_ACTIVE_KEYS = ['lzb2.profile', 'lz.profile', 'sd.profile'];

function safeJson(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function legacyProfiles() {
  for (const key of LEGACY_PROFILE_KEYS) {
    const value = safeJson(localStorage.getItem(key) || 'null', null);
    if (Array.isArray(value) && value.length) {
      return value.filter((profile) => profile && profile.id).map((profile) => ({
        ...profile,
        id: String(profile.id),
        name: String(profile.name || profile.company || profile.id),
        migratedFrom: '2.5.4',
      }));
    }
  }
  return [];
}

function legacyActiveProfileId() {
  for (const key of LEGACY_ACTIVE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return String(value);
  }
  return '';
}

function mergeProfiles(current, legacy) {
  const merged = new Map();
  for (const profile of [...legacy, ...current]) {
    if (!profile?.id) continue;
    merged.set(String(profile.id), { ...merged.get(String(profile.id)), ...profile, id: String(profile.id) });
  }
  return [...merged.values()];
}

export function createStorageService() {
  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_BRAND_KEY);
        const parsed = raw ? safeJson(raw, {}) : {};
        const migrated = legacyProfiles();
        const profiles = mergeProfiles(Array.isArray(parsed.profiles) ? parsed.profiles : [], migrated);
        let activeProfileId = String(parsed.activeProfileId || legacyActiveProfileId() || profiles[0]?.id || '');
        if (activeProfileId && !profiles.some((profile) => String(profile.id) === activeProfileId)) activeProfileId = String(profiles[0]?.id || '');
        return {
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          parcels: Array.isArray(parsed.parcels) ? parsed.parcels : [],
          archive: Array.isArray(parsed.archive) ? parsed.archive : [],
          claims: Array.isArray(parsed.claims) ? parsed.claims : [],
          inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
          stockMovements: Array.isArray(parsed.stockMovements) ? parsed.stockMovements : [],
          profiles,
          activeProfileId,
          workspace: parsed.workspace || null,
          profileSettings: parsed.profileSettings && typeof parsed.profileSettings === 'object' ? parsed.profileSettings : { name: '', manifestEmail: '' },
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
        inventory: state.inventory || [],
        stockMovements: state.stockMovements || [],
        profiles: state.profiles || [],
        activeProfileId: state.activeProfileId || '',
        workspace: state.workspace || null,
        profileSettings: state.profileSettings || { name: '', manifestEmail: '' },
        savedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(snapshot);
      localStorage.setItem(KEY, json);
      localStorage.setItem(LEGACY_BRAND_KEY, json);
    },
  };
}
