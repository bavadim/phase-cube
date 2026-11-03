/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,turnPuzzle} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'standard-gears/4',engine:r.engine,physicalDevice:false,cases:[],errors:[]};let page;
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 for(const [width,height]of [[1280,800],[390,844],[844,390]].filter(([w])=>!process.env.BOUNCE_SIZE||w===Number(process.env.BOUNCE_SIZE))){
  const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(r.url+'/?debug=1&puzzle=bounce&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  assert(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()));
  const click=locator=>locator[touch?'tap':'click'](),state=()=>page.evaluate(()=>phaseCubeApp.state()),inspect=()=>page.evaluate(()=>phaseCubeApp.getPresentation().active.view.inspect());
  await click(page.locator('#start'));await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  const initial=await state();let v=await inspect();assert.equal(v.selected,null);assert(v.layers.every(l=>l.opacity===1));assert.equal(v.layers.length,6);
  assert.equal(await page.locator('.bounce-voices,.bounce-instruction,.bounce-readhead').count(),0);assert(await page.locator('#orbit-score').isVisible());assert.equal(await page.locator('#orbit-score .orbit-track').count(),6);assert.equal(await page.locator('#clock-hand').count(),1);
  await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-'+width+'-all.png')});
  // Every model tier is clickable; navigation begins at A from no selection, wraps, and never makes a musical move.
  await click(page.locator('#next-object'));await page.waitForFunction(()=>phaseCubeApp.getPuzzle().selected==='A');
  for(let i=1;i<=6;i++){await click(page.locator('#next-object'));await page.waitForFunction(i=>phaseCubeApp.getPuzzle().selected===FourierModel.keys[i%6],i);}
  assert.deepEqual(await state(),initial);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),0);
  if(!touch){await page.locator('#next-object').focus();for(const key of ['B','C']){await page.keyboard.press('Enter');await page.waitForFunction(key=>phaseCubeApp.getPuzzle().selected===key,key);assert.equal(await page.evaluate(()=>document.activeElement.id),'next-object');}assert.deepEqual(await state(),initial);}
  for(let i=0;i<6;i++){
   const at=await page.evaluate(i=>phaseCubeApp.getPresentation().locations()[i],i);
   assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.pieceId,at),i);
   await page[touch?'touchscreen':'mouse'][touch?'tap':'click'](at.x,at.y);
   await page.waitForFunction(i=>phaseCubeApp.getPresentation().active.view.inspect().selected===i,i);
   v=await inspect();assert(v.layers.every(l=>l.opacity===(l.index===i?1:.1)));assert.deepEqual(await state(),initial);
  }
  // Button pointer/keyboard focus must not forecast bounce. Hints remain explicit previews.
  await click(page.locator('#next-object'));await frame(page);
  if(!touch)await page.locator('#turn-left').hover();
  await page.locator('#turn-left').focus();await page.waitForTimeout(280);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().actionFocus),null);
  assert(await page.evaluate(()=>{const a=phaseCubeApp,actual=a.getPresentation().active.view.inspect().display;return a.getPuzzle().parameters().every((p,i)=>p.phase===actual[i].phase&&p.level/4===actual[i].gain);}));
  const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
  async function send(type,at){
   if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],touchPoints:['up','cancel'].includes(type)?[]:[{id:0,x:at.x,y:at.y}]});await frame(page);return;}
   if(touch){await page.evaluate(({type,at})=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({down:'pointerdown',move:'pointermove',up:'pointerup',cancel:'pointercancel'}[type],{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:type==='up'?0:1,clientX:at?.x||0,clientY:at?.y||0,bubbles:true})),{type,at});await frame(page);return;}
   if(type==='down'){await page.mouse.move(at.x,at.y);return page.mouse.down();}if(type==='move')return page.mouse.move(at.x,at.y,{steps:3});if(type==='up')return page.mouse.up();await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.cancel());return page.mouse.up();
  }
  const point=async(time,radius)=>page.evaluate(({time,radius})=>{const p=BounceTerrain.point(time,radius,0);return phaseCubeApp.getPresentation().project(new THREE.Vector3(p.x,p.y,p.z));},{time,radius});
  const params=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]),origin=await page.evaluate(()=>phaseCubeApp.getPresentation().locations()[0]);
  assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.key,origin),'A');
  // No pointer movement: the gear freezes immediately, sockets and other gears continue on the audio clock.
  await send('down',origin);await frame(page);const held=await inspect();assert.equal(held.holding,0);
  await page.waitForFunction(phase=>Math.abs(phaseCubeApp.getPresentation().active.view.inspect().display[0].phase-phase)>1.1,params.phase);
  v=await inspect();assert(Math.abs(Math.sin(v.layers[0].rotation)-Math.sin(held.layers[0].rotation))<1e-7);
  assert(Math.abs(Math.cos(v.layers[0].rotation)-Math.cos(held.layers[0].rotation))<1e-7);
  assert(Math.hypot(Math.sin(v.layers[0].targetRotation)-Math.sin(held.layers[0].targetRotation),Math.cos(v.layers[0].targetRotation)-Math.cos(held.layers[0].targetRotation))>.05);
  assert.deepEqual(await state(),initial);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),[0]);
  await send('up');await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);await frame(page);
  let after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.notEqual(after.phase,params.phase);assert.equal(after.level,params.level);assert.equal((await inspect()).holding,null);assert.equal((await inspect()).display[0].phase,after.phase);assert(Number.isInteger((await inspect()).display[0].phase));
  await click(page.locator('#undo'));await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(page);await frame(page);assert.deepEqual(await state(),initial);
  // Pointer angle is ignored; radial motion alone can still alter size/gain during a hold.
  await send('down',origin);await send('move',await point(.125,2.65));await send('move',await point(.125,.92+1.8*.337));
  const gainPreview=(await inspect()).display[0].gain;assert(Math.abs(gainPreview-(params.level/4+.337))<.04);
  await send('up');await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert(Math.abs(after.level/4-gainPreview)<1e-6);
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getTransport().active.meta.state),await state());
  await click(page.locator('#undo'));await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(page);await frame(page);
  await send('down',origin);await page.waitForTimeout(170);await send('cancel');await frame(page);assert.deepEqual(await state(),initial);assert.equal((await inspect()).holding,null);assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  // A cancelled press cannot leave a stopped gear behind.
  const resumed=await inspect();await page.waitForTimeout(140);v=await inspect();assert(Math.hypot(Math.sin(v.layers[0].rotation)-Math.sin(resumed.layers[0].rotation),Math.cos(v.layers[0].rotation)-Math.cos(resumed.layers[0].rotation))>.01);
  const stage=await page.locator('#puzzle-stage').boundingBox();await page[touch?'touchscreen':'mouse'][touch?'tap':'click'](stage.x+2,stage.y+2);await frame(page);assert.equal((await inspect()).selected,null);
  await click(page.locator('#next-object'));await frame(page);assert.equal((await inspect()).selected,0);
  await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-'+width+'.png')});
  const geometry=await page.evaluate(()=>({scoreVisible:getComputedStyle(document.getElementById('orbit-score')).display!=='none',stageRatio:document.getElementById('puzzle-stage').clientWidth/document.getElementById('orbital-workspace').clientWidth,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,canvases:document.querySelectorAll('#puzzle-stage canvas').length,minTargetHeight:Math.min(...[...document.querySelectorAll('.puzzle-action,#hint')].map(b=>b.getBoundingClientRect().height)),stage:document.getElementById('puzzle-stage').getBoundingClientRect().toJSON()}));
  assert(!geometry.overflow);assert.equal(geometry.canvases,1);assert(geometry.minTargetHeight>=44);assert(geometry.scoreVisible);assert(Math.abs(geometry.stageRatio-.66)<.01);
  let hints=0;while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){
   const before=await state();await click(page.locator('#hint'));await page.waitForTimeout(280);assert.deepEqual(await state(),before);
   assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().selected),await page.evaluate(()=>phaseCubeApp.getPuzzle().moveTarget(phaseCubeApp.diagnostics().actionFocus.move)));
   await click(page.locator('.puzzle-action.hinted'));await settled(page);assert(++hints<50);
  }
  assert(await page.locator('#result-dialog').isVisible());
  const navigation=[];
  for(const id of ['twiddle','rubik','fourier','scratch']){
   await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);assert.equal(await page.locator('.bounce-readhead').count(),0);
   await click(page.locator('#start'));await settled(page);await frame(page);
   const before=await state(),keys=await page.evaluate(()=>phaseCubeApp.getPuzzle().choices().map(c=>c.key));
   const current=await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),expected=await page.locator('.puzzle-action:enabled:not(#next-object)').count()===0?keys[0]:keys[(keys.indexOf(current)+1)%keys.length];
   await click(page.locator('#next-object'));await page.waitForFunction(key=>phaseCubeApp.diagnostics().selectedFace===key,expected);assert.deepEqual(await state(),before);
   await click(page.locator('#hint'));const hintKey=await page.evaluate(()=>phaseCubeApp.getPuzzle().selected);
   await click(page.locator('#next-object'));await page.waitForFunction(key=>phaseCubeApp.diagnostics().selectedFace===key,keys[(keys.indexOf(hintKey)+1)%keys.length]);assert.deepEqual(await state(),before);
   if(id==='rubik'){await page.waitForFunction(()=>!phaseCubeApp.getPresentation().timelines.has('camera'));assert(await page.evaluate(()=>phaseCubeApp.getPresentation().locations().some(p=>p.key===phaseCubeApp.getPuzzle().selected)));}
   // Previews still work in the other puzzle families.
   if(!touch){await page.locator('#turn-left').hover();await page.waitForFunction(()=>phaseCubeApp.diagnostics().actionFocus?.source==='button-pointer');await page.mouse.move(1,1);}
   if(id==='twiddle'||id==='rubik'){
    const key=id==='rubik'?await page.evaluate(()=>phaseCubeApp.getPresentation().locations()[0].key):'A';if(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace)!==key)await select(page,key,touch);await turnPuzzle(page,key,false,touch);await turnPuzzle(page,key,true,touch);
   }
   navigation.push({id,choices:keys.length,selectionOnly:true,hintContinuation:true});console.log(JSON.stringify({width,height,puzzle:id,status:'PASS'}));
  }
  await page.evaluate(()=>phaseCubeApp.choosePuzzle('bounce'));assert.equal(await page.locator('.bounce-readhead').count(),0);assert(await page.locator('#orbit-score').isVisible());assert.equal(await page.locator('#next-object').count(),1);assert.equal(await page.locator('#puzzle-stage canvas').count(),1);
  report.cases.push({width,height,input:cdp?'native CDP touch':touch?'synthetic touch PointerEvents':'mouse',sixLayers:true,modelSelection:true,nextSelection:true,buttonPreviewOff:true,stationaryHold:true,independentTargets:true,releaseSingleMove:true,continuousGain:gainPreview,undo:true,cancel:true,standardEqualizer:true,exactReleaseSeat:true,noExtraControls:true,hintsWin:true,hints,legacyFieldInput:true,navigation,geometry});
  if(cdp)await cdp.detach();await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-failure.png')});report.diagnostics=await page.evaluate(()=>({d:phaseCubeApp.diagnostics(),view:phaseCubeApp.getPresentation().active.view.inspect?.(),events:phaseCubeApp.report().events.slice(-12)}));}catch{}throw e;}
finally{
 const files=['index.html','config.js','puzzle-contract.js','app.js','style.css','graphics/stage.js','graphics/pointer.js','controls/puzzle.js','controls/action-controls.js','controls/player.css','puzzles/fourier/model.js','puzzles/fourier/module.js','puzzles/fourier/three-view.js','puzzles/scratch/module.js','puzzles/scratch/three-view.js','puzzles/bounce/module.js','puzzles/bounce/terrain.js','puzzles/bounce/three-view.js'];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));
 await writeFile(join(root,'qa/bounce/'+r.engine+(process.env.BOUNCE_SIZE?'-'+process.env.BOUNCE_SIZE:'')+'-report.json'),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,engine:r.engine,cases:report.cases,failure:report.failure,errors:report.errors}));
}
