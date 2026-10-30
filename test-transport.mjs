/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Real upstream Pattern + Cyclist; deterministic AudioParam/mixer fixture.
// This test proves transport logic, not PCM or human musical acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Pattern,Cyclist,pure} from '@strudel/core';
globalThis.window={};
await import('./transport.js');
const Transport=window.PhaseCubeTransport;
const checks=[];
const check=(v,name)=>{assert(v,name);checks.push({name,status:'PASS'});};
let ctx,controller,events=[],intervalCallback;
class Param {
  constructor(value=1){this.events=[{t:-1,value}];}
  setValueAtTime(value,t){this.events.push({t,value});this.events.sort((a,b)=>a.t-b.t);return this;}
  linearRampToValueAtTime(value,t){return this.setValueAtTime(value,t);}
  cancelScheduledValues(t){this.events=this.events.filter(e=>e.t<t);return this;}
  valueAt(t){return this.events.filter(e=>e.t<=t).at(-1)?.value??0;}
  get value(){return this.valueAt(ctx.currentTime);}
}
function freshController(){return {nodes:{},output:{destinationGain:{gain:new Param(),connect(){}}},getOrbit(id){return this.nodes[id]??=( {output:{gain:new Param()},disconnected:false,disconnect(){this.disconnected=true;}} );}};}
function fixture(){
  ctx={currentTime:0,state:'suspended',resume:async()=>{ctx.state='running';},suspend:async()=>{ctx.state='suspended';},createAnalyser:()=>({fftSize:2048})};
  controller=freshController();events=[];
  const S={Pattern,getAudioContext:()=>ctx,getSuperdoughAudioController:()=>controller,initAudio:async()=>{},
    resetGlobalEffects:()=>{Object.values(controller.nodes).forEach(b=>b.disconnect());controller=freshController();},
    webaudioOutput:async(h,deadline,duration,cps,t)=>{events.push({h,t,duration,bus:controller.getOrbit(h.value.orbit)});}};
  const tr=new Transport(S);
  const scheduler=new Cyclist({getTime:()=>ctx.currentTime,onTrigger:(...a)=>tr.output(...a),
    setInterval:cb=>{intervalCallback=cb;return 1;},clearInterval:()=>{intervalCallback=null;}});
  const repl={scheduler,stop:()=>scheduler.stop(),setPattern:(p,start)=>scheduler.setPattern(p,start)};
  tr.attach(repl);return {tr,S,scheduler};
}
async function advance(time,tr){
  while(ctx.currentTime+.025<time){ctx.currentTime+=.025;intervalCallback?.();tr.poll();await Promise.resolve();}
  ctx.currentTime=time;intervalCallback?.();tr.poll();await Promise.resolve();
}
const P=pure({s:'triangle',note:'c3',gain:.1});
const Q=pure({s:'triangle',note:'g3',gain:.1});
const R=pure({s:'sine',note:'eb3',gain:.1});
let {tr,scheduler}=fixture();
await tr.start(P,144,.65,{name:'P'},Promise.resolve());
check(tr.running&&tr.want&&ctx.state==='running','explicit play starts native Cyclist');
await advance(tr.timeAt(.25),tr);
const active=tr.active;
tr.queue(Q,{name:'Q'});
const pending=tr.pending;
check(pending.begin===1,'mid-bar change targets next integer cycle');
check(pending.audioBegin-ctx.currentTime<=240/144+1e-6,'queued delay is bounded by one bar');
check(active.bus.output.gain.valueAt(pending.audioBegin+.001)===0,'old voices, even long sources, are gated off at boundary');
check(pending.bus.output.gain.valueAt(pending.audioBegin-.01)===0,'new revision is silent before boundary');
check(pending.bus.output.gain.valueAt(pending.audioBegin+.001)===1,'new revision opens at exact boundary');
tr.queue(R,{name:'R'});
check(tr.pending.begin===1&&tr.pending.meta.name==='R','latest edit replaces pending edit without postponing bar');
check(pending.bus.output.gain.valueAt(pending.audioBegin+.01)===0,'replaced pending revision never sounds');
await advance(tr.timeAt(1)+.001,tr);
check(tr.active.meta.name==='R'&&!tr.pending,'latest revision is applied at boundary');
const applied=tr.changes.find(x=>x.type==='apply');
check(applied.cycle===1&&applied.observedDelay<=.026,'apply observation follows audio boundary within poll interval');
const current=tr.active;
await advance(tr.timeAt(1.98),tr);
check(scheduler.lastEnd>2,'fixture reaches native lookahead beyond next bar');
tr.queue(Q,{name:'backfill'});
const qid=tr.pending.id;
check(events.some(e=>e.h.value.orbit===qid&&Number(e.h.whole.begin)===2),'lookahead backfills first new downbeat');
await advance(tr.timeAt(2)+.08,tr);
check(events.filter(e=>e.h.value.orbit===qid&&Number(e.h.whole.begin)===2).length===1,'backfilled downbeat is not duplicated');
check(current.bus.output.gain.valueAt(tr.timeAt(2)+.001)===0,'old lookahead cannot leak through cut bus');
tr.queue(P,{name:'cancel-on-stop'});
await tr.stop();
check(!tr.running&&!tr.want&&!scheduler.started,'stop synchronously clears playback intent and scheduler');
check(!tr.pending&&tr.entries.length===0,'stop cancels pending bar transaction');
check(ctx.state==='suspended'&&controller.output.destinationGain.gain.value===0,'stop suspends context with zero master gain');
const count=events.length;
await advance(ctx.currentTime+2,tr);
check(events.length===count,'no event clock continues after stop');
await tr.start(Q,120,.65,{name:'restart'},Promise.resolve());
check(tr.active.meta.name==='restart'&&tr.entries.length===1&&!tr.pending,'restart uses fresh graph without stale queued mix');
await tr.stop();

// Stop while a delayed native initialization is still outstanding.
({tr}=fixture());
let releaseInit,enteredInit;
const entered=new Promise(r=>enteredInit=r);
tr.S.initAudio=()=>{enteredInit();return new Promise(r=>releaseInit=r);};
const startup=tr.start(P,144,.65,{name:'race'},Promise.resolve());
await entered;
const stopping=tr.stop();releaseInit();await startup;await stopping;
check(!tr.want&&!tr.running&&!tr.repl.scheduler.started,'stop wins against outstanding async start');
check(ctx.state==='suspended','async initialization cannot resume a stopped context');
const result={status:'PASS',checks:checks.length,cases:checks,scope:'upstream Strudel Pattern/Cyclist, deterministic native timing, fixture AudioParam/mixer; PCM is separate'};
fs.mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./qa/transport-report.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
