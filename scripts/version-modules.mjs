import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const html=await readFile('index.html','utf8');
const version=html.match(/const VERSION = '([^']+)'/)?.[1];
if(!version)throw Error('Release version is missing');
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory()){await walk(path);continue;}if(!path.endsWith('.js'))continue;const source=await readFile(path,'utf8');const updated=source.replace(/((?:from\s+|import\s*)['"])(\.{1,2}\/[^'"]+?\.js)(?:\?v=[^'"]*)?(['"])/g,`$1$2?v=${version}$3`);if(updated!==source)await writeFile(path,updated);}}
await walk('src');
console.log(`Module imports versioned for release ${version}`);
