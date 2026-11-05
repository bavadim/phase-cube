/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Gears = require('./gears.js');
const {S, library} = require('../test-runtime.cjs');
const Composition = require('../composition-contract.js');
const Music = require('./music.js');

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, message ?? `${actual} ≠ ${expected}`);
const clockDistance = (a, b) => Math.abs((a - b) - Math.round(a - b));
const periodBars = 4;
let prepared;
const nativeSong = () => prepared ??= library.load('turkish-circuit').then(song => Music.prepare(S, song));

function nativeMinimumPeriod(pattern) {
  const events = Composition.attacks(pattern, 0, periodBars);
  const first = events.reduce((min, event) =>
    event.whole.begin.compare(min) < 0 ? event.whole.begin : min, events[0].whole.begin);
  function signature(shift) {
    return Array.from(events, event => JSON.stringify([
      event.whole.begin.add(shift).mod(periodBars).toFraction(),
      event.whole.end.sub(event.whole.begin).toFraction(),
      event.duration.toFraction(),
      event.value
    ])).sort().join('\n');
  }
  // A symmetry must carry this first attack onto another attack. Testing all
  // such offsets is exhaustive on the authored event multiset, without first
  // quantizing its timing to a chosen grid.
  const shifts = Array.from(events, event => event.whole.begin.sub(first))
    .filter(shift => Number(shift) > 0).concat(S.Fraction(periodBars));
  shifts.sort((left, right) => left.compare(right));
  const original = signature(0);
  return Number(shifts.find(shift => signature(shift) === original));
}

test('authored wheel periods preserve every source voice and piano variant', async () => {
  const song = await nativeSong();
  const train = Gears.layout();
  for (const voice of song.modules) {
    const gear = train.find(gear => gear.key === voice.key);
    for (const variant of voice.variants) {
      assert.equal(nativeMinimumPeriod(variant.pattern), gear.repeatBars, variant.id);
      const first = Gears.oneRevolution(gear, variant.events, periodBars);
      const eventKey = (e, start) => JSON.stringify([Math.round(start * 1e9), e.duration, e.value]);
      const repeated = [];
      for (let bar = 0; bar < periodBars; bar += gear.periodBars) {
        for (const event of first) repeated.push(eventKey(event, event.start + bar / periodBars));
      }
      assert.deepEqual(repeated.sort(), Array.from(variant.events, e => eventKey(e, e.start)).sort(), variant.id);
    }
  }
});

test('all three contacts maintain timing, pitch distance and axial overlap', () => {
  for (const portrait of [false, true]) {
    const gears = Gears.layout(portrait);
    assert.deepEqual(gears.map(g => g.teeth), [20, 20, 80, 80]);
    for (const [i, gear] of gears.entries()) {
      close(2 * gear.radius / gear.teeth, Gears.MODULE);
      // A front reader at the pitch circle's outer edge cannot enter another wheel.
      for (const other of gears.filter(other => other !== gear)) {
        const readerClearance = Math.hypot(gear.x - other.x, gear.z + gear.radius + .1 - other.z) - other.outerRadius;
        assert.ok(readerClearance >= .28);
      }
      if (!i) continue;
      const previous = gears[i - 1];
      close(Math.hypot(gear.x - previous.x, gear.z - previous.z), gear.radius + previous.radius);
      const contact = Math.atan2(gear.x - previous.x, gear.z - previous.z) / (Math.PI * 2);
      for (const time of [-3.86, 0, .129, 3.125, 4.01, 60.25]) {
        const a = previous.teeth * (contact - Gears.rimTurns(previous, time));
        const b = gear.teeth * (contact + .5 - Gears.rimTurns(gear, time));
        close(clockDistance(a + b, .5), 0, 'Each passing tooth faces a gap');
      }
      for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) {
        const overlap = Gears.FACE_WIDTH - Math.abs(Gears.lift(a) - Gears.lift(b));
        assert.ok(overlap >= .55 - 1e-12);
      }
      for (const other of gears.slice(0, i - 1)) {
        assert.ok(Math.hypot(gear.x - other.x, gear.z - other.z) > gear.outerRadius + other.outerRadius);
      }
    }
  }
});

test('every projected attack crosses the local reader after a signed phase adjustment', async () => {
  const song = await nativeSong();
  const gears = Gears.layout();
  for (const voice of song.modules) {
    const gear = gears.find(gear => gear.key === voice.key);
    for (const variant of voice.variants) {
      for (const event of variant.events) for (const phase of [0, 1/32, .281, .5, 31/32]) {
        const time = (phase + event.start) * periodBars;
        const onset = Gears.noteTurns(gear, event.start, periodBars);
        const sleeve = Gears.sleeveTurns(gear, time, phase, periodBars);
        close(clockDistance(sleeve + onset, 0), 0);
        const endTime = time + event.duration * periodBars;
        const tail = onset + Gears.noteTurns(gear, event.duration, periodBars);
        close(clockDistance(Gears.sleeveTurns(gear, endTime, phase, periodBars) + tail, 0), 0);
      }
    }
    for (const delta of [-1.1, -.18, .4, 1]) {
      const shift = Gears.phaseFromDrag(gear, delta);
      close(Gears.sleeveTurns(gear, 2, .14 + shift) - Gears.sleeveTurns(gear, 2, .14), delta);
    }
  }
});
