/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),registry=require('./puzzles/registry.js'),Actions=require('./puzzles/actions.js'),Contract=require('./puzzle-contract.js');
test('every model supplies named/icon actions and callbacks dispatch rather than mutate the model',()=>{
 for(const module of registry.modules){
  const model=module.create(),moves=[],previews=[];
  for(const choice of model.choices()){
   model.select(choice.key);const actions=Actions.validate(model.actions({perform:move=>moves.push(move),preview:move=>previews.push(move)}));
   assert.equal(actions.length,{fourier:4,bounce:4,scratch:3,twiddle:2,rubik:2}[module.id]);
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

test('one interaction contract owns selection, focus and edit capabilities for all puzzles',()=>{
 for(const puzzle of registry.modules){const policy=Contract.interaction(puzzle);assert(Object.isFrozen(policy));assert.equal(typeof policy.selectionPrompt,'string');
  assert.equal(policy.requiresSelection,['fourier','bounce','scratch'].includes(puzzle.id));
  assert.equal(policy.buttonPreview,puzzle.id!=='bounce');
  if(puzzle.manifest.projection==='complex-riff/3')assert.equal(typeof puzzle.create().editPoint,'function');
 }
 const base=registry.get('bounce');
 for(const interaction of [{unknown:true},{requiresSelection:'yes'}])assert.throws(()=>Contract.inspect({...base,manifest:{...base.manifest,interaction}}),/контракт управления/);
 assert.throws(()=>Contract.inspect({...base,create(){const m=base.create();m.editPoint=null;return m;}}),/editPoint/);
});

test('views obey the same geometry/edit contract and cannot override interaction policy',()=>{
 const view={camera:{isCamera:true},...Object.fromEntries(['resize','sync','pickTargets','hit','locations','feedback','animate'].map(name=>[name,()=>{}]))};
 assert.equal(Contract.inspectView(view),view);assert.throws(()=>Contract.inspectView({...view,camera:{}}),/камера/);
 assert.throws(()=>Contract.inspectView({...view,animate:null}),/animate/);
 assert.throws(()=>Contract.inspectView({...view,requiresSelection:true}),/manifest.interaction/);
 assert.throws(()=>Contract.inspectView({...view,beginDrag(){}}),/жеста/);
});
