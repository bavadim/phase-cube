/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Optional offline export. The normal app is served directly from index.html.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
let html=await readFile(new URL('index.html',root),'utf8');
const css=await readFile(new URL('style.css',root),'utf8');
html=html.replace(/<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">/,()=>`<style>\n${css}\n</style>`);
for(const match of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]){
  const code=(await readFile(new URL(match[1].split('?')[0],root),'utf8')).replace(/<\/script/gi,'<\\/script');
  html=html.replace(match[0],()=>`<script>\n${code}\n</script>`);
}
const output=new URL('phase-cube.html',root);await writeFile(output,html);
console.log(`${fileURLToPath(output)} (${Buffer.byteLength(html)} bytes)`);
