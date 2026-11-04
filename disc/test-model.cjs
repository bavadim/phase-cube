/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {S,library}=require('../test-runtime.cjs'),Composition=require('../composition-contract.js'),M=require('./model.js'),Music=require('./music.js');
const round=n=>Math.round(n*1e8)/1e8;
const signature=(haps,offset=0)=>Array.from(haps,h=>JSON.stringify([round(Number(h.whole.begin)-offset),round(Number(h.duration)),h.value])).sort();
let fixture;
const get=()=>fixture??=(async()=>{const song=await library.load('turkish-circuit'),prepared=Music.prepare(S,song);return{song,prepared,engine:new Music.Engine(S,prepared)};})();

test('three explicit stems and every variant preserve original native notes, gates and patches',async()=>{
  const {song,prepared,engine}=await get();assert.deepEqual(prepared.modules.map(m=>m.key),['kick','bass','hook']);assert.equal(prepared.phaseSteps,32);assert.equal(prepared.baseFrom,8);
  assert.deepEqual(prepared.modules.map(m=>m.variants.length),[1,1,4]);
  const all=Composition.attacks(song.pattern,0,song.bars);
  for(const module of prepared.modules)for(const variant of module.variants){
    const expected=all.filter(h=>h.value._phaseCubePart===module.key&&Number(h.whole.begin)>=variant.sourceStart&&Number(h.whole.begin)<variant.sourceEnd);
    assert.deepEqual(signature(Composition.attacks(variant.pattern,0,4)),signature(expected,variant.sourceStart));
    assert.deepEqual(signature(Composition.attacks(variant.pattern,4,8),4),signature(expected,variant.sourceStart));
    assert(variant.events.every(e=>e.start>=0&&e.start<1&&e.duration>0));
  }
  const model=M.create(prepared.modules,{phaseSteps:prepared.phaseSteps});
  const expected=all.filter(h=>['kick','bass','hook'].includes(h.value._phaseCubePart)&&Number(h.whole.begin)>=8&&Number(h.whole.begin)<12);
  assert.deepEqual(signature(Composition.attacks(engine.pattern(model.snapshot()),0,4)),signature(expected,8));
  assert(model.snapshot().parts.every(p=>p.installed&&p.gain===1&&p.phase===0));
});

test('one revolution is identity; one grid step is an eighth note, not an eighth of the bar cycle',async()=>{
  const {prepared,engine}=await get(),model=M.create(prepared.modules,{phaseSteps:32}),original=model.snapshot(),sound=signature(Composition.attacks(engine.pattern(original),0,4));
  for(let i=0;i<32;i++){const p=model.snapshot().parts.find(p=>p.key==='hook');model.set('hook',{phase:p.phase+1/32});}
  assert.deepEqual(model.snapshot(),original);assert.deepEqual(signature(Composition.attacks(engine.pattern(model.snapshot()),0,4)),sound);
  model.set('hook',{phase:1/32});
  const expected=prepared.modules[2].variants[0].pattern.late(1/8);
  assert.deepEqual(signature(Composition.attacks(engine.project(model.snapshot()).patterns[2],0,4)),signature(Composition.attacks(expected,0,4)));
  const raw=original;raw.parts[2].phase=.101234;raw.parts[2].gain=.67891;
  const continuous=model.normalize(raw,{snap:false});assert(Math.abs(continuous.parts[2].phase-.101234)<1e-10);assert.equal(continuous.parts[2].gain,.67891);
  assert.equal(model.normalize(raw).parts[2].phase,3/32);
});

test('editing one disc leaves the other voices unchanged; rhythmic symmetry is not harmonic symmetry',async()=>{
  const {prepared,engine}=await get(),model=M.create(prepared.modules,{phaseSteps:32}),before=engine.rows(model.snapshot());
  model.set('bass',{phase:.25,gain:.5});const after=engine.rows(model.snapshot());
  assert.deepEqual(after[0],before[0]);assert.deepEqual(after[2],before[2]);
  const expected=prepared.modules[1].variants[0].pattern.late(1).withValue(v=>({...v,postgain:(v.postgain??1)*.5}));
  assert.deepEqual(signature(Composition.attacks(engine.project(model.snapshot()).patterns[1],0,4)),signature(Composition.attacks(expected,0,4)));
  model.set('bass',{gain:1});
  const shifted=engine.rows(model.snapshot())[1];
  assert.deepEqual(shifted.map(e=>round(e.start)),before[1].map(e=>round(e.start)),'Bass rhythm repeats every bar');
  assert.notDeepEqual(shifted.map(e=>e.pitch),before[1].map(e=>e.pitch),'Bass notes still follow a four-bar progression');
  model.undo();model.undo();assert.deepEqual(engine.rows(model.snapshot()),before);
});

test('muting retains exact visual geometry and all muted discs produce silence',async()=>{
  const {prepared,engine}=await get(),model=M.create(prepared.modules,{phaseSteps:32}),before=engine.rows(model.snapshot());
  for(const module of prepared.modules)model.set(module.key,{installed:false});
  const muted=engine.rows(model.snapshot());
  assert.deepEqual(muted.map(row=>row.map(e=>[e.start,e.duration,e.pitch])),before.map(row=>row.map(e=>[e.start,e.duration,e.pitch])));
  assert(muted.flat().every(e=>e.audible===false&&e.volume===0&&e.gain===0));
  assert.equal(Composition.attacks(engine.pattern(model.snapshot()),0,8).length,0);
  model.set('hook',{installed:true,gain:0});assert.equal(engine.rows(model.snapshot())[2].length,before[2].length);assert.equal(Composition.attacks(engine.pattern(model.snapshot()),0,4).length,0);
  model.set('hook',{gain:99});assert.equal(model.snapshot().parts[2].gain,2);model.undo();assert.equal(model.snapshot().parts[2].gain,0);
  assert.throws(()=>model.normalize({...model.snapshot(),phaseSteps:8}),/сохранение/);
});

test('native clip is applied once and sustained gates survive the loop seam',()=>{
  const source=S.note('c4 e4').s('sine').clip(.5),haps=Composition.attacks(source,0,1),loop=Music.loopHaps(S,haps,0,1);
  assert.deepEqual(signature(Composition.attacks(loop,0,3)),signature(Composition.attacks(source,0,3)));
  const held=S.note('c4').s('sine').slow(2),repeated=Music.loopHaps(S,Composition.attacks(held,0,1),0,1),overlapping=repeated.queryArc(1.25,1.5);
  assert.equal(overlapping.length,2);assert(overlapping.every(h=>Number(h.whole.end)-Number(h.whole.begin)===2));
});
