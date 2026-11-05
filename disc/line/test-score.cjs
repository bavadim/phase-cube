/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {S, library} = require('../../test-runtime.cjs');
const {attacks} = require('../../composition-contract.js');
const Line = require('./score.js');
const song = library.load('turkish-circuit');

test('the conveyor preserves pitches from the source and its controls are reversible', async () => {
  const score = Line.create(S, await song);
  const initial = score.snapshot();
  assert.deepEqual(initial.notes, [45,52,41,48,38,45,40,47]);
  for (const action of ['rotor', 'disc', 'tab', 'note', 'clutch']) {
    const period = {rotor:8, disc:8, tab:2, note:score.palette.length, clutch:2}[action];
    for (let t = 0; t < period; t++) assert.ok(score.edit(action, 1));
    assert.deepEqual(score.snapshot(), initial);
  }
  assert.throws(() => score.restore({...initial, routes:[true]}));
  assert.throws(() => score.restore({...initial, notes:[...initial.notes.slice(0,7), 200]}));
  assert.deepEqual(score.snapshot(), initial);
});

test('every sounding attack agrees with the box, rotor and apertures across bar seams and edits', async () => {
  const score = Line.create(S, await song);
  function compare(bar) {
    const heard = Array.from(attacks(score.pattern(), bar, bar + 1));
    for (let i = 0; i < 8; i++) {
      const event = Line.eventAt(score.snapshot(), bar*8 + i);
      const hits = heard.filter(h => Number(h.whole.begin) === bar + i/8 && h.value._phaseCubePart !== 'hook');
      const box = hits.find(h => h.value._phaseCubePart === event.route);
      assert.equal(box.value.note, event.pitch);
      assert.equal(box.value.velocity, event.gain);
      assert.ok(Math.abs(Number(box.duration) - event.length/8) < 1e-8);
      assert.equal(hits.filter(h => h.value._phaseCubePart === 'stamp').length, Number(event.stamp));
      assert.equal(hits.length, 1 + Number(event.stamp) + Number(event.motor));
    }
  }
  compare(-1);
  for (const [action, index] of [['note',1],['tab',1],['rotor'],['disc',1],['clutch']]) {
    score.edit(action,index);
    compare(0);
    compare(2);
  }
  const state = score.snapshot();
  assert.ok(!state.clutch);
  for (let i = 0; i < 8; i++) {
    const event = Line.eventAt(state,i);
    assert.equal(event.stamp, event.route === 'metal');
  }
});

test('gear settings migrate atomically and bounded volume edits report their end stops', async () => {
  const score = Line.create(S, await song);
  score.edit('note', 2);
  const {gears, ...legacy} = score.snapshot();
  score.edit('gearLevel', 1, -2);
  score.edit('gearPhase', 0, -1);
  assert.ok(score.restore(legacy));
  assert.deepEqual(score.snapshot(), {...legacy, gears});
  for (const gear of [0,1]) {
    assert.ok(score.edit('gearPhase', gear, -1));
    assert.equal(score.snapshot().gears[gear].phase, 7);
    assert.ok(score.edit('gearPhase', gear, 1));
    for (const [delta,level] of [[-10,0],[12,2],[-4,1]]) {
      assert.ok(score.edit('gearLevel',gear,delta));
      assert.equal(score.snapshot().gears[gear].level, level);
      if (level !== 1) assert.equal(score.edit('gearLevel',gear,delta), false);
    }
  }
  const good = score.snapshot();
  for (const invalid of [null, [], [gears[0],{phase:1,level:1.01}], [{level:1,phase:-1},gears[1]]])
    assert.throws(() => score.restore({...good, gears:invalid}));
  assert.equal(score.snapshot(), good);
});

test('gear phases and gains act only on their own native loop at positive and negative bar seams', async () => {
  const composition = await song;
  const score = Line.create(S, composition);
  const reference = Array.from(attacks(composition.backing, 8, 9)).filter(h => h.value._phaseCubePart === 'hook');
  const event = (hap, offset) => ({
    at:Number(hap.whole.begin) - offset, length:Number(hap.duration),
    span:Number(hap.whole.duration), value:{...hap.value}
  });
  const plain = reference.map(h => event(h,8));
  assert.equal(plain.length, 10);
  assert.deepEqual(score.gearMarks[1], plain.map(h => h.at));
  assert.ok(plain.some(hit => !Number.isInteger(hit.at*8)));
  const initial = Array.from(attacks(score.pattern(),0,1));
  function lane(hits,part,from) {
    return hits.filter(h => h.value._phaseCubePart === part).map(h => event(h,from)).sort((a,b) => a.at-b.at);
  }
  const drum = lane(initial,'motor',0);
  assert.deepEqual(score.gearMarks[0], drum.map(h => h.at));
  assert.deepEqual(lane(initial,'hook',0),plain);
  score.edit('gearLevel',0,2);
  score.edit('gearLevel',1,-2);
  for (let shift = 0; shift < 8; shift++) {
    score.edit('gearPhase',0,1);
    score.edit('gearPhase',1,-1);
    const bar = shift % 2 === 0 ? -1 : 3;
    const hits = Array.from(attacks(score.pattern(),bar,bar+1));
    for (const part of ['glass','metal','stamp']) assert.deepEqual(lane(hits,part,bar),lane(initial,part,0));
    for (const [part,gear,original] of [['hook',1,plain],['motor',0,drum]]) {
      const {phase,level} = score.snapshot().gears[gear];
      const expected = original.map(h => ({...h, at:(h.at + phase/8)%1,
        value:{...h.value, postgain:h.value.postgain*level}})).sort((a,b) => a.at-b.at);
      assert.deepEqual(lane(hits,part,bar),expected);
    }
    for (let i = 0; i < 8; i++) assert.equal(Line.eventAt(score.snapshot(),i).motor,
      lane(hits,'motor',bar).some(h => h.at === i/8));
  }
  for (const gear of [0,1]) score.edit('gearLevel',gear,-8);
  const muted = Array.from(attacks(score.pattern(),0,1));
  assert.deepEqual(lane(muted,'hook',0),[]);
  assert.deepEqual(lane(muted,'motor',0),[]);
  assert.equal(muted.length,10);
});
