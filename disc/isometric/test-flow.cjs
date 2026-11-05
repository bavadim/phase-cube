/* SPDX-License-Identifier: AGPL-3.0-or-later */
'use strict';
const assert = require('node:assert/strict');
const {S} = require('../../test-runtime.cjs');
const Flow = require('./flow.js');
const Audio = require('./sound.js');

const initial = Flow.initial();
const rev = Flow.revision(initial);
const edit = (state, type, data = {}) => Flow.apply(state, {type,...data});
function notes(revision, route, first, last) {
  const result = [];
  for (let t = first; t < last; t++) {
    for (const box of Flow.tick(revision,t).hits[route]) result.push([t,box.pitch]);
  }
  return result;
}

assert.deepEqual(notes(rev,'keys',0,8), [[0,60],[2,64],[4,67],[6,64]]);
assert.deepEqual(notes(rev,'bell',0,8), [[4,64]], 'first pocket begins empty');
assert.deepEqual(notes(rev,'bell',8,16), [[8,64],[12,64]]);
assert.deepEqual(notes(rev,'bin',8,16), [[10,60],[14,67]]);
assert.deepEqual(Flow.tick(rev,0).pockets.map(p => [p.pitch,p.entered,p.due]), [[60,0,2]]);
assert.deepEqual(Flow.tick(rev,8).edges.map(p => [p.from,p.to]), [
  ['delay:out','router'], ['router:straight','bell'], ['source:out','copy'], ['copy:out','keys'], ['copy:copy','delay']
]);

// Reorder two processors on an occupied line, by removing then splicing.
const noDelay = edit(initial,'bypass',{node:'delay'});
assert.equal(noDelay.links['copy:copy'],'router');
const reversed = edit(noDelay,'insert',{node:'delay',from:'router:straight'});
assert.deepEqual(notes(Flow.revision(reversed),'bell',0,8),[[2,60],[6,67]]);
assert.deepEqual(Flow.restore(JSON.parse(JSON.stringify(initial))),initial);
assert.deepEqual(Flow.restore({...initial,links:{'source:out':'keys'}}).links,{'source:out':'keys'});
assert.throws(() => edit(initial,'connect',{from:'copy:out',to:'delay'}), /занят/);
const unhooked = edit(initial,'disconnect',{from:'source:out'});
assert.throws(() => edit(unhooked,'connect',{from:'router:side',to:'copy'}), /замкнула/);
assert.deepEqual(unhooked.links,{...noSource(initial.links)});
function noSource(links) {
  const next = {...links};
  delete next['source:out'];
  return next;
}
assert.throws(() => Flow.restore({...initial,links:{'source:out':'source'}}), /выход/);
assert.throws(() => Flow.restore({...initial,links:{'source:nope':'keys'}}));
assert.throws(() => Flow.restore({...initial,source:{...initial.source,level:'1'}}));
assert.equal(edit(initial,'disconnect',{from:'source:out'}).links['source:out'],undefined);
assert.equal(edit(initial,'connect',{from:'copy:out',to:'keys'}),initial);
assert.equal(edit(initial,'phase',{delta:8}),initial);
assert.equal(edit(initial,'level',{delta:5}).source.level,2);
assert.deepEqual(notes(Flow.revision(edit(initial,'phase',{delta:1})),'keys',0,8),[[1,60],[3,64],[5,67],[7,64]]);
assert.deepEqual(initial.routes,[true,false,false,false,true,false,false,false]);
assert.equal(edit(initial,'route',{index:4,value:true}), initial);
const changed = edit(initial,'route',{index:2});
assert.deepEqual(changed.routes,[true,false,true,false,true,false,false,false]);
assert.deepEqual(notes(Flow.revision(changed),'bell',8,16),[[8,64],[10,60],[12,64]]);
assert.deepEqual(edit(changed,'route',{index:2,value:false}), initial);
assert.throws(() => edit(initial,'route',{index:8}));
assert.throws(() => edit(initial,'route',{index:2,value:1}));

// Every old combination must keep its audible rhythm after restoring. Use
// the repeated binary openings of the old wheels for an independent oracle.
const {routes, ...legacyBase} = initial;
for (let a=0; a<8; a++) for (let b=0; b<8; b++) for (const clutch of [false,true]) {
  const old = {...legacyBase,discs:[a,b],clutch};
  const restored = Flow.restore(old);
  const expected = Array.from({length:8}, (_,t) => !clutch ||
    (t-a)%2 === 0 && (8+t-b)%4 < 2);
  assert.deepEqual(restored.routes,expected);
  assert.deepEqual(restored.source,initial.source);
  assert.deepEqual(restored.links,initial.links);
  assert.equal(restored.delay,initial.delay);
  assert.ok(!('discs' in restored) && !('clutch' in restored));
}
assert.throws(() => Flow.restore(legacyBase));
assert.throws(() => Flow.restore({...legacyBase,discs:[0,8],clutch:true}));
assert.throws(() => Flow.restore({...legacyBase,discs:[0,0],clutch:'true'}));
for (const invalid of [[], Array(8), Array(8).fill(0), null]) {
  assert.throws(() => Flow.restore({...legacyBase,discs:[0,0],clutch:true,routes:invalid}));
}
assert.deepEqual(notes(Flow.revision(edit(initial,'delay',{delta:-2})),'bell',0,8),[[0,60],[4,67]]);
assert.deepEqual(notes(Flow.revision(edit(initial,'note',{index:0,value:null})),'keys',0,2),[]);
assert.deepEqual(notes(Flow.revision(edit(initial,'note',{index:1,delta:1})),'keys',1,2),[[1,60]]);

