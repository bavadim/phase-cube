/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  async function create({onChange = () => {}, onError = console.error} = {}) {
    const S = window.strudel;
    const transport = new PhaseCubeTransport(S, {outputGain:1, onChange, onError});
    const repl = await PuzzleAsync.wait(S.initStrudel({
      sync:false, miniAllStrings:true, prebake:() => PhaseCubeBank.register(S),
      setInterval:window.setInterval.bind(window), clearInterval:window.clearInterval.bind(window),
      defaultOutput:(...args) => transport.output(...args),
      onUpdateState:state => { if (state.error) onError(state.error); }
    }), 'Не удалось открыть звуковой движок.', 15000);
    transport.attach(repl);
    const song = await PuzzleAsync.wait(new PuzzleCompositions.Loader(S).load('turkish-circuit'),
      'Не удалось открыть «Моцарта на конвейере».', 20000);
    const score = FactoryScore.create(S, song);
    const audition = ConveyorAudition.create(S, transport, song.bpm);
    transport.setComposition({...song, backing:S.silence, stats:{...song.stats, maxGateBars:1}});
    await PuzzleAsync.wait(PhaseCubeBank.preload(S, score.pattern(), 1), 'Не удалось загрузить инструменты линии.', 25000);
    function revision() {
      const state = score.snapshot();
      return {pattern:score.pattern(state), meta:{state}};
    }
    function publish(changed) {
      if (changed && transport.running) transport.queue(revision);
      return changed;
    }
    const auditionSource = {
      noteEvent(route, step) {
        const start = step / FactoryScore.STEPS;
        return score.pattern().queryArc(start, start + 1/FactoryScore.STEPS)
          .find(hit => hit.hasOnset() && hit.value._phaseCubePart === route);
      }
    };
    return {
      score, transport, bpm:song.bpm, title:song.title,
      get playing() { return transport.running; },
      get wanted() { return transport.want; },
      clock:() => transport.clock(),
      audible() {
        transport.poll();
        return transport.active?.meta.state ?? score.snapshot();
      },
      edit:(...args) => publish(score.edit(...args)),
      restore:state => publish(score.restore(state)),
      preview(step) {
        if (!Number.isInteger(step) || step < 0 || step >= FactoryScore.STEPS ||
            transport.running || transport.want) return Promise.resolve(false);
        return audition.play(auditionSource, FactoryScore.eventAt(score.snapshot(), step).route, step);
      },
      async start() {
        if (transport.want) return transport.lifecycle;
        audition.stop();
        await transport.start(revision, song.bpm, 1);
        // A live gesture can arrive while the native scheduler starts.
        if (transport.running && transport.active.meta.state !== score.snapshot()) transport.queue(revision);
      },
      pause() {
        audition.stop();
        return transport.stop();
      }
    };
  }
  window.FactoryMusic = Object.freeze({create});
})();
