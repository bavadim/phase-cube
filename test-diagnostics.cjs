/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Recorder}=require('./diagnostics.js');
test('flight recorder is bounded and reload retains one previous report without recursive growth',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const a=new Recorder({build:'test',capacity:4,storage,snapshot:()=>({phase:'paused',state:[1,0]})});
 for(let i=0;i<100;i++)a.record('tap',{i});
 assert.equal(a.report().events.length,4);assert.equal(a.report().events[0].i,96);a.save();a.destroy();
 const b=new Recorder({build:'next',storage});assert.equal(b.report().previous.build,'test');assert.deepEqual(b.report().previous.state.state,[1,0]);b.save();b.destroy();
 const c=new Recorder({build:'third',storage});assert.equal(c.report().previous.build,'next');assert.equal(c.report().previous.previous,undefined);c.destroy();
 const denied=new Recorder({build:'denied',storage:{getItem(){throw Error('denied');}},snapshot(){throw Error('bad snapshot');}});
 assert.equal(denied.report().state.snapshotError.message,'bad snapshot');assert.doesNotThrow(()=>denied.save());denied.destroy();
});
