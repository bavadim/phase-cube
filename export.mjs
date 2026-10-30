/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Optional offline HTML: the same score factories, sample bank and downloads.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=new URL('./',import.meta.url);
const {files}=require('./composition-loader.js'),bank=require('./audio-bank.js').files;
let html=await readFile(new URL('index.html',root),'utf8');
const css=await readFile(new URL('style.css',root),'utf8');
html=html.replace(/<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">/,()=>`<style>\n${css}\n</style>`);
const paths=new Set(Object.values(bank).flatMap(v=>Array.isArray(v)?v:Object.values(v)));
for(const id of files)paths.add(`assets/${id}-game.mp3`);
const assets={};
for(const path of paths){const data=await readFile(new URL(path,root));assets[path]=`data:${path.endsWith('.mp3')?'audio/mpeg':'audio/wav'};base64,${data.toString('base64')}`;}
const factories=[];
for(const id of files){
 const code=await readFile(new URL(`compositions/${id}.strudel.mjs`,root),'utf8');
 if(!code.includes('export default function compose('))throw new Error('Unexpected score module: '+id);
 factories.push(`${JSON.stringify(id)}:(()=>{${code.replace('export const metadata','const metadata').replace('export default ','')};return {metadata,default:compose};})()`);
}
const embedded=`globalThis.PhaseCubeEmbeddedAssets=${JSON.stringify(assets)};\nglobalThis.PhaseCubeEmbeddedCompositions={${factories.join(',\n')}};`;
html=html.replace('<script src="audio-bank.js?v=compositions1"></script>',()=>`<script>${embedded.replace(/<\/script/gi,'<\\/script')}</script>\n<script src="audio-bank.js?v=compositions1"></script>`);
for(const match of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]){
 const code=(await readFile(new URL(match[1].split('?')[0],root),'utf8')).replace(/<\/script/gi,'<\\/script');
 html=html.replace(match[0],()=>`<script>\n${code}\n</script>`);
}
const output=new URL('steel-shift-cube.html',root);await writeFile(output,html);
console.log(`${fileURLToPath(output)} (${Buffer.byteLength(html)} bytes; ${files.length} compositions)`);
