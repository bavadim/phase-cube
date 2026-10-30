/* SPDX-License-Identifier: AGPL-3.0-or-later */
const assert = require('node:assert/strict');
const Cube = require('./vendor/cube-1.3.2.js');
const M = require('./model.js');
const solved = M.snapshot(new Cube());
let checks = 0;
function check(value, message) { assert(value, message); checks++; }
function same(a,b) { return JSON.stringify(a)===JSON.stringify(b); }
for (const face of M.FACES) {
  const cube = new Cube();
  cube.move(Array(4).fill(face).join(' '));
  check(same(M.snapshot(cube),solved),face+'^4 = identity');
  cube.move(face+' '+M.inverse(face));
  check(same(M.snapshot(cube),solved),face+' inverse');
  const c = new Cube();c.move(face);
  check(M.phases(M.snapshot(c)).filter(p=>p.ticks!==0).length===4,face+' changes exactly four objects');
}
const ur=new Cube().move('U R'), ru=new Cube().move('R U');
check(!same(M.snapshot(ur),M.snapshot(ru)),'adjacent faces do not commute');
for (let seed=1;seed<=100;seed++) {
  const moves=M.scramble(seed,20),cube=new Cube().move(moves.join(' ')),state=M.snapshot(cube);
  check(M.valid(state),'legal state '+seed);
  const ps=M.phases(state);
  check(ps.every(p=>Number.isInteger(p.ticks)&&p.ticks>=0&&p.ticks<24),'24-step phase domain');
  check(ps.every(p=>(p.ticks===0)===(p.slot===p.id&&p.orientation===0)),'zero iff object is home');
  let path=[];for(const m of moves)path=M.appendPath(path,m);
  const replay=new Cube().move(path.join(' '));
  check(same(M.snapshot(replay),state),'path reduction preserves state');
  cube.move(moves.slice().reverse().map(M.inverse).join(' '));
  check(same(M.snapshot(cube),solved),'scramble + inverse');
  check(M.phases(M.snapshot(cube)).every(p=>p.ticks===0),'all phases restore');
  const restored=M.restore(new Cube(),state);
  check(same(M.snapshot(restored),state),'restore roundtrip');
  for(let j=0;j<8;j++)check(M.stickers(state,j).map(s=>s.face).sort().join('')===M.CORNER_FACES[j].slice().sort().join(''),'stickers stay on corner faces');
}
let path=[];for(let i=0;i<4;i++)path=M.appendPath(path,'R');
check(path.length===0,'four turns reduce to empty path');
check(!M.valid({cp:[0,0,2,3,4,5,6,7],co:Array(8).fill(0)}),'reject duplicate object');
check(!M.valid({cp:[0,1,2,3,4,5,6,7],co:[1,0,0,0,0,0,0,0]}),'reject impossible twist');
console.log(JSON.stringify({status:'PASS',checks,scope:'cubejs corner moves; phase mapping; inverses; legal scrambles; sticker mapping',audio:'NOT_TESTED'},null,2));
