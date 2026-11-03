/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled} from '../modules/field-input.mjs';
const r=await openBrowser(),errors=[],external=[],page=await r.browser.newPage({viewport:{width:1280,height:800}});
try{
 page.on('pageerror',e=>errors.push(e.message));page.on('request',q=>{if(/^https?:/.test(q.url()))external.push(q.url());});
 await page.goto(pathToFileURL(join(root,'steel-shift-cube.html')).href+'?debug=1');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzleModule().id),'bounce');
 assert.equal(await page.getByText('Круг ритма',{exact:true}).count(),0);await page.screenshot({path:join(root,'qa/bounce/components-start.png')});
 if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
 await page.locator('#start').click();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
 await page.locator('#next-object').click();const before=await page.evaluate(()=>phaseCubeApp.state());await page.locator('#turn-left').click();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);assert.notDeepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
 await page.locator('#undo').click();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const bytes=await readFile(join(root,'steel-shift-cube.html')),report={schema:'bounce-offline/1',status:'PASS',engine:r.engine,physicalDevice:false,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),externalRequests:external,errors,startAudio:true,move:true,undo:true};
 await writeFile(join(root,'qa/bounce/offline-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await r.close();}
