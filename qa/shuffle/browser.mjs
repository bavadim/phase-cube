/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,turnOnField} from '../modules/field-input.mjs';
const runtime=await openBrowser(),report={schema:'puzzle-shuffle/1',engine:runtime.engine,physicalDevice:false,cases:[],errors:[]};
const touch=runtime.engine==='webkit',width=touch?390:1280,height=touch?844:800;
const press=(page,id)=>touch?page.locator(id).tap():page.locator(id).click();
async function audit(page){
 await page.evaluate(()=>{
  window.shuffleAudit=[];const m=phaseCubeApp.getPuzzle(),shuffle=m.shuffle.bind(m);
  m.shuffle=()=>{
   const before=m.snapshot(),move=shuffle();
   shuffleAudit.push({before,after:m.snapshot(),expected:m.applyTo(before,move),move,
    phase:phaseCubeApp.diagnostics().sessionPhase,history:m.history.length});
   return move;
  };
 });
}
async function verifyTrace(page,count){
 const trace=await page.evaluate(()=>shuffleAudit);assert.equal(trace.length,count);
 for(const step of trace){assert.equal(step.phase,'shuffling');assert.equal(step.history,0);assert.deepEqual(step.after,step.expected);assert.notDeepEqual(step.after,step.before);}
 const d=await page.evaluate(()=>phaseCubeApp.diagnostics());assert.equal(d.sessionPhase,'playing');assert.equal(d.shuffle.complete,true);
 assert.equal(d.shuffle.moves.length,3);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),0);
 assert.equal(await page.locator('#undo').isDisabled(),true);assert.equal(await page.locator('#result-dialog').evaluate(e=>e.open),false);
 assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()),false);
}
try{
 const c=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});const p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(runtime.url+'/?debug=1');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 for(const id of ['twiddle','rubik','fourier']){
  await p.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);
  assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);
  assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().history.length),0);
  await audit(p);await press(p,'#start');
  await p.waitForFunction(()=>phaseCubeApp.diagnostics().sessionPhase==='shuffling'&&!phaseCubeApp.diagnostics().starting);
  assert.equal(await p.locator('#session-overlay').evaluate(e=>e.open),false);
  // The initial reference has not been secretly scrambled behind the dialog.
  assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);
  await p.waitForFunction(()=>phaseCubeApp.diagnostics().shuffle.moves.length===1);
  const state=await p.evaluate(()=>phaseCubeApp.state());
  for(const id of ['turn-left','turn-right','hint','undo','pause','song-seek'])assert.equal(await p.locator('#'+id).isDisabled(),true,id+' locked during demonstration');
  await p.evaluate(async()=>{await phaseCubeApp.turn(phaseCubeApp.getPuzzle().legalMoves()[0]);phaseCubeApp.hint();});
  assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),state,'User commands cannot move during demonstration');
  assert.equal(await p.locator('.turn-button.hinted').count(),1);
  await p.waitForTimeout(140);await p.screenshot({path:join(root,`qa/shuffle/${runtime.engine}-${id}.png`)});
  await settled(p);await verifyTrace(p,3);
  await p.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  // Pause/resume preserves this scramble instead of performing another intro.
  const before=await p.evaluate(()=>phaseCubeApp.state());await press(p,'#pause');await press(p,'#start');await settled(p);
  assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),before);assert.equal(await p.evaluate(()=>shuffleAudit.length),3);
  const key=await p.evaluate(()=>{
   const d=phaseCubeApp.diagnostics();return d.puzzleId==='rubik'?phaseCubeApp.getPresentation().locations()[0].key:'A';
  });
  await select(p,key,touch);await turnOnField(p,key,false,touch);await press(p,'#undo');await settled(p);
  assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),before);
  let steps=0;
  while(await p.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase!=='won')){
   await p.evaluate(()=>phaseCubeApp.turn(phaseCubeApp.getPuzzle().hint()));assert(++steps<12);
  }
  await p.waitForFunction(()=>document.querySelector('#result-dialog').open);
  await press(p,'#play-again');await settled(p);await verifyTrace(p,6);
  await press(p,'#pause');report.cases.push({id,shownMoves:3,reference:true,inputLocked:true,fieldInput:true,undo:true,hintsSolve:true,pausePreserves:true,replay:true});
 }
 // Cancelling an intro must not leave its animations/moves on the next model.
 await p.evaluate(()=>phaseCubeApp.choosePuzzle('rubik'));await press(p,'#start');
 await p.waitForFunction(()=>phaseCubeApp.diagnostics().shuffle.moves.length===1);
 await p.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));await p.waitForTimeout(1100);
 assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);
 assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase),'ready');
 assert.deepEqual(await p.evaluate(()=>phaseCubeApp.diagnostics().shuffle.moves),[]);
 assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().graphics.tweens),0);
 report.choiceCancelsOldIntro=true;
 // Back/forward cache preserves the partial shuffle and resumes remaining moves.
 await audit(p);await press(p,'#start');await p.waitForFunction(()=>phaseCubeApp.diagnostics().shuffle.moves.length===1);
 await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await p.waitForFunction(()=>phaseCubeApp.diagnostics().context==='suspended');await press(p,'#start');await settled(p);await verifyTrace(p,3);
 report.partialResume=true;
 await c.close();
 const offline=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),single=await offline.newPage();
 single.on('pageerror',e=>report.errors.push('offline: '+e.message));
 await single.route('**/*',r=>r.request().isNavigationRequest()?r.continue():r.abort());
 await single.goto(runtime.url+'/steel-shift-cube.html?debug=1&puzzle=fourier');await single.waitForFunction(()=>window.phaseCubeApp);await single.evaluate(()=>phaseCubeApp.ready);
 assert.equal(await single.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);await offline.setOffline(true);
 await press(single,'#start');await settled(single);assert.equal(await single.evaluate(()=>phaseCubeApp.diagnostics().shuffle.moves.length),3);
 await single.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);await offline.close();report.offline=true;
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,`qa/shuffle/${runtime.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify(report,null,2));
}
