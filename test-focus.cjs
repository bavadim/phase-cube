/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),Focus=require('./controls/action-focus.js');
test('hover temporarily overrides a hint, stale leave cannot clear a newer owner, and reset releases all focus',()=>{
 const changes=[],f=new Focus({onChange:s=>changes.push(s)});
 f.set('hint',{key:'A',move:"A'"},{exclusive:true});
 f.set('button-pointer',{key:'B',move:'B',owner:'right'});
 f.set('button-pointer',{key:'B',move:"B'",owner:'left'});
 f.clear('button-pointer','right');assert.equal(f.current.move,"B'");
 f.clear('button-pointer','left');assert.equal(f.current.source,'hint');assert.equal(f.current.move,"A'");
 const n=changes.length;f.set('hint',{key:'A',move:"A'"});assert.equal(changes.length,n,'Same focus does not restart the animation');
 f.set('button-keyboard',{key:'A',move:'A'});f.set('hint',{key:'B',move:'B+'},{exclusive:true});
 f.clear('button-keyboard');assert.equal(f.current.source,'hint');f.reset();assert.equal(f.current,null);assert.equal(f.sources.size,0);
});
test('model changes invalidate stale direct edits; disabled interactions cannot revive focus',()=>{
 let state=0,enabled=true;const f=new Focus({resolve:s=>enabled&&(s.before==null||s.before===state)?s:null});
 f.set('edit',{key:'C',move:{from:0,to:1},before:0});state=1;f.refresh();assert.equal(f.current,null);
 f.set('field',{key:'D',move:'D'});enabled=false;f.refresh();assert.equal(f.current,null);enabled=true;f.refresh();assert.equal(f.current,null);
});
