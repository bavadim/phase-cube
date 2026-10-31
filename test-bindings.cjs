/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {S,Phases,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),Contract=require('./puzzle-contract.js'),Parts=require('./controls/pattern-pieces.js'),L=require('./composition-loader.js');
const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const loader=new Loader(S,{palette,registry,library,storage}),prepared=new Map();
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)])));
test('every composition/puzzle: native Strudel, inverses, targets, deterministic bindings and discrimination',async()=>{
 const report={schema:'music-puzzle-contracts/1',acousticAcceptance:'unverified',pairs:[]};
 for(const puzzleId of ['twiddle','rubik'])for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
  const p=await loader.prepareSession({songId,puzzleId}),music=new Music(S,p),m=p.model;prepared.set(puzzleId+'/'+songId,p);
  assert(Phases.validateTable(p.phaseMap,p.module.manifest));assert(Object.isFrozen(p.phaseMap.poseTicks));assert.equal(p.diagnostics.acousticAcceptance,'unverified');
  const goal=m.initialState();assert(music.phases(goal).every(v=>v.ticks===0));assert.equal(norm(music.rows(goal)),norm(p.fragments.targetRows));
  const before=m.snapshot();
  for(const move of m.legalMoves(goal)){
   const next=m.applyTo(goal,move),back=m.applyTo(next,m.inverse(move));assert.deepEqual(back,goal);assert.equal(norm(music.rows(back)),norm(p.fragments.targetRows));
   const phases=music.phases(next),rows=music.rows(next);
   p.fragments.targetRows.forEach((row,id)=>{
    const expected=row.map(e=>Math.round(((e.start+phases[id].offset)%1)*1e8)).sort((a,b)=>a-b);
    assert.deepEqual(rows[id].map(e=>Math.round(e.start*1e8)).sort((a,b)=>a-b),expected,'Symbolic shifts must agree with actual Strudel scheduling');
   });
   let cycle=goal;for(let i=0;i<4;i++)cycle=m.applyTo(cycle,move);assert.deepEqual(cycle,goal);
  }
  assert.deepEqual(m.snapshot(),before,'Pure projections must not mutate the playable model');
  for(const state of m.goalStates?.()||[goal])assert(music.phases(state).every(v=>v.ticks===0),'Every accepted goal plays the same author score');
  const again=await loader.prepareSession({songId,puzzleId});assert.equal(again.diagnostics.cache,'hit');assert.deepEqual(again.phaseMap.poseTicks,p.phaseMap.poseTicks);
  assert.equal(p.diagnostics.coverage,puzzleId==='twiddle'?'complete':'sampled');
  report.pairs.push({puzzleId,songId,gridSteps:p.phaseMap.gridSteps,poseTicks:p.phaseMap.poseTicks,...p.diagnostics,cacheFingerprint:p.phaseMap.fingerprint});
 }
 const mozart=prepared.get('twiddle/turkish-circuit');assert.equal(mozart.diagnostics.distinctRhythms,120);assert.equal(mozart.diagnostics.unsolvedGoalRhythmAliases,0);assert.equal(mozart.diagnostics.silentMoves,0);
 fs.mkdirSync(path.join(__dirname,'qa/contracts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/contracts/report.json'),JSON.stringify(report,null,2)+'\n');
});
test('cache survives a fresh loader; changed notes or pose contract invalidate it',async()=>{
 const fresh=new Loader(S,{palette,registry,library,storage});const first=await fresh.prepareSession({songId:'turkish-circuit',puzzleId:'twiddle'});assert.equal(first.diagnostics.cache,'hit');
 const changedLibrary={load:async id=>{const song=await library.load(id);return {...song,playerParts:song.playerParts.map((p,i)=>i? p:{...p,pattern:p.pattern.note('c3')})};}};
 const notes=await new Loader(S,{palette,registry,library:changedLibrary,storage}).prepareSession({songId:'turkish-circuit',puzzleId:'twiddle'});assert.notEqual(notes.phaseMap.fingerprint,first.phaseMap.fingerprint);assert.equal(notes.diagnostics.cache,'miss');
 const changedRegistry={get:id=>{const p=registry.get(id);return {...p,manifest:{...p.manifest,version:p.manifest.version+1}};}};
 const rules=await new Loader(S,{palette,registry:changedRegistry,library,storage}).prepareSession({songId:'turkish-circuit',puzzleId:'twiddle'});assert.notEqual(rules.phaseMap.fingerprint,first.phaseMap.fingerprint);assert.equal(rules.diagnostics.cache,'miss');
 // A malformed persisted table is ignored, not played.
 const entries=JSON.parse([...store.values()][0]);const item=entries.find(e=>e.key===first.phaseMap.fingerprint);item.binding.poseTicks.fill(0);store.set([...store.keys()][0],JSON.stringify(entries));
 const recovered=await new Loader(S,{palette,registry,library,storage}).prepareSession({songId:'turkish-circuit',puzzleId:'twiddle'});assert.equal(recovered.diagnostics.cache,'miss');assert.deepEqual(recovered.phaseMap.poseTicks,first.phaseMap.poseTicks);
});
test('same inputs deterministically select the same phases; cancellation does not cache partial work',async()=>{
 const cold=await new Loader(S,{palette,registry,library,storage:null}).prepareSession({songId:'turkish-circuit',puzzleId:'twiddle'});
 assert.deepEqual(cold.phaseMap.poseTicks,prepared.get('twiddle/turkish-circuit').phaseMap.poseTicks);
 const controller=new AbortController(),cancelLoader=new Loader(S,{palette,registry,library,storage:null});
 await assert.rejects(()=>cancelLoader.prepareSession({songId:'turkish-circuit',puzzleId:'twiddle',signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.equal(cancelLoader.bindings.size,0);
});
test('composer groups stay intact; incompatible groups and unsupported contracts fail explicitly',async()=>{
 const base=await library.load('turkish-circuit'),pattern=S.note('c4 d4 e4 f4 g4 a4 b4 c5').slow(4).duration(.1);
 const part={key:'phrase',name:'Фразы',pattern,groups:[{onsetsBeats:[0,4]},{onsetsBeats:[2,6]},{onsetsBeats:[8,12]},{onsetsBeats:[10,14]}]};
 const song=L.analyze(S,{...base,playerParts:[part]},'groups');const game=Parts.build(S,song,{count:2,palette});
 for(const group of part.groups){const owners=group.onsetsBeats.map(at=>game.targetRows.findIndex(row=>row.some(e=>Math.abs(e.start*16-at)<1e-8)));assert.equal(new Set(owners).size,1);}
 assert.throws(()=>Parts.build(S,song,{count:6,palette}),/Недостаточно/);
 assert.throws(()=>Contract.inspect({...registry.get('twiddle'),manifest:{schema:'other'}}),/контракт/);
 assert.throws(()=>L.analyze(S,{...base,meter:[7,8]},'meter'),/4\/4/);
 assert.throws(()=>L.analyze(S,{...base,phaseOptions:{subdivisionsPerBeat:[Infinity]}},'grid'),/сетка/);
});
test('symmetry analysis and unavoidable collisions remain diagnostic, not acoustic approval',async()=>{
 const events=[0,.25,.5,.75].map(start=>({start,duration:.02,value:{note:60,velocity:1,s:'sine'}}));
 assert.deepEqual(Phases.analyzePattern(events,16).rhythmicSymmetriesBeats,[4,8,12]);
 const p=prepared.get('twiddle/turkish-circuit'),analysis=p.analysis.map(a=>({...a,notes:[]}));
 const table=await Phases.fitPhaseMap({puzzle:p.puzzle,game:p.fragments,analysis});assert.equal(table.diagnostics.discrimination,'weak');assert.equal(table.diagnostics.unsolvedGoalRhythmAliases,119);assert.equal(table.diagnostics.acousticAcceptance,'unverified');
});
