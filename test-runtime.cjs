/* SPDX-License-Identifier: AGPL-3.0-or-later */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const context={window:{addEventListener(){}},document:{addEventListener(){}},console:{log(){},warn:console.warn,error:console.error},performance,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,URL,Blob};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/strudel-web-1.3.0.js'),'utf8'),context);
const S=context.strudel;S.miniAllStrings();
const Phases=require('./phase-map.js'),{Loader}=require('./composition-loader.js');
context.PuzzlePhases=Phases;vm.runInContext(fs.readFileSync(path.join(__dirname,'music.js'),'utf8'),context);
context.PhaseCubeLibrary=require('./composition-loader.js');
const palette=require('./config.js').palette,registry=require('./puzzles/registry.js'),library=new Loader(S,{baseURL:pathToFileURL(__dirname+'/')});
module.exports={S,Phases,palette,registry,library,Music:context.window.PuzzleMusic.Music};
