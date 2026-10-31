/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'picture-assets/1',engine:r.engine,physicalDevice:false,cases:[]};
try{
  {
    const context=await r.browser.newContext(),page=await context.newPage();
    await page.route('**/director-puzzle.png*',route=>route.abort());
    await page.goto(r.url+'/?debug=1&puzzle=scratch');await page.waitForFunction(()=>window.phaseCubeApp);
    await assert.rejects(()=>page.evaluate(()=>phaseCubeApp.ready),/картинка/);
    assert.match(await page.locator('#session-feedback').textContent(),/картинка/);
    assert.equal(await page.locator('#start').isEnabled(),true);
    assert.equal(await page.locator('#start').textContent(),'Повторить');
    report.cases.push({missingImage:'explicit retry state'});await context.close();
  }
  {
    const context=await r.browser.newContext(),page=await context.newPage(),errors=[];let blocked;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/director-puzzle.png*',route=>{blocked=route;});
    await page.goto(r.url+'/?debug=1&puzzle=scratch');await page.waitForFunction(()=>window.phaseCubeApp);
    await page.waitForFunction(()=>phaseCubeApp.getPresentation()?.active?.view?.ready!=null);
    await page.evaluate(()=>phaseCubeApp.choosePuzzle('twiddle'));
    assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().puzzleId),'twiddle');
    if(blocked)await blocked.abort();
    await page.evaluate(()=>phaseCubeApp.ready);
    assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().loading),false);
    assert.deepEqual(errors,[]);report.cases.push({cancelledImage:'new puzzle ready; old wait released'});await context.close();
  }
  {
    const context=await r.browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(r.engine==='webkit'){
      // This Linux WebKit build rejects offline file:// navigation internally.
      // Exercise the user's HTTP delivery, then disable the network for the
      // self-contained document's startup and actual audio playback.
      await page.goto(r.url+'/steel-shift-cube.html?debug=1&puzzle=scratch',{waitUntil:'domcontentloaded'});await context.setOffline(true);
    }else{
      await context.setOffline(true);await page.goto(pathToFileURL(join(root,'steel-shift-cube.html')).href+'?debug=1&puzzle=scratch');
    }
    await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
    assert.equal(await page.evaluate(()=>[...phaseCubeApp.getPresentation().active.resources.items].some(r=>r.isTexture&&r.image?.naturalWidth>0)),true);
    await page.locator('#start').tap();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
    assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().build),'music-puzzles/picture2');assert.deepEqual(errors,[]);
    report.cases.push({offlineHTML:r.engine==='webkit'?'HTTP document, then offline startup/audio; embedded assets':'file://, embedded art, embedded compositions and working audio',fileProtocol:r.engine==='webkit'?'unverified: Linux WebKit internal navigation error':'verified'});await context.close();
  }
  report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;throw error;}
finally{
  const files=['app.js','controls/puzzle.js','puzzles/scratch/three-view.js','assets/director-puzzle.png','steel-shift-cube.html'];
  report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(root,file))).digest('hex')])));
  await writeFile(join(root,`qa/scratch/${r.engine}-assets-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));
}