// Once boxed, pitch, level and deadline remain attached to the box across
// several edits. The diverter uses the revision that's active on arrival.
let next = edit(initial,'note',{index:0,value:81});
next = edit(next,'delay',{delta:2});
next = edit(next,'level',{delta:-.5});
const atOne = Flow.revision(next,1,rev);
assert.equal(Flow.tick(atOne,1).pockets[0].due,2);
const atTwo = Flow.revision(edit(next,'route',{index:2,value:true}),2,atOne);
assert.deepEqual(Flow.tick(atTwo,2).hits.bell.map(b => [b.pitch,b.gain,b.origin]),[[60,1,0]]);
assert.equal(Flow.tick(atTwo,2).pockets[0].due,6);
assert.equal(Flow.tick(Flow.revision(atTwo.state,2,atTwo),2).hits.bell[0].pitch,60);
assert.deepEqual(Flow.tick(atTwo,10002).hits.bell.map(b => b.pitch),[64]);

// Native Strudel queries share the exact same attacks as the workbench.
// Test fragmented lookahead windows, a pause inside a note and two twins
// routed into the same instrument (its scheduler dedup keys must differ).
for (const r of [rev,Flow.revision(reversed),atTwo]) {
  const pat = Audio.pattern(S,r);
  const expected = [];
  for (let t = 0; t < 24; t++) {
    for (const name of ['keys','bell']) for (const box of Flow.tick(r,t).hits[name]) {
      if (box.gain) expected.push([t,name,box.pitch,box.gain,box.length / 8]);
    }
  }
  const actual = [];
  for (let i = 0; i < 48; i++) for (const h of pat.queryArc(i/16,(i+1)/16)) {
    if (h.hasOnset()) actual.push([Number(h.whole.begin)*8,h.value._phaseCubePart,h.value.note,h.value.postgain,Number(h.duration)]);
  }
  assert.deepEqual(actual,expected);
}
const twins = edit(initial,'connect',{from:'copy:copy',to:'keys'});
const pair = Audio.pattern(S,Flow.revision(twins)).queryArc(0,1/16);
assert.equal(pair.length,2);
assert.notEqual(pair[0].value._boxPath,pair[1].value._boxPath);
assert.deepEqual([...Audio.pattern(S,Flow.revision(edit(initial,'level',{delta:-1}))).queryArc(0,2)],[]);
const held = Audio.pattern(S,rev).queryArc(1/32,1/16);
assert.equal(held.length,1);
assert.equal(held[0].hasOnset(),false);
const listen = (state,index) => Audio.routeEvents(S,state,index)
  .map(h => [(Number(h.whole.begin) - 1) * 8, h.value.s, h.value.note]);
assert.deepEqual(listen(initial,0), [[0,'sine',64]], 'previous-bar box, without parallel keyboard accompaniment');
assert.deepEqual(listen(initial,1), [], 'no box');
assert.deepEqual(listen(initial,2), [], 'basket is silent');
const forkThenCopy = Flow.restore({...initial, links:{
  'source:out':'router','router:straight':'copy','copy:out':'bell','copy:copy':'delay','delay:out':'keys'
}});
assert.deepEqual(listen(forkThenCopy,0), [[0,'sine',60],[2,'biba_tx_piano',60]], 'both descendants with relative delay');
assert.deepEqual(listen(edit(initial,'disconnect',{from:'source:out'}),0), [], 'unconnected source');
assert.deepEqual(listen(edit(initial,'level',{delta:-1}),0), [], 'silent source');
const phased=Flow.restore({...forkThenCopy,source:{...forkThenCopy.source,phase:7},
  routes:Array(8).fill(true)});
const pinPreview=(state,pin)=>Audio.pinEvents(S,state,pin)
  .map(h=>[Number(h.whole.begin)*Flow.STEPS,h.value._phaseCubePart,h.value.note]);
assert.deepEqual(pinPreview(phased,0),[[7,'bell',60],[9,'keys',60]],'only this pin and its delayed copy across the loop seam');
assert.deepEqual(pinPreview(phased,2),[[1,'bell',64],[3,'keys',64]],'phase wraps back to the start');
assert.deepEqual(pinPreview(phased,1),[],'empty pin stays silent despite adjacent notes in the query');
assert.deepEqual(pinPreview(edit(phased,'connect',{from:'source:out',to:'bin'}),0),[],'basket silences the pin');
console.log('PASS: graph edits, delay handover, eight-step routing, v1 save migration, cold start and native Strudel onsets.');
