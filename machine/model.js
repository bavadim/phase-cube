/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Free composition state. No renderer, transport, target, score or puzzle solver. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MachineModel=factory();})(globalThis,function(){
  'use strict';
  const SCHEMA='mechanism/1',VERSION=1,PHASE_STEPS=8,MAX_GAIN=1.5;
  const finite=(n,fallback)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
  const phase=n=>((Math.round(finite(n,0)*PHASE_STEPS)%PHASE_STEPS)+PHASE_STEPS)%PHASE_STEPS/PHASE_STEPS;
  const gain=n=>Math.round(Math.max(0,Math.min(MAX_GAIN,finite(n,1)))*100)/100;
  const clone=s=>({schema:SCHEMA,version:VERSION,parts:s.parts.map(p=>({...p}))});
  class Model{
    constructor(modules){
      if(!Array.isArray(modules)||!modules.length||modules.some(m=>!m.key)||new Set(modules.map(m=>m.key)).size!==modules.length)throw Error('Механизму нужны детали с уникальными ключами');
      this.modules=modules;this.count=modules.length;this.history=[];this.selected=modules.find(m=>m.available!==false)?.key||modules[0].key;
      this._state={schema:SCHEMA,version:VERSION,parts:modules.map(m=>({key:m.key,installed:m.available!==false&&['pulse','bass'].includes(m.key),phase:0,gain:1,variant:0}))};
    }
    snapshot(){return clone(this._state);}
    choices(){return this.modules.map(m=>({key:m.key,label:m.name,disabled:m.available===false}));}
    select(key){if(!this.modules.some(m=>m.key===key))return false;this.selected=key;return true;}
    normalize(raw){
      if(raw?.schema!==SCHEMA||raw?.version!==VERSION||!Array.isArray(raw.parts))throw Error('Неподдерживаемое сохранение механизма');
      const input=new Map(raw.parts.filter(p=>p&&typeof p.key==='string').map(p=>[p.key,p]));
      return{schema:SCHEMA,version:VERSION,parts:this.modules.map(m=>{
        const p=input.get(m.key)||{},count=m.variants?.length||0;
        return{key:m.key,installed:m.available!==false&&count>0&&p.installed===true,phase:phase(p.phase),gain:gain(p.gain),variant:Math.max(0,Math.min(Math.max(0,count-1),Math.floor(finite(p.variant,0))))};
      })};
    }
    restore(raw,{record=true}={}){
      const next=this.normalize(raw);if(JSON.stringify(next)===JSON.stringify(this._state))return false;
      if(record){this.history.push(this.snapshot());if(this.history.length>120)this.history.shift();}
      this._state=next;return true;
    }
    set(key,patch){
      if(!this.modules.some(m=>m.key===key))return false;
      const next=this.snapshot(),part=next.parts.find(p=>p.key===key);
      for(const field of ['installed','phase','gain','variant'])if(Object.hasOwn(patch||{},field))part[field]=patch[field];
      return this.restore(next);
    }
    toggle(key){const p=this._state.parts.find(p=>p.key===key);return p?this.set(key,{installed:!p.installed}):false;}
    undo(){const previous=this.history.pop();if(!previous)return false;this._state=previous;return true;}
  }
  return Object.freeze({SCHEMA,VERSION,PHASE_STEPS,MAX_GAIN,phase,gain,Model,create:modules=>new Model(modules)});
});
