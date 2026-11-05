/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../music.js'), require('../../composition-contract.js'));
  } else {
    root.ConveyorScore = factory(root.DiscMusic, root.MusicCompositionContract);
  }
})(globalThis, function (Music, Composition) {
  'use strict';
  const BARS = 4;
  const STEPS_PER_BAR = 16;
  const STEPS = BARS * STEPS_PER_BAR;
  const SPEEDS = Object.freeze([0.5, 1, 2]);
  const SCHEMA = 'conveyor/1';
  const wrap = (n, period) => n - Math.floor(n / period) * period;
  const clone = state => ({...state, parts: state.parts.map(p => ({...p, notes: p.notes.map(n => ({...n}))}))});
  const stepAt = (part, time) => wrap(time * part.speed + part.offset, BARS) * STEPS_PER_BAR;
  const offsetAt = (from, speed, time) => wrap(from.offset + (from.speed - speed) * time, BARS);

  // The outgoing belt and its replacement must pass the same point at the
  // *audible* revision boundary, including when a queued gear is superseded.
  function alignSpeeds(desired, audible, time) {
    if (!Number.isFinite(time)) throw Error('Нужно время включения передачи');
    const next = clone(desired);
    for (const p of next.parts) {
      const previous = audible.parts.find(other => other.key === p.key);
      p.offset = offsetAt(previous, p.speed, time);
    }
    return next;
  }

  const validPitch = n => Number.isInteger(n) && n >= 0 && n <= 127;
  const validStep = n => Number.isInteger(n) && n >= 0 && n < STEPS;
  const validLength = n => Number.isFinite(n) && n > 0 && n <= STEPS;
  const byPosition = (a,b) => a.step - b.step || a.pitch - b.pitch || a.id.localeCompare(b.id);

  function create(S, prepared) {
    if (prepared.periodBars !== BARS) throw Error('Для ленты нужны четыре такта');
    const sources = new Map();
    const parts = prepared.modules.map(m => {
      const native = Composition.attacks(m.variants[0].pattern, 0, BARS);
      const templates = Array.from(native, hap => {
        const value = hap.value;
        const pitch = typeof value.note === 'number' ? value.note : S.noteToMidi(value.note);
        const step = Number(hap.whole.begin) * STEPS_PER_BAR;
        const length = Number(hap.duration) * STEPS_PER_BAR;
        if (!validStep(step) || !validPitch(pitch) || !validLength(length)) throw Error('Нота вне сетки ленты');
        return {step, pitch, length, span: Number(hap.whole.duration), value};
      });
      sources.set(m.key, templates);
      const notes = templates.map(({step,pitch,length},source) => ({id:m.key+'-'+source, step,pitch,length,source}));
      return {key:m.key, speed:1, offset:0, notes:notes.sort(byPosition)};
    });
    const original = {schema:SCHEMA, songId:prepared.song.id, parts};
    let current = original, serial = 0;
    const history = [];
    function commit(next, record = true) {
      if (JSON.stringify(next) === JSON.stringify(current)) return false;
      if (record) {
        history.push(current);
        if (history.length > 120) history.shift();
      }
      current = next;
      return true;
    }
    function change(key, fn) {
      const next = clone(current);
      const part = next.parts.find(p => p.key === key);
      if (!part || !fn(part)) return false;
      part.notes.sort(byPosition);
      return commit(next);
    }
    function validate(data) {
      if (data?.schema !== SCHEMA || data.songId !== original.songId || data.parts?.length !== parts.length) {
        throw Error('Неизвестная сборка конвейера');
      }
      const next = {schema:SCHEMA, songId:original.songId, parts:[]};
      for (const {key} of parts) {
        const p = data.parts.find(p => p?.key === key);
        if (!p || !SPEEDS.includes(p.speed) || !Number.isFinite(p.offset) || !Array.isArray(p.notes) || p.notes.length > 1024) {
          throw Error('Повреждена партия конвейера');
        }
        const ids = new Set(), cells = new Set();
        const notes = p.notes.map(n => {
          if (!n || typeof n.id !== 'string' || !n.id || n.id.length > 96 || ids.has(n.id) ||
              !validStep(n.step) || !validPitch(n.pitch) || !validLength(n.length) ||
              !Number.isInteger(n.source) || !sources.get(key)[n.source] || cells.has(n.step+'@'+n.pitch)) {
            throw Error('Повреждена плитка конвейера');
          }
          ids.add(n.id); cells.add(n.step+'@'+n.pitch);
          return {id:n.id,step:n.step,pitch:n.pitch,length:n.length,source:n.source};
        });
        next.parts.push({key,speed:p.speed,offset:wrap(p.offset,BARS),notes:notes.sort(byPosition)});
      }
      return next;
    }
    function eventFor(p, note) {
      const src = sources.get(p.key)[note.source];
      const changedLength = src.length !== note.length;
      const gate = note.length / (STEPS_PER_BAR * p.speed);
      const start = S.Fraction(wrap(note.step / STEPS_PER_BAR - p.offset, BARS)).div(p.speed);
      const span = changedLength ? gate : src.span / p.speed;
      const whole = new S.TimeSpan(start, start.add(span));
      const value = {...src.value};
      if (note.pitch !== src.pitch) value.note = note.pitch;
      // The authored gates are explicit Strudel durations; fast() alone
      // would leave them at their old length.
      if (changedLength || p.speed !== 1) value.duration = gate / (value.clip ?? 1);
      return new S.Hap(whole, whole, value);
    }
    function pattern(state = current) {
      const voices = state.parts.map(p =>
        Music.loopHaps(S, p.notes.map(note => eventFor(p,note)), 0, BARS / p.speed)
      );
      return S.stack(...voices);
    }
    return {
      snapshot: () => clone(current),
      noteEvent(key,id) {
        const part = current.parts.find(p => p.key === key);
        const note = part?.notes.find(n => n.id === id);
        return note ? eventFor(part,note) : null;
      },
      restore: (state, {record=true}={}) => commit(validate(state), record),
      setSpeed(key, speed, time = 0) {
        return change(key,p => {
          if (!SPEEDS.includes(speed) || !Number.isFinite(time) || p.speed === speed) return false;
          p.offset = offsetAt(p,speed,time); p.speed = speed; return true;
        });
      },
      add(key, {step, pitch, length=1}) {
        let id = null;
        change(key, p => {
          if (!validStep(step) || !validPitch(pitch) || !validLength(length) || p.notes.length >= 1024 ||
              p.notes.some(n => n.step === step && n.pitch === pitch)) return false;
          const templates = sources.get(key);
          // Borrow the nearest authored attack's patch and dynamics.
          let source = 0;
          const distance = t => Math.min(wrap(step-t.step,STEPS), wrap(t.step-step,STEPS));
          for (let i=1; i<templates.length; i++) if (distance(templates[i]) < distance(templates[source])) source = i;
          do { id = 'u'+(++serial); } while (p.notes.some(n => n.id === id));
          p.notes.push({id,step,pitch,length,source}); return true;
        });
        return id;
      },
      edit(key,id,patch) {
        return change(key,p => {
          const n = p.notes.find(n => n.id === id);
          if (!n) return false;
          const {step=n.step, pitch=n.pitch, length=n.length} = patch;
          if (!validStep(step) || !validPitch(pitch) || !validLength(length) ||
              p.notes.some(other => other !== n && other.step === step && other.pitch === pitch)) return false;
          Object.assign(n,{step,pitch,length}); return true;
        });
      },
      remove(key,id) {
        return change(key,p => {
          const index = p.notes.findIndex(n => n.id === id);
          if (index < 0) return false;
          p.notes.splice(index,1); return true;
        });
      },
      reset: () => commit(original),
      get canUndo() { return history.length > 0; },
      undo() { if (!history.length) return false; current = history.pop(); return true; },
      pattern
    };
  }
  return Object.freeze({create, stepAt, alignSpeeds, BARS, STEPS, STEPS_PER_BAR, SPEEDS});
});
