/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const games=require('./puzzles/registry.js'),Game=require('./puzzle-contract.js'),Composition=require('./composition-contract.js'),Compositions=require('./composition-loader.js'),catalog=require('./compositions/catalog.js');
test('game rules and composition contracts load without DOM, graphics or the audio engine',()=>{
 assert(Object.isFrozen(catalog));assert(catalog.length>0);assert.equal(new Set(catalog).size,catalog.length);
 assert.deepEqual(Object.keys(Compositions),['Loader']);assert.equal(Composition.Loader,undefined);
 for(const game of games.modules){assert.equal(game.mount,undefined);assert(Game.inspect(game).model.solved());}
 const good={metadata:{schema:'music-composition/1',version:1,title:'T',style:'S',bpm:120,download:'track.mp3'},default:()=>{throw Error('Catalog must never compile the score');}};
 assert.equal(Composition.inspectModule(good),good);
 for(const bad of [{...good,default:null},{...good,metadata:{...good.metadata,bpm:NaN}},{...good,metadata:{...good.metadata,schema:'other'}}])assert.throws(()=>Composition.inspectModule(bad),/композиции/);
});
test('each puzzle owns its module and only depends on shared pure domain code',()=>{
 // Inspect actual CommonJS dependencies, including transitive imports. This
 // catches accidental manifest inheritance even when all runtime tests pass.
 const relative=file=>path.relative(__dirname,file).split(path.sep).join('/');
 for(const game of games.modules){
  const entry=require.resolve('./puzzles/'+game.id+'/module.js'),seen=new Set(),queue=[require.cache[entry]];
  while(queue.length){
   const dependency=queue.pop();if(seen.has(dependency.id))continue;seen.add(dependency.id);
   const file=relative(dependency.filename);
   if(/^puzzles\/[^/]+\/module\.js$/.test(file))assert.equal(dependency.filename,entry,game.id+' depends on another puzzle module: '+file);
   assert(!file.startsWith('graphics/')&&!file.endsWith('/three-view.js'),game.id+' imports presentation: '+file);
   // This legacy filename is a pure native-event partitioner, not a UI control.
   if(file.startsWith('controls/'))assert.equal(file,'controls/pattern-pieces.js',game.id+' imports a UI control: '+file);
   assert(!['app.js','transport.js','composition-loader.js','session-loader.js'].includes(file),game.id+' imports application lifecycle: '+file);
   queue.push(...dependency.children);
  }
  assert(seen.size>1,'Inspect a real dependency graph for '+game.id);
 }
});
test('presentation factories are independently registered for every rules module',()=>{
 const context={window:{}},factories=new Map();
 for(const id of games.modules.map(g=>g.id)){const name=id[0].toUpperCase()+id.slice(1)+'View',create=()=>id;context[name]={create};factories.set(id,create);}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'graphics/puzzle-views.js'),'utf8'),context);
 for(const game of games.modules)assert.equal(context.window.PuzzleViews.get(game.id),factories.get(game.id));
 assert.throws(()=>context.window.PuzzleViews.get('missing'),/представления/);assert(Object.isFrozen(context.window.PuzzleViews));
});
