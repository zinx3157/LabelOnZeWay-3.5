import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const required = [
  'src/app/bootstrap.js','src/app/router.js','src/app/store.js','src/modules/index.js','src/services/index.js','src/main.js','index.html'
];
for (const file of required) await readFile(file, 'utf8');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}

const files = await walk('src');
const banned = [
  /document\.write\s*\(/,
  /document\.open\s*\(/,
  /stopImmediatePropagation\s*\(/,
  /MutationObserver\s*\(/,
  /setTimeout\s*\(/,
  /!important/,
  /labelonzeway-v7/i,
  /\.\.\/labelonzeway\//i,
];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const rule of banned) if (rule.test(source)) throw new Error(`Banned legacy pattern ${rule} in ${file}`);
}
console.log(`Architecture guard: PASS (${files.length} source files scanned)`);
