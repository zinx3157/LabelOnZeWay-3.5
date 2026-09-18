// Release guard (PWA-01): one version number across index.html, a service-worker
// precache that actually covers every shipped file, and a branded manifest.
// Runs via `npm run check`, in CI and before every Pages/APK build.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const errors = [];
const html = await readFile('index.html', 'utf8');
const sw = await readFile('sw.js', 'utf8');

// 1. index.html carries exactly one version, and every cache-busting link agrees with it.
const versionMatch = html.match(/const VERSION = '([^']+)'/);
if (!versionMatch) errors.push('index.html: missing `const VERSION = \'…\'` constant');
const version = versionMatch?.[1];
for (const m of html.matchAll(/\?v=([0-9A-Za-z._-]+)/g)) {
  if (m[1] !== version) errors.push(`index.html: ?v=${m[1]} disagrees with VERSION='${version}'`);
}

// 2. The service-worker cache name stays on the current brand prefix
//    (index.html boot cleanup and sw.js activate both rely on it).
if (!/^const CACHE='lzway-3\.5-shell-v[0-9]+';/m.test(sw)) {
  errors.push('sw.js: CACHE must match `lzway-3.5-shell-v<N>`');
}

// 3. Every SHELL entry exists on disk, and every shipped src/public file is precached —
//    a module missing from SHELL breaks offline boot (found in audit PWA-01 follow-up:
//    stock.js, profile-manager.js and domain/csv.js shipped without being precached).
const shellList = (sw.match(/const SHELL=\[(.*?)\];/s)?.[1] ?? '')
  .split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
for (const entry of shellList) {
  const path = entry.replace(/^\.\//, '');
  if (!path) continue;
  try { await readFile(path, 'utf8'); } catch { errors.push(`sw.js SHELL entry missing on disk: ${entry}`); }
}
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}
const shellSet = new Set(shellList.map((entry) => entry.replace(/^\.\//, '')));
for (const file of [...await walk('src'), ...await walk('public')]) {
  if (!shellSet.has(file)) errors.push(`shipped file not precached in sw.js SHELL: ${file}`);
}

// 4. Stylesheets referenced by index.html must be precached too.
for (const m of html.matchAll(/href="\.\/(src\/styles\/[^"?]+)/g)) {
  if (!shellSet.has(m[1])) errors.push(`index.html stylesheet not in sw.js SHELL: ${m[1]}`);
}

// 5. Manifest keeps the LZWay identity after the rebrand.
const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
if (!String(manifest.name).startsWith('LZWay')) errors.push(`manifest.webmanifest: name lost the LZWay brand (${manifest.name})`);

if (errors.length) {
  console.error('Release guard: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Release guard: PASS (version ${version}, ${shellList.length} precached entries)`);
