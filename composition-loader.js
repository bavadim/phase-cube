/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Score import, catalog and caching. Composition semantics belong to the contract. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./compositions/catalog.js'),require('./composition-contract.js'));else root.PuzzleCompositions=factory(root.CompositionCatalog,root.MusicCompositionContract);})(globalThis,function(files,Contract){
  'use strict';
  class Loader{
    constructor(S,{baseURL}={}){this.S=S;this.baseURL=baseURL||new URL('./',document.baseURI);this.cache=new Map();this.modules=new Map();}
    async module(id){
      if(!files.includes(id))throw new Error('Неизвестная композиция: '+id);
      if(!this.modules.has(id)){
        const url=new URL(`compositions/${id}.strudel.mjs`,this.baseURL);url.searchParams.set('v','contracts1');
        const source=globalThis.PhaseCubeEmbeddedCompositions?.[id]||import(url.href),pending=Promise.resolve(source).then(Contract.inspectModule);
        this.modules.set(id,pending);pending.catch(()=>this.modules.delete(id));
      }
      return this.modules.get(id);
    }
    async load(id){
      if(!files.includes(id))throw new Error('Неизвестная композиция: '+id);
      if(!this.cache.has(id)){
        const pending=(async()=>{
          const module=await this.module(id);
          return Contract.analyze(this.S,await module.default(this.S),id);
        })();
        this.cache.set(id,pending);pending.catch(()=>this.cache.delete(id));
      }
      return this.cache.get(id);
    }
    async catalog(){return Promise.all(files.map(async id=>({...((await this.module(id)).metadata),id})));}
  }
  return {Loader};
});
