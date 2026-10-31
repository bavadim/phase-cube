/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from './browser.mjs';
import {turnOnField,select} from './field-input.mjs';
const runtime=await openBrowser(),report={schema:'music-puzzle-modules/1',combinations:[],layouts:[],errors:[],physicalDevice:false};
const settled=page=>page.waitForFunction(()=>{const d=phaseCubeApp.diagnostics();return!d.busy&&!d.starting&&!d.seeking&&!d.pending&&!d.loading;});
async function layout(page){return page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
 return{width:innerWidth,height:innerHeight,document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],board:rect(document.querySelector('#orbital-workspace')),dock:rect(document.querySelector('.controls-dock')),
   controls:['turn-left','turn-right','undo','pause','hint','song-seek'].map(id=>({id,...rect(document.getElementById(id))}))};
});}
function checkLayout(m){
 assert(m.document[0]<=m.width+1&&m.document[1]<=m.height+1,'Page overflow');
 for(const b of m.controls)assert(b.x>=0&&b.y>=0&&b.x+b.w<=m.width+1&&b.y+b.h<=m.height+1&&b.w>=44&&b.h>=44,'Offscreen/small control '+b.id);
 const a=m.board,b=m.dock;assert(a.x+a.w<=b.x+1||a.y+a.h<=b.y+1||b.x+b.w<=a.x+1,'Puzzle overlaps controls');
}
async function checkCelebration(page,screenshot){
 await page.waitForFunction(()=>[...document.querySelectorAll('.firework-spark')].some(e=>Number(getComputedStyle(e).opacity)>.5));
 const effect=await page.locator('#celebration').evaluate(e=>{
  const r=e.getBoundingClientRect(),button=document.querySelector('#play-again'),b=button.getBoundingClientRect();
  return{modal:e.closest('dialog')?.matches(':modal'),sparks:e.querySelectorAll('.firework-spark').length,
   position:getComputedStyle(e).position,pointerEvents:getComputedStyle(e).pointerEvents,
   viewport:r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight,
   buttonClickable:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===button};
 });
 assert.deepEqual(effect,{modal:true,sparks:70,position:'fixed',pointerEvents:'none',viewport:true,buttonClickable:true});
 await page.waitForFunction(()=>document.querySelector('.firework-spark')?.getAnimations()[0]?.currentTime>=600);
 await page.screenshot({path:join(root,'qa/modules/'+screenshot)});return effect;
}
try{
 const ctx=await runtime.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{window.inputAudit=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{
  if(e.target.tagName!=='CANVAS')return;
  inputAudit.push({type,x:e.clientX,y:e.clientY,primary:e.isPrimary,disabled:window.phaseCubeApp?.getPresentation()?.disabled,selected:window.phaseCubeApp?.diagnostics()?.selectedFace});
  if(inputAudit.length>20)inputAudit.shift();
 },true);});
 await page.goto(runtime.url+'/?debug=1');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 assert.equal(await page.locator('#puzzle-select').inputValue(),'twiddle');
 for(const puzzleId of ['twiddle','rubik'])for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
  // Exercise the actual startup selectors rather than reloading between pairs.
  if(!await page.locator('#session-overlay').evaluate(e=>e.open))await page.locator('#choose-song').click();
  if(await page.locator('#puzzle-select').inputValue()!==puzzleId){await page.locator('#puzzle-select').selectOption(puzzleId);await settled(page);}
  if(await page.locator('#song-select').inputValue()!==songId){await page.locator('#song-select').selectOption(songId);await settled(page);}
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getGame().count),puzzleId==='twiddle'?6:8);
  const binding=await page.evaluate(()=>{const p=phaseCubeApp.getPreparation();return{gridSteps:p.phaseMap.gridSteps,...p.diagnostics};});
  assert.equal(binding.coverage,puzzleId==='twiddle'?'complete':'sampled');assert.equal(binding.unsolvedGoalRhythmAliases,0);assert.equal(binding.silentMoves,0);
  await page.screenshot({path:join(root,'qa/modules/'+puzzleId+'-'+songId+'-start.png')});
  await page.locator('#start').click();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().playing);
  const phaseViews=await page.evaluate(()=>({audio:phaseCubeApp.phases().map(p=>p.ticks),view:[...document.querySelectorAll('.orbit-track')].map(e=>Number(e.dataset.phase))}));
  assert.deepEqual(phaseViews.audio,phaseViews.view,'Audio and equalizer must share the selected phase map');
  assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().masterGain),1);
  await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  assert.equal(await page.locator('#touch-face').count(),0);
  const selectionBefore=await page.evaluate(()=>phaseCubeApp.state());
  try{await select(page,puzzleId==='twiddle'?'B':'R',true);}catch(e){report.inputAudit=await page.evaluate(()=>inputAudit);throw e;}
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),selectionBefore,'Field selection must not move pieces');
  await page.screenshot({path:join(root,'qa/modules/'+puzzleId+'-'+songId+'-playing.png')});
  const before=await page.evaluate(()=>phaseCubeApp.state()),backing=await page.evaluate(()=>phaseCubeApp.getTransport().backingEntry.id);
  await page.locator('#turn-right').click();await settled(page);assert.notDeepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getTransport().backingEntry.id),backing);
  await page.locator('#undo').click();await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
  await page.locator('#pause').click();await page.waitForFunction(()=>phaseCubeApp.diagnostics().context==='suspended');
  await page.locator('#start').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().masterGain),1);
  await page.evaluate(()=>phaseCubeApp.seekSong(32));await settled(page);
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
  let peak=0;for(let i=0;i<15;i++){peak=Math.max(peak,await page.evaluate(()=>phaseCubeApp.diagnostics().peak));await page.waitForTimeout(40);}
  let steps=0;
  while(await page.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase!=='won')){
   const hintedFrom=await page.evaluate(()=>phaseCubeApp.state());
   await page.locator('#hint').click();const hint=await page.evaluate(()=>phaseCubeApp.diagnostics().hint);assert(hint);
   assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),hint[0]);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),hintedFrom,'Hint must not make a move');
   await page.waitForFunction(()=>phaseCubeApp.getPresentation().info().tweens===0);
   await turnOnField(page,hint[0],hint.endsWith("'"),true);assert(++steps<=8);
  }
  await page.waitForFunction(()=>document.querySelector('#result-dialog').open);assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().playing),true);
  const firework=await checkCelebration(page,puzzleId+'-'+songId+'-fireworks.png');
  if(puzzleId==='twiddle'&&songId==='turkish-circuit')await page.waitForFunction(()=>document.querySelector('#celebration').hidden&&document.querySelector('#celebration').childElementCount===0);
  await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  const dlEvent=page.waitForEvent('download');await page.locator('#download-mp3').click();const dl=await dlEvent;
  assert.equal(dl.suggestedFilename(),await page.evaluate(()=>phaseCubeApp.getSong().title+'.mp3'));assert.equal(await dl.failure(),null);
  await page.screenshot({path:join(root,'qa/modules/'+puzzleId+'-'+songId+'-result.png')});
  await page.locator('#play-again').click();await page.waitForFunction(()=>phaseCubeApp.diagnostics().sessionPhase==='playing'&&!document.querySelector('dialog[open]'));await settled(page);assert.equal(await page.locator('#undo').isDisabled(),true);
  assert.equal(await page.locator('#celebration').evaluate(e=>e.hidden&&e.childElementCount===0),true,'Replay clears fireworks');
  assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().masterGain),1);
  // Replay preserves the camera: its default selected face can be on the back.
  const replayKey=await page.evaluate(()=>phaseCubeApp.diagnostics().puzzleId==='rubik'?phaseCubeApp.getPresentation().locations()[0].key:phaseCubeApp.diagnostics().selectedFace);
  await select(page,replayKey,true);
  await page.screenshot({path:join(root,'qa/modules/'+puzzleId+'-'+songId+'-playing.png')});
  const m=await layout(page);checkLayout(m);
  report.combinations.push({puzzleId,songId,binding,steps,peakAtBar32:peak,masterGain:1,undo:true,hint:true,win:true,download:true,replay:true,firework});
  await page.locator('#pause').click();await settled(page);
 }
 // Recreate the page to verify the persistent cache, then replace an in-flight preparation.
 await page.reload();await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 assert.equal(await page.evaluate(()=>phaseCubeApp.getPreparation().diagnostics.cache),'hit');
 await page.evaluate(async()=>{await Promise.all([phaseCubeApp.choose({songId:'steel-shift',puzzleId:'twiddle'}),phaseCubeApp.choose({songId:'turkish-circuit',puzzleId:'rubik'})]);});
 assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().songId),'turkish-circuit');assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().puzzleId),'rubik');
 report.preparation={persistentCache:true,latestChoiceWins:true,sharedAudioAndEqualizerProjection:true};
 // Desktop regression: a monochrome solved cube rotated as R L' used to report 0/8.
 await page.evaluate(()=>phaseCubeApp.choose({songId:'steel-shift',puzzleId:'rubik'}));await page.setViewportSize({width:1280,height:800});
 await page.locator('#start').click();await settled(page);
 await page.evaluate(async()=>{phaseCubeApp.getPuzzle().restore(PhaseCube.snapshot(new Cube().move("R L'")));await phaseCubeApp.turn('U');await phaseCubeApp.undo();});
 await page.waitForFunction(()=>document.querySelector('#result-dialog').open);
 assert.equal(await page.locator('#correct-count').textContent(),'8/8');assert((await page.evaluate(()=>phaseCubeApp.diagnostics().phases)).every(p=>p===0));
 report.rotatedSolvedCube={correct:8,total:8,won:true,allPhasesZero:true};
 await checkCelebration(page,'rubik-desktop-fireworks.png');
 await page.screenshot({path:join(root,'qa/modules/rubik-rotated-solved.png')});
 for(const puzzleId of ['twiddle','rubik']){
  await page.evaluate(puzzleId=>phaseCubeApp.choosePuzzle(puzzleId),puzzleId);await settled(page);await page.locator('#start').click();await settled(page);
  for(const [width,height]of [[320,568],[360,640],[390,844],[568,320],[852,393],[1280,800]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);const m=await layout(page);checkLayout(m);report.layouts.push({puzzleId,...m});
   if(width===320||width===568||width===852)await page.screenshot({path:join(root,'qa/modules/'+puzzleId+'-'+width+'-playing.png')});
  }
  await page.locator('#pause').click();await settled(page);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>phaseCubeApp.choosePuzzle('twiddle'));await settled(page);await page.locator('#start').click();await settled(page);
 await page.evaluate(()=>phaseCubeApp.reset());await page.waitForFunction(()=>document.querySelector('#result-dialog').open);
 assert.equal(await page.locator('#celebration').evaluate(e=>e.hidden&&e.childElementCount===0),true,'Reduced motion skips fireworks');
 report.celebration={finiteCleanup:true,replayCleanup:true,reducedMotion:true};
 await ctx.close();
 // Only the exported HTML is served; no linked resources are allowed, then network is disabled.
 const offline=await runtime.browser.newContext({viewport:{width:390,height:844}});const p=await offline.newPage();
 await p.route('**/*',route=>route.request().isNavigationRequest()?route.continue():route.abort());
 p.on('pageerror',e=>report.errors.push('offline: '+e.message));
 await p.goto(runtime.url+'/steel-shift-cube.html?debug=1&puzzle=twiddle&song=steel-shift');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);await offline.setOffline(true);
 for(const puzzleId of ['twiddle','rubik']){
  await p.evaluate(puzzleId=>phaseCubeApp.choosePuzzle(puzzleId),puzzleId);await p.locator('#start').click();await settled(p);await p.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  await p.locator('#hint').click();await p.locator('.turn-button.hinted').click();await settled(p);await p.locator('#pause').click();await settled(p);
 }
 report.offline=true;report.offlineLoad='one HTML over HTTP, linked requests blocked, then offline';await offline.close();assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8');
 const clients=[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1].split('?')[0]);
 const scores=(await readdir(join(root,'compositions'))).filter(p=>p.endsWith('.strudel.mjs')).map(p=>'compositions/'+p);
 report.sourceSha256=Object.fromEntries(await Promise.all([...new Set(['index.html','steel-shift-cube.html',...clients,...scores])].map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,'qa/modules/report.json'),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify(report,null,2));
}
