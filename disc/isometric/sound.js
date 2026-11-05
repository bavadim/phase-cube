/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./flow.js'));
  else root.IsoAudio = factory(root.IsoFlow);
})(globalThis, function (Flow) {
  'use strict';
  const BPM = 112;
  const KEYS = Object.freeze({s:'biba_tx_piano',gain:.72,pan:.35,release:.08});
  const SYNTH_KEYS = Object.freeze({s:'triangle',gain:.63,pan:.35,attack:.002,decay:.13,sustain:.17,release:.08,cutoff:2200});
  const BELL = Object.freeze({s:'sine',gain:.57,pan:.66,attack:.002,decay:.15,sustain:.1,release:.16,fmh:3.01,fmi:2.1});

  function pattern(S, rev, keys = KEYS) {
    return new S.Pattern(query => {
      const haps = [];
      const first = Math.max(rev.begin, Math.floor(Number(query.span.begin) * Flow.STEPS));
      const end = Number(query.span.end) * Flow.STEPS;
      for (let t = first; t < end; t++) {
        const {hits} = Flow.tick(rev, t);
        const span = new S.TimeSpan(t / Flow.STEPS, (t + 1) / Flow.STEPS);
        const part = span.intersection(query.span);
        if (!part) continue;
        for (const instrument of ['keys','bell']) {
          for (const box of hits[instrument]) {
            if (box.gain === 0) continue;
            // The transport deduplicates repeated scheduler queries. Preserve
            // separate twins when two wired outlets reach the same instrument.
            const value = {...(instrument === 'keys' ? keys : BELL), note:box.pitch, postgain:box.gain,
              duration:box.length / Flow.STEPS, _phaseCubePart:instrument, _boxOrigin:box.origin, _boxPath:box.path};
            haps.push(new S.Hap(span, part, value));
          }
        }
      }
      return haps;
    });
  }

  function routeEvents(S, state, index, keys = KEYS) {
    if (!Number.isInteger(index) || index < 0 || index >= Flow.STEPS) return [];
    const rev = Flow.revision(state);
    // Read from a settled loop, including boxes loaded in its preceding bar.
    const at = Flow.STEPS + index;
    const arriving = Flow.tick(rev,at).activity.router;
    if (!arriving.length) return [];
    const port = state.routes[index] ? 'straight' : 'side';
    const prefixes = arriving.map(box => ({origin:box.origin, path:box.path + '/router:' + port}));
    // A copy may ring two instruments; a pocket after the fork may ring one
    // of them later. Audition only descendants of these particular boxes.
    return pattern(S,rev,keys).queryArc(at / Flow.STEPS,(at + Flow.MAX_DELAY + 1) / Flow.STEPS)
      .filter(event => prefixes.some(p => event.value._boxOrigin === p.origin &&
        (event.value._boxPath === p.path || event.value._boxPath.startsWith(p.path + '/'))));
  }

  // A pin keeps its index as the gear rotates. Listen to just that attack
  // and any copies of it, at their actual instruments and delays.
  function pinTick(state,index){
    return (index+state.source.phase)%Flow.STEPS;
  }
  function pinEvents(S,state,index,keys=KEYS){
    const at=pinTick(state,index);
    return pattern(S,Flow.revision(state),keys)
      .queryArc(at/Flow.STEPS,(at+Flow.MAX_DELAY+1)/Flow.STEPS)
      .filter(event=>event.value._boxOrigin===at);
  }

  async function create({onChange = () => {}, onError = console.error} = {}) {
    const S = window.strudel;
    const transport = new PhaseCubeTransport(S, {outputGain:1, onChange, onError});
    const audition = ConveyorAudition.create(S,transport,BPM);
    // A local file cannot fetch its sibling WAVs in several browsers. Both
    // receivers then use native Strudel synths and keep the line playable.
    const useBank = window.location.protocol !== 'file:';
    const keys = useBank ? KEYS : SYNTH_KEYS;
    const repl = await PuzzleAsync.wait(S.initStrudel({
      sync:false, miniAllStrings:true, prebake:() => useBank ? PhaseCubeBank.register(S) : Promise.resolve(),
      setInterval:window.setInterval.bind(window), clearInterval:window.clearInterval.bind(window),
      defaultOutput:(...args) => transport.output(...args),
      onUpdateState:status => { if (status.error) onError(status.error); }
    }), 'Не удалось загрузить Strudel.', 15000);
    transport.attach(repl);
    transport.setComposition({id:'note-conveyor',bars:1,stats:{maxGateBars:1},backing:S.silence});
    if (useBank) {
      // Preload all four recorded roots, including octaves reachable by a
      // restored custom pin. Runtime knob edits never have to await a sample.
      const roots = Object.keys(PhaseCubeBank.files[KEYS.s]);
      const loadPattern = S.stack(...roots.map(note => S.note(note.toLowerCase()).s(KEYS.s)));
      await PuzzleAsync.wait(PhaseCubeBank.preload(S, loadPattern, 1), 'Не удалось загрузить клавиши.', 20000);
    }
    let desired = Flow.initial(), idle = Flow.revision(desired), stopped = null;
    const entry = revision => ({pattern:pattern(S, revision, keys), meta:{revision}});

    function queue(state) {
      if (desired === state) return;
      audition.stop();
      desired = state;
      if (transport.running) {
        transport.queue(bar => entry(Flow.revision(desired, Math.round(bar * Flow.STEPS), transport.active.meta.revision)));
      } else {
        idle = stopped && desired === stopped.state ? stopped :
          Flow.revision(desired, Math.ceil(transport.cursor * Flow.STEPS), stopped);
      }
    }
    // Follow the same gates and releases as the two playback patches. A
    // delayed bell can still ring when the next piano attack reaches the mix.
    const stepSeconds=30/BPM;
    let meterRevision,meterTick,voices=[];
    function soundingPitches(rev,position,playing) {
      if(!playing)return audition.soundingPitches();
      const step=Math.floor(position);
      if(rev!==meterRevision||step!==meterTick){
        meterRevision=rev;meterTick=step;voices=[];
        for(let at=Math.max(rev.begin,step-1);at<=step;at++){
          const {hits}=Flow.tick(rev,at);
          for(const [id,patch] of [['keys',keys],['bell',BELL]]){
            for(const box of hits[id])if(box.gain>0)voices.push({pitch:box.pitch,until:at+box.length+patch.release/stepSeconds});
          }
        }
      }
      return voices.filter(v=>position<v.until).map(v=>v.pitch);
    }
    return Object.freeze({
      bpm:BPM, stepSeconds, transport, queue, soundingPitches, clock:() => transport.clock(),
      previewDose(rev,onScheduled) {
        const haps=pattern(S,rev,keys).queryArc(0,(Flow.MAX_DELAY+1)/Flow.STEPS);
        return audition.playEvents(haps,0,start=>onScheduled(()=>Math.max(0,(S.getAudioContext().currentTime-start)/stepSeconds)));
      },
      stopPreview:audition.stop,
      previewRoute(state,index) {
        return audition.playEvents(routeEvents(S,state,index,keys),1 + index / Flow.STEPS);
      },
      previewPin(state,index) {
        return audition.playEvents(pinEvents(S,state,index,keys),pinTick(state,index)/Flow.STEPS);
      },
      previewPitch(pitch) {
        if(pitch===null)return audition.playEvents([]);
        const span=new S.TimeSpan(0,1/Flow.STEPS);
        return audition.playEvents([new S.Hap(span,span,{...keys,note:pitch})],0);
      },
      audible() {
        transport.poll();
        return transport.active?.meta.revision ?? idle;
      },
      // The native scheduler reports running during its audio lookahead.
      // Light the pins and animate boxes only once that audio reaches the bus.
      playing:() => transport.running && S.getAudioContext().currentTime >= transport.active.audioBegin,
      wanted:() => transport.want,
      async start(state = desired) {
        audition.stop();
        queue(state);
        if (transport.want) return transport.lifecycle;
        await transport.start(() => entry(idle), BPM, 1);
        if (transport.running && desired !== transport.active.meta.revision.state && !transport.pending) {
          // A control edit during native scheduler activation is still live.
          transport.queue(bar => entry(Flow.revision(desired, Math.round(bar * Flow.STEPS), transport.active.meta.revision)));
        }
      },
      pause() {
        audition.stop();
        transport.poll();
        stopped = transport.active?.meta.revision ?? stopped;
        const pausing = transport.stop();
        if (stopped) idle = desired === stopped.state ? stopped :
          Flow.revision(desired, Math.ceil(transport.cursor * Flow.STEPS), stopped);
        return pausing;
      }
    });
  }
  return Object.freeze({BPM, pattern, routeEvents, pinEvents, create});
});
