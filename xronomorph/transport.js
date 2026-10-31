/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Strudel owns event scheduling and synthesis. Edits replace the queried
 * pattern without restarting Cyclist or resetting its musical phase. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.XronoAudio=factory(root.XronoModel);})(globalThis,function(M){
  'use strict';
  const samples={xrono_kick:'kick/0.wav',xrono_hat:'biba_closed_hat/0.wav',xrono_clap:'biba_clap/0.wav',xrono_click:'biba_claves/0.wav'};
  function pattern(S,state){
    const seconds=60/state.rpm,fraction=x=>S.Fraction([Math.round(x*1e9),1e9]);
    const source=M.score(state).map(e=>({start:fraction(e.start),duration:fraction(e.gateSeconds/seconds),value:{
      s:M.instruments.find(v=>v.id===e.instrument).sound,note:e.note,velocity:e.velocity,gain:.22,
      attack:.003,decay:.05,sustain:.25,release:.035,_xronoPart:e.part
    }}));
    const maxGate=Math.max(0,...source.map(e=>Number(e.duration)));
    return new S.Pattern(state=>{
      const begin=Number(state.span.begin),end=Number(state.span.end),haps=[];
      for(let cycle=Math.floor(begin-maxGate);cycle<=Math.floor(end);cycle++)for(const e of source){
        const start=e.start.add(cycle),whole=new S.TimeSpan(start,start.add(e.duration)),part=whole.intersection(state.span);
        if(part)haps.push(new S.Hap(whole,part,e.value));
      }
      return haps;
    });
  }
  const timeout=(p,ms,label)=>{let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(new Error(label)),ms);})]).finally(()=>clearTimeout(t));};
  class Transport{
    constructor(S,{onChange=()=>{},onError=console.error}={}){this.S=S;this.onChange=onChange;this.onError=onError;this.running=false;this.starting=false;this.epoch=0;this.events=[];this.cursor=0;}
    update(state){
      this.state=M.clone(state);this.current=pattern(this.S,state);
      if(this.repl&&this.running)this.repl.scheduler.setCps(state.rpm/60);
      if(this.master)this.master.gain.setTargetAtTime(state.volume,this.S.getAudioContext().currentTime,.015);
    }
    prepare(){
      if(this.ready)return this.ready;
      const S=this.S;
      this.ready=timeout(S.initStrudel({sync:false,miniAllStrings:true,setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),
        prebake:async()=>{
          await S.samples(Object.fromEntries(Object.entries(samples).map(([name,file])=>[name,[new URL('../assets/samples/'+file,document.baseURI).href]])));
        },defaultOutput:(...args)=>this.output(...args),onUpdateState:s=>{if(s.error)this.onError(s.error);}
      }),12000,'Звуковой движок не загрузился').then(async repl=>{
        this.repl=repl;
        this.router=new S.Pattern(query=>this.current?this.current.query(query):[]);
        // All four small, local CC0 one-shots are prepared before the first event.
        await timeout(Promise.all(Object.keys(samples).map(async name=>{
          const registered=S.getSound(name),sound=registered.data||registered;await S.getSampleBuffer({s:name,n:0,note:60},sound.samples);
        })),10000,'Не удалось загрузить звуки. Проверьте соединение и повторите запуск');
        return repl;
      }).catch(e=>{this.ready=null;throw e;});
      return this.ready;
    }
    async start(state){
      if(this.running||this.starting)return;
      const S=this.S,ctx=S.getAudioContext(),epoch=++this.epoch;
      // Safari must see resume() in the trusted click stack.
      const activation=timeout(ctx.state==='running'?Promise.resolve():ctx.resume(),8000,'Нажмите «Слушать» ещё раз, чтобы включить звук');activation.catch(()=>{});
      this.update(state);this.starting=true;this.onChange();
      try{
        const ready=this.prepare();await Promise.all([activation,ready]);await timeout(S.initAudio(),8000,'Аудио не отвечает');
        if(epoch!==this.epoch)return;
        this.master=S.getSuperdoughAudioController().output.destinationGain;
        if(!this.analyser){this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;this.master.connect(this.analyser);}
        this.update(this.state);this.master.gain.setValueAtTime(this.state.volume,ctx.currentTime);
        this.orbitId=2000+epoch;this.bus=S.getSuperdoughAudioController().getOrbit(this.orbitId,[0,1]);this.bus.output.gain.setValueAtTime(1,ctx.currentTime);
        this.events=[];this.cursor=0;this.running=true;this.repl.scheduler.setCps(this.state.rpm/60);
        await this.repl.setPattern(this.router,true);
        if(epoch!==this.epoch)this.repl.stop();
      }catch(e){this.error=e;this.stop();this.onError(e);}
      finally{if(epoch===this.epoch){this.starting=false;this.onChange();}}
    }
    async output(hap,deadline,duration,cps,t){
      if(!this.running)return;
      const epoch=this.epoch,part=hap.value._xronoPart;
      const clean=hap.withValue(v=>{const out={...v,orbit:2000+epoch};delete out._xronoPart;return out;});
      this.events.push({part,cycle:Number(hap.whole.begin),time:t});if(this.events.length>512)this.events.splice(0,this.events.length-512);
      try{await this.S.webaudioOutput(clean,deadline,duration,cps,t);}catch(e){if(epoch===this.epoch){this.stop();this.onError(e);}}
    }
    clock(){
      const s=this.repl?.scheduler;if(!this.running||!s?.started)return this.cursor;
      return Math.max(0,s.num_cycles_at_cps_change+(this.S.getAudioContext().currentTime-s.seconds_at_cps_change-s.latency)*s.cps);
    }
    stop(){
      this.cursor=this.clock();this.running=false;this.starting=false;++this.epoch;this.repl?.stop();
      if(this.bus){
        const old=this.bus,id=this.orbitId;old.output.gain.setValueAtTime(0,this.S.getAudioContext().currentTime);this.bus=null;
        setTimeout(()=>{old.disconnect();const nodes=this.S.getSuperdoughAudioController().nodes;if(nodes[id]===old)delete nodes[id];},1000);
      }
      this.onChange();
    }
    rms(){if(!this.analyser)return 0;const a=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);}
  }
  return{pattern,Transport};
});
