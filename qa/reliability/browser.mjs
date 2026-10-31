/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,turnOnField,actionPoint} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'input-reliability/1',engine:r.engine,physicalDevice:false,stress:[],errors:[],postRequests:0};
const ready=p=>p.waitForFunction(()=>{const d=phaseCubeApp.diagnostics();return d.sessionPhase==='playing'&&!d.busy&&!d.starting&&!d.pending;});
try{
 const c=await r.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true}),p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('request',q=>{if(q.method()==='POST')report.postRequests++;});
 await p.goto(r.url+'/?debug=1');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 let key='A';
 for(const id of ['twiddle','rubik','fourier']){
  await p.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);await p.locator('#start').tap();await ready(p);
  key=await p.evaluate(()=>{
   if(phaseCubeApp.diagnostics().puzzleId!=='rubik')return 'A';
   const area=f=>Math.abs(f.region.reduce((s,a,i)=>{const b=f.region[(i+1)%f.region.length];return s+a.x*b.y-a.y*b.x;},0));
   return phaseCubeApp.getPresentation().locations().sort((a,b)=>area(b)-area(a))[0].key;
  });
  await select(p,key,true);
  for(let i=0;i<16;i++)await turnOnField(p,key,i%3===1,true);
  // Actual rapid touchscreen taps, including presses while a move is busy.
  const point=await actionPoint(p,key,false);
  for(let i=0;i<120;i++)await p.touchscreen.tap(point.x,point.y);
  await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
  assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().disabled),false);
  await turnOnField(p,key,false,true);
  report.stress.push({id,acceptedFieldTurns:17,rapidTaps:120,fieldResponsive:true});
 }
 // Deliberate faults, separate from the stress above. These are not evidence
 // that any particular OS interruption caused the user's original report.
 const point=await actionPoint(p,key,false);await p.touchscreen.tap(point.x,point.y);
 await p.evaluate(()=>strudel.getAudioContext().suspend());
 await p.waitForFunction(()=>{const d=phaseCubeApp.diagnostics();return d.sessionPhase==='paused'&&!d.busy&&!d.pending;});
 assert.match(await p.locator('#session-feedback').textContent(),/прерван/);
 await p.locator('#start').tap();await ready(p);await turnOnField(p,key,false,true);report.audioInterruptionRecovered=true;
 // A press with no release, then a late capture-loss from a different pointer.
 const at=await actionPoint(p,key,false);
 await p.evaluate(at=>{
  const s=phaseCubeApp.getPresentation();s.canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:777,clientX:at.x,clientY:at.y,button:0,buttons:1,isPrimary:true,pointerType:'touch',bubbles:true}));
  s.canvas.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:999,bubbles:true}));
 },at);
 assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture.id),777);
 await turnOnField(p,key,false,true);assert.equal(await p.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);report.stalePointerRecovered=true;
 // A render exception must not kill the only application animation loop.
 await p.evaluate(()=>{const s=phaseCubeApp.getPresentation(),frame=s.frame.bind(s);s.frame=now=>{s.frame=frame;throw new Error('QA one-shot render failure');};});
 await p.waitForFunction(()=>phaseCubeApp.diagnostics().error?.includes('QA one-shot'));
 await p.locator('#start').tap();await ready(p);await turnOnField(p,key,false,true);
 assert((await p.evaluate(()=>phaseCubeApp.diagnostics().frameAgeMs))<500);report.frameLoopRecovered=true;
 const gl=await p.evaluate(()=>{window.qaGl=phaseCubeApp.getPresentation().renderer.getContext().getExtension('WEBGL_lose_context');if(!qaGl)return false;qaGl.loseContext();return true;});
 if(gl){
  await p.waitForFunction(()=>phaseCubeApp.getPresentation().contextLost&&phaseCubeApp.diagnostics().sessionPhase==='paused');
  assert.equal(await p.locator('#start').isDisabled(),true);await p.waitForTimeout(250);await p.evaluate(()=>qaGl.restoreContext());
  await p.waitForFunction(()=>!phaseCubeApp.getPresentation().contextLost);await p.locator('#start').tap();await ready(p);await turnOnField(p,key,false,true);
  report.webglRecovery=true;
 }else report.webglRecovery='UNSUPPORTED';
 await p.locator('#pause').tap();
 // Exercise the download fallback with a real browser download. No data is sent.
 await p.evaluate(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
 const download=p.waitForEvent('download');await p.locator('#session-overlay .report-button').tap();
 const file=await download,content=JSON.parse(await readFile(await file.path(),'utf8'));
 assert.equal(content.schema,'music-puzzle-report/1');assert.equal(content.build,'music-puzzles/input1');assert.equal(content.state.puzzleId,'fourier');
 assert(content.events.some(e=>e.type==='session.error'));assert(content.events.some(e=>e.type==='audio.state'));assert(content.events.length<=400);
 assert(content.state.playerMoveCount>=17);assert(content.state.audioChanges.length>0);report.reportDownload=true;
 await p.reload();await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 assert.equal(await p.evaluate(()=>phaseCubeApp.report().previous.build),'music-puzzles/input1');report.previousSessionPreserved=true;
 // File-share branch is a mock; physical iPhone's native share sheet is untested.
 await p.evaluate(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
  Object.defineProperty(navigator,'share',{value:async data=>{window.sharedReport=JSON.parse(await data.files[0].text());},configurable:true});
 });
 await p.locator('#session-overlay .report-button').tap();await p.waitForFunction(()=>window.sharedReport);assert.equal(await p.evaluate(()=>sharedReport.schema),'music-puzzle-report/1');report.fileShareApiMock=true;
 assert.deepEqual(report.errors,[]);assert.equal(report.postRequests,0);report.status='PASS';await c.close();
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,`qa/reliability/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report,null,2));
}
