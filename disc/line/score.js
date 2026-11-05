/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../music.js'), require('../../composition-contract.js'));
  } else root.FactoryScore = factory(root.DiscMusic, root.MusicCompositionContract);
})(globalThis, function (Music, Composition) {
  'use strict';
  const STEPS = 8;
  const SLOTS = Object.freeze([Object.freeze([0, 2, 4, 6]), Object.freeze([0, 3, 6])]);
  const NEUTRAL_GEARS = Object.freeze(Array.from({length:2}, () => Object.freeze({phase:0, level:1})));
  const GEAR_LEVEL_STEP = .25;
  const wrap = (n, length = STEPS) => ((n % length) + length) % length;
  const validIndex = i => Number.isInteger(i) && i >= 0 && i < STEPS;

  // Screen, paper and Strudel all read the same physical tab and two apertures.
  function eventAt(state, position) {
    const step = wrap(position), tab = wrap(step - state.rotor);
    const open = SLOTS.map((slots, i) => slots.includes(wrap(step - state.discs[i])));
    const metal = state.routes[tab], accented = step % 2 === 0;
    const kick = state.gears[0];
    const motor = kick.level > 0 && wrap(step - kick.phase) % 2 === 0;
    return {step, tab, open, motor, pitch:state.notes[step], route:metal ? 'metal' : 'glass',
      stamp:metal && (!state.clutch || open.every(Boolean)),
      length:accented ? 0.84 : 0.66, gain:accented ? 1 : 0.78};
  }

  function freeze(state) {
    return Object.freeze({notes:Object.freeze([...state.notes]), routes:Object.freeze([...state.routes]),
      rotor:state.rotor, discs:Object.freeze([...state.discs]), clutch:state.clutch,
      gears:Object.freeze(state.gears.map(({phase,level}) => Object.freeze({phase,level})))});
  }

  function create(S, song) {
    const bass = song.playerParts.find(part => part.key === 'bass');
    const source = Composition.attacks(bass.pattern, 0, song.periodBars).map(h => ({
      at:Number(h.whole.begin), pitch:typeof h.value.note === 'number' ? h.value.note : S.noteToMidi(h.value.note)
    })).sort((a,b) => a.at - b.at);
    // Two boxes per harmony from Turkish Circuit's four-bar bass line: root
    // and the sounding fifth at its late syncopation. The belt lasts one bar.
    const notes = Array.from({length:STEPS}, (_, i) => {
      const at = Math.floor(i / 2) + (i % 2) * 11/16;
      return source.filter(note => note.at <= at).at(-1).pitch;
    });
    const palette = Object.freeze(Array.from(new Set(source.map(note => note.pitch))).sort((a,b) => a-b));
    const original = freeze({notes, routes:[true,false,true,false,false,true,true,false],
      rotor:0, discs:[0,0], clutch:true, gears:NEUTRAL_GEARS});
    let state = original;

    function restore(next) {
      const eight = (value, predicate) => Array.isArray(value) && value.length === STEPS &&
        Array.from(value).every(predicate);
      if (!next || !eight(next.notes, p => palette.includes(p)) ||
          !eight(next.routes, r => typeof r === 'boolean') || !validIndex(next.rotor) ||
          !Array.isArray(next.discs) || next.discs.length !== 2 ||
          !Array.from(next.discs).every(validIndex) || typeof next.clutch !== 'boolean') {
        throw new Error('Повреждены настройки музыкальной линии');
      }
      // Saves from the original line have no gear controls.
      const gears = next.gears === undefined ? NEUTRAL_GEARS : next.gears;
      if (!Array.isArray(gears) || gears.length !== 2 || !Array.from(gears).every(g =>
        g && validIndex(g.phase) && Number.isFinite(g.level) && g.level >= 0 && g.level <= 2 &&
        Number.isInteger(g.level / GEAR_LEVEL_STEP))) throw new Error('Повреждены настройки шестерён');
      const replacement = freeze({...next, gears});
      if (JSON.stringify(replacement) === JSON.stringify(state)) return false;
      state = replacement;
      return true;
    }

    function edit(action, index, delta = 1) {
      if (!Number.isInteger(delta)) return false;
      const next = {...state};
      switch (action) {
        case 'note':
          if (!validIndex(index)) return false;
          next.notes = [...state.notes];
          next.notes[index] = palette[wrap(palette.indexOf(state.notes[index]) + delta, palette.length)];
          break;
        case 'tab':
          if (!validIndex(index)) return false;
          next.routes = [...state.routes];
          next.routes[index] = !next.routes[index];
          break;
        case 'rotor': next.rotor = wrap(state.rotor + delta); break;
        case 'disc':
          if (index !== 0 && index !== 1) return false;
          next.discs = [...state.discs];
          next.discs[index] = wrap(next.discs[index] + delta);
          break;
        case 'clutch': next.clutch = !state.clutch; break;
        case 'gearPhase':
        case 'gearLevel': {
          if (index !== 0 && index !== 1) return false;
          const gear = state.gears[index];
          next.gears = [...state.gears];
          next.gears[index] = action === 'gearPhase'
            ? {...gear, phase:wrap(gear.phase + delta)}
            : {...gear, level:Math.max(0, Math.min(2, gear.level + delta * GEAR_LEVEL_STEP))};
          break;
        }
        case 'reset': return restore(original);
        default: return false;
      }
      return restore(next);
    }

    // The original kit provides the motor kick and stamp. Taking the patch
    // from an authored attack preserves the bank, envelope and mix settings.
    const authoredKit = Composition.attacks(song.backing, 8, 9);
    const sourcePatch = key => {
      const hit = authoredKit.find(h => h.value._phaseCubePart === key);
      if (!hit) throw new Error('В исходной композиции отсутствует партия ' + key);
      return hit.value;
    };
    const kick = sourcePatch('kick'), snare = sourcePatch('snare');
    const hookHits = authoredKit.filter(hit => hit.value._phaseCubePart === 'hook');
    if (!hookHits.length) throw new Error('В исходной композиции отсутствует фортепианная фраза');
    const piano = Music.loopHaps(S, hookHits, 8, 1);
    const gearMarks = Object.freeze([
      Object.freeze([0, .25, .5, .75]),
      Object.freeze([...new Set(hookHits.map(hit => Number(hit.whole.begin) - 8))].sort((a,b) => a-b))
    ]);
    const patches = {
      glass:{s:'sine', fmh:3, fmi:1.75, attack:.002, decay:.11, sustain:.13, release:.10, gain:.68, pan:.34},
      metal:{s:'triangle', fmh:2.47, fmi:2.6, cutoff:3100, attack:.001, decay:.073, sustain:.22, release:.045, gain:.63, pan:.65}
    };
    function pattern(snapshot = state) {
      const haps = [];
      function add(step, length, part, value) {
        const start = S.Fraction(step / STEPS);
        const span = new S.TimeSpan(start, start.add(1 / STEPS));
        haps.push(new S.Hap(span, span, {...value, duration:length, _phaseCubePart:part}));
      }
      for (let step = 0; step < STEPS; step++) {
        const event = eventAt(snapshot, step);
        add(step, event.length/STEPS, event.route, {...patches[event.route], note:event.pitch, velocity:event.gain});
        if (event.motor) add(step, .074, 'motor', {...kick, postgain:(kick.postgain ?? 1)*.72*snapshot.gears[0].level});
        if (event.stamp) add(step, .071, 'stamp', snare);
      }
      const line = Music.loopHaps(S, haps, 0, 1);
      const {phase,level} = snapshot.gears[1];
      if (level === 0) return line;
      let phrase = phase ? piano.late(phase / STEPS) : piano;
      if (level !== 1) phrase = phrase.withValue(v => ({...v, postgain:(v.postgain ?? 1) * level}));
      return S.stack(line, phrase);
    }
    return {palette, gearMarks, snapshot:() => state, restore, edit, pattern};
  }
  return Object.freeze({STEPS, SLOTS, GEAR_LEVEL_STEP, eventAt, create});
});
