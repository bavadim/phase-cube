/* SPDX-License-Identifier: AGPL-3.0-or-later */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1].split('?')[0]);
assert(scripts.length>0);
const {files}=await import('./composition-loader.js').then(m=>m.default);
for(const file of [...scripts,'check.mjs','export.mjs',...files.map(id=>`compositions/${id}.strudel.mjs`)]){
  assert(!file.includes('..')&&!file.includes('://'));
  const check=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ids');
for(const id of ['puzzle-stage','player-controls','dialogs','orbit-score'])assert(ids.includes(id),id);
for(const id of ['listen-target','scramble','tracks','track-select','tempo','show-target','foundation'])assert(!ids.includes(id),`Removed control: ${id}`);
for(const match of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g))assert((await readFile(new URL(match[1].split('?')[0],root))).length>0);
for(const id of files)assert((await readFile(new URL(`assets/${id}-game.mp3`,root))).length>1000,`MP3 missing: ${id}`);
assert(!html.includes('song-assets.js'),'The app must play note patterns rather than the old PCM song');
for(const item of JSON.parse(await readFile(new URL('vendor/manifest.json',root),'utf8'))){
  const data=await readFile(new URL(`vendor/${item.file}`,root));
  assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256,`Vendor changed: ${item.file}`);
}
console.log(`Client: ${scripts.length} local scripts, unique HTML ids, pinned vendor hashes verified`);
