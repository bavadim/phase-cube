/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Bar transactions around the upstream Strudel Cyclist and Superdough mixer.
 * No replacement synthesis or event clock: queryArc, timing and rendering stay native.
 */
(() => {
  'use strict';
  class PhaseCubeTransport {
    constructor(S, {onChange=()=>{}, onError=console.error,outputGain=1}={}) {
      this.S=S;this.onChange=onChange;this.onError=onError;
      this.outputGain=outputGain;
      this.want=false;this.running=false;this.token=0;this.revision=0;
      this.entries=[];this.retired=[];this.active=null;this.pending=null;
      this.lifecycle=Promise.resolve();this.stopPromise=Promise.resolve();
      this.baseCycle=0;this.cursor=0;this.volume=.65;this.log=[];this.changes=[];this.analyser=null;this.master=null;
      this.router=new S.Pattern(localState=>{
        const state=localState.withSpan(span=>span.withTime(t=>t.add(this.baseCycle)));
        return this.entries.flatMap(entry=>{
          if(Number(state.span.end)<=entry.begin || Number(state.span.begin)>=entry.end)return [];
          return entry.pattern.query(state).filter(h=>h.whole && Number(h.whole.begin)>=entry.begin && Number(h.whole.begin)<entry.end)
            .map(h=>h.withSpan(span=>span.withTime(t=>t.sub(this.baseCycle))));
        });
      });
    }
    attach(repl) { this.repl=repl; }
    startBacking() {
      if(!this.backingBuffer)return;
      const ctx=this.S.getAudioContext(),origin=this.timeAt(this.baseCycle),now=ctx.currentTime;
      const source=ctx.createBufferSource();source.buffer=this.backingBuffer;source.loop=true;
      source.loopStart=0;source.loopEnd=48*240/140;
      this.backingGain=ctx.createGain();this.backingGain.gain.value=1;
      source.connect(this.backingGain);this.backingGain.connect(this.master);
      source.start(Math.max(now,origin),(this.baseCycle*240/140+Math.max(0,now-origin))%source.loopEnd);
      this.backingSource=source;this.backingStarts=(this.backingStarts||0)+1;this.backingId=this.backingStarts;
      this.record('backing-start',{backingId:this.backingId,origin,loopSeconds:source.loopEnd});
    }
    stopBacking() {
      if(this.backingSource){try{this.backingSource.stop();}catch{}this.backingSource.disconnect();this.backingSource=null;}
      this.backingGain?.disconnect();this.backingGain=null;
    }
    setBackingMix({foundation=true,solo=-1}) {
      if(this.backingGain)this.backingGain.gain.setTargetAtTime(foundation&&solo<0?1:0,this.S.getAudioContext().currentTime,.008);
    }
    continueAt(entry,cycle) {
      // Restart only the edited sampler lane at its current sample offset.
      // This resumes partial samples instead of waiting for their next 4-bar onset.
      for(const h of entry.pattern.queryArc(cycle,cycle+1e-7)){
        const start=Number(h.whole.begin),duration=Number(h.duration),elapsed=cycle-start;
        if(elapsed<=1e-8||elapsed>=duration-1e-8)continue;
        const remaining=duration-elapsed,begin=(h.value.begin||0)+elapsed/duration*(1-(h.value.begin||0));
        const span=new this.S.TimeSpan(cycle,cycle+remaining);
        const partial=new this.S.Hap(span,span,{...h.value,begin,duration:remaining});
        this.record('continue-sample',{revision:entry.id,cycle,sample:h.value.s,begin,remaining});
        this.output(partial.withSpan(span=>span.withTime(t=>t.sub(this.baseCycle))),0,remaining/this.repl.scheduler.cps,this.repl.scheduler.cps,this.timeAt(cycle)).catch(this.onError);
      }
    }
    record(type, data={}) {
      const entry={type,wall:performance.now(),audio:this.S.getAudioContext().currentTime,...data};
      this.log.push(entry);
      if(this.log.length>512)this.log.splice(0,this.log.length-512);
      if(type!=='event'){this.changes.push(entry);if(this.changes.length>64)this.changes.shift();}
    }
    clock() {
      const s=this.repl?.scheduler;
      if(!s?.started)return this.cursor;
      return this.baseCycle+Math.max(0,s.num_cycles_at_cps_change+(this.S.getAudioContext().currentTime-s.seconds_at_cps_change-s.latency)*s.cps);
    }
    timeAt(cycle) {
      const s=this.repl.scheduler;
      return (cycle-this.baseCycle-s.num_cycles_at_cps_change)/s.cps+s.seconds_at_cps_change+s.latency;
    }
    connectMaster() {
      const ctx=this.S.getAudioContext();
      this.master=this.S.getSuperdoughAudioController().output.destinationGain;
      if(!this.analyser){this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;}
      this.master.connect(this.analyser);
    }
    setVolume(value) {
      this.volume=value;
      const master=this.S.getSuperdoughAudioController().output.destinationGain;
      const now=this.S.getAudioContext().currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(this.want?value*this.outputGain:0,now);
    }
    entry(pattern, begin, meta) {
      const id=++this.revision, epoch=this.token;
      const bus=this.S.getSuperdoughAudioController().getOrbit(id,[0,1]);
      bus.output.gain.setValueAtTime(0,this.S.getAudioContext().currentTime);
      return {id,epoch,begin,end:Infinity,meta,bus,seen:new Set(),audioBegin:Infinity,audioEnd:Infinity,
        pattern:pattern.withValue(v=>({...v,_phaseCubeRevision:id}))};
    }
    gate(entry) {
      const now=this.S.getAudioContext().currentTime, gain=entry.bus.output.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(now>=entry.audioBegin&&now<entry.audioEnd?1:0,now);
      if(entry.audioBegin>now)gain.setValueAtTime(1,entry.audioBegin);
      if(Number.isFinite(entry.audioEnd)) {
        gain.setValueAtTime(1,Math.max(now,entry.audioEnd-.003));
        gain.linearRampToValueAtTime(0,Math.max(now,entry.audioEnd));
      }
    }
    silence(entry) {
      const gain=entry.bus.output.gain, now=this.S.getAudioContext().currentTime;
      gain.cancelScheduledValues(now);gain.setValueAtTime(0,now);
      entry.audioEnd=now;this.retired.push(entry);
    }
    async output(hap, deadline, duration, cps, t) {
      hap=hap.withSpan(span=>span.withTime(x=>x.add(this.baseCycle)));
      const id=hap.value._phaseCubeRevision,entry=this.entries.find(e=>e.id===id);
      if(!this.want||!entry||entry.epoch!==this.token)return;
      const onset=Number(hap.whole.begin);
      if(onset<entry.begin||onset>=entry.end)return;
      const key=hap.whole.begin.toFraction()+':'+hap.whole.end.toFraction()+':'+JSON.stringify(hap.value);
      if(entry.seen.has(key))return;
      entry.seen.add(key);if(entry.seen.size>512)entry.seen.delete(entry.seen.values().next().value);
      const clean=hap.withValue(value=>{const v={...value,orbit:id};delete v._phaseCubeRevision;return v;});
      this.record('event',{revision:id,cycle:onset,targetAudio:t,sound:clean.value.s,note:clean.value.note});
      try {await this.S.webaudioOutput(clean,deadline,duration,cps,t);}catch(e){this.onError(e);throw e;}
    }
    async start(pattern, bpm, volume, meta, ready) {
      this.want=true;this.volume=volume;const token=++this.token;
      this.onChange();
      this.lifecycle=this.lifecycle.catch(()=>{}).then(async()=>{
        await this.stopPromise;await ready;
        if(!this.want||token!==this.token)return;
        const ctx=this.S.getAudioContext();
        await ctx.resume();await this.S.initAudio();
        if(!this.want||token!==this.token)return;
        this.repl.stop();this.S.resetGlobalEffects();this.connectMaster();this.setVolume(this.volume);
        const initial=typeof pattern==='function'?pattern():{pattern,meta};
        this.baseCycle=this.cursor;
        const entry=this.entry(initial.pattern,this.baseCycle,initial.meta);
        // The first scheduler callback may run before start() resolves.
        // Its audio has a native lead-in, so open this first bus now.
        entry.bus.output.gain.setValueAtTime(1,ctx.currentTime);
        this.entries=[entry];this.retired=[];this.active=entry;this.pending=null;
        this.repl.scheduler.setCps(bpm/240);
        await this.repl.setPattern(this.router,true);
        if(!this.want||token!==this.token){this.repl.stop();return;}
        entry.audioBegin=this.timeAt(this.baseCycle);this.running=true;this.startBacking();this.continueAt(entry,this.baseCycle);
        this.record('start',{revision:entry.id,bpm,origin:entry.audioBegin});this.onChange();
      }).catch(e=>{this.stop();this.onError(e);});
      return this.lifecycle;
    }
    stop() {
      this.cursor=this.clock();
      this.want=false;this.running=false;++this.token;
      this.stopBacking();this.repl?.stop();
      for(const e of this.entries)this.silence(e);
      this.entries=[];this.active=null;this.pending=null;
      this.S.resetGlobalEffects();this.connectMaster();this.setVolume(0);
      this.record('stop');this.onChange();
      const token=this.token;
      // A short drain gives the analyser an actual silent PCM window before suspend.
      this.stopPromise=new Promise(r=>setTimeout(r,65)).then(async()=>{
        if(!this.want&&token===this.token)await this.S.getAudioContext().suspend();
      });
      return this.stopPromise;
    }
    queue(pattern, meta) {
      if(!this.running)return;
      this.poll();
      // Schedule beyond native lookahead: no already-queued old onset can
      // cross the transaction. Commit on a quarter-note boundary.
      const cycle=Math.max(0,Math.ceil((Math.max(this.clock(),(this.repl.scheduler.lastEnd||0)+this.baseCycle)+.025)*4)/4), at=this.timeAt(cycle);
      if(this.pending){this.silence(this.pending);this.entries=this.entries.filter(e=>e!==this.pending);}
      const previous=this.active, next=this.entry(pattern,cycle,meta);
      previous.end=cycle;previous.audioEnd=at+.010;this.gate(previous);
      next.audioBegin=at;this.gate(next);
      this.pending=next;this.entries.push(next);
      this.record('queue',{revision:next.id,cycle,targetAudio:at,delay:at-this.S.getAudioContext().currentTime});
      // Cyclist can already have queried slightly beyond the next bar.
      // Old queued events are silenced by their orbit; backfill NEW onsets in
      // that small interval using upstream queryArc/webaudioOutput. Dedup is per revision.
      const end=this.repl.scheduler.lastEnd+this.baseCycle;
      if(end>cycle){
        for(const h of next.pattern.queryArc(cycle,end,{_cps:this.repl.scheduler.cps}))if(h.hasOnset()){
          this.output(h.withSpan(span=>span.withTime(t=>t.sub(this.baseCycle))),0,Number(h.duration)/this.repl.scheduler.cps,this.repl.scheduler.cps,this.timeAt(Number(h.whole.begin))).catch(this.onError);
        }
      }
      this.continueAt(next,cycle);
      this.onChange();
    }
    poll() {
      if(!this.running)return;
      const now=this.S.getAudioContext().currentTime;
      if(this.pending&&now>=this.pending.audioBegin){
        this.active=this.pending;this.pending=null;
        this.record('apply',{revision:this.active.id,cycle:this.active.begin,targetAudio:this.active.audioBegin,observedDelay:now-this.active.audioBegin});
        this.onChange();
      }
      const expired=this.entries.filter(e=>e!==this.active&&e!==this.pending&&e.audioEnd<now-.25);
      this.entries=this.entries.filter(e=>!expired.includes(e));
      this.retired.push(...expired);
      for(const e of this.retired){
        if(e.audioEnd<now-.25){e.bus.disconnect();delete this.S.getSuperdoughAudioController().nodes[e.id];e.cleaned=true;}
      }
      this.retired=this.retired.filter(e=>!e.cleaned);
    }
    info() {
      return {wanted:this.want,running:this.running,token:this.token,cycle:this.clock(),
        activeRevision:this.active?.id??null,
        pending:this.pending?{revision:this.pending.id,cycle:this.pending.begin,audioTime:this.pending.audioBegin,seconds:Math.max(0,this.pending.audioBegin-this.S.getAudioContext().currentTime)}:null};
    }
  }
  window.PhaseCubeTransport=PhaseCubeTransport;
})();
