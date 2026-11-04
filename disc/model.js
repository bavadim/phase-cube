/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Three independent musical discs. One revolution is the COMPLETE phrase. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiscModel=factory();})(globalThis,function(){
  'use strict';
  const SCHEMA='disc-state/1',VERSION=1,MAX_GAIN=2;
  const finite=(n,fallback)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
  const wrap=n=>((n%1)+1)%1;
  function phase(n,steps=32,snap=true){const value=finite(n,0);return snap?((Math.round(value*steps)%steps)+steps)%steps/steps:wrap(value);}
  const gain=n=>Math.max(0,Math.min(MAX_GAIN,finite(n,1)));
  const clone=s=>({schema:SCHEMA,version:VERSION,phaseSteps:s.phaseSteps,parts:s.parts.map(p=>({...p}))});
  class Model{
    constructor(modules,{phaseSteps=32}={}){
      if(!Array.isArray(modules)||modules.length!==3||modules.some(m=>!m.key||!m.variants?.length)||new Set(modules.map(m=>m.key)).size!==3)throw Error('Нужны три диска с непустыми музыкальными фразами');
      if(!Number.isInteger(phaseSteps)||phaseSteps<1)throw Error('Нужна целочисленная сетка полного цикла');
      this.modules=modules;this.count=modules.length;this.phaseSteps=phaseSteps;this.history=[];this.selected=modules[0].key;
      this._state={schema:SCHEMA,version:VERSION,phaseSteps,parts:modules.map(m=>({key:m.key,installed:true,phase:0,gain:1,variant:0}))};
    }
    snapshot(){return clone(this._state);}
    choices(){return this.modules.map(m=>({key:m.key,label:m.name,disabled:false}));}
    select(key){if(!this.modules.some(m=>m.key===key))return false;this.selected=key;return true;}
    normalize(raw,{snap=true}={}){
      if(raw?.schema!==SCHEMA||raw?.version!==VERSION||!Array.isArray(raw.parts)||raw.phaseSteps!==undefined&&raw.phaseSteps!==this.phaseSteps)throw Error('Неподдерживаемое сохранение дисков');
      const input=new Map(raw.parts.filter(p=>p&&typeof p.key==='string').map(p=>[p.key,p]));
      return{schema:SCHEMA,version:VERSION,phaseSteps:this.phaseSteps,parts:this.modules.map(m=>{
        const p=input.get(m.key)||{};
        return{key:m.key,installed:p.installed===true,phase:phase(p.phase,this.phaseSteps,snap),gain:gain(p.gain),variant:Math.max(0,Math.min(m.variants.length-1,Math.floor(finite(p.variant,0))))};
      })};
    }
    restore(raw,{record=true,snap=true}={}){
      const next=this.normalize(raw,{snap});if(JSON.stringify(next)===JSON.stringify(this._state))return false;
      if(record){this.history.push(this.snapshot());if(this.history.length>120)this.history.shift();}
      this._state=next;return true;
    }
    set(key,patch,options){
      if(!this.modules.some(m=>m.key===key))return false;
      const next=this.snapshot(),part=next.parts.find(p=>p.key===key);
      for(const field of ['installed','phase','gain','variant'])if(Object.hasOwn(patch||{},field))part[field]=patch[field];
      return this.restore(next,options);
    }
    toggle(key){const p=this._state.parts.find(p=>p.key===key);return p?this.set(key,{installed:!p.installed}):false;}
    undo(){const previous=this.history.pop();if(!previous)return false;this._state=previous;return true;}
  }
  return Object.freeze({SCHEMA,VERSION,MAX_GAIN,phase,gain,Model,create:(modules,options)=>new Model(modules,options)});
});
