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

  async function create({onChange = () => {}, onError = console.error} = {}) {
    const S = window.strudel;
    const transport = new PhaseCubeTransport(S, {outputGain:1, onChange, onError});
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
      desired = state;
      if (transport.running) {
        transport.queue(bar => entry(Flow.revision(desired, Math.round(bar * Flow.STEPS), transport.active.meta.revision)));
      } else {
        idle = stopped && desired === stopped.state ? stopped :
          Flow.revision(desired, Math.ceil(transport.cursor * Flow.STEPS), stopped);
      }
    }
    return Object.freeze({
      bpm:BPM, transport, queue, clock:() => transport.clock(),
      audible() {
        transport.poll();
        return transport.active?.meta.revision ?? idle;
      },
      // The native scheduler reports running during its audio lookahead.
      // Light the pins and animate boxes only once that audio reaches the bus.
      playing:() => transport.running && S.getAudioContext().currentTime >= transport.active.audioBegin,
      wanted:() => transport.want,
      async start(state = desired) {
        queue(state);
        if (transport.want) return transport.lifecycle;
        await transport.start(() => entry(idle), BPM, 1);
        if (transport.running && desired !== transport.active.meta.revision.state && !transport.pending) {
          // A control edit during native scheduler activation is still live.
          transport.queue(bar => entry(Flow.revision(desired, Math.round(bar * Flow.STEPS), transport.active.meta.revision)));
        }
      },
      pause() {
        transport.poll();
        stopped = transport.active?.meta.revision ?? stopped;
        const pausing = transport.stop();
        if (stopped) idle = desired === stopped.state ? stopped :
          Flow.revision(desired, Math.ceil(transport.cursor * Flow.STEPS), stopped);
        return pausing;
      }
    });
  }
  return Object.freeze({BPM, pattern, create});
});
