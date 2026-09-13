import { access, readFile } from 'node:fs/promises';

const required = ['package.json', 'docs/MIGRATION.md'];
for (const file of required) await access(file);

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!String(pkg.version).startsWith('3.5.')) {
  throw new Error(`Expected 3.5.x version, found ${pkg.version}`);
}

const migration = await readFile('docs/MIGRATION.md', 'utf8');
for (const heading of ['## KEEP', '## REBUILD', '## DROP', '## Production safety']) {
  if (!migration.includes(heading)) throw new Error(`Missing migration section: ${heading}`);
}

console.log('LabelOnZeWay 3.5 baseline structure: PASS');
