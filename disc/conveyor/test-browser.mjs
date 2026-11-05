/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBrowser} from '../../qa/modules/browser.mjs';

const output = process.env.BELT_QA_DIR || join(tmpdir(), 'biba-conveyor-qa');
await mkdir(output, {recursive:true});
const browser = await openBrowser();
const report = {engine:browser.engine, cases:[], errors:[], missing:[], physicalDevice:false};
let page, touch, cdp;

function frame() {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function press(locator) {
  if (touch) await locator.tap();
  else await locator.click();
  await frame();
}

async function tap({x,y}) {
  if (touch) await page.touchscreen.tap(x,y);
  else await page.mouse.click(x,y);
  await frame();
}

async function drag(from, to, cancel = false) {
  if (touch) {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{id:0,...from}]});
  } else {
    await page.mouse.move(from.x,from.y);
    await page.mouse.down();
  }
  for (let i=1;i<=8;i++) {
    const x = from.x+(to.x-from.x)*i/8, y = from.y+(to.y-from.y)*i/8;
    if (touch) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{id:0,x,y}]});
    else await page.mouse.move(x,y);
  }
  if (touch) await cdp.send('Input.dispatchTouchEvent', {type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  else await page.mouse.up();
  await frame();
}

async function ready() {
  await page.waitForFunction(() => !!window.conveyorTest?.ready);
  await page.evaluate(() => conveyorTest.ready);
  await page.locator('#play:enabled').waitFor({timeout:15000});
  await page.evaluate(async()=>{
    const ctx=strudel.getAudioContext();
    if(ctx.setSinkId)await ctx.setSinkId({type:'none'});
  });
  await frame();
}

const state = () => page.evaluate(() => conveyorTest.state());
async function part(key) {
  await press(page.locator('[data-part="'+key+'"]'));
}

async function screenshot(name) {
  await page.screenshot({path:join(output,name+'.png'),animations:'allow'});
}

const track = (score,key) => score.parts.find(p => p.key===key);
const speeds = [0.5,1,2];

async function checkSchedule(minimumEvents = 12) {
  await page.waitForFunction(count => {
    const transport=conveyorTest.transport;
    return transport.running && !transport.pending &&
      transport.log.filter(e=>e.type==='event' && e.revision===transport.active.id).length>=count;
  },minimumEvents,{timeout:12000});
  const result = await page.evaluate(() => {
    const t=conveyorTest.transport, score=t.active.meta.state;
    const names={kick:'kick',bass:'sawtooth',hook:'biba_grand_piano'};
    const scheduled=t.log.filter(e=>e.type==='event' && e.revision===t.active.id);
    const seen=new Set(), bad=[];
    let timingError=0;
    for(const e of scheduled){
      const p=score.parts.find(p=>names[p.key]===e.sound);
      const pitch=typeof e.note==='number'?e.note:strudel.noteToMidi(e.note);
      const step=p && ConveyorScore.stepAt(p,e.cycle);
      const resumed=t.log.some(log=>log.type==='continue-note' && log.revision===e.revision && log.cycle===e.cycle && log.sound===e.sound);
      const valid=p?.notes.some(note=>{
        if(note.pitch!==pitch)return false;
        const elapsed=(step-note.step+64)%64;
        return Math.min(elapsed,64-elapsed)<1e-5 || (resumed && elapsed<note.length);
      });
      if(!valid) bad.push({sound:e.sound,note:e.note,step,cycle:e.cycle,pitch,resumed});
      if(p)seen.add(p.key);
      timingError=Math.max(timingError,Math.abs(t.timeAt(e.cycle)-e.targetAudio));
    }
    return {checked:scheduled.length,bad,timingError,parts:[...seen].sort()};
  });
  assert.deepEqual(result.bad,[], 'Each sound must come from a tile at the reader in its own transmission');
  assert.ok(result.timingError<.0001,'Native attack time diverged from the audio clock');
  assert.deepEqual(result.parts,['bass','hook','kick']);
  return result;
}

async function signal() {
  return page.evaluate(async () => {
    const t=conveyorTest.transport;
    const buffer=new Float32Array(t.analyser.fftSize);
    let peak=0;
    for(let i=0;i<25;i++){
      await new Promise(requestAnimationFrame);
      t.analyser.getFloatTimeDomainData(buffer);
      for(const x of buffer)peak=Math.max(peak,Math.abs(x));
    }
    return peak;
  });
}

async function checkControls(width,height) {
  const ui = await page.evaluate(() => {
    const rect = element => {
      const {x,y,width,height}=element.getBoundingClientRect();
      return {x,y,width,height};
    };
    return {
      viewport:[innerWidth,innerHeight],
      pageWidth:document.documentElement.scrollWidth, pageHeight:document.documentElement.scrollHeight,
      play:rect(document.querySelector('#play')),undo:rect(document.querySelector('#undo')),
      tracks:[...document.querySelectorAll('[data-part]')].filter(e=>e.getBoundingClientRect().width).map(e=>e.dataset.part)
    };
  });
  assert.deepEqual(ui.viewport,[width,height]);
  assert.ok(ui.pageWidth<=width+1,'The instrument exceeds the viewport width');
  assert.ok(ui.play.width>=40 && ui.play.height>=38,'Transport is too small to operate');
  assert.ok(ui.undo.width>=32 && ui.undo.height>=32,'Undo is too small to operate');
  assert.deepEqual([...new Set(ui.tracks)].sort(),['bass','hook','kick']);
  return ui;
}

async function gear(rate) {
  const at=await page.locator('#machine [data-speed="'+rate+'"]').evaluate(el=>{
    const r=el.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height-11;
    if(document.elementFromPoint(x,y)?.closest('[data-speed]')!==el)throw Error('Gear control occluded');
    return {x,y};
  });
  // The stationary socket also accepts taps near its lower edge.
  await tap(at);
}
const bar = index => page.locator('#machine [data-bar="'+index+'"]');
const cellPoint = (step,pitch) => page.evaluate(([s,p])=>conveyorTest.cellPoint(s,p),[step,pitch]);
const notePoint = (id,kind='body') => page.evaluate(([id,k])=>conveyorTest.notePoint(id,k),[id,kind]);
const shiftedPoint=(origin,oldCell,newCell)=>({x:origin.x+newCell.x-oldCell.x,y:origin.y+newCell.y-oldCell.y});

async function editScore() {
  await part('hook'); await press(bar(0));
  const before=await state(), original=track(before,'hook');
  const pitches=[original.notes[0].pitch,original.notes[1].pitch];
  const at=await cellPoint(5,pitches[0]);
  // Sample the audition orbit throughout the click (also covers its asynchronous warm-up).
  await page.evaluate(() => { window.qaAudition=(async()=>{
    let peak=0;
    for (let i=0;i<45;i++){
      await new Promise(requestAnimationFrame);
      const meter=conveyorTest.auditionMeter();
      if(!meter)continue;
      const samples=new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(samples);
      for(const s of samples)peak=Math.max(peak,Math.abs(s));
    }
    return peak;
  })(); });
  await tap(at);
  const auditionPeak=await page.evaluate(()=>window.qaAudition);
  assert.ok(auditionPeak>.0001,'Attaching a tile on pause must sound the chosen instrument');
  assert.equal(await page.evaluate(()=>conveyorTest.transport.running),false);
  const added=track(await state(),'hook').notes.find(n=>!original.notes.some(p=>p.id===n.id));
  assert.ok(added,'Tap on empty conveyor cell must attach a tile');
  assert.equal(added.step,5);
  assert.equal(added.pitch,pitches[0]);

  const a=await cellPoint(added.step,added.pitch), b=await cellPoint(7,pitches[1]);
  let from=await notePoint(added.id);
  if (touch) {
    const last=await state();
    await drag(from,shiftedPoint(from,a,b),true);
    assert.deepEqual(await state(),last,'Cancelled drag must leave the note in place');
  }
  await drag(from,shiftedPoint(from,a,b));
  let tile=track(await state(),'hook').notes.find(n=>n.id===added.id);
  assert.equal(tile.step,7); assert.equal(tile.pitch,pitches[1]);
  const priorLength=tile.length;

  await tap(await notePoint(tile.id));
  from=await notePoint(tile.id,'length');
  const oldCell=await cellPoint(7,tile.pitch), newCell=await cellPoint(10,tile.pitch);
  await drag(from,shiftedPoint(from,oldCell,newCell));
  tile=track(await state(),'hook').notes.find(n=>n.id===added.id);
  assert.ok(tile.length>priorLength,'Dragging the end of the note must extend its duration');
  assert.equal(tile.step,7);assert.equal(tile.pitch,pitches[1]);

  const saved=await state();
  await press(page.locator('#machine [data-eject]'));
  await page.waitForFunction(id=>!conveyorTest.state().parts.find(p=>p.key==='hook').notes.some(n=>n.id===id),added.id,{timeout:1200});
  await press(page.locator('#undo'));
  assert.deepEqual(await state(),saved,'Undo must restore the deleted tile with its edited length');
  for(const key of ['kick','bass']) assert.deepEqual(track(saved,key),track(before,key));

  // Move a single tile across the folded four-bar strip using the physical page tabs.
  const tab=await bar(3).boundingBox();
  await drag(await notePoint(tile.id),{x:tab.x+tab.width/2,y:tab.y+tab.height/2});
  const moved=track(await state(),'hook').notes.find(n=>n.id===tile.id);
  assert.equal(moved.step,48+tile.step);
  assert.equal(moved.pitch,tile.pitch);
  await press(page.locator('#undo'));
  assert.deepEqual(await state(),saved);
  await press(bar(3));
  const lastNotes=track(saved,'hook').notes.filter(n=>n.step>=48);
  assert.ok(lastNotes.length>0);
  const witness=page.locator('#machine [data-note-id="'+lastNotes[0].id+'"]');
  assert.ok(await witness.isVisible(),'Fourth bar must expose its authored notes');
  await press(bar(0));
  return {id:tile.id,step:tile.step,pitch:tile.pitch,length:tile.length,auditionPeak};
}

async function checkRunningBelt() {
  // Capture the actual mechanical slot or moving tile under a held pointer.
  // The sound continues throughout this gesture and the belt advances several steps.
  const point=await page.evaluate(()=>{
    const drive=document.querySelector('.cv-drive'), head=drive.querySelector('[data-reader-line]');
    const x=head.x1.baseVal.value+conveyorTest.view().tileSpacing*1.4, y=head.y2.baseVal.value-13;
    const client=new DOMPoint(x,y).matrixTransform(drive.getScreenCTM());
    drive.addEventListener('pointerdown',event=>{
      const v=conveyorTest.view();
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(drive.getScreenCTM().inverse());
      window.qaLatch={id:event.target.closest('[data-running-id]')?.dataset.runningId,
        step:((Math.floor(v.step+(p.x-head.x1.baseVal.value)/v.tileSpacing)%64)+64)%64,
        time:v.step};
    },{capture:true,once:true});
    return {x:client.x,y:client.y};
  });
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,...point}]});
  else {await page.mouse.move(point.x,point.y);await page.mouse.down();}
  await page.waitForFunction(()=>window.qaLatch && (conveyorTest.view().step-window.qaLatch.time+64)%64>2);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await page.mouse.up();
  await frame();
  const result=await page.evaluate(()=>{
    const id=conveyorTest.view().selectedId, n=conveyorTest.state().parts.find(p=>p.key===conveyorTest.selected()).notes.find(n=>n.id===id);
    return {at:window.qaLatch,chosen:n?.id,step:n?.step,playing:conveyorTest.transport.running,bar:conveyorTest.bar()};
  });
  assert.ok(result.playing && result.chosen);
  if(result.at.id)assert.equal(result.chosen,result.at.id);
  else assert.equal(result.step,result.at.step);
  assert.equal(result.bar,Math.floor(result.step/16));
  return result;
}

