/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBrowser} from '../../qa/modules/browser.mjs';

const output = process.env.BOXES_QA_DIR || join(tmpdir(), 'biba-boxes-qa');
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

const mode = name => press(page.locator('[data-representation="'+name+'"]'));
const bar = index => press(page.locator('[data-bar="'+index+'"]').first());
const cellPoint = step => page.evaluate(s=>conveyorTest.cellPoint(s),step);
const notePoint = (id,kind='body') => page.evaluate(([id,k])=>conveyorTest.notePoint(id,k),[id,kind]);
const note = (score,key,id) => track(score,key).notes.find(n=>n.id===id);
const boxTools = () => page.locator('[data-box-tools]');
const changeField = (field,direction) => press(boxTools().locator('[data-field="'+field+'"][data-delta="'+direction+'"]'));

async function gear(rate) {
  const socket=page.locator('#machine [data-speed="'+rate+'"]:visible').first();
  await press(socket);
}
async function inspectBox(id) {
  return page.evaluate(id=>{
    const group=[...document.querySelectorAll('[data-crate-id]')].find(el=>el.dataset.crateId===id && el.checkVisibility() && el.getBoundingClientRect().width);
    if (!group) throw Error('Cannot see crate '+id);
    const face=group.querySelector('[data-face="front"]'), b=face.getBBox();
    const fill=getComputedStyle(face).fill;
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.fillStyle=fill;
    return {width:b.width,height:b.height,color:ctx.fillStyle};
  },id);
}
async function inspector() {
  if(!await boxTools().isVisible()) await press(page.locator('[data-edit-box]'));
}
async function saveLegacyAndReload() {
  const before=await state();
  const raw=await page.evaluate(fresh=>{
    const legacy=JSON.parse(JSON.stringify(fresh));
    for(const p of legacy.parts){ delete p.phase; delete p.level; for(const n of p.notes)delete n.gain; }
    const hook=legacy.parts.find(p=>p.key==='hook');
    hook.notes[0].length=2.375;
    localStorage.setItem('biba.conveyor.turkish-circuit.v1',JSON.stringify({selected:'hook',bar:0,state:legacy}));
    return legacy;
  },before);
  await page.reload();
  await ready();
  const migrated=await state();
  for(const p of raw.parts){
    const current=track(migrated,p.key);
    assert.equal(current.phase,0);
    assert.equal(current.level,1);
    assert.equal(current.notes.length,p.notes.length);
    for(const n of p.notes){
      const saved=note(migrated,p.key,n.id);
      assert.ok(Number.isFinite(saved.gain) && saved.gain>=0 && saved.gain<=2);
      assert.deepEqual({...saved,gain:undefined},{...n,gain:undefined});
    }
  }
  return migrated;
}

async function monitorAudition(action) {
  await page.evaluate(()=>{
    window.qaAudition=(async()=>{
      let peak=0;
      for(let i=0;i<55;i++){
        await new Promise(requestAnimationFrame);
        const meter=conveyorTest.auditionMeter();
        if(!meter)continue;
        const samples=new Float32Array(meter.fftSize);
        meter.getFloatTimeDomainData(samples);
        for(const s of samples)peak=Math.max(peak,Math.abs(s));
      }
      return peak;
    })();
  });
  await action();
  return page.evaluate(()=>window.qaAudition);
}

async function checkParallelLanes() {
  const initial=await state();
  const [lead,neighbour]=track(initial,'hook').notes;
  assert.ok(lead.step+lead.length<=neighbour.step);
  const before=await inspectBox(neighbour.id);
  await tap(await notePoint(lead.id));
  const handle=await notePoint(lead.id,'length');
  const spacing=(await cellPoint(1)).x-(await cellPoint(0)).x;
  await drag(handle,{x:handle.x+2*spacing,y:handle.y});
  const stateWithOverlap=await state();
  const elongated=note(stateWithOverlap,'hook',lead.id);
  assert.ok(elongated.step+elongated.length>neighbour.step,'Second rail must now carry simultaneous notes');
  assert.deepEqual(note(stateWithOverlap,'hook',neighbour.id),neighbour);
  const polyphonic=await inspectBox(neighbour.id);
  assert.ok(Math.abs(polyphonic.height-before.height)<1e-3,
    'A neighbour taking another rail must not change the height scale of its boxes');
  await press(page.locator('#undo'));
  assert.deepEqual(await state(),initial);
  const restored=await inspectBox(neighbour.id);
  assert.equal(restored.height,before.height);
  return {heightBefore:before.height,heightWithOverlap:polyphonic.height,heightAfter:restored.height};
}

