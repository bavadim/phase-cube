/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'bounce-game/1',engine:r.engine,physicalDevice:false,cases:[],errors:[]};let page;
try{
 for(const [width,height]of (process.env.BOUNCE_MOBILE_ONLY?[[390,844]]:[[1280,800],[390,844],[844,390]])){
  const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(r.url+'/?debug=1&puzzle=bounce&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);await page.evaluate(()=>{window.inputLog=[];for(const kind of ['pointerdown','pointerup','touchstart','touchend','click'])document.addEventListener(kind,e=>{inputLog.push({kind,target:e.target.id||e.target.className,x:e.clientX,y:e.clientY,defaultPrevented:e.defaultPrevented});if(inputLog.length>30)inputLog.shift();},true);});
  if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  assert(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()),'Load in reference state');
  await page.locator('#start')[touch?'tap':'click']();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().shuffle.moves.length),6);
  const initial=await page.evaluate(()=>phaseCubeApp.state());
  for(let i=0;i<6;i++){
   await page.locator('.bounce-voices button').nth(i)[touch?'tap':'click']();
   assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().active.view.inspect().selected),i);
   assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  }
  await page.locator('.bounce-voices button').nth(0)[touch?'tap':'click']();
  const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
  async function send(type,at){
   if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],touchPoints:['up','cancel'].includes(type)?[]:[{id:0,x:at.x,y:at.y}]});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return;}
   if(touch)return page.evaluate(({type,at})=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({down:'pointerdown',move:'pointermove',up:'pointerup',cancel:'pointercancel'}[type],{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:type==='up'?0:1,clientX:at?.x||0,clientY:at?.y||0,bubbles:true})),{type,at});
   if(type==='down'){await page.mouse.move(at.x,at.y);return page.mouse.down();}if(type==='move')return page.mouse.move(at.x,at.y,{steps:8});if(type==='up')return page.mouse.up();await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.cancel());return page.mouse.up();
  }
  const point=async(time,radius)=>page.evaluate(({time,radius})=>{const p=BounceTerrain.point(time,radius);return phaseCubeApp.getPresentation().project(new THREE.Vector3(p.x,p.y,0));},{time,radius});
  const beforeParams=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);
  let origin=await point(0,1.68);assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.key,origin),'A');
  await send('down',origin);await send('move',await point(.125,1.68));
  const preview=await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast);assert.deepEqual(preview.changed,[0]);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  await send('up');await settled(page);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  let after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.equal(after.phase,(beforeParams.phase+7)%8);assert.equal(after.level,beforeParams.level);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),1);
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getTransport().active.meta.state),await page.evaluate(()=>phaseCubeApp.state()));
  await page.locator('#undo')[touch?'tap':'click']();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0,null,{timeout:3000});await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  // A radial drag changes only level; preview is continuous and cancel is lossless.
  origin=await point(0,1.68);await send('down',origin);await send('move',{x:origin.x,y:origin.y-38});await send('move',await point(0,1.68+.9*.337));
  const gainPreview=await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.phases[0].gain);assert(Math.abs(gainPreview-(beforeParams.level/4+.337))<.04);
  await send('up');await settled(page);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.equal(after.phase,beforeParams.phase);assert(Math.abs(after.level/4-gainPreview)<1e-6);
  await page.locator('#undo')[touch?'tap':'click']();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0,null,{timeout:3000});await settled(page);
  await send('down',origin);await send('move',await point(.17,1.68));await send('cancel');assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvases:document.querySelectorAll('#puzzle-stage canvas').length,voiceCount:document.querySelectorAll('.bounce-voices button').length,minTargetHeight:Math.min(...[...document.querySelectorAll('.bounce-voices button')].map(b=>b.getBoundingClientRect().height)),stage:document.getElementById('puzzle-stage').getBoundingClientRect().toJSON()}));
  assert(!geometry.overflow);assert.equal(geometry.canvases,1);assert.equal(geometry.voiceCount,6);assert(geometry.minTargetHeight>=44);
  await page.screenshot({path:join(root,`qa/bounce/${r.engine}-${width}.png`)});
  const sync=await page.evaluate(()=>{
   const a=phaseCubeApp,v=a.getPresentation().active.view,m=a.getPuzzle(),g=a.getGame(),prepared=a.getPreparation();let maxError=0,count=0;
   for(let i=0;i<6;i++){
    m.select(FourierModel.keys[i]);v.feedback({selected:FourierModel.keys[i]});
    const params=m.parameters()[i],events=BounceTerrain.shift(BounceTerrain.attacks(g.targetRows[i],prepared.binding.periods[i]),params.phase-FourierModel.homePhase[i]);
    for(const e of events){v.updateMusic({phase:e.time*prepared.binding.periods[i],playing:true,rows:a.getMusic().rows(m.snapshot()),periodSeconds:6.4});const f=v.inspect().flight;maxError=Math.max(maxError,Math.abs(f.radius-BounceTerrain.crest(e,FourierModel.gain(params))-BounceTerrain.ballRadius));count++;}
   }return{count,maxError};
  });assert(sync.count>0);assert(sync.maxError<1e-7);
  let hints=0;while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){await page.locator('#hint')[touch?'tap':'click']();await page.locator('.puzzle-action.hinted')[touch?'tap':'click']();await settled(page);assert(++hints<50);}
  assert(await page.locator('#result-dialog').isVisible());assert(await page.locator('#download-mp3').getAttribute('href'));
  for(const id of ['rubik','twiddle','scratch','fourier']){await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);assert(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()));assert.equal(await page.locator('.bounce-voices').count(),0,'Unmount removes local controls');}
  await page.evaluate(()=>phaseCubeApp.choosePuzzle('bounce'));assert.equal(await page.locator('.bounce-voices').count(),1);assert.equal(await page.locator('#puzzle-stage canvas').count(),1);
  report.cases.push({width,height,input:cdp?'native CDP touch':touch?'synthetic touch PointerEvents':'mouse',audioRms:true,shuffleSteps:6,singleRiffPreview:true,phaseDrag:true,continuousGain:gainPreview,undo:true,cancel:true,hintsWin:true,hints,landings:sync,oldPuzzles:true,geometry});
  if(cdp)await cdp.detach();await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(root,`qa/bounce/${r.engine}-failure.png`)});report.diagnostics=await page.evaluate(()=>({d:phaseCubeApp.diagnostics(),events:phaseCubeApp.report().events.slice(-18),inputLog:window.inputLog,undo:document.getElementById('undo').getBoundingClientRect().toJSON()}));}catch{}throw e;}
finally{
 const files=['index.html','config.js','app.js','style.css','puzzles/registry.js','puzzles/bounce/module.js','puzzles/bounce/terrain.js','puzzles/bounce/three-view.js'];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));
 await writeFile(join(root,`qa/bounce/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));
}
