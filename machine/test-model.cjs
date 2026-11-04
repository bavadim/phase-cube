/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{pathToFileURL}=require('node:url');
const Model=require('./model.js'),Music=require('./music.js'),Composition=require('../composition-contract.js');
const root=path.resolve(__dirname,'..'),context={window:{addEventListener(){}},document:{addEventListener(){}},console:{log(){},warn:console.warn,error:console.error},performance,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,URL,Blob};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'vendor/strudel-web-1.3.0.js'),'utf8'),context);const S=context.strudel;S.miniAllStrings();
const {Loader}=require('../composition-loader.js'),loader=new Loader(S,{baseURL:pathToFileURL(root+'/')});
const fixtures=Music.ROLES.map(m=>({...m,available:true,variants:[{},{}]}));
const round=x=>Math.round(x*1e8)/1e8;
const signature=(haps,offset=0)=>Array.from(haps,h=>JSON.stringify([round(Number(h.whole.begin)-offset),round(Number(h.duration)),h.value])).sort();

test('creative state supports bounded editing, exact undo and normalized persisted state without any target',()=>{
  const m=Model.create(fixtures),initial=m.snapshot();
  assert.deepEqual(initial.parts.filter(p=>p.installed).map(p=>p.key),['pulse','bass']);
  assert.equal(m.solved,undefined);assert.equal(m.hint,undefined);
  assert.equal(m.set('bass',{phase:.26,gain:8,variant:99}),true);
  assert.deepEqual(m.snapshot().parts[1],{key:'bass',installed:true,phase:.25,gain:1.5,variant:1});
  assert.equal(m.set('bass',{phase:.25,gain:1.5,variant:1}),false,'No duplicate undo for unchanged values');
  assert.equal(m.history.length,1);assert.equal(m.undo(),true);assert.deepEqual(m.snapshot(),initial);
  assert.equal(m.toggle('bass'),true);assert.equal(m.snapshot().parts[1].installed,false);assert.equal(m.undo(),true);
  const foreign={schema:Model.SCHEMA,version:1,parts:[{key:'bass',installed:true,phase:-.125,gain:NaN,variant:-2},{key:'alien',installed:true}]};
  m.restore(foreign,{record:false});
  assert.deepEqual(m.snapshot().parts[1],{key:'bass',installed:true,phase:.875,gain:1,variant:0});
  assert.equal(m.snapshot().parts.length,6);assert.equal(m.history.length,0);assert.equal(m.select('alien'),false);
  assert.throws(()=>m.restore({parts:[]}),/сохранение/);
});

test('every score is partitioned into six roles and excerpts preserve native notes, gates and sound patches',async()=>{
  for(const id of require('../compositions/catalog.js')){
    const song=await loader.load(id),prepared=Music.prepare(S,song),engine=new Music.Engine(S,prepared),model=Model.create(prepared.modules);
    assert.equal(prepared.modules.length,6);assert.equal(prepared.sourceAttackCount,song.stats.attacks);
    const all=Composition.attacks(song.pattern,0,song.bars),sourceKeys=[...new Set(all.map(h=>String(h.value._phaseCubePart??h.value.s)))].sort();
    assert.deepEqual([...new Set(prepared.modules.flatMap(m=>m.sources))].sort(),sourceKeys,'No invisible backing instrument');
    for(const module of prepared.modules){
      assert.equal(module.available,module.variants.length>0);
      for(const variant of module.variants){
        const expected=all.filter(h=>Music.roleOf(h.value)===module.key&&Number(h.whole.begin)>=variant.sourceStart&&Number(h.whole.begin)<variant.sourceStart+song.periodBars);
        const actual=Composition.attacks(variant.pattern,0,song.periodBars);
        assert.deepEqual(signature(actual),signature(expected,variant.sourceStart),id+'/'+module.key+'/'+variant.id);
        assert.deepEqual(signature(Composition.attacks(variant.pattern,song.periodBars,song.periodBars*2),song.periodBars),signature(actual),'Loop repeats source faithfully');
      }
      if(module.baseVariant>=0)model.set(module.key,{installed:true,variant:module.baseVariant});else model.set(module.key,{installed:false});
    }
    const expected=Composition.attacks(song.pattern,prepared.baseFrom,prepared.baseFrom+song.periodBars);
    assert.deepEqual(signature(Composition.attacks(engine.pattern(model.snapshot()),0,song.periodBars)),signature(expected,prepared.baseFrom),'All on at zero displacement equals the source passage');
    for(const module of prepared.modules)model.set(module.key,{installed:false});
    assert.equal(Composition.attacks(engine.pattern(model.snapshot()),0,song.periodBars*2).length,0,'Removing every module really silences the song');
    assert.equal(engine.diagnostics(model.snapshot()).uncontrolledBacking,false);
  }
});

test('phase changes only selected role; gain multiplies native postgain and row positions follow audio',async()=>{
  const song=await loader.load('turkish-circuit'),prepared=Music.prepare(S,song),engine=new Music.Engine(S,prepared),model=Model.create(prepared.modules);
  for(const module of prepared.modules)model.set(module.key,{installed:true});
  const initial=model.snapshot(),before=engine.rows(initial);model.set('bass',{phase:.25,gain:.5});
  const state=model.snapshot(),after=engine.rows(state);
  for(let i=0;i<prepared.modules.length;i++)if(prepared.modules[i].key!=='bass')assert.deepEqual(after[i],before[i]);
  const index=prepared.modules.findIndex(m=>m.key==='bass'),variant=prepared.modules[index].variants[0],expected=variant.pattern.late(.25).withValue(v=>({...v,postgain:(v.postgain??1)*.5}));
  assert.deepEqual(signature(Composition.attacks(engine.project(state).patterns[index],0,song.periodBars)),signature(Composition.attacks(expected,0,song.periodBars)));
  assert.deepEqual(after[index].map(e=>round(e.start)),Composition.attacks(expected,0,song.periodBars).map(h=>round(Number(h.whole.begin)/song.periodBars)).sort((a,b)=>a-b));
  assert.deepEqual(engine.rows(initial),before,'Projection must not mutate source rows or previous snapshots');
});

test('native whole spans survive duration/clip and long notes crossing the loop seam',()=>{
  const source=S.note('c4 e4').s('sine').clip(.5),haps=Composition.attacks(source,0,1),loop=Music.loopHaps(S,haps,0,1);
  assert.deepEqual(signature(Composition.attacks(loop,0,3)),signature(Composition.attacks(source,0,3)));
  const held=S.note('c4').s('sine').slow(2),heldHaps=Composition.attacks(held,0,1),repeated=Music.loopHaps(S,heldHaps,0,1);
  const overlapping=repeated.queryArc(1.25,1.5);
  assert.equal(overlapping.length,2,'Previous cycle sustain overlaps next attack instead of being truncated');
  assert(overlapping.every(h=>Number(h.whole.end)-Number(h.whole.begin)===2));
});
