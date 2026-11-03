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
test('presentation factories are independently registered for every rules module',()=>{
 const context={window:{}},factories=new Map();
 for(const id of games.modules.map(g=>g.id)){const name=id[0].toUpperCase()+id.slice(1)+'View',create=()=>id;context[name]={create};factories.set(id,create);}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'graphics/puzzle-views.js'),'utf8'),context);
 for(const game of games.modules)assert.equal(context.window.PuzzleViews.get(game.id),factories.get(game.id));
 assert.throws(()=>context.window.PuzzleViews.get('missing'),/представления/);assert(Object.isFrozen(context.window.PuzzleViews));
});
