/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DiscGears = factory();
})(globalThis, function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const MODULE = 0.06;
  const TEETH_PER_BAR = 20;
  const FACE_WIDTH = 1.15;
  const MAX_LIFT = 0.60;
  const wrap = (value, period) => value - period * Math.floor(value / period);

  // Units are bars and world lengths. repeatBars is the measured shortest
  // period of all the source events, including pitches, gates and patch.
  // The one-bar kick sleeve deliberately shows four quarter-note attacks.
  const PLAN = [
    {key: 'drive', periodBars: 1, repeatBars: null, x: -5.76, z: 2.52},
    {key: 'kick',  periodBars: 1, repeatBars: 0.25, x: -4.80, z: 1.80},
    {key: 'bass',  periodBars: 4, repeatBars: 4,    x: -2.4, z: 0},
    {key: 'hook',  periodBars: 4, repeatBars: 4,    x:  2.4, z: 0}
  ];

  function layout(portrait = false) {
    // The diagonal keeps each six-o'clock reader clear of the next rim.
    const angle = portrait ? 65 * Math.PI / 180 : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const gears = [];
    for (const plan of PLAN) {
      const teeth = TEETH_PER_BAR * plan.periodBars;
      const radius = MODULE * teeth / 2;
      const gear = {
        ...plan,
        x: plan.x * cos - plan.z * sin,
        z: plan.x * sin + plan.z * cos,
        teeth, radius,
        outerRadius: radius + MODULE,
        rootRadius: radius - 1.25 * MODULE,
        meshOffset: 0,
        sign: -1
      };
      const previous = gears[gears.length - 1];
      if (previous) {
        gear.sign = -previous.sign;
        const contact = Math.atan2(gear.x - previous.x, gear.z - previous.z) / TAU;
        const toothAtContact = previous.teeth * (contact - previous.meshOffset);
        // At the opposite end of the line of centres the two tooth phases
        // add to half a tooth. The gear ratio preserves this at every time.
        gear.meshOffset = wrap(contact + 0.5 - (0.5 - toothAtContact) / teeth, 1 / teeth);
      }
      gears.push(gear);
    }
    return gears;
  }

  // Positive angle moves a point from local +Z towards +X (Three Y-rotation).
  // The front reader is at angle zero. Only the score sleeve takes edits.
  function rimTurns(gear, positionBars) {
    return gear.meshOffset + gear.sign * positionBars / gear.periodBars;
  }
  function sleeveTurns(gear, positionBars, phrasePhase, phraseBars = 4) {
    return gear.sign * (positionBars - phrasePhase * phraseBars) / gear.periodBars;
  }
  function noteTurns(gear, eventStart, phraseBars = 4) {
    return -gear.sign * eventStart * phraseBars / gear.periodBars;
  }
  function phaseFromDrag(gear, deltaTurns, phraseBars = 4) {
    return -gear.sign * deltaTurns * gear.periodBars / phraseBars;
  }
  function oneRevolution(gear, events, phraseBars = 4) {
    const end = gear.periodBars / phraseBars;
    return events.filter(event => event.start < end);
  }
  function lift(gain) {
    return MAX_LIFT * Math.max(0, Math.min(2, gain)) / 2;
  }

  return Object.freeze({
    MODULE, TEETH_PER_BAR, FACE_WIDTH, MAX_LIFT,
    layout, rimTurns, sleeveTurns, noteTurns, phaseFromDrag, oneRevolution, lift
  });
});
