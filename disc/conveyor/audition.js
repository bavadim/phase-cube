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
    async function playEvents(events, origin = Number(events[0]?.whole.begin ?? 0)) {
      stop();
      const token = generation;
      const current = () => generation === token && !transport.running && !transport.want;
      if (!events.length || !current()) return false;
      const ctx = S.getAudioContext();
      try {
        // WebKit needs the first resume directly in the input callback.
        // A pause already in flight may subsequently suspend this context.
        await Promise.all([ctx.resume(), transport.stopPromise]);
        if (!current()) return false;
        if (ctx.state !== 'running') await ctx.resume();
        if (!current()) return false;
        init ??= S.initAudio().catch(error => { init = null; throw error; });
        await Promise.all([init, ...events.map(event => {
          const sound = S.getSound(event.value.s);
          return sound?.type === 'sample' ? S.getSampleBuffer(event.value,sound.samples) : undefined;
        })]);
        if (!current() || ctx.state !== 'running') return false;
        const mixer = S.getSuperdoughAudioController(), bus = mixer.getOrbit(ORBIT,[0,1]);
        active = {mixer,bus};
        if (!analyser) {
          analyser = ctx.createAnalyser();
          analyser.connect(ctx.destination);
        }
        bus.output.disconnect();
        bus.output.connect(analyser);
        const start = ctx.currentTime + .04;
        const voices = events.map(event => {
          const at = start + (Number(event.whole.begin) - origin) / cps;
          const length = Math.min(.5, Number(event.duration) / cps);
          const end = at + length + Math.min(.14, Math.max(.015, event.value.release ?? .08));
          return {note:event.withValue(value => ({...value, orbit:ORBIT})), at, length, end};
        });
        const end = Math.max(...voices.map(v => v.end));
        const gain = bus.output.gain;
        gain.setValueAtTime(transport.outputGain,ctx.currentTime);
        gain.setValueAtTime(transport.outputGain,end - .008);
        gain.linearRampToValueAtTime(0,end);
        timer = setTimeout(() => { if (generation === token) stop(); }, (end - ctx.currentTime) * 1000 + 60);
        await Promise.all(voices.map(v => S.webaudioOutput(v.note,v.at - ctx.currentTime,v.length,cps,v.at)));
        return current();
      } catch (error) {
        if (!current()) return false;
        stop();
        throw error;
      }
    }
    function play(score, key, id) {
      const event = score.noteEvent(key,id);
      return playEvents(event ? [event] : []);
    }
    return {play,playEvents,stop,get analyser() {return analyser;}};
  }
  return {create};
});
