/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),registry=require('./puzzles/registry.js'),Actions=require('./puzzles/actions.js'),Contract=require('./puzzle-contract.js');
test('every model supplies named/icon actions and callbacks dispatch rather than mutate the model',()=>{
 for(const module of registry.modules){
  const model=module.create(),moves=[],previews=[];
  for(const choice of model.choices()){
   model.select(choice.key);const actions=Actions.validate(model.actions({perform:move=>moves.push(move),preview:move=>previews.push(move)}));
   assert.equal(actions.length,module.id==='fourier'?4:2);
   for(const action of actions){
    const before=model.snapshot();action.onInvoke();assert.deepEqual(model.snapshot(),before);
    assert.equal(action.enabled,model.validMove(action.move));
    if(action.enabled){assert.deepEqual(moves.at(-1),action.move);action.onPreview(true);assert.deepEqual(previews.at(-1),action.move);}
    action.onPreview(false);assert.equal(previews.at(-1),null);
   }
  }
  assert.throws(()=>Contract.inspect({...module,create(){const m=module.create();m.actions=undefined;return m;}}),/actions/);
 }
 assert.throws(()=>Actions.validate([{id:'bad',label:'',icon:{text:'?'},onInvoke(){}}]));
});
