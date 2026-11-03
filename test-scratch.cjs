/* SPDX-License-Identifier: AGPL-3.0-or-later */
const compositionIds=require('./compositions/catalog.js');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./puzzles/scratch/model.js'),Binding=require('./puzzles/scratch/binding.js'),Partition=require('./puzzles/scratch/partition.js'),Contract=require('./puzzle-contract.js'),Projection=require('./music-projection.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-contract.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
const nativeKey=h=>JSON.stringify([Math.round(Number(h.whole.begin)*1e8),Math.round(Number(h.duration)*1e8),Object.fromEntries(Object.entries(h.value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)))]);
test('dynamic image puzzle: reversible periods, hints, arbitrary swaps, snapshots and size-independent field bounds',()=>{
 for(const count of [1,3,13,14,19,30]){
  const m=new F.Model({count}),goal=m.snapshot();assert(m.solved());
  for(let i=0;i<30;i++)m.shuffle();const scrambled=m.snapshot();m.apply(m.legalMoves()[0]);m.undo();assert.deepEqual(m.snapshot(),scrambled);
  let n=0;while(!m.solved()){m.apply(m.hint());assert(++n<=30);}
  for(const move of m.legalMoves()){
    const next=m.applyTo(goal,move);assert.deepEqual(m.applyTo(next,m.inverse(move)),goal);
    let cycle=goal;for(let i=0;i<(move.endsWith('x')?2:4);i++)cycle=m.applyTo(cycle,move);assert.deepEqual(cycle,goal);
  }
  if(count>1){const move=m.swapMove(m.keys[0],m.keys.at(-1));m.apply(move);assert.deepEqual(m.applyTo(m.snapshot(),m.inverse(move)),goal);assert.deepEqual(m.actions().at(-1).move,m.hint());m.apply(m.hint());assert(m.solved());}
  const halfTurn=m.editMove(m.keys[0],2);m.apply(halfTurn);m.apply(m.hint());m.apply(m.hint());assert(m.solved());
  m.restore(scrambled);n=0;while(!m.solved()){m.apply(m.hint());assert(++n<4*count*count);}
  for(let source=0;source<count;source++)for(let slot=0;slot<count;slot++)for(const phase of [0,.37,1,2,3,4])for(const t of [.013,.25,.49,.83]){
    const piece={source,slot,phase},f=F.field(piece,t);assert(f.gain>=.424-1e-8&&f.gain<=1.576+1e-8);assert(f.derivative>=.664-1e-8);close(F.field(piece,t+1).time,f.time+1);
  }
 }
 const m=new F.Model(),goal=m.snapshot();assert.equal(m.editMove('A',4),null);const move=m.editMove('A',1.2);m.apply(move);assert(!m.validMove(move));assert.throws(()=>m.applyTo(m.snapshot(),move),/Устаревшее/);m.undo();assert.deepEqual(m.snapshot(),goal);
 assert.notDeepEqual(m.applyTo(m.applyTo(goal,'A'),'Ax'),m.applyTo(m.applyTo(goal,'Ax'),'A'));
 for(const n of [1,3,13,14,17,30]){const l=Partition.layout(n);assert.equal(l.movingCells.length,n);assert.equal(l.movingCells.length+l.fixedCells.length,l.rows*l.columns);assert.equal(new Set([...l.movingCells,...l.fixedCells]).size,l.rows*l.columns);}
});
test('every instrument moves: full native arrangement, no background duplication, per-piece audit, local previews and cache',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},loader=new Loader(S,{palette,registry,library,storage});
 const report={schema:'scratch-instrument-contracts/2',status:'PASS',pairs:[],acousticAcceptance:'unverified',musicalAcceptance:'unverified'};
 for(const [songId,count]of [['turkish-circuit',13],['steel-shift',14],['elise-after-hours',14]]){
  const p=await loader.prepareSession({songId,puzzleId:'scratch'}),m=p.model,music=new Music(S,p),game=p.fragments,goal=m.initialState();
  assert(Projection.validate(p.binding,p.module.manifest));assert.equal(m.count,count);assert.equal(game.count,count);assert.equal(p.module.shuffleSteps,count);assert.equal(p.diagnostics.pieceStates,4*count*count);assert.equal(p.diagnostics.silentMoves,0);
  assert.equal(game.layout.columns,4);assert.equal(game.layout.rows,4);assert.equal(game.layout.fixedCells.length,16-count);
  const original=await library.load(songId);assert.notEqual(p.composition,original);assert.equal(L.attacks(p.composition.backing,0,original.bars).length,0);assert(L.attacks(original.backing,0,original.bars).length>0);
  assert.equal(game.targetRows.flat().length,original.stats.attacks);
  const assembled=L.attacks(S.stack(p.composition.backing,music.pattern(goal)),0,original.bars).map(nativeKey).sort();
  assert.deepEqual(assembled,L.attacks(original.pattern,0,original.bars).map(nativeKey).sort(),'Preserve every authored event, gate, instrument and dynamic');
  assert.equal(norm(music.rows(goal)),norm(game.targetRows));assert(music.shifted(goal).every((pattern,id)=>pattern===game.basePatterns[id]));
  const probes=Contract.probes(p.puzzle,{stateLimit:24,edgeLimit:64});
  for(const {state}of probes.states){
   const rows=music.rows(state);
   rows.forEach((row,id)=>{assert.equal(row.length,game.targetRows[id].length);const source=new Map(game.targetRows[id].map(e=>[e.id,e]));for(const e of row){const original=source.get(e.id);assert(e.duration>0&&e.start>=0&&e.start<1);assert.equal(e.pitch,original.pitch);assert.equal(e.value.s,original.value.s);assert.equal(e.value.note,original.value.note);close(e.value.postgain??1,(original.value.postgain??1)*(e.volume??1));}});
  }
  for(const key of m.keys){const id=m.keys.indexOf(key);assert.deepEqual(music.predict(key,goal).changed,[id]);const preview=music.preview({kind:'piece-phase',key,phase:.12},goal);assert(preview.continuous);assert.deepEqual(preview.changed,[id]);}
  const state=m.applyTo(m.applyTo(goal,'A'),'Ax');
  music.shifted(state).forEach((pattern,id)=>{const native=L.eventsOf(pattern,game.periodBars).sort((a,b)=>a.start-b.start||a.duration-b.duration),rows=music.rows(state)[id].slice().sort((a,b)=>a.start-b.start||a.duration-b.duration);assert.equal(native.length,rows.length);native.forEach((e,i)=>{close(e.start,rows[i].start);close(e.duration,rows[i].duration);assert.deepEqual(e.value,rows[i].value);});});
  assert.notEqual(norm(music.preview({kind:'piece-phase',key:'A',phase:.12},goal).rows),norm(music.preview({kind:'piece-phase',key:'A',phase:.19},goal).rows));
  assert.deepEqual(music.preview({kind:'piece-phase',key:'A',phase:4},goal).changed,[]);
  assert.deepEqual(music.preview({kind:'piece-swap',key:'A',to:m.keys.at(-1)},goal).changed,[0,count-1]);
  for(const bar of [0,4,16,original.bars-4,original.bars]){
    const rows=music.displayRows(game.targetRows,bar);assert.equal(rows,music.displayRows(game.targetRows,bar));assert(rows.flat().every(e=>e.start>=-1e-8&&e.start<1));
    const window=bar%original.bars,expected=game.targetRows.flat().filter(e=>e.start*original.bars>=window-1e-8&&e.start*original.bars<window+4-1e-8).length;assert.equal(rows.flat().length,expected);
  }
  assert(!Binding.validate({...p.binding,algorithm:'spectral-riff/1'},p.module.manifest));
  const cached=await new Loader(S,{palette,registry,library,storage}).prepareSession({songId,puzzleId:'scratch'});assert.equal(cached.diagnostics.cache,'hit');
  report.pairs.push({songId,count,events:assembled.length,layout:game.layout,...p.diagnostics});
 }
 const controller=new AbortController(),cancelled=new Loader(S,{palette,registry,library,storage:null});await assert.rejects(()=>cancelled.prepareSession({songId:compositionIds[0],puzzleId:'scratch',signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.equal(cancelled.bindings.size,0);
 fs.writeFileSync(path.join(__dirname,'qa/scratch/contracts-report.json'),JSON.stringify(report,null,2)+'\n');
});