async function runDevice(width,height,isTouch) {
  touch=isTouch;
  const context=await browser.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  page=await context.newPage();
  if (process.env.BELT_TRACE) await page.addInitScript(() => {
    window.beltTrace=[];
    for (const type of ['click','pointerdown','pointerup','pointercancel']) document.addEventListener(type,e=>{
      window.beltTrace.push({type,at:performance.now(),x:e.clientX,y:e.clientY,tag:e.target.tagName,data:{...e.target.dataset},parent:{...e.target.parentElement?.dataset}});
    },true);
  });
  page.on('pageerror',e=>report.errors.push(e.stack || e.message));
  page.on('response',r=>{if(r.status()>=400)report.missing.push([r.status(),r.url()]);});
  page.on('dialog',d=>d.dismiss());
  if(touch)cdp=await context.newCDPSession(page);
  await page.goto(browser.url+'/disc/conveyor/index.html');
  await ready();
  const item={width,height,input:touch?'CDP touch':'mouse',ui:await checkControls(width,height)};
  assert.deepEqual((await state()).parts.map(p=>p.notes.length),[16,24,35]);
  await screenshot(width+'-initial');
  item.edited=await editScore();
  await part('kick');
  for(const rate of speeds){
    await gear(rate); assert.equal(track(await state(),'kick').speed,rate);
  }
  const edited=await state();
  assert.equal(track(edited,'hook').speed,1);
  assert.equal(track(edited,'bass').speed,1);
  await page.reload();
  await ready();
  assert.deepEqual(await state(),edited,'Composition and gearing must survive a reload');
  await part('hook');
  await press(page.locator('#play'));
  item.schedule=await checkSchedule();
  item.peak=await signal();
  assert.ok(item.peak>.0001,'The transport did not produce a digital audio signal');
  const old=await page.evaluate(()=>conveyorTest.transport.active.meta.state);
  await gear(.5);
  await page.waitForFunction(()=>conveyorTest.transport.active?.meta.state.parts.find(p=>p.key==='hook').speed===.5);
  item.shift=await page.evaluate(old=>{
    const t=conveyorTest.transport;
    const p1=old.parts.find(p=>p.key==='hook'), p2=t.active.meta.state.parts.find(p=>p.key==='hook');
    const oldAt=ConveyorScore.stepAt(p1,t.active.begin), newAt=ConveyorScore.stepAt(p2,t.active.begin);
    return {boundary:t.active.begin,oldAt,newAt};
  },old);
  assert.ok(Math.abs(item.shift.oldAt-item.shift.newAt)<.0001,'Changing gears jumps to another tile');
  item.shiftedSchedule=await checkSchedule();
  item.visual=await visualPlayback();
  item.runningBelt=await checkRunningBelt();
  await screenshot(width+'-running');
  await press(page.locator('#play'));
  assert.equal(await page.evaluate(()=>conveyorTest.transport.running),false);
  report.cases.push(item);
  await context.close();
  console.log('PASS',width,JSON.stringify(item));
}

