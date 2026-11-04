/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled} from '../modules/field-input.mjs';
const r=await openBrowser(),page=await r.browser.newPage({viewport:{width:1280,height:800}}),errors=[],external=[];
try{
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 await page.goto(pathToFileURL(join(root,'steel-shift-cube.html')).href+'?puzzle=fourier&song=turkish-circuit&debug=1');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
 assert.equal(await page.locator('#puzzle-select').inputValue(),'fourier');await page.locator('#start').click();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
 const before=await page.evaluate(()=>phaseCubeApp.state());await page.locator('#hint').click();await page.locator('.puzzle-action.hinted').click();await settled(page);assert.notDeepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
 await page.locator('#undo').click();await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const bytes=await readFile(join(root,'steel-shift-cube.html')),report={schema:'maze-offline/1',status:'PASS',engine:r.engine,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),externalRequests:external,errors,startAudio:true,hint:true,undo:true};
 await writeFile(join(root,'qa/maze/offline-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await r.close();}
