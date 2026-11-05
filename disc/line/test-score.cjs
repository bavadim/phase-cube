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
      const hits = heard.filter(h => Number(h.whole.begin) === bar + i/8);
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
