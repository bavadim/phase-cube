/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict');
const registry=require('./puzzles/registry.js'),Contract=require('./puzzle-contract.js');

test('every puzzle starts solved and shuffle() applies exactly one replayable legal move',()=>{
 for(const module of registry.modules)for(let seed=0;seed<48;seed++){
  const m=module.create();assert(m.solved());assert.deepEqual(m.snapshot(),m.initialState());assert.equal(m.hint(),null);
  m.reset(seed);const moves=[],states=[m.snapshot()];
  // Include walks beyond the diameter of the finite models.
  for(let i=0;i<24;i++){
   const before=m.snapshot(),move=m.shuffle();assert(m.legalMoves(before).includes(move));
   assert.deepEqual(m.snapshot(),m.applyTo(before,move));assert.notDeepEqual(m.snapshot(),before);assert(!m.solved());
   assert.equal(m.history.length,0);assert.equal(m.moves.length,0);assert.equal(m.undo(),null);
   if(i<3&&m.distance)assert.equal(m.distance(),i+1,'Intro must move outward');
   moves.push(move);states.push(m.snapshot());
  }
  const end=m.snapshot(),playerMove=m.legalMoves()[0];m.apply(playerMove);m.undo();assert.deepEqual(m.snapshot(),end);
  // Cube hints retain the real shuffle path, even though it is not undo history.
  let n=0;while(!m.solved()){const hint=m.hint();assert(m.validMove(hint));m.apply(hint);assert(++n<=moves.length);}
  m.reset(seed);assert.deepEqual(m.snapshot(),m.initialState());assert.equal(m.hint(),null);
  for(let i=0;i<moves.length;i++){assert.equal(m.shuffle(),moves[i]);assert.deepEqual(m.snapshot(),states[i+1]);}
 }
});

test('contract rejects missing shuffle and constructors with a pre-shuffled model',()=>{
 for(const module of registry.modules){
  assert(Contract.inspect(module).model.solved());
  assert.throws(()=>Contract.inspect({...module,create(){const m=module.create();m.shuffle=undefined;return m;}}),/shuffle/);
  assert.throws(()=>Contract.inspect({...module,create(){const m=module.create();m.shuffle();return m;}}),/должна быть собрана/);
 }
});
