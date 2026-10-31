/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'coefficient-drag/1',engine:r.engine,physicalDevice:false,errors:[]};
try{
 const c=await r.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(r.url+'/?debug=1&puzzle=fourier');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);await p.locator('#start').tap();await settled(p);
 const initial=await p.evaluate(()=>phaseCubeApp.state());
 await p.evaluate(()=>{
  const music=phaseCubeApp.getMusic(),predict=music.predict.bind(music);window.qaPredictions=0;
  music.predict=(...args)=>{qaPredictions++;return predict(...args);};
 });
 assert.equal(await p.locator('.puzzle-action:enabled').count(),0,'No operation before an explicit coefficient selection');
 assert.equal(await p.locator('.puzzle-operation').textContent(),'Выберите точку');
 const sweep=async()=>{for(const point of await targets(p))await p.mouse.move(point.x,point.y);};
 await sweep();
 assert.equal(await p.evaluate(()=>qaPredictions),0,'Free cursor motion does not calculate a forecast');
 assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus),null);
 const empty=await p.evaluate(()=>phaseCubeApp.getPresentation().project(new THREE.Vector3(1.7,0,0)));await p.mouse.click(empty.x,empty.y);
 assert.equal(await p.locator('.puzzle-action:enabled').count(),0,'Blank chart cannot select a coefficient or apply a move');
 await select(p,'B',true);await sweep();
 assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().selected),'B','Hover cannot switch a selected point');
 assert.equal(await p.evaluate(()=>qaPredictions),0);assert.equal(await p.evaluate(()=>phaseCubeApp.getEqualizer().forecast),null);
 await p.locator('#hint').tap();
 const pinned=await p.evaluate(()=>({focus:phaseCubeApp.diagnostics().actionFocus,count:qaPredictions}));await sweep();
 assert.deepEqual(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus),pinned.focus,'Free cursor motion cannot replace a hint');
 assert.equal(await p.evaluate(()=>qaPredictions),pinned.count);
 await select(p,'A',true);report.explicitSelection=true;report.hoverDoesNotPredictOrSelect=true;report.hoverPreservesHint=true;
 let cdp=r.engine==='chromium'?await c.newCDPSession(p):null,lastTouch=null;
 async function touch(type,point){
  if(cdp){
   if(type==='touchMove'&&lastTouch){
    for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[{id:0,x:lastTouch.x+(point.x-lastTouch.x)*i/8,y:lastTouch.y+(point.y-lastTouch.y)*i/8}]});await p.waitForTimeout(16);}
   }else await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{id:0,x:point.x,y:point.y}]});
   lastTouch=type==='touchEnd'||type==='touchCancel'?null:point;
  }
  else await p.evaluate(({type,point})=>{
   phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({touchStart:'pointerdown',touchMove:'pointermove',touchEnd:'pointerup',touchCancel:'pointercancel'}[type],{pointerId:713,pointerType:'touch',isPrimary:true,button:0,buttons:type==='touchEnd'?0:1,clientX:point?.x||0,clientY:point?.y||0,bubbles:true,cancelable:true}));
  },{type,point});
 }
 const origin=()=>targets(p).then(a=>a.find(t=>t.kind==='point'&&t.key==='A'));
 const destination=await p.evaluate(()=>phaseCubeApp.getPresentation().project(new THREE.Vector3(-1.15,0,0)));
 await touch('touchStart',await origin());await touch('touchMove',destination);
 assert.equal(await p.evaluate(()=>phaseCubeApp.state()),initial);assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture.custom),true);
 const forecast=await p.evaluate(()=>{
  const f=phaseCubeApp.getEqualizer().forecast,m=phaseCubeApp.getPuzzle(),before=m.parameters(),next=m.parameters(m.applyTo(m.snapshot(),f.move));
  return{source:phaseCubeApp.diagnostics().actionFocus.source,key:f.move.key,affected:f.changed,others:before.slice(1),nextOthers:next.slice(1)};
 });assert.equal(forecast.source,'edit');assert.equal(forecast.key,'A');assert.deepEqual(forecast.others,forecast.nextOthers);assert.deepEqual(forecast.affected,[0],'Only the edited riff changes');
 report.dragFocusIsSelectedCoefficient=true;report.independentRiffProjection=true;
 await touch('touchEnd',destination);await settled(p);
 assert.deepEqual(await p.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]),{phase:4,level:2});assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().history.length),1);
 await p.locator('#undo').tap();await p.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.state()),initial);report.touchCommitUndo=cdp?'native CDP touch':'synthetic touch PointerEvents';
 await p.mouse.move((await origin()).x,(await origin()).y);await p.mouse.down();await p.mouse.move(destination.x,destination.y,{steps:8});
 assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus.source),'edit');assert.equal(await p.evaluate(()=>phaseCubeApp.state()),initial);
 await p.mouse.up();await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().history.length),1);
 assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus),null,'Dropping a point does not restart a cursor forecast');
 await p.locator('#undo').tap();await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.state()),initial);report.mouseCommitUndo=true;
 // Move beyond the canvas: capture preserves the drag and the radius clamps.
 const box=await p.locator('#puzzle-stage canvas').boundingBox(),outside={x:box.x-35,y:box.y-35};
 const expected=await p.evaluate(outside=>{const s=phaseCubeApp.getPresentation(),w=s.unproject(outside.x,outside.y);return phaseCubeApp.getPuzzle().snap([w.x/(1.15/Math.max(...FourierModel.levels)),w.y/(1.15/Math.max(...FourierModel.levels))]);},outside);
 await touch('touchStart',await origin());await touch('touchMove',outside);await touch('touchEnd',outside);await settled(p);
 assert.deepEqual(await p.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0]),expected);assert.equal(expected.level,2);await p.locator('#undo').tap();await p.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length===0);await settled(p);report.outsideCanvas=true;
 await touch('touchStart',await origin());await touch('touchMove',destination);
 await p.locator('#pause').evaluate(b=>b.click());await p.waitForFunction(()=>phaseCubeApp.diagnostics().context==='suspended');
 await touch('touchEnd',destination);assert.equal(await p.evaluate(()=>phaseCubeApp.state()),initial);assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().history.length),0);assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
 await p.locator('#start').tap();await settled(p);report.pauseCancels=true;
 await select(p,'A',true);await touch('touchStart',await origin());await touch('touchMove',destination);
 await p.evaluate(()=>phaseCubeApp.choosePuzzle('twiddle'));await touch('touchEnd',destination);assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);
 await p.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);report.switchCancels=true;
 if(cdp)await cdp.detach();await c.close();assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,`qa/polar/${r.engine}-drag-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));
}
