/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.DiscGearChallenge = factory(root.DiscModel);
})(globalThis, function (DiscModel) {
  'use strict';
  const wrap = (phase, period) => phase - Math.floor(phase / period) * period;

  class GearModel extends DiscModel.Model {
    constructor(score, wheels) {
      super(score.modules, {phaseSteps: score.phaseSteps});
      this.wheels = wheels;
      this.phraseBars = score.periodBars;
    }
    normalize(raw, {snap = true} = {}) {
      const result = super.normalize(raw, {snap});
      for (const p of result.parts) {
        // A full mechanical turn gives the same orientation.
        p.phase = wrap(p.phase, this.wheels.get(p.key).periodBars / this.phraseBars);
        if (snap) p.gain = Math.round(p.gain * 2) / 2;
        p.variant = 0;
        p.installed = true;
      }
      return result;
    }
  }
  function create(score, train) {
    const wheels = new Map(train.filter(w => w.key !== 'drive').map(w => [w.key, w]));
    for (const part of score.modules) {
      if (!(wheels.get(part.key)?.repeatBars > 0)) throw Error('Нет периода колеса ' + part.key);
    }
    const target = key => ({key, phase: 0, gain: 1});
    const phasePeriod = key => wheels.get(key).repeatBars / score.periodBars;
    function evaluate(state) {
      const parts = state.parts.map(p => {
        const goal = target(p.key);
        const period = phasePeriod(p.key);
        const residual = wrap(p.phase - goal.phase, period);
        const phaseOK = Math.min(residual, period - residual) < 1e-7;
        const gainOK = Math.abs(p.gain - goal.gain) < 1e-7;
        return {key: p.key, phaseOK, gainOK, matched: phaseOK && gainOK};
      });
      const matched = parts.filter(p => p.matched).length;
      return {parts, matched, total: parts.length, solved: matched === parts.length};
    }
    function scramble(state, random = Math.random) {
      // Keep the melody audible. Odd eighth-note displacements always
      // fall between the four equivalent kick alignments.
      const shifts = [-3, -1, 1, 3];
      const gains = [0.5, 1.5, 2];
      const pick = list => list[Math.floor(random() * list.length)];
      const parts = state.parts.map(p => ({
        ...p, phase: pick(shifts) / score.phaseSteps, gain: pick(gains), installed: true, variant: 0
      }));
      return {...state, parts};
    }
    return {target, phasePeriod, evaluate, scramble, createModel: () => new GearModel(score, wheels)};
  }
  return {create};
});
