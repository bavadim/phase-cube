/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select} from '../modules/field-input.mjs';
let currentPage;
const r=await openBrowser(),report={schema:'office-chairs/1',engine:r.engine,physicalDevice:false,audioOutput:r.engine==='chromium'?'native-null-sink':process.env.GST_PLUGIN_FEATURE_RANK?.includes('fakeaudiosink')?'GStreamer-fakeaudiosink':'system',cases:[],errors:[]};
try{
 for(const [width,height]of [[1280,800],[390,844],[844,390]]){
  const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch}),page=await context.newPage();currentPage=page;page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(r.url+'/?debug=1&puzzle=fourier&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  assert.equal(await page.locator('#puzzle-select option[value="fourier"]').textContent(),'Совещание');
  await page.locator('#start')[touch?'tap':'click']();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  assert.equal(await page.locator('.puzzle-action:enabled').count(),0);
  const initial=await page.evaluate(()=>phaseCubeApp.state());
  // Equal gain, all-zero gain and a tall front row must not hide another riff.
  for(const levels of [[4,4,4,4,4,4],[0,0,0,0,0,0],[0,0,0,8,8,8]]){
   await page.evaluate(levels=>{const m=phaseCubeApp.getPuzzle();let s=m.initialState();for(const [i,key]of FourierModel.keys.entries()){const move=m.editMove(key,{phase:FourierModel.homePhase[i]+1,level:levels[i]},s);if(move)s=m.applyTo(s,move);}m.restore(s);phaseCubeApp.getPresentation().active.view.sync();},levels);
   for(const key of ['A','B','C','D','E','F']){report.step={width,height,levels,key};await select(page,key,touch);}
  }
  await page.evaluate(initial=>{phaseCubeApp.getPuzzle().restore(initial);phaseCubeApp.getPresentation().active.view.sync();},initial);
  await select(page,'A',touch);
  await page.mouse.move(0,0);
  for(const point of await targets(page))await page.mouse.move(point.x,point.y);
  assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().selected),'A');assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
  async function begin(at){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:at.x,y:at.y}]});else if(touch)await page.evaluate(at=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:at.x,clientY:at.y,bubbles:true})),at);else {await page.mouse.move(at.x,at.y);await page.mouse.down();}}
  async function move(at){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:at.x,y:at.y}]});else if(touch)await page.evaluate(at=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:at.x,clientY:at.y,bubbles:true})),at);else await page.mouse.move(at.x,at.y,{steps:8});await page.waitForTimeout(30);}
  async function end(cancel=false){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else if(touch)await page.evaluate(cancel=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:0,bubbles:true})),cancel);else if(cancel){await page.evaluate(()=>{const p=phaseCubeApp.getPresentation().pointer;p.cancel();});await page.mouse.up();}else await page.mouse.up();}
  const origin=async()=> (await targets(page)).find(p=>p.key==='A');
  const destination=async(at,axis,value)=>page.evaluate(({at,axis,value})=>{const stage=phaseCubeApp.getPresentation(),world=stage.unproject(at.x,at.y);world[axis]+=value;return stage.project(world);},{at,axis,value});
  // Start beyond touch slop, then fine-tune: final gain is genuinely fractional.
  let at=await origin();const gain=await page.evaluate(()=>FourierModel.gain(phaseCubeApp.getPuzzle().parameters()[0]));
  await begin(at);await move({x:at.x,y:at.y-38});await move(await destination(at,'y',.58*(1.337-gain)));
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),[0]);
  const preview=await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.phases[0].gain);
  const pixelTolerance=1.1/Math.abs((await destination(at,'y',.58)).y-at.y);assert(Math.abs(preview-1.337)<=pixelTolerance,'Gain follows pointer within one screen pixel: '+preview);
  await end();await settled(page);
  const saved=await page.evaluate(()=>({p:phaseCubeApp.getPuzzle().parameters()[0],gain:phaseCubeApp.getMusic().phases(phaseCubeApp.state())[0].gain,history:phaseCubeApp.getPuzzle().history.length}));
  assert(Math.abs(saved.gain-preview)<1e-6);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getTransport().active.meta.state),await page.evaluate(()=>phaseCubeApp.state()));assert.equal(saved.history,1);assert(!Number.isInteger(saved.p.level));
  await page.locator('#undo')[touch?'tap':'click']();await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  // Horizontal movement rotates the selected worker without changing gain.
  at=await origin();await begin(at);await move(await destination(at,'x',2.4*1.9/8));
  const phasePreview=await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast);assert.deepEqual(phasePreview.changed,[0]);
  await end();await settled(page);const rotated=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]);assert.equal(rotated.level,FourierLevel(initial));
  await page.locator('#undo')[touch?'tap':'click']();await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
  // Cancel preserves the live state and clears preview.
  at=await origin();await begin(at);await move({x:at.x,y:at.y-40});await end(true);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  // A fractional edit still has a clickable hint and can reach the exact goal.
  await page.evaluate(async()=>{const app=phaseCubeApp,m=app.getPuzzle(),p=m.parameters()[0];await app.turn(m.editMove('A',{...p,level:5.348}));});await settled(page);
  let hints=0;while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){await page.locator('#hint')[touch?'tap':'click']();await page.locator('.puzzle-action.hinted')[touch?'tap':'click']();await settled(page);assert(++hints<24);}
  assert(await page.locator('#result-dialog').isVisible());
  await page.screenshot({path:join(root,`qa/chairs/${r.engine}-${width}-win.png`)});
  const geometry=await page.evaluate(()=>({canvas:document.querySelectorAll('#puzzle-stage canvas').length,overflow:document.documentElement.scrollWidth>innerWidth,info:phaseCubeApp.getPresentation().info()}));assert.equal(geometry.canvas,1);assert(!geometry.overflow);
  for(const puzzleId of ['scratch','twiddle','rubik']){await page.evaluate(puzzleId=>phaseCubeApp.choosePuzzle(puzzleId),puzzleId);assert(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()));}
  await page.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));await page.locator('#start')[touch?'tap':'click']();await settled(page);await select(page,'B',touch);
  await page.screenshot({path:join(root,`qa/chairs/${r.engine}-${width}.png`)});
  report.cases.push({width,height,input:cdp?'native CDP touch':touch?'synthetic touch PointerEvents':'mouse',allSixSelectableAtEqualAndZeroGain:true,highFrontRowSelectable:true,continuousGain:saved.gain,pointerGainTolerance:pixelTolerance,singleRiffPreview:true,rotateOnlyPhase:true,undo:true,cancel:true,hintsWin:true,hints,oldPuzzles:true,geometry});
  if(cdp)await cdp.detach();await context.close();
 }
 assert.deepEqual(report.errors,[]);delete report.step;report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{report.debug=await currentPage.evaluate(()=>({diagnostics:phaseCubeApp.diagnostics(),locations:phaseCubeApp.getPresentation().locations().map(p=>({...p,pick:phaseCubeApp.getPresentation().pick(p.x,p.y)})),events:phaseCubeApp.report().events.slice(-14)}));await currentPage.screenshot({path:join(root,`qa/chairs/${r.engine}-failure.png`)});}catch{}throw e;}
finally{const files=['index.html','app.js','puzzle-contract.js','puzzles/fourier/model.js','puzzles/fourier/module.js','puzzles/fourier/binding.js','puzzles/fourier/three-view.js','controls/puzzle.js','graphics/stage.js'];report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));await writeFile(join(root,`qa/chairs/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));}
function FourierLevel(state){const radix=72;return(4+Math.floor(state%radix/8))%9;}
