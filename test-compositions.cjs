/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),path=require('node:path');
const root=__dirname;
const context={window:{addEventListener(){}},document:{addEventListener(){}},console:{log(){},warn:console.warn,error:console.error},performance,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,URL,Blob};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'vendor/strudel-web-1.3.0.js'),'utf8'),context);const S=context.strudel;S.miniAllStrings();
const {Loader,analyze,attacks}=require('./composition-loader.js');
const palette=require('./config.js').palette;
const loader=new Loader(S,{palette,baseURL:pathToFileURL(root+'/')});
test('pinned Strudel compiles every score and derives the cube from declared player parts',async()=>{
 const catalog=await loader.catalog();assert.equal(catalog.length,3);
 assert(catalog.every(item=>item.title&&!item.pattern),'Catalog must not compile unselected scores');
 const songs=await Promise.all(catalog.map(item=>loader.load(item.id)));
 for(const song of songs){
  assert.equal(song.game.voices.length,8);assert.equal(song.game.targetRows.length,8);
  assert.equal(song.stats.seconds,song.bars*240/song.bpm);
  assert.equal(song.stats.parts.reduce((n,p)=>n+p.pieces,0),8);
  assert.deepEqual([...new Set(song.game.voices.map(v=>v.part))],song.playerParts.map(p=>p.key));
  for(const rows of song.game.targetRows)assert(rows.length&&rows.every(e=>e.start>=0&&e.start<1&&e.duration>0));
  const expected=attacks(S.stack(...song.playerParts.map(p=>p.pattern)),0,song.periodBars);
  assert.equal(song.game.targetRows.reduce((n,row)=>n+row.length,0),expected.length,'Partition must neither lose nor double notes');
  assert.equal(await loader.load(song.id),song,'Cache should reuse the score object');
 }
 const mozart=songs[0];assert.equal(mozart.stats.attacks,2491);assert.equal(mozart.stats.instruments,13);
 assert.deepEqual(mozart.stats.parts.map(p=>p.pieces),[3,3,2]);
 // Independent native score: compare pitch, onset, gate and dynamics for every event.
 // Reference: native score SHA-256 916986c042bf3463bd8f32b3af2a430f653d0fd26ad740043e0c172761ba4c46.
 const key=row=>JSON.stringify(row.map(n=>Math.round(n*1e6)/1e6));
 const actual=attacks(mozart.pattern,0,mozart.bars).map(h=>key([Number(h.whole.begin)*4,typeof h.value.note==='number'?h.value.note:S.noteToMidi(h.value.note),Number(h.duration)*4,h.value.velocity])).sort();
 const digest=require('node:crypto').createHash('sha256').update(JSON.stringify(actual)).digest('hex');
 assert.equal(digest,'13b33577977acd871da2b9aacb91ad881a552ce1a328be0473816b3b2cf24ef7','All 2491 events must preserve the authored composition');
});
test('module changes drive all displayed metadata and player rows without a config edit',async()=>{
 const base=await loader.load('turkish-circuit');
 const changed=analyze(S,{...base,title:'Другая музыка',bpm:120,playerParts:[{key:'bell',name:'Колокольчик',pattern:S.note('c5 d5 e5 f5 g5 a5 b5 c6').s('sine').duration(.1)}]},'test',palette);
 assert.equal(changed.stats.seconds,128);assert.equal(changed.game.voices.length,8);
 assert(changed.game.voices.every(v=>v.name.startsWith('Колокольчик')));
 assert.deepEqual(changed.stats.parts.map(p=>p.key),['bell']);
 assert.throws(()=>analyze(S,{...base,playerParts:[]},'test',palette),/партий/);
 assert.throws(()=>analyze(S,{...base,periodBars:3},'test',palette),/целое/);
 assert.throws(()=>analyze(S,{...base,playerParts:[{key:'x',name:'Пусто',pattern:S.silence}]},'test',palette),/Пустая/);
});
