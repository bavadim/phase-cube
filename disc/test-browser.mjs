/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Real mouse/native-touch flows and source/audio-clock/geometry consistency. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {openBrowser,root} from '../qa/modules/browser.mjs';
const output=join(root,'disc/qa');await mkdir(output,{recursive:true});
const run=await openBrowser();let page;
const report={schema:'music-disc-browser/1',engine:run.engine,physicalDevice:false,hardwareAudioLatencyVerified:false,cases:[],errors:[],missingResources:[],startedAt:new Date().toISOString()};
const frame=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settled=p=>p.waitForFunction(()=>{const d=discTest.diagnostics();return !d.loading&&!d.starting&&!d.pending;},{},{timeout:30000});
const state=p=>p.evaluate(()=>discTest.state());
const diagnostics=p=>p.evaluate(()=>discTest.diagnostics());
const part=(s,key)=>s.parts.find(p=>p.key===key);
const click=(p,selector,touch)=>p.locator(selector)[touch?'tap':'click']();
async function ready(p){await p.waitForFunction(()=>window.discTest,{},{timeout:30000});await p.evaluate(()=>discTest.ready);await settled(p);await frame(p);}
async function closeMenu(p){if(await p.locator('#library').evaluate(e=>e.open))await p.locator('#library .close').click();await frame(p);}
async function menu(p,selector,touch){if(!await p.locator('#library').evaluate(e=>e.open))await click(p,'#open-library',touch);await click(p,selector,touch);await settled(p);}
async function point(p,key,kind){
 await closeMenu(p);await frame(p);const at=await p.evaluate(({key,kind})=>{const s=discTest.stage,v=discTest.locations().find(v=>v.key===key&&v.kind===kind);if(!v)return null;const hit=s.pick(v.x,v.y);return{...v,hit:{key:hit?.key,kind:hit?.kind},element:document.elementFromPoint(v.x,v.y)?.tagName};},{key,kind});
 assert(at,'Scene target '+key+'/'+kind);assert.deepEqual(at.hit,{key,kind},'Actual raycast '+key+'/'+kind);assert.equal(at.element,'CANVAS');return at;
}
async function tap(p,key,kind,touch){const at=await point(p,key,kind);await(touch?p.touchscreen.tap(at.x,at.y):p.mouse.click(at.x,at.y));await frame(p);return at;}
async function select(p,key,touch){const before=await state(p);await tap(p,key,'phase',touch);await p.waitForFunction(k=>discTest.diagnostics().selected===k,key,{timeout:3000});assert.deepEqual((await state(p)).parts,before.parts,'Selection leaves music unchanged');}
async function action(p,key,kind,touch){await tap(p,key,kind,touch);await settled(p);}
async function gesture(p,context,key,kind,touch,{cancel=false,full=false}={}){
 await select(p,key,touch);const handle=await point(p,key,kind);
 let path;
 if(kind==='phase')path=await p.evaluate(({key,full})=>{
  const s=discTest.stage,world=s.active.view.ringPath(key,100),start=28,steps=full?100:14;
  return Array.from({length:steps+1},(_,i)=>s.project(world[(start+i)%100]));
 },{key,full});
 else path=Array.from({length:13},(_,i)=>({x:handle.x,y:handle.y-i*7}));
 const actual=await p.evaluate(at=>{const h=discTest.stage.pick(at.x,at.y);return{key:h?.key,kind:h?.kind};},path[0]);assert.deepEqual(actual,{key,kind});
 const before={state:await state(p),diag:await diagnostics(p)},cdp=touch?await context.newCDPSession(p):null;
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,...path[0]}]});else{await p.mouse.move(path[0].x,path[0].y);await p.mouse.down();}
 for(const at of path.slice(1)){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,...at}]});else await p.mouse.move(at.x,at.y);await frame(p);}
 assert.equal((await diagnostics(p)).preview,true,'Dragging auditions a temporary state');assert.deepEqual((await state(p)).parts,before.state.parts,'Dragging does not commit repeatedly');
 if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await cdp.detach();}else await p.mouse.up();
 await settled(p);await frame(p);const after={state:await state(p),diag:await diagnostics(p)};
 assert.equal(after.diag.preview,false);assert.equal(await p.evaluate(()=>discTest.stage.pointer.gesture),null);
 if(cancel||full){assert.deepEqual(after.state.parts,before.state.parts,cancel?'Cancelled gesture restores state':'A complete revolution is the identity');assert.equal(after.diag.historyLength,before.diag.historyLength);}
 else{assert.notEqual(part(after.state,key)[kind],part(before.state,key)[kind]);assert.equal(after.diag.historyLength,before.diag.historyLength+1);await click(p,'#undo',touch);await settled(p);assert.deepEqual((await state(p)).parts,before.state.parts);}
}
async function syncEvidence(p){
 const evidence=await p.evaluate(async()=>{
  const wrap=x=>((x%1)+1)%1,dist=(a,b)=>Math.abs(((a-b+.5)%1+1)%1-.5);
  let maxAngleError=0,maxClockLagMs=0,frames=0,events=0,lightMismatches=0;
  await new Promise(resolve=>{function sample(){
   const d=discTest.diagnostics(),v=d.view,clock=discTest.clock(),rows=discTest.rows();
   if(!v?.rings?.length)throw Error('Missing native geometry inspection');
   maxClockLagMs=Math.max(maxClockLagMs,Math.abs(d.audioCycle-d.visualCycle)*clock.periodSeconds/clock.periodBars*1000);
   for(const [i,r]of v.rings.entries()){
    for(const e of r.events){const expected=wrap(e.start+r.state.phase-v.cycle);maxAngleError=Math.max(maxAngleError,dist(e.angle,expected));events++;}
    const active=clock.playing&&r.state.installed&&r.state.gain>0&&rows[i].some(e=>e.audible!==false&&e.gain!==0&&wrap(wrap(v.cycle)-e.start)*clock.periodSeconds<Math.max(.04,e.duration*clock.periodSeconds));
    if(active!==r.active)lightMismatches++;
   }
   if(++frames===90)resolve();else requestAnimationFrame(sample);
  }requestAnimationFrame(sample);});
  const t=discTest.transport,rows=discTest.rows(),period=discTest.clock().periodBars;
  const scheduled=t.log.filter(e=>e.type==='event'&&e.revision===t.active?.id),bad=[];
  for(const event of scheduled){
   const found=rows.flat().some(e=>e.audible!==false&&dist(e.start,wrap(event.cycle/period))<1e-7&&e.value.s===event.sound&&String(e.value.note)===String(event.note));
   if(!found||Math.abs(t.timeAt(event.cycle)-event.targetAudio)>.00001)bad.push(event);
  }
  return{frames,geometryEventSamples:events,maxAngleError,maxClockLagMs,lightMismatches,nativeScheduledEvents:scheduled.length,nativeTimingMismatches:bad};
 });
 assert(evidence.geometryEventSamples>0);assert(evidence.maxAngleError<1e-6,'Rendered angles match real note onsets and full-cycle phase');
 assert(evidence.maxClockLagMs<100,'Visual clock remains within a bounded render frame of native audio');assert.equal(evidence.lightMismatches,0);
 assert(evidence.nativeScheduledEvents>0);assert.deepEqual(evidence.nativeTimingMismatches,[]);return evidence;
}
async function metrics(p){return p.evaluate(()=>{
 const s=discTest.stage;s.renderer.render(s.active.scene,s.active.view.camera);const r=s.canvas.getBoundingClientRect(),buttons=[...document.querySelectorAll('main footer button')].map(b=>b.getBoundingClientRect());
 return{canvasCount:s.element.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,
 stage:{width:r.width,height:r.height},render:{...s.renderer.info.render},memory:{...s.renderer.info.memory},minControl:Math.min(...buttons.map(r=>Math.min(r.width,r.height))),offscreenControl:buttons.some(r=>r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1),
 obsoleteUI:document.querySelectorAll('#hint,#correct-count,#inspector,.module-card,input[type=range]').length};
});}
try{
 for(const [width,height]of [[1280,800],[390,844]].filter(([w])=>!process.env.DISC_SIZE||+process.env.DISC_SIZE===w)){
  const touch=width<600,context=await run.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({width,message:e.message}));page.on('response',r=>{if(r.status()>=400)report.missingResources.push({width,status:r.status(),url:r.url()});});
  await page.goto(run.url+'/disc/index.html');await ready(page);
  if(run.engine==='chromium')await page.evaluate(async()=>{const c=strudel.getAudioContext();if(c.setSinkId)await c.setSinkId({type:'none'});});
  const initial=await state(page);assert.deepEqual(initial.parts.map(p=>p.key),['kick','bass','hook']);assert.equal((await diagnostics(page)).playing,false);
  for(const key of ['kick','bass','hook']){for(const kind of (key==='hook'?['phase','gain','toggle','variant']:['phase','gain','toggle']))await point(page,key,kind);await select(page,key,touch);}
  await action(page,'hook','toggle',touch);assert.equal(part(await state(page),'hook').installed,false);await click(page,'#undo',touch);assert.deepEqual((await state(page)).parts,initial.parts);
  await action(page,'hook','variant',touch);assert.notEqual(part(await state(page),'hook').variant,part(initial,'hook').variant);await click(page,'#undo',touch);
  await gesture(page,context,'bass','phase',touch);await gesture(page,context,'bass','gain',touch);await gesture(page,context,'bass','phase',touch,{full:true});
  if(touch){await gesture(page,context,'bass','phase',touch,{cancel:true});await gesture(page,context,'bass','gain',touch,{cancel:true});}
  await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>discTest.diagnostics().rms>.0001,{},{timeout:15000});
  const audible=await diagnostics(page),synchronization=await syncEvidence(page);
  await gesture(page,context,'hook','phase',touch);await gesture(page,context,'bass','gain',touch);
  // Create two user-authored snapshots; neither slot is a target or score.
  await menu(page,'#snapshot-a',touch);const a=await state(page);
  await menu(page,'#snapshot-b',touch);await action(page,'hook','variant',touch);const b=await state(page);await menu(page,'#save-snapshot',touch);
  await menu(page,'#snapshot-a',touch);assert.deepEqual((await state(page)).parts,a.parts);
  await menu(page,'#snapshot-b',touch);assert.deepEqual((await state(page)).parts,b.parts);assert.notDeepEqual(a.parts,b.parts);
  await menu(page,'#save-scene',touch);const saved=await state(page);
  await action(page,'hook','toggle',touch);await menu(page,'#restore-scene',touch);assert.deepEqual((await state(page)).parts,saved.parts);
  const downloading=page.waitForEvent('download');await menu(page,'#export-scene',touch);const download=await downloading,exported=await readFile(await download.path());assert.deepEqual(JSON.parse(exported).state.parts,saved.parts);
  await action(page,'hook','variant',touch);if(!await page.locator('#library').evaluate(e=>e.open))await click(page,'#open-library',touch);
  await page.locator('#scene-file').setInputFiles({name:'music-disc.json',mimeType:'application/json',buffer:exported});await settled(page);await frame(page);assert.deepEqual((await state(page)).parts,saved.parts);
  await page.reload();await ready(page);assert.deepEqual((await state(page)).parts,saved.parts);assert.equal((await diagnostics(page)).playing,false);
  await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>discTest.diagnostics().rms>.0001,{},{timeout:15000});
  await page.screenshot({path:join(output,`${run.engine}-${width}.png`)});const layout=await metrics(page);
  assert.equal(layout.canvasCount,1);assert(!layout.overflow);assert(!layout.offscreenControl);assert(layout.minControl>=44);assert.equal(layout.obsoleteUI,0);assert(layout.stage.height>=300);assert(layout.render.calls<600);assert(layout.memory.textures<64);
  for(const key of ['kick','bass','hook'])await action(page,key,'toggle',touch);
  await settled(page);await page.waitForFunction(()=>discTest.diagnostics().rms<.00001,{},{timeout:15000});const silent=await diagnostics(page);
  assert.equal(silent.projection.events,0);assert.equal(silent.playing,true);assert((await page.evaluate(()=>discTest.rows())).every(r=>r.length>0),'Muted rings retain real musical geometry');
  const mutedSaved=await state(page);await page.reload();await ready(page);assert.deepEqual((await state(page)).parts,mutedSaved.parts);
  await action(page,'hook','toggle',touch);await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>discTest.diagnostics().rms>.0001,{},{timeout:15000});
  report.cases.push({width,height,input:touch?'native CDP touch and taps':'mouse',allTenRayTargets:true,selection:true,toggleVariant:true,phaseGainDrag:true,fullRotationIdentity:true,oneGestureOneUndo:true,nativeCancellation:touch,
  audio:true,synchronization,snapshotAB:true,saveReload:true,jsonRoundTrip:true,muteAllPCMQuiet:true,mutedReloadReconnection:true,rms:audible.rms,peak:audible.peak,layout});
  console.log(JSON.stringify({engine:run.engine,width,status:'PASS',calls:layout.render.calls,syncLagMs:synchronization.maxClockLagMs}));await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingResources,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{report.lastDiagnostics=await diagnostics(page);await page.screenshot({path:join(output,`${run.engine}-failure.png`)});}catch{}throw e;}
finally{
 const html=await readFile(join(root,'disc/index.html'),'utf8'),base=html.match(/<base\s+href="([^"]+)"/)?.[1]||'./';
 const paths=[...new Set(['disc/index.html',...[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1].split('?')[0])])];report.sourceSha256={};
 for(const p of paths){try{const f=p==='disc/index.html'?join(root,p):resolve(root,'disc',base,p);report.sourceSha256[f.slice(root.length)]=createHash('sha256').update(await readFile(f)).digest('hex');}catch{}}
 await writeFile(join(output,`${run.engine}-${process.env.DISC_SIZE||'all'}-report.json`),JSON.stringify(report,null,2));await run.close();
}