async function exerciseCrate() {
  const before=await state(), original=track(before,'hook');
  const clear=Array.from({length:16},(_,i)=>i).filter(s=>!original.notes.some(n=>n.step===s));
  assert.ok(clear.length>=2);
  const first=clear[0], second=clear[1];
  const at=await cellPoint(first);
  const peak=await monitorAudition(()=>tap(at));
  assert.ok(peak>.0001,'A placed box must audition its sampled note');
  const added=track(await state(),'hook').notes.find(n=>!original.notes.some(old=>old.id===n.id));
  assert.ok(added, 'Tapping the tread should attach a box');
  assert.equal(added.step,first);
  assert.equal(await page.evaluate(()=>conveyorTest.transport.running),false);
  const id=added.id;
  const originalBox=await inspectBox(id);
  let pos=await notePoint(id), d=(await cellPoint(second)).x-at.x;
  if(touch){
    const saved=await state();
    await drag(pos,{x:pos.x+d,y:pos.y},true);
    assert.deepEqual(await state(),saved,'Cancelled drag must leave the note in place');
  }
  await drag(pos,{x:pos.x+d,y:pos.y});
  let current=note(await state(),'hook',id);
  assert.equal(current.step,second);
  assert.equal(current.pitch,added.pitch);
  assert.equal(current.gain,added.gain);
  const beforeLift=await inspectBox(id);
  pos=await notePoint(id,'body');
  const up=current.gain>1.35?35:-35;
  await drag(pos,{x:pos.x,y:pos.y+up});
  let lifted=note(await state(),'hook',id);
  assert.ok((lifted.gain-current.gain)*up<0,'Higher physical boxes should play louder');
  assert.equal(lifted.step,second);
  const afterLift=await inspectBox(id);
  const louder=await monitorAudition(async()=>tap(await notePoint(id)));
  assert.ok(louder>0 && peak>0);
  // Same piano patch, pitch and note length; only this box's velocity changed.
  const amplitudeRatio=louder/peak, gainRatio=lifted.gain/added.gain;
  assert.ok(Math.abs(amplitudeRatio-gainRatio)<.14*gainRatio,
    'Measured amplitude does not follow box height: '+JSON.stringify({peak,louder,amplitudeRatio,gainRatio}));
  assert.ok((afterLift.height-beforeLift.height)*up<0);
  assert.equal(afterLift.color,beforeLift.color);
  assert.equal(afterLift.width,beforeLift.width);

  pos=await notePoint(id,'length');
  const cellWidth=(await cellPoint(2)).x-(await cellPoint(1)).x;
  await drag(pos,{x:pos.x+2*cellWidth,y:pos.y});
  current=note(await state(),'hook',id);
  assert.ok(current.length>added.length);
  let changed=await inspectBox(id);
  assert.ok(changed.width>afterLift.width);
  assert.equal(changed.height,afterLift.height);
  assert.equal(changed.color,afterLift.color);

  await inspector();
  const target=(current.pitch+1)%12;
  await press(boxTools().locator('[data-pitch="'+target+'"]'));
  current=note(await state(),'hook',id);
  assert.equal(current.pitch%12,target);
  changed=await inspectBox(id);
  assert.notEqual(changed.color,originalBox.color,'A semitone should change the box colour');
  await inspector();
  const prevPitch=current.pitch;
  await press(boxTools().locator('[data-octave="1"]'));
  current=note(await state(),'hook',id);
  assert.equal(current.pitch,prevPitch+12);
  assert.equal((await inspectBox(id)).color,changed.color,'Octaves share a pitch-class colour');
  await inspector();
  await changeField('gain',current.gain<1.9?1:-1);
  assert.notEqual(note(await state(),'hook',id).gain,current.gain);
  const saved=await state();
  await inspector();
  await press(page.locator('[data-eject]:visible').first());
  assert.ok(!note(await state(),'hook',id));
  await press(page.locator('#undo'));assert.deepEqual(await state(),saved);
  for(const key of ['kick','bass'])assert.deepEqual(track(saved,key),track(before,key));
  return {id,peak,louder,amplitudeRatio,gainRatio,gain:lifted.gain,length:current.length,pitch:current.pitch};
}