async function visualPlayback() {
  return page.evaluate(async()=>{
    const t=conveyorTest.transport, check={frames:0,litFrames:0,stepError:0,tilesChecked:0,pixelError:0};
    const cursorStart=conveyorTest.view().step;
    let moved=false;
    for(let i=0;i<90;i++){
      await new Promise(requestAnimationFrame);
      const view=conveyorTest.view();
      const p=t.active.meta.state.parts.find(p=>p.key===conveyorTest.selected());
      const expected=ConveyorScore.stepAt(p,t.clock()), diff=view.step-expected;
      check.stepError=Math.max(check.stepError,Math.abs(diff-64*Math.round(diff/64)));
      if(!view.playing || view.rate!==p.speed)throw Error('Displayed gear differs from the sounding part');
      const expectedNotes=p.notes.filter(n=>(view.step-n.step+64)%64<n.length).map(n=>n.id).sort();
      if(JSON.stringify([...view.activeIds].sort())!==JSON.stringify(expectedNotes))throw Error('Reader lamps do not match sounding notes');
      const head=document.querySelector('[data-reader-line]').x1.baseVal.value;
      for (const g of document.querySelectorAll('[data-running-id]')) {
        if (g.style.display==='none') continue;
        const n=p.notes.find(n=>n.id===g.dataset.runningId);
        const steps=((n.step-view.step+96)%64)-32;
        const measured=g.transform.baseVal.getItem(0).matrix.e;
        const error=measured-(head+steps*view.tileSpacing), cycleWidth=64*view.tileSpacing;
        check.pixelError=Math.max(check.pixelError,Math.abs(error-Math.round(error/cycleWidth)*cycleWidth));
        check.tilesChecked++;
      }
      if(view.activeIds.length)check.litFrames++;
      if(view.step!==cursorStart)moved=true;
      check.frames++;
    }
    // Allow a rendering frame between the sample and the corresponding audio time.
    if(!moved || check.stepError>1 || !check.litFrames || !check.tilesChecked || !(check.pixelError<.02))throw Error('Belt motion/reader failed: '+JSON.stringify(check));
    return check;
  });
}

try {
  for(const [width,height,touch] of [[1280,800,false],[390,844,true]]){
    if(process.env.BELT_WIDTH && Number(process.env.BELT_WIDTH)!==width)continue;
    await runDevice(width,height,touch);
  }
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.missing,[]);
  report.status='PASS';
} catch(error) {
  report.status='FAIL';
  report.failure=error.stack;
  if(page && !page.isClosed()){
    await screenshot('failure').catch(()=>{});
    report.last=await page.evaluate(()=>({state:window.conveyorTest?.state(),view:window.conveyorTest?.view(),body:document.body.innerText,trace:window.beltTrace})).catch(()=>null);
  }
  throw error;
} finally {
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
