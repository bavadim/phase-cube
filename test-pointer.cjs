/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function rig(pressable){
 const window=new EventTarget(),canvas=new EventTarget(),events=[],capture=new Set();let enabled=true;
 canvas.setPointerCapture=id=>capture.add(id);canvas.hasPointerCapture=id=>capture.has(id);canvas.releasePointerCapture=id=>capture.delete(id);
 vm.runInNewContext(fs.readFileSync(require.resolve('./graphics/pointer.js'),'utf8'),{window,AbortController,Math});
 const pointer=new window.PuzzlePointer(canvas,{enabled:()=>enabled,pick:()=>({key:'A',pressable}),select:()=>events.push('select'),hover:()=>{},drag:()=>events.push('camera'),
  beginDrag:()=>{events.push('begin');return true;},moveDrag:()=>events.push('move'),endDrag:cancel=>{events.push(cancel?'cancel':'commit');enabled=false;}});
 const send=(type,x=10)=>{const e=new Event(type);Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:10});canvas.dispatchEvent(e);};
 return{pointer,events,send,window};
}
test('hold begins on down, commits once without movement and is cleared before commit disables input',()=>{
 const r=rig(true);r.send('pointerdown');assert.deepEqual(r.events,['begin']);r.send('pointerup');r.send('lostpointercapture');r.send('pointerup');
 assert.deepEqual(r.events,['begin','commit']);assert.equal(r.pointer.gesture,null);r.pointer.destroy();
});
test('hold moving past drag slop never begins a second edit and cancellation cannot commit',()=>{
 for(const cancel of ['pointercancel','lostpointercapture','blur']){
  const r=rig(true);r.send('pointerdown');r.send('pointermove',40);assert.deepEqual(r.events,['begin','move']);
  if(cancel==='blur')r.window.dispatchEvent(new Event('blur'));else if(cancel==='lostpointercapture')r.pointer.cancel('lost-capture');else r.send(cancel);
  r.send('pointerup');assert.deepEqual(r.events,['begin','move','cancel']);assert.equal(r.pointer.gesture,null);r.pointer.destroy();
 }
});
test('ordinary puzzle taps and deferred drags retain their original behavior',()=>{
 const tap=rig(false);tap.send('pointerdown');assert.deepEqual(tap.events,[]);tap.send('pointerup');assert.deepEqual(tap.events,['select']);tap.pointer.destroy();
 const drag=rig(false);drag.send('pointerdown');drag.send('pointermove',40);drag.send('pointerup');assert.deepEqual(drag.events,['begin','move','commit']);drag.pointer.destroy();
});