async function exerciseCog(id) {
  const previous=await state();
  await mode('gear');
  assert.deepEqual(await state(),previous,'Representation must not change music');
  const pos=await notePoint(id);
  await tap(pos);
  assert.equal(await page.evaluate(()=>conveyorTest.view().selectedId),id);
  const p=await page.evaluate(()=>{
    const cog=conveyorTest.component();
    return {start:cog.phasePoint(.12),end:cog.phasePoint(.245),hub:cog.hubPoint()};
  });
  await drag(p.start,p.end);
  const afterPhase=await state();
  const original=track(previous,'hook'), shifted=track(afterPhase,'hook');
  const delta=(shifted.phase-original.phase+64)%64;
  assert.ok(Math.abs(delta-8)<=1,'Dragging one eighth turn must delay a sample by eight sixteenths, got '+delta);
  assert.deepEqual(shifted.notes,original.notes);
  assert.equal(shifted.level,original.level);
  await drag(p.hub,{x:p.hub.x,y:p.hub.y-32});
  const after=await state();
  const enhanced=track(after,'hook');
  assert.ok(enhanced.level>original.level);
  assert.deepEqual(enhanced.notes,original.notes);
  for(const key of ['kick','bass'])assert.deepEqual(track(after,key),track(previous,key));
  await mode('belt');
  assert.deepEqual(await state(),after);
  await mode('gear');
  await screenshot('gear-'+(await page.viewportSize()).width);
  await part('bass');
  assert.equal(await page.locator('[data-representation="belt"]').getAttribute('aria-pressed'),'true');
  await part('hook');
  assert.equal(await page.locator('[data-representation="gear"]').getAttribute('aria-pressed'),'true');
  await page.reload();await ready();
  assert.deepEqual(await state(),after);
  assert.equal(await page.locator('[data-representation="gear"]').getAttribute('aria-pressed'),'true');
  return {phase:enhanced.phase,level:enhanced.level};
}

async function movingBoxes() {
  return page.evaluate(async()=>{
    const t=conveyorTest.transport;
    const evidence={frames:0,visible:0,cycles:0,pixelError:0,clockError:0};
    const first=conveyorTest.view().step;
    for(let i=0;i<50;i++){
      await new Promise(requestAnimationFrame);
      const v=conveyorTest.view();
      const p=t.active.meta.state.parts.find(p=>p.key===conveyorTest.selected());
      const expected=ConveyorScore.stepAt(p,t.clock());
      const delta=v.step-expected;
      evidence.clockError=Math.max(evidence.clockError,Math.abs(delta-64*Math.round(delta/64)));
      const beam=document.querySelector('[data-reader-line]');
      const head=new DOMPoint(beam.x1.baseVal.value,0).matrixTransform(beam.getCTM()).x;
      for(const group of document.querySelectorAll('[data-crate-id]')){
        if(group.style.display==='none')continue;
        const n=p.notes.find(note=>note.id===group.dataset.crateId);
        const measured=new DOMPoint(0,0).matrixTransform(group.getCTM()).x-head;
        const rootScale=beam.closest('svg').getCTM().a;
        const error=measured-(n.step-v.step)*v.tileSpacing*rootScale;
        const size=64*v.tileSpacing*rootScale;
        evidence.pixelError=Math.max(evidence.pixelError,Math.abs(error-size*Math.round(error/size)));
        evidence.visible++;
      }
      evidence.frames++;
    }
    evidence.cycles=(conveyorTest.view().step-first+64)%64;
    if(evidence.cycles===0 || evidence.clockError>1 || evidence.visible<1 || evidence.pixelError>.1)
      throw Error('Audio clock and box geometry disagree '+JSON.stringify(evidence));
    return evidence;
  });
}

async function runningTap() {
  const at=await page.evaluate(()=>{
    const c=conveyorTest.component(),v=conveyorTest.view();
    const p=conveyorTest.state().parts.find(p=>p.key===conveyorTest.selected());
    for(const n of p.notes) {
      const distance=(n.step-v.origin+64)%64;
      if(distance<2||distance>14)continue;
      const at=c.notePoint(n.id), hit=at && document.elementFromPoint(at.x,at.y);
      if(!hit?.closest('[data-crate-id]'))continue;
      document.querySelector('.crate-belt').addEventListener('pointerdown',e=>{
        window.qaHeld={id:e.target.closest('[data-crate-id]')?.dataset.crateId, step:conveyorTest.view().step};
      },{capture:true,once:true});
      return at;
    }
    throw Error('No visible box to pick');
  });
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,...at}]});
  else{await page.mouse.move(at.x,at.y);await page.mouse.down();}
  await page.waitForFunction(()=>window.qaHeld?.id && (conveyorTest.view().step-qaHeld.step+64)%64>2);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await page.mouse.up();
  await frame();
  const held=await page.evaluate(()=>({...qaHeld,selected:conveyorTest.view().selectedId,playing:conveyorTest.transport.running}));
  assert.equal(held.id,held.selected);
  assert.equal(held.playing,true);
  return held;
}

