/* SPDX-License-Identifier: AGPL-3.0-or-later */
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let PW;
try{PW=require(process.env.BIBA_PLAYWRIGHT||'playwright');}catch{PW=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
export const root=fileURLToPath(new URL('../../',import.meta.url));
export async function openBrowser(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wav':'audio/wav','.mp3':'audio/mpeg','.json':'application/json'};
 const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root)){res.writeHead(403).end();return;}res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await PW.chromium.launch({headless:true,executablePath:process.env.BIBA_CHROMIUM||PW.chromium.executablePath(),args:['--no-sandbox']});
 return{browser,url:'http://127.0.0.1:'+server.address().port,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
