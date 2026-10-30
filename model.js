/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Cube moves come from cubejs. This adapter uses its corner action only. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhaseCube = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const SLOTS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  const CORNER_FACES = SLOTS.map(s => s.split(''));
  const POSITIONS = [[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1],[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]];
  const mod = (n, m) => ((n % m) + m) % m;
  function snapshot(cube) { return { cp: [...cube.cp], co: [...cube.co] }; }
  function valid(s) {
    return s && Array.isArray(s.cp) && Array.isArray(s.co) && s.cp.length === 8 && s.co.length === 8 &&
      new Set(s.cp).size === 8 && s.cp.every(x => Number.isInteger(x) && x >= 0 && x < 8) &&
      s.co.every(x => Number.isInteger(x) && x >= 0 && x < 3) && s.co.reduce((a,b) => a+b, 0) % 3 === 0;
  }
  function restore(cube, s) {
    if (!valid(s)) throw new Error('Invalid corner configuration');
    cube.identity(); cube.cp = [...s.cp]; cube.co = [...s.co]; return cube;
  }
  function solved(s) { return s.cp.every((id, j) => id === j && s.co[j] === 0); }
  function correct(s) { return s.cp.reduce((n,id,j) => n + (id === j && s.co[j] === 0), 0); }
  function phases(s) {
    const result = Array(8);
    s.cp.forEach((id, slot) => { result[id] = { id, slot, orientation: s.co[slot], ticks: mod(3*slot + 8*s.co[slot] - 3*id, 24) }; });
    return result;
  }
  function inverse(move) { return move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move + "'"; }
  function appendPath(path, move) {
    const power = m => m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1;
    const out = [...path];
    if (out.length && out[out.length-1][0] === move[0]) {
      const n = (power(out.pop()) + power(move)) % 4;
      if (n) out.push(move[0] + (n === 2 ? '2' : n === 3 ? "'" : ''));
    } else out.push(move);
    return out;
  }
  function scramble(seed, length = 3) {
    let x = seed >>> 0;
    const random = () => { x = (Math.imul(x,1664525)+1013904223) >>> 0; return x / 4294967296; };
    const moves = []; let last = '';
    for (let i=0; i<length; i++) {
      const available = FACES.filter(f => f !== last);
      const face = available[Math.floor(random()*available.length)];
      moves.push(face + (random() < .5 ? "'" : '')); last = face;
    }
    return moves;
  }
  function stickers(s, slot) {
    const id = s.cp[slot], co = s.co[slot];
    return CORNER_FACES[id].map((color, n) => ({ color, face: CORNER_FACES[slot][(n+co)%3], id }));
  }
  return { FACES, SLOTS, CORNER_FACES, POSITIONS, mod, snapshot, restore, valid, solved, correct, phases, inverse, appendPath, scramble, stickers };
});
