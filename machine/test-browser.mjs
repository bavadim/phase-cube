/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Real browser workflows. Neither music taste nor a physical iPhone is certified here. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {openBrowser,root} from '../qa/modules/browser.mjs';
const output=join(root,'machine/qa');await mkdir(output,{recursive:true});
const run=await openBrowser();let page;
const report={schema:'music-machine-browser/2',engine:run.engine,physicalDevice:false,cases:[],errors:[],missingResources:[],startedAt:new Date().toISOString()};
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settled=page=>page.waitForFunction(()=>{const d=machineApp.diagnostics();return !d.loading&&!d.starting&&!d.pending;},{},{timeout:30000});
const state=page=>page.evaluate(()=>machineApp.state());
const snapshot=page=>page.evaluate(()=>machineApp.diagnostics());
const click=(page,selector,touch)=>page.locator(selector)[touch?'tap':'click']();
const musicState=s=>s.parts;
const part=(s,key)=>s.parts.find(p=>p.key===key);
async function ready(page){await page.waitForFunction(()=>window.machineApp,{},{timeout:30000});await page.evaluate(()=>machineApp.ready);await settled(page);await frame(page);}
async function closeLibrary(page){if(await page.locator('#library').evaluate(e=>e.open))await page.locator('#library .close-dialog').click();await frame(page);}
async function libraryAction(page,selector,touch){
  if(!await page.locator('#library').evaluate(e=>e.open))await click(page,'#open-library',touch);
  await click(page,selector,touch);await settled(page);
}
async function fieldPoint(page,key,kind){
  await closeLibrary(page);await frame(page);
  const result=await page.evaluate(({key,kind})=>{
    const s=machineApp.stage,p=s.locations().find(p=>p.key===key&&p.kind===kind);
    if(!p)return null;const hit=s.pick(p.x,p.y);return{...p,actual:{key:hit?.key,kind:hit?.kind},element:document.elementFromPoint(p.x,p.y)?.tagName};
  },{key,kind});
  assert(result,'Real scene location '+key+'/'+kind);assert.deepEqual(result.actual,{key,kind},'Actual scene raycast '+key+'/'+kind);assert.equal(result.element,'CANVAS');return result;
}
async function fieldTap(page,key,kind,touch){const at=await fieldPoint(page,key,kind);await(touch?page.touchscreen.tap(at.x,at.y):page.mouse.click(at.x,at.y));await frame(page);return at;}
async function fieldSelect(page,key,touch){
  if((await snapshot(page)).selected===key)return;
  const before=await state(page);await fieldTap(page,key,'gain',touch);
  await page.waitForFunction(key=>machineApp.diagnostics().selected===key,key,{timeout:3000});
  assert.deepEqual(musicState(await state(page)),musicState(before),'First tap only selects');
}
async function fieldAction(page,key,kind,touch){await fieldSelect(page,key,touch);await fieldTap(page,key,kind,touch);await settled(page);}
async function modelDrag(page,context,key,kind,touch,{cancel=false}={}){
  await fieldSelect(page,key,touch);const start=await fieldPoint(page,key,kind);
  const gesture=await page.evaluate(({key,kind,start})=>{
    const s=machineApp.stage;
    // Start at the actual exposed location. Extend outside the dial after capture
    // so the same test crosses the native touch slop at small viewport sizes.
    const from={x:start.x,y:start.y};
    const to=kind==='phase'?{x:from.x+65,y:from.y+28}:{x:from.x,y:from.y-64};
    return{from,to};
  },{key,kind,start});
  const before={state:await state(page),diagnostics:await snapshot(page)};
  const cdp=touch?await context.newCDPSession(page):null;
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,...gesture.from}]});
  else{await page.mouse.move(gesture.from.x,gesture.from.y);await page.mouse.down();}
  for(let i=1;i<=12;i++){
    const point={x:gesture.from.x+(gesture.to.x-gesture.from.x)*i/12,y:gesture.from.y+(gesture.to.y-gesture.from.y)*i/12};
    if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,...point}]});else await page.mouse.move(point.x,point.y);
    await frame(page);
  }
  assert.equal((await snapshot(page)).preview,true,'Scene drag auditions a temporary state');
  assert.deepEqual(musicState(await state(page)),musicState(before.state),'Preview does not mutate committed state');
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await cdp.detach();}else await page.mouse.up();
  await settled(page);const after={state:await state(page),diagnostics:await snapshot(page)};
  assert.equal(after.diagnostics.preview,false);assert.equal(await page.evaluate(()=>machineApp.stage.pointer.gesture),null);
  if(cancel){assert.deepEqual(musicState(after.state),musicState(before.state));assert.equal(after.diagnostics.historyLength,before.diagnostics.historyLength);}
  else{
    const prop=kind==='phase'?'phase':'gain';assert.notEqual(part(after.state,key)[prop],part(before.state,key)[prop],'Direct '+kind+' gesture changes the model');
    assert.equal(after.diagnostics.historyLength,before.diagnostics.historyLength+1,'One gesture makes one undo entry');
    await click(page,'#undo',touch);await settled(page);assert.deepEqual(musicState(await state(page)),musicState(before.state));
  }
}
async function measure(page){return page.evaluate(()=>{
  const s=machineApp.stage;s.renderer.render(s.active.scene,s.active.view.camera);const r=s.canvas.getBoundingClientRect();
  const buttons=[...document.querySelectorAll('.controls-dock button')].map(e=>e.getBoundingClientRect());
  return{canvasCount:s.element.querySelectorAll('canvas').length,overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,
    stage:{width:r.width,height:r.height},memory:{...s.renderer.info.memory},render:{...s.renderer.info.render},
    obsoleteUI:document.querySelectorAll('#hint,#correct-count,#inspector,.module-card,input[type=range]').length,
    minControl:Math.min(...buttons.map(r=>Math.min(r.width,r.height))),offscreenControls:buttons.some(r=>r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)};
});}
try{
 for(const [width,height]of [[1280,800],[390,844]].filter(([w])=>!process.env.MACHINE_SIZE||+process.env.MACHINE_SIZE===w)){
  const touch=width<600,context=await run.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({width,message:e.message}));page.on('response',r=>{if(r.status()>=400)report.missingResources.push({width,status:r.status(),url:r.url()});});
  await page.goto(run.url+'/machine/index.html?song=turkish-circuit');await ready(page);
  if(run.engine==='chromium')await page.evaluate(async()=>{const c=strudel.getAudioContext();if(c.setSinkId)await c.setSinkId({type:'none'});});
  const initial=await state(page);assert.equal(initial.parts.length,6);assert.equal((await snapshot(page)).playing,false);
  assert(initial.parts.some(p=>p.installed)&&initial.parts.some(p=>!p.installed));
  for(const p of initial.parts)await fieldSelect(page,p.key,touch);
  await fieldAction(page,'melody','gain',touch);assert.equal(part(await state(page),'melody').installed,true);
  await click(page,'#undo',touch);assert.deepEqual(musicState(await state(page)),musicState(initial));
  await fieldAction(page,'melody','gain',touch);
  const phaseBefore=part(await state(page),'melody').phase;await fieldAction(page,'melody','phase',touch);
  assert.notEqual(part(await state(page),'melody').phase,phaseBefore);
  const variantBefore=part(await state(page),'melody').variant;await fieldAction(page,'melody','variant',touch);
  assert.notEqual(part(await state(page),'melody').variant,variantBefore,'Physical cartridge changes phrase');
  await modelDrag(page,context,'bass','phase',touch);await modelDrag(page,context,'bass','gain',touch);
  if(touch)await modelDrag(page,context,'bass','phase',touch,{cancel:true});

  await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>machineApp.diagnostics().playing&&machineApp.diagnostics().rms>.0001,{},{timeout:15000});
  const audible=await snapshot(page);assert(audible.projection.events>0);
  await fieldAction(page,'bass','phase',touch);await settled(page);
  assert.notEqual((await snapshot(page)).projection.signature,audible.projection.signature,'Physical phase changes audible projection');
  await modelDrag(page,context,'bass','gain',touch);

  await libraryAction(page,'#snapshot-a',touch);const a=await state(page);
  await libraryAction(page,'#snapshot-b',touch);const b=await state(page);assert.notDeepEqual(musicState(a),musicState(b));
  await libraryAction(page,'#snapshot-a',touch);assert.deepEqual(musicState(await state(page)),musicState(a));
  await fieldAction(page,'bass','phase',touch);const rewritten=await state(page);await libraryAction(page,'#save-snapshot',touch);
  await libraryAction(page,'#snapshot-b',touch);await libraryAction(page,'#snapshot-a',touch);assert.deepEqual(musicState(await state(page)),musicState(rewritten));
  await libraryAction(page,'#save-scene',touch);const saved=await state(page);
  await fieldAction(page,'bass','phase',touch);await libraryAction(page,'#restore-scene',touch);assert.deepEqual(musicState(await state(page)),musicState(saved));
  const downloadPromise=page.waitForEvent('download');await libraryAction(page,'#export-scene',touch);const download=await downloadPromise;
  const exported=await readFile(await download.path());assert.deepEqual(JSON.parse(exported).state.parts,musicState(saved));
  await fieldAction(page,'bass','phase',touch);
  if(!await page.locator('#library').evaluate(e=>e.open))await click(page,'#open-library',touch);
  await page.locator('#scene-file').setInputFiles({name:'saved-machine.json',mimeType:'application/json',buffer:exported});await settled(page);await frame(page);
  assert.deepEqual(musicState(await state(page)),musicState(saved),'Downloaded creation imports exactly');
  await page.reload();await ready(page);assert.deepEqual(musicState(await state(page)),musicState(saved));assert.equal((await snapshot(page)).playing,false);

  await libraryAction(page,'#snapshot-b',touch);await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>machineApp.diagnostics().rms>.0001,{},{timeout:15000});
  await page.screenshot({path:join(output,`${run.engine}-${width}.png`)});
  const metrics=await measure(page);assert.equal(metrics.canvasCount,1);assert(!metrics.overflow);assert.equal(metrics.obsoleteUI,0);assert(!metrics.offscreenControls);assert(metrics.minControl>=44);
  assert(metrics.stage.width>=Math.min(300,width-40)&&metrics.stage.height>=250);assert(metrics.render.calls<800);assert(metrics.memory.textures<64);
  for(const p of(await state(page)).parts)if(p.installed)await fieldAction(page,p.key,'gain',touch);
  await settled(page);await page.waitForFunction(()=>machineApp.diagnostics().rms<.00001,{},{timeout:15000});
  const silent=await snapshot(page);assert.equal(silent.projection.events,0);assert.equal(silent.playing,true);await click(page,'#play',touch);await settled(page);
  await page.evaluate(async()=>{await Promise.all([machineApp.chooseSong('steel-shift'),machineApp.chooseSong('elise-after-hours')]);});await settled(page);assert.equal((await snapshot(page)).songId,'elise-after-hours');
  const catalogIds=await page.locator('#song-select option').evaluateAll(options=>options.map(o=>o.value));
  if(catalogIds.includes('your-turn')){await click(page,'#open-library',touch);await page.selectOption('#song-select','your-turn');await settled(page);assert.equal((await snapshot(page)).songId,'your-turn');}
  await click(page,'#play',touch);await settled(page);await page.waitForFunction(()=>machineApp.diagnostics().rms>.0001,{},{timeout:15000});await click(page,'#play',touch);await settled(page);
  await click(page,'#open-library',touch);await page.selectOption('#song-select','turkish-circuit');await settled(page);assert.equal((await snapshot(page)).songId,'turkish-circuit');
  report.cases.push({width,height,input:touch?'native CDP touch and taps':'mouse',allSixSelectable:true,physicalInstallPhaseVariant:true,directPhaseGainDrag:true,oneGestureOneUndo:true,nativeCancellation:touch,
    stoppedEditing:true,nativeAudio:true,snapshotAB:true,saveReload:true,jsonExportImport:true,allDisconnectedSilence:true,catalogSongs:catalogIds,rapidSongSelection:true,rms:audible.rms,peak:audible.peak,metrics});
  console.log(JSON.stringify({engine:run.engine,width,status:'PASS',calls:metrics.render.calls}));await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingResources,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{report.lastDiagnostics=await snapshot(page);await page.screenshot({path:join(output,`${run.engine}-failure.png`)});}catch{}throw e;}
finally{
 const html=await readFile(join(root,'machine/index.html'),'utf8'),base=html.match(/<base\s+href="([^"]+)"/)?.[1]||'./';
 const paths=[...new Set(['machine/index.html',...[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1].split('?')[0])])];report.sourceSha256={};
 for(const p of paths){try{const f=p==='machine/index.html'?join(root,p):resolve(root,'machine',base,p);report.sourceSha256[f.slice(root.length)]=createHash('sha256').update(await readFile(f)).digest('hex');}catch{}}
 await writeFile(join(output,`${run.engine}-${process.env.MACHINE_SIZE||'all'}-report.json`),JSON.stringify(report,null,2));await run.close();
}
