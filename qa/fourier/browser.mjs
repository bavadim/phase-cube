/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select,turnPuzzle,actionPoint} from '../modules/field-input.mjs';
const runtime=await openBrowser(),report={schema:'fourier-points-browser/2',engine:runtime.engine,cases:[],errors:[],physicalDevice:false};
try{
 for(const [width,height,touch]of [[1280,800,false],[390,844,true],[320,568,true]]){
  const ctx=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),page=await ctx.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(runtime.url+'/?debug=1&puzzle=fourier');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  assert.equal(await page.locator('#puzzle-select').inputValue(),'fourier');
  const canvas=await page.locator('#puzzle-stage canvas').elementHandle();
  for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
   await page.evaluate(songId=>phaseCubeApp.choose({songId,puzzleId:'fourier'}),songId);
   await page.locator('#start').click();await settled(page);
   await page.waitForFunction(()=>phaseCubeApp.diagnostics().playing&&phaseCubeApp.diagnostics().rms>.0001);
   const d=await page.evaluate(()=>phaseCubeApp.diagnostics());assert.equal(d.projection,'fourier-time/2');assert.equal(d.fragmentCount,6);assert.equal(d.pieceCount,4);assert.equal(d.masterGain,1);
   const locations=await targets(page);assert.equal(locations.length,4);assert(locations.every(t=>t.kind==='point'&&t.selectOnly));
   assert.equal(await page.locator('.turn-button').count(),2,'Only the bottom two operation buttons');
   assert.equal(await page.locator('.puzzle-operation').count(),1);
   // Test the exact and rounded mobile hit coordinates in every finite state.
   const missed=await page.evaluate(()=>{
    const m=phaseCubeApp.getPuzzle(),stage=phaseCubeApp.getPresentation(),original=m.snapshot(),misses=[];
    for(const state of m.allStates()){
     m.restore(state);stage.update(false);
     for(const p of stage.locations()){
      const hit=stage.pick(Math.round(p.x),Math.round(p.y));if(hit?.key!==p.key)misses.push({state,key:p.key,hit:hit?.key});
     }
    }
    m.restore(original);stage.update(false);return misses;
   });assert.deepEqual(missed,[],'Every point remains selectable in every state');
   assert(d.phases.every(p=>p===null));assert.equal(await page.locator('.orbit-track[data-phase]').count(),0,'Nonlinear timing is not one phase offset');
   const start=await page.evaluate(()=>phaseCubeApp.state()),backing=await page.evaluate(()=>phaseCubeApp.getTransport().backingId);
   for(const key of ['A','B','C','D']){
    await select(page,key,touch);await select(page,key,touch); // repeated point taps only select
    const pair=await page.evaluate(()=>phaseCubeApp.getPuzzle().pair());
    assert.equal(await page.locator('.puzzle-operation').textContent(),'Связь '+(pair[0]+1)+' ↔ '+(pair[1]+1));
    await turnPuzzle(page,key,false,touch);await turnPuzzle(page,key,true,touch);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),start);
   }
   if(!touch){const p=await actionPoint(page,'D',true);await page.mouse.move(p.x,p.y);}
   await page.screenshot({path:join(root,`qa/fourier/${songId}-${width}.png`)});
   assert.equal(await page.evaluate(()=>phaseCubeApp.getTransport().backingId),backing,'Moves must preserve the playing backing bus');
   const before=await page.evaluate(()=>phaseCubeApp.state());await page.locator('#turn-right').click();await settled(page);await page.locator('#undo').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before);
   await page.locator('#pause').click();await page.waitForFunction(()=>phaseCubeApp.diagnostics().context==='suspended');
   await page.locator('#start').click();await settled(page);await page.evaluate(()=>phaseCubeApp.seekSong(16));await settled(page);
   assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase),'playing','Seeking must not trigger an interruption pause');
   let steps=0;
   while(await page.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase!=='won')){
    await page.locator('#hint').click();const move=await page.evaluate(()=>phaseCubeApp.diagnostics().hint);assert(move);
    await turnPuzzle(page,move[0],move.endsWith("'"),touch);assert(++steps<8);
   }
   await page.waitForFunction(()=>document.querySelector('#result-dialog').open);
   assert.equal(await page.locator('#correct-count').textContent(),'4/4');assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().playing),true);
   assert.equal(await page.locator('#celebration .firework-spark').count(),70);
   await page.locator('#play-again').click();await settled(page);assert.equal(await page.locator('#undo').isDisabled(),true);
   await select(page,'A',touch);await page.locator('#pause').click();
   report.cases.push({width,height,touch,songId,steps,pointSelection:true,repeatedTapSelects:true,pointHitsIn192States:true,bottomOnlyOperations:true,undo:true,pauseSeek:true,winReplay:true,masterGain:1});
  }
  // Same renderer across both musical projection families, including a return to Fourier.
  for(const id of ['rubik','twiddle','fourier']){
   await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);
   assert(await page.evaluate(c=>document.querySelector('#puzzle-stage canvas')===c,canvas));
  }
  await ctx.close();
 }
 // Exercise the same spectral binding and direct controls in the one-file distribution.
 const ctx=await runtime.browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage();
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.continue():r.abort());page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(runtime.url+'/steel-shift-cube.html?debug=1&puzzle=fourier&song=steel-shift');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);await ctx.setOffline(true);
 await page.locator('#start').click();await settled(page);await select(page,'D',true);await turnPuzzle(page,'D',false,true);await turnPuzzle(page,'D',true,true);
 await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);await ctx.close();report.offline=true;
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,`qa/fourier/${runtime.engine}-points-report.json`),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify(report,null,2));
}
