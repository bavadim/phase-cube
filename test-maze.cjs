/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const G=require('./puzzles/fourier/maze.js'),M=require('./puzzles/fourier/maze-model.js'),F=require('./puzzles/fourier/model.js'),Module=require('./puzzles/fourier/module.js'),Binding=require('./puzzles/fourier/binding.js');
const pose=(i,phase=F.homePhase[i],gain=1)=>({phase:phase-F.homePhase[i],gain});
test('physical L-passages have exactly one connecting angle and lift height per node',()=>{
 const interfaces=[];let checked=0;
 for(let i=0;i<6;i++){
  const classes=new Map();
  for(let phase=0;phase<8;phase++)for(const gain of G.gains){
   const poses=F.keys.map((_,j)=>pose(j));poses[i]=pose(i,phase,gain);const result=G.analyze(poses),joint=result.joints[i],expected=phase===F.homePhase[i]&&gain===1;
   assert.equal(joint.connected,expected);assert.equal(result.passable,expected);assert.equal(result.correct,expected?6:5);
   const mask=(joint.contacts[0]>=0?1:0)+(joint.contacts[1]>=0?2:0);if(!classes.has(mask))classes.set(mask,poses[i]);checked++;
  }
  assert.deepEqual([...classes.keys()].sort(),[0,1,2,3]);interfaces.push(classes);
 }
 // Exhaust all combinations of physically possible interfaces. This quotient
 // covers the full 40^6 domain: connectivity only depends on these contacts.
 for(let code=0;code<4**6;code++){
  const masks=F.keys.map((_,i)=>Math.floor(code/4**i)%4),result=G.analyze(masks.map((m,i)=>interfaces[i].get(m)));
  assert.equal(result.passable,masks.every(m=>m===3));assert.equal(result.correct,masks.filter(m=>m===3).length);
 }
 const files=['puzzles/fourier/maze.js','puzzles/fourier/maze-model.js','puzzles/fourier/module.js','puzzles/fourier/model.js','puzzles/fourier/binding.js','test-maze.cjs'];
 const report={schema:'rotary-lift-maze/1',status:'PASS',individualPoses:checked,interfaceCombinations:4**6,stateSpace:M.stateCount,
  invariant:'route is passable iff every riff has its reference phase and gain',scope:'fixed six-node serial topology; C8 phase and five gain values; not musical/artistic acceptance',
  sourceSha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex')]))};
 fs.mkdirSync(path.join(__dirname,'qa/maze'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/maze/contracts-report.json'),JSON.stringify(report,null,2)+'\n');
});
test('maze model keeps geometric and musical goals equal, edits reversible and hints actionable',()=>{
 const m=Module.create();assert(m.solved());assert.equal(m.maze().completed,6);assert.equal(Module.manifest.gridPresetStates,40**6);
 for(const state of m.probeStates()){
  const params=m.parameters(state),expected=params.every((p,i)=>p.phase===F.homePhase[i]&&p.level===4),projected=Binding.project({periods:Array(6).fill(1)},null,state,{targetRows:Array(6).fill([{start:0,duration:.1,value:{note:60}}])});
  assert.equal(m.solved(state),expected);assert.equal(m.solved(state),projected.parts.every(p=>p.aligned));
  for(const move of m.legalMoves(state)){const next=m.applyTo(state,move);assert.equal(m.applyTo(next,m.inverse(move)),state);assert(m.parameters(next).every(p=>G.gains.includes(p.level/4)));}
 }
 for(let seed=0;seed<24;seed++){
  m.reset(seed);for(let i=0;i<12;i++)m.shuffle();const before=m.snapshot(),move=m.legalMoves()[0];m.apply(move);m.undo();assert.equal(m.snapshot(),before);
  let n=0;while(!m.solved()){const hint=m.hint();m.select(m.moveTarget(hint));assert(m.actions().some(a=>a.move===hint));const distance=m.distance();m.apply(hint);assert.equal(m.distance(),distance-1);assert(++n<=12);}
 }
 m.reset();for(const gain of [.76,.999999,1,1.000001,1.24])assert.equal(m.editPoint('A',{phase:0,gain}),null);
 for(const key of F.keys){let state=0;for(let n=1;n<=8;n++){state=m.applyTo(state,key);assert.equal(m.solved(state),n===8);}}
 assert.throws(()=>m.editMove('A',{phase:0,level:4.000000001}),/между/);
 const continuous=new F.Model(),offGrid=continuous.applyTo(0,continuous.editMove('A',{phase:0,level:4.000000001}));
 assert.throws(()=>m.parameters(offGrid),/между/);assert.throws(()=>m.applyTo(offGrid,'A'),/между/);assert.throws(()=>m.maze(offGrid),/между/);
});
