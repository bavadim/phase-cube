/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,turnPuzzle} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'isometric-gears/2',engine:r.engine,physicalDevice:false,cases:[],errors:[]};let page;
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 for(const [width,height]of (process.env.BOUNCE_MOBILE_ONLY?[[390,844]]:[[1280,800],[390,844],[844,390]])){
  const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(r.url+'/?debug=1&puzzle=bounce&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  assert(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()));
  await page.locator('#start')[touch?'tap':'click']();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  const inspect=()=>page.evaluate(()=>phaseCubeApp.getPresentation().active.view.inspect()),initial=await page.evaluate(()=>phaseCubeApp.state());
  let v=await inspect();assert.equal(v.selected,null);assert(v.layers.every(l=>l.opacity===1));assert.equal(v.layers.length,6);
  assert.equal(await page.locator('.bounce-center').count(),0);assert.equal(await page.locator('#orbit-score').isVisible(),false);
  const arrow=await page.locator('.bounce-readhead').boundingBox();
  await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-'+width+'-all.png')});
  // Selection uses actual Three pick objects on all six tiers.
  for(let i=0;i<6;i++){
   const at=await page.evaluate(i=>phaseCubeApp.getPresentation().locations()[i],i);
   assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.pieceId,at),i);
   await page[touch?'touchscreen':'mouse'][touch?'tap':'click'](at.x,at.y);
   await page.waitForFunction(i=>phaseCubeApp.getPresentation().active.view.inspect().selected===i,i);
   v=await inspect();assert(v.layers.every(l=>l.opacity===(l.index===i?1:.1)));assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  }
  // Repeating the selected voice button clears isolation, without a move.
  await page.locator('.bounce-voices button').nth(5)[touch?'tap':'click']();await page.waitForFunction(()=>phaseCubeApp.getPresentation().active.view.inspect().selected===null);
  assert((await inspect()).layers.every(l=>l.opacity===1));
  await page.locator('.bounce-voices button').nth(0)[touch?'tap':'click']();await frame(page);
  const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
  async function send(type,at){
   if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],touchPoints:['up','cancel'].includes(type)?[]:[{id:0,x:at.x,y:at.y}]});await frame(page);return;}
   if(touch)return page.evaluate(({type,at})=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({down:'pointerdown',move:'pointermove',up:'pointerup',cancel:'pointercancel'}[type],{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:type==='up'?0:1,clientX:at?.x||0,clientY:at?.y||0,bubbles:true})),{type,at});
   if(type==='down'){await page.mouse.move(at.x,at.y);return page.mouse.down();}if(type==='move')return page.mouse.move(at.x,at.y,{steps:8});if(type==='up')return page.mouse.up();await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.cancel());return page.mouse.up();
  }
  const point=async(time,radius)=>page.evaluate(({time,radius})=>{const p=BounceTerrain.point(time,radius,0);return phaseCubeApp.getPresentation().project(new THREE.Vector3(p.x,p.y,p.z));},{time,radius});
  const params=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);const origin=await point(.375,.8);
  assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.key,origin),'A');
  await send('down',origin);await send('move',await point(.5,.8));
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),[0]);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  await send('up');await settled(page);await frame(page);
  let after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.equal(after.phase,(params.phase+7)%8);assert.equal(after.level,params.level);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),1);
  await page.locator('#undo')[touch?'tap':'click']();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(page);await frame(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  await send('down',origin);await send('move',await point(.375,.8+1.8*.337));
  const gainPreview=await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.phases[0].gain);assert(Math.abs(gainPreview-(params.level/4+.337))<.035);
  await send('up');await settled(page);await frame(page);after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.equal(after.phase,params.phase);assert(Math.abs(after.level/4-gainPreview)<1e-6);
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getTransport().active.meta.state),await page.evaluate(()=>phaseCubeApp.state()));
  await page.locator('#undo')[touch?'tap':'click']();await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(page);await frame(page);
  await send('down',origin);await send('move',await point(.52,.8));await send('cancel');assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  // Reference sockets and the gear share a rotor; the marker itself never moves.
  const clocks=await page.evaluate(()=>{
   const view=phaseCubeApp.getPresentation().active.view,m=phaseCubeApp.getPuzzle(),state=m.snapshot();let error=0,checks=0;
   for(const t of [0,.137,.5,.91]){
    view.updateMusic({phase:t,playing:true,rows:[],periodSeconds:6.4});const data=view.inspect();
    for(const layer of data.layers){const expected=BounceTerrain.rotation(t,layer.period);error=Math.max(error,Math.abs(Math.sin(layer.rotation)-Math.sin(expected)));checks++;}
   }
   const result={error,checks};m.restore(0);view.sync();result.solvedSlots=view.inspect().layers.every(l=>l.wrongSlots===0);
   m.restore(state);view.sync();return result;
  });assert.equal(clocks.error,0);assert(clocks.solvedSlots);
  assert.deepEqual(await page.locator('.bounce-readhead').boundingBox(),arrow);
  // Empty space restores full opacity; each footer target remains at least 44px.
  const stage=await page.locator('#puzzle-stage').boundingBox();await page[touch?'touchscreen':'mouse'][touch?'tap':'click'](stage.x+2,stage.y+2);await frame(page);
  assert.equal((await inspect()).selected,null);assert((await inspect()).layers.every(l=>l.opacity===1));
  await page.locator('.bounce-voices button').nth(2)[touch?'tap':'click']();await frame(page);
  await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-'+width+'.png')});
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,canvases:document.querySelectorAll('#puzzle-stage canvas').length,minTargetHeight:Math.min(...[...document.querySelectorAll('.bounce-voices button')].map(b=>b.getBoundingClientRect().height)),stage:document.getElementById('puzzle-stage').getBoundingClientRect().toJSON()}));
  assert(!geometry.overflow);assert.equal(geometry.canvases,1);assert(geometry.minTargetHeight>=44);
  let hints=0;while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){
   const state=await page.evaluate(()=>phaseCubeApp.state());await page.locator('#hint')[touch?'tap':'click']();await page.waitForTimeout(280);
   assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),state,'Hint preview must not commit');
   assert(await page.evaluate(()=>{const a=phaseCubeApp,m=a.getPuzzle(),focus=a.diagnostics().actionFocus,expected=m.parameters(m.applyTo(m.snapshot(),focus.move)),actual=a.getPresentation().active.view.inspect().display;return actual.every((p,i)=>Math.abs(BounceTerrain.delta(p.phase/8,expected[i].phase/8))<1e-7&&Math.abs(p.gain-FourierModel.gain(expected[i]))<1e-7);}),'Hint must animate the real gear to its forecast');
   await page.locator('.puzzle-action.hinted')[touch?'tap':'click']();await settled(page);assert(++hints<50);
  }
  assert(await page.locator('#result-dialog').isVisible());
  for(const id of ['twiddle','rubik']){
   await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);assert.equal(await page.locator('.bounce-readhead').count(),0);
   await page.locator('#start')[touch?'tap':'click']();await settled(page);
   const key=id==='rubik'?await page.evaluate(()=>phaseCubeApp.getPresentation().locations()[0].key):'A';await select(page,key,touch);await turnPuzzle(page,key,false,touch);await turnPuzzle(page,key,true,touch);
  }
  await page.evaluate(()=>phaseCubeApp.choosePuzzle('bounce'));assert.equal(await page.locator('.bounce-readhead').count(),1);assert.equal(await page.locator('#puzzle-stage canvas').count(),1);
  report.cases.push({width,height,input:cdp?'native CDP touch':touch?'synthetic touch PointerEvents':'mouse',sixLayers:true,isolation:true,deselect:true,phaseDrag:true,continuousGain:gainPreview,undo:true,cancel:true,fixedReadhead:true,clocks,hintPreview:true,hintsWin:true,hints,legacyFieldInput:true,geometry});
  if(cdp)await cdp.detach();await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(root,'qa/bounce/'+r.engine+'-failure.png')});report.diagnostics=await page.evaluate(()=>({d:phaseCubeApp.diagnostics(),view:phaseCubeApp.getPresentation().active.view.inspect?.(),events:phaseCubeApp.report().events.slice(-12)}));}catch{}throw e;}
finally{
 const files=['index.html','config.js','app.js','style.css','graphics/stage.js','graphics/pointer.js','controls/puzzle.js','puzzles/bounce/module.js','puzzles/bounce/terrain.js','puzzles/bounce/three-view.js'];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));
 await writeFile(join(root,'qa/bounce/'+r.engine+'-report.json'),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({...report,diagnostics:report.diagnostics?{d:report.diagnostics.d,events:report.diagnostics.events}:undefined}));
}
