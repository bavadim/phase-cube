/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Local bounded flight recorder; export is initiated by the player, no endpoint. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(root);else root.PuzzleDiagnostics=factory(root);})(globalThis,function(root){
  'use strict';
  const KEY='music-puzzle-report/1',brief=e=>({name:String(e?.name||'Error'),message:String(e?.message||e).slice(0,1500),stack:String(e?.stack||'').slice(0,4000)});
  class Recorder{
    constructor({build,snapshot=()=>({}),capacity=400,storage}={}){
      Object.assign(this,{build,snapshot,capacity});this.started=new Date().toISOString();this.events=[];this.sequence=0;
      try{this.storage=storage===undefined?root.localStorage:storage;const saved=this.storage?.getItem(KEY);this.previous=saved&&saved.length<250000?JSON.parse(saved):null;}catch{this.storage=null;this.previous=null;}
      this.listeners=new AbortController();
      root.addEventListener?.('error',e=>{this.record('js.error',brief(e.error||e.message));this.save();},{signal:this.listeners.signal});
      root.addEventListener?.('unhandledrejection',e=>{this.record('js.rejection',brief(e.reason));this.save();},{signal:this.listeners.signal});
      root.addEventListener?.('pagehide',()=>this.save(),{signal:this.listeners.signal});
      this.record('boot');this.timer=setInterval(()=>this.save(),5000);this.timer.unref?.();
    }
    record(type,data={}){this.events.push({seq:++this.sequence,ms:Math.round(performance.now()),type,...data});if(this.events.length>this.capacity)this.events.splice(0,this.events.length-this.capacity);}
    report(previous=true){
      let state;try{state=this.snapshot();}catch(e){state={snapshotError:brief(e)};}
      const n=root.navigator,v=root.visualViewport;
      return{schema:'music-puzzle-report/1',build:this.build,started:this.started,created:new Date().toISOString(),
        environment:{userAgent:n?.userAgent,language:n?.language,touchPoints:n?.maxTouchPoints,viewport:[root.innerWidth,root.innerHeight],visualViewport:v?[v.width,v.height,v.scale]:null,pixelRatio:root.devicePixelRatio,visibility:root.document?.visibilityState},
        state,events:[...this.events],...(previous&&this.previous?{previous:this.previous}:{})};
    }
    save(){try{this.storage?.setItem(KEY,JSON.stringify(this.report(false)));}catch{}}
    async share(){
      this.record('report.export');this.save();
      const file=new File([JSON.stringify(this.report(),null,2)],'phase-cube-report-'+Date.now()+'.json',{type:'application/json'});
      if(root.navigator?.canShare?.({files:[file]})){
        try{await root.navigator.share({files:[file],title:'Phase Cube — отчёт об ошибке'});return 'shared';}
        catch(e){if(e.name==='AbortError')return 'cancelled';this.record('report.share-failed',brief(e));}
      }
      const url=URL.createObjectURL(file),a=root.document.createElement('a');a.href=url;a.download=file.name;root.document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);return 'downloaded';
    }
    destroy(){clearInterval(this.timer);this.listeners.abort();}
  }
  return {Recorder,brief};
});
