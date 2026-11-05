/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ConveyorAudition = factory();
})(globalThis, function () {
  'use strict';
  // Transport revisions use positive orbit numbers. A paused transport keeps
  // its master muted. Route only this private, native instrument orbit out.
  const ORBIT = -1;
  function create(S, transport, bpm) {
    const cps = bpm / 240;
    let generation = 0, active = null, timer = null, analyser = null, init = null;
    function stop() {
      generation++;
      clearTimeout(timer);
      if (active) {
        const {mixer, bus} = active;
        bus.disconnect();
        if (mixer.nodes[ORBIT] === bus) delete mixer.nodes[ORBIT];
        active = null;
      }
    }
    async function play(score, key, id) {
      stop();
      const token = generation;
      const current = () => generation === token && !transport.running && !transport.want;
      const event = score.noteEvent(key,id);
      if (!event || !current()) return false;
      const ctx = S.getAudioContext();
      try {
        // WebKit needs the first resume directly in the input callback.
        // A pause already in flight may subsequently suspend this context.
        await Promise.all([ctx.resume(), transport.stopPromise]);
        if (!current()) return false;
        if (ctx.state !== 'running') await ctx.resume();
        if (!current()) return false;
        init ??= S.initAudio().catch(error => { init = null; throw error; });
        const sound = S.getSound(event.value.s);
        const sample = sound?.type === 'sample' ? S.getSampleBuffer(event.value,sound.samples) : undefined;
        await Promise.all([init,sample]);
        if (!current() || ctx.state !== 'running') return false;
        const mixer = S.getSuperdoughAudioController(), bus = mixer.getOrbit(ORBIT,[0,1]);
        active = {mixer,bus};
        if (!analyser) {
          analyser = ctx.createAnalyser();
          analyser.connect(ctx.destination);
        }
        bus.output.disconnect();
        bus.output.connect(analyser);
        const at = ctx.currentTime + .04;
        const length = Math.min(.5, Number(event.duration) / cps);
        const end = at + length + Math.min(.14, Math.max(.015, event.value.release ?? .08));
        const gain = bus.output.gain;
        gain.setValueAtTime(transport.outputGain,ctx.currentTime);
        gain.setValueAtTime(transport.outputGain,end - .008);
        gain.linearRampToValueAtTime(0,end);
        timer = setTimeout(() => { if (generation === token) stop(); }, (end - ctx.currentTime) * 1000 + 60);
        const note = event.withValue(value => ({...value, orbit:ORBIT}));
        await S.webaudioOutput(note,.04,length,cps,at);
        return current();
      } catch (error) {
        if (!current()) return false;
        stop();
        throw error;
      }
    }
    return {play,stop,get analyser() {return analyser;}};
  }
  return {create};
});
