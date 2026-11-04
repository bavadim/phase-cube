/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,targets} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'rotary-maze-ui/1',engine:r.engine,physicalDevice:false,cases:[],errors:[]};let page;
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 for(const [width,height]of [[1280,800],[390,844],[844,390]].filter(([w])=>!process.env.MAZE_SIZE||w===+process.env.MAZE_SIZE)){
  const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(r.url+'/?debug=1&puzzle=fourier&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  assert.equal(await page.locator('#puzzle-select option[value="fourier"]').textContent(),'Звучащий лабиринт');
  if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  const click=locator=>locator[touch?'tap':'click'](),state=()=>page.evaluate(()=>phaseCubeApp.state()),inspect=()=>page.evaluate(()=>phaseCubeApp.getPresentation().active.view.inspect());
  await click(page.locator('#start'));await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  assert.equal(await page.locator('.puzzle-action:enabled:not(#next-object)').count(),0);
  const initial=await state();assert(!(await inspect()).passable);
  await page.screenshot({path:join(root,`qa/maze/${r.engine}-${width}-shuffled.png`)});
  // Every lift remains selectable at equal, zero, and occluding front-row heights.
  for(const levels of [[4,4,4,4,4,4],[0,0,0,0,0,0],[8,0,0,8,8,0]]){
   await page.evaluate(levels=>{const m=phaseCubeApp.getPuzzle();let state=0;for(let i=0;i<6;i++){const e=m.editMove(FourierModel.keys[i],{phase:(FourierModel.homePhase[i]+1)%8,level:levels[i]},state);if(e)state=m.applyTo(state,e);}m.restore(state);phaseCubeApp.getPresentation().active.view.sync();},levels);
   for(const key of ['A','B','C','D','E','F']){
    const p=(await targets(page)).find(p=>p.key===key);assert.equal(await page.evaluate(p=>phaseCubeApp.getPresentation().pick(p.x,p.y)?.key,p),key);
    await select(page,key,touch);
   }
   const geometry=await page.evaluate(()=>{
    const m=phaseCubeApp.getPuzzle(),p=m.parameters(),v=phaseCubeApp.getPresentation().active.view.inspect();
    return v.lifts.every((l,i)=>l.ports.every((port,j)=>{const expected=FourierMaze.port(i,j?'out':'in',p[i].phase-FourierModel.homePhase[i],p[i].level/4);return Math.hypot(port[0]-expected.x,port[1]-expected.y,port[2]-expected.z)<1e-7;}));
   });assert(geometry,'Real Three.js ports must match the reachability model');
  }
  await page.evaluate(initial=>{phaseCubeApp.getPuzzle().restore(initial);phaseCubeApp.getPresentation().active.view.sync();},initial);await select(page,'A',touch);
  const misses=await page.evaluate(()=>{
   const s=phaseCubeApp.getPresentation(),m=phaseCubeApp.getPuzzle(),before=m.snapshot(),misses=[];
   for(let phase=0;phase<8;phase++)for(const gain of FourierMaze.gains){
    let state=0;for(let i=0;i<6;i++){const move=m.editMove(FourierModel.keys[i],{phase:(FourierModel.homePhase[i]+phase)%8,level:gain*4},state);if(move)state=m.applyTo(state,move);}m.restore(state);s.active.view.sync();
    for(const p of s.locations())if(s.pick(p.x,p.y)?.key!==p.key)misses.push({phase,gain,key:p.key});
   }
   m.restore(before);s.active.view.sync();return misses;
  });assert.deepEqual(misses,[],'All 240 platform centers must hit their real moving meshes');
  const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
  async function send(type,p){
   if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],touchPoints:['up','cancel'].includes(type)?[]:[{id:0,x:p.x,y:p.y}]});await frame(page);return;}
   if(touch){await page.evaluate(({type,p})=>phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({down:'pointerdown',move:'pointermove',up:'pointerup',cancel:'pointercancel'}[type],{pointerId:881,pointerType:'touch',isPrimary:true,button:0,buttons:type==='up'?0:1,clientX:p?.x||0,clientY:p?.y||0,bubbles:true})),{type,p});await frame(page);return;}
   if(type==='down'){await page.mouse.move(p.x,p.y);await page.mouse.down();}else if(type==='move')await page.mouse.move(p.x,p.y,{steps:3});else if(type==='up')await page.mouse.up();else {await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.cancel());await page.mouse.up();}await frame(page);
  }
  const origin=async()=>(await targets(page)).find(p=>p.key==='A');
  const destination=async(p,axis,distance)=>page.evaluate(({p,axis,distance})=>{const s=phaseCubeApp.getPresentation(),world=s.unproject(p.x,p.y),direction=new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,0).applyQuaternion(s.active.view.camera.quaternion);return s.project(world.addScaledVector(direction,distance));},{p,axis,distance});
  const params=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters());
  let at=await origin();await send('down',at);await send('move',await destination(at,'x',2.2*1.8/8));
  assert.deepEqual(await state(),initial);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),[0]);assert.equal((await inspect()).dragging,'phase');
  await send('up');await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);
  let after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters());assert.equal(after[0].phase,(params[0].phase+6)%8);assert.equal(after[0].level,params[0].level);assert.deepEqual(after.slice(1),params.slice(1));
  await click(page.locator('#undo'));await page.waitForFunction(()=>!phaseCubeApp.getPuzzle().history.length);await settled(page);assert.deepEqual(await state(),initial);
  // Drag past touch slop, then back near the target. The preview is already snapped.
  at=await origin();await send('down',at);await send('move',{x:at.x,y:at.y-38});await send('move',await destination(at,'y',.5*(1.06-params[0].level/4)));
  assert.equal((await inspect()).dragging,'gain');assert.equal((await inspect()).display[0].gain,1);assert.deepEqual(await state(),initial);
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),[0]);
  await send('up');await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);
  after=await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters());assert.equal(after[0].level,4);assert.equal(after[0].phase,params[0].phase);assert.deepEqual(after.slice(1),params.slice(1));
  assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getTransport().active.meta.state),await state());
  await page.screenshot({path:join(root,`qa/maze/${r.engine}-${width}-selected.png`)});
  await click(page.locator('#undo'));await page.waitForFunction(()=>!phaseCubeApp.getPuzzle().history.length);await settled(page);assert.deepEqual(await state(),initial);
  at=await origin();await send('down',at);await send('move',{x:at.x,y:at.y-40});await send('cancel');assert.deepEqual(await state(),initial);assert.equal((await inspect()).dragging,null);assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
  const beforeSelection=await state();await click(page.locator('#next-object'));await page.waitForFunction(()=>phaseCubeApp.getPuzzle().selected==='B');assert.deepEqual(await state(),beforeSelection);
  await click(page.locator('#magnitude-down'));await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===1);await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[1].level),2);
  await click(page.locator('#undo'));await page.waitForFunction(()=>!phaseCubeApp.getPuzzle().history.length);await settled(page);assert.deepEqual(await state(),initial);
  let hints=0;while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){
   await click(page.locator('#hint'));const before=await state();assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().selected),await page.evaluate(()=>phaseCubeApp.getPuzzle().moveTarget(phaseCubeApp.diagnostics().actionFocus.move)));
   assert.deepEqual(await state(),before);await click(page.locator('.puzzle-action.hinted'));await settled(page);assert(++hints<24);
  }
  assert(await page.locator('#result-dialog').isVisible());assert((await inspect()).passable);assert.equal((await inspect()).correct,6);assert.equal((await inspect()).completed,6);
  await page.screenshot({path:join(root,`qa/maze/${r.engine}-${width}-win.png`)});
  const png=await page.evaluate(()=>{const s=phaseCubeApp.getPresentation();s.renderer.render(s.active.scene,s.active.view.camera);return s.canvas.toDataURL('image/png');});
  await writeFile(join(root,`qa/maze/${r.engine}-${width}-solved-field.png`),Buffer.from(png.split(',')[1],'base64'));
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,canvases:document.querySelectorAll('#puzzle-stage canvas').length,buttons:Math.min(...[...document.querySelectorAll('.puzzle-action,#hint')].map(b=>b.getBoundingClientRect().height)),scoreTracks:document.querySelectorAll('#orbit-score .orbit-track').length}));assert(!geometry.overflow);assert.equal(geometry.canvases,1);assert(geometry.buttons>=44);assert.equal(geometry.scoreTracks,6);
  report.cases.push({width,height,input:cdp?'native CDP touch':touch?'synthetic touch PointerEvents':'mouse',sixLiftsSelectableAtAllHeights:true,physicalPortsMatchModel:true,phaseOnlyDrag:true,gainOnlyDrag:true,fiveGainLevels:true,singleRiffPreview:true,undo:true,cancel:true,buttons:true,hintsWin:true,hints,geometricAndMusicalGoal:true,geometry});
  if(cdp)await cdp.detach();await context.close();console.log(JSON.stringify({engine:r.engine,width,status:'PASS'}));
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{report.debug=await page.evaluate(()=>({state:phaseCubeApp.state(),diagnostics:phaseCubeApp.diagnostics(),view:phaseCubeApp.getPresentation().active.view.inspect(),locations:phaseCubeApp.getPresentation().locations().map(p=>({...p,picked:phaseCubeApp.getPresentation().pick(p.x,p.y)}))}));await page.screenshot({path:join(root,`qa/maze/${r.engine}-failure.png`)});}catch{}throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=[...new Set(['index.html',...[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m=>m[1].split('?')[0])])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));
 await writeFile(join(root,`qa/maze/${r.engine}${process.env.MAZE_SIZE?'-'+process.env.MAZE_SIZE:''}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,engine:r.engine,cases:report.cases,failure:report.failure,errors:report.errors}));
}
