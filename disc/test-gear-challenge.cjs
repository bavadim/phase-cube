/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test = require('node:test');
const assert = require('node:assert/strict');
const train = require('./gears.js').layout();
const score = {periodBars: 4, phaseSteps: 32, modules: train.slice(1).map(g => ({key: g.key, variants: [{}]}))};
const challenge = require('./gear-challenge.js').create(score, train);

test('a quarter-note kick shift solves; a one-bar bass shift changes the tune', () => {
  const model = challenge.createModel();
  for (let step = 0; step < 32; step++) {
    model.set('kick', {phase: step / 32});
    assert.equal(challenge.evaluate(model.snapshot()).solved, step % 2 === 0);
  }
  model.set('kick', {phase: 0});
  model.set('bass', {phase: 1/4});
  assert.equal(challenge.evaluate(model.snapshot()).solved, false);
  model.undo();
  assert.equal(challenge.evaluate(model.snapshot()).solved, true);
});

test('phase and height audition smoothly; release picks legal settings', () => {
  const model = challenge.createModel();
  const raw = model.snapshot();
  Object.assign(raw.parts[0], {phase: -0.04, gain: 0.89});
  const preview = model.normalize(raw, {snap: false});
  assert.ok(Math.abs(preview.parts[0].phase - 0.21) < 1e-8);
  assert.equal(preview.parts[0].gain, 0.89);
  model.restore(raw);
  assert.equal(model.snapshot().parts[0].phase, 7/32);
  assert.equal(model.snapshot().parts[0].gain, 1);
  model.set('kick', {phase: 0, gain: 1, installed: false, variant: 30});
  assert.equal(model.snapshot().parts[0].installed, true);
  assert.equal(challenge.evaluate(model.snapshot()).solved, true);
});

test('each starting wheel is audible and needs both adjustments', () => {
  for (const random of [0, 0.26, 0.4, 0.51, 0.7, 0.99]) {
    const model = challenge.createModel();
    model.restore(challenge.scramble(model.snapshot(), () => random), {record: false});
    assert.equal(model.history.length, 0);
    for (const part of challenge.evaluate(model.snapshot()).parts) {
      assert.equal(part.phaseOK, false);
      assert.equal(part.gainOK, false);
    }
    assert.ok(model.snapshot().parts.every(p => p.gain > 0));
  }
});