async function runDevice(width,height,isTouch) {
  touch=isTouch;
  const context=await browser.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.stack || e.message));
  page.on('response',r=>{if(r.status()>=400)report.missing.push([r.status(),r.url()]);});
  if(touch)cdp=await context.newCDPSession(page);
  await page.goto(browser.url+'/disc/conveyor/index.html');
  await ready();
  await screenshot('belt-'+width);
  const rails=await checkParallelLanes();
  const initial=await saveLegacyAndReload();
  const result={width,height,input:touch?'CDP touch':'mouse',ui:await checkControls(width,height)};
  assert.deepEqual(initial.parts.map(p=>p.notes.length),[16,24,35]);
  assert.equal(await page.locator('.cv-grid,.cv-cassette').count(),0);
  result.rails=rails;
  result.crate=await exerciseCrate();
  result.gear=await exerciseCog(result.crate.id);
  await mode('belt');
  await press(page.locator('#play'));
  await page.waitForFunction(()=>conveyorTest.transport.running);
  result.schedule=await checkSchedule();
  result.peak=await signal();
  assert.ok(result.peak>.0001);
  const startRevision=await page.evaluate(()=>conveyorTest.transport.active.id);
  await mode('gear');
  await page.waitForFunction(()=>conveyorTest.view().playing);
  assert.equal(await page.evaluate(()=>conveyorTest.transport.active.id),startRevision);
  const pair=await page.evaluate(()=>{
    const c=conveyorTest.component();
    return [c.phasePoint(.12),c.phasePoint(.1825)];
  });
  await drag(...pair);
  const requested=track(await state(),'hook').phase;
  assert.equal((requested-result.gear.phase+64)%64,4);
  await page.waitForFunction(phase=>
    conveyorTest.transport.active.meta.state.parts.find(p=>p.key==='hook').phase===phase,requested);
  result.livePhase=requested;
  await mode('belt');
  const old=await page.evaluate(()=>({id:conveyorTest.transport.active.id,state:conveyorTest.transport.active.meta.state}));
  await gear(.5);
  await page.waitForFunction(()=>conveyorTest.transport.active?.meta.state.parts.find(p=>p.key==='hook').speed===.5);
  result.speed=await page.evaluate(old=>{
    const t=conveyorTest.transport;
    const p1=old.state.parts.find(p=>p.key==='hook'),p2=t.active.meta.state.parts.find(p=>p.key==='hook');
    return {at:t.active.begin,before:ConveyorScore.stepAt(p1,t.active.begin),after:ConveyorScore.stepAt(p2,t.active.begin)};
  },old);
  const delta=result.speed.after-result.speed.before;
  assert.ok(Math.abs(delta-64*Math.round(delta/64))<1e-5,'Shifting speed should keep the sample phase continuous');
  result.shiftedSchedule=await checkSchedule();
  result.visual=await movingBoxes();
  result.livePick=await runningTap();
  await press(page.locator('#play'));
  assert.equal(await page.evaluate(()=>conveyorTest.transport.running),false);
  report.cases.push(result);
  await context.close();
  console.log('PASS',width,JSON.stringify(result));
}
try {
  for(const [width,height,touch] of [[1280,800,false],[390,844,true]]){
    if(process.env.BOXES_WIDTH && Number(process.env.BOXES_WIDTH)!==width)continue;
    await runDevice(width,height,touch);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
  report.status='PASS';
} catch(error){
  report.status='FAIL';report.failure=error.stack;
  if(page && !page.isClosed()){
    await screenshot('failure').catch(()=>{});
    report.last=await page.evaluate(()=>({state:window.conveyorTest?.state(),view:window.conveyorTest?.view(),body:document.body.innerText})).catch(()=>null);
  }
  throw error;
} finally {
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
