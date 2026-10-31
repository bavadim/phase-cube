/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('./puzzles/twiddle/model.js'),R=require('./puzzles/rubik/module.js');
test('Rubik accepts every rigidly rotated solved cube and restores the musical goal',()=>{
 assert.equal(R.goals.length,24);
 for(const state of R.goals){const m=R.create();m.restore(state);assert(m.solved());assert.equal(m.correct(),8);assert.equal(m.placements().length,8);}
 const Cube=require('./vendor/cube-1.3.2.js'),M=require('./puzzles/rubik/model.js');
 const m=R.create();m.restore(M.snapshot(new Cube().move("R L'")));assert.equal(m.correct(),8);
});
test('Twiddle: all 120 states, every inverse/four-turn cycle and shortest hint chain',()=>{
 assert.equal(T.states().size,120);let max=0;
 for(const entry of T.states().values()){
  const m=new T.Model();m.restore(entry.state);
  for(const move of T.moves){
   assert.deepEqual(T.applyTo(T.applyTo(entry.state,move),T.inverse(move)),entry.state);
   let s=entry.state;for(let i=0;i<4;i++)s=T.applyTo(s,move);assert.deepEqual(s,entry.state);
  }
  assert.equal(m.placements().length,6);
  let steps=0;while(!m.solved()){const hint=m.hint();assert(hint);const before=m.distance();m.apply(hint);assert.equal(m.distance(),before-1);steps++;assert(steps<=7);}
  assert.equal(steps,entry.depth);max=Math.max(max,steps);
 }
 assert.equal(max,7);
 const a=T.applyTo(T.applyTo([0,1,2,3,4,5],'A'),'B'),b=T.applyTo(T.applyTo([0,1,2,3,4,5],'B'),'A');assert.notDeepEqual(a,b);
});
test('Both modules own state, undo and valid hints after exploration',()=>{
 for(const create of [()=>new T.Model(),R.create]){
  const m=create();m.reset(1730);for(let i=0;i<3;i++)m.shuffle();const state=m.snapshot(),move=m.moveFor(m.choices()[0].key);
  m.apply(move);m.undo();assert.deepEqual(m.snapshot(),state);
  let n=0;while(!m.solved()){const hint=m.hint();assert(m.validMove(hint));m.apply(hint);assert(++n<40);}
 }
});
