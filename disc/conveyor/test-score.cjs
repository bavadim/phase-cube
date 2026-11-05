/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test = require('node:test');
const assert = require('node:assert/strict');
const {S, library} = require('../../test-runtime.cjs');
const Composition = require('../../composition-contract.js');
const DiscMusic = require('../music.js');
const Conveyor = require('./score.js');
const fixture = library.load('turkish-circuit').then(song => DiscMusic.prepare(S,song));
const voice = (score,key) => score.snapshot().parts.find(p => p.key === key);
const signature = (haps, offset = 0) => Array.from(haps,h =>
  JSON.stringify([h.whole.begin.sub(offset).toFraction(), h.whole.duration.toFraction(), h.duration.toFraction(), h.value])
).sort();
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, a+' differs from '+b);

test('untouched conveyor exactly reproduces the authored attacks, note spans, gates and patch values', async () => {
  const prepared = await fixture;
  const score = Conveyor.create(S, prepared);
  const pattern = score.pattern(), keys = prepared.modules.map(m => m.key);
  const source = Composition.attacks(prepared.song.pattern, 8, 12).filter(h => keys.includes(h.value._phaseCubePart));
  for (const from of [-4,0,4]) {
    assert.deepEqual(signature(Composition.attacks(pattern,from,from+4),from),signature(source,8));
  }
  assert.equal(score.canUndo,false);
});

test('an inserted note can move, lengthen across the seam, change pitch and be removed and restored', async () => {
  const score = Conveyor.create(S, await fixture), original = score.snapshot();
  const id = score.add('hook',{step:15,pitch:61});
  assert.ok(id);
  assert.deepEqual(voice(score,'hook').notes.find(n => n.id === id).length,1);
  assert.equal(score.add('hook',{step:15,pitch:61}),null);
  assert.equal(score.edit('hook',id,{step:63,pitch:62,length:8}),true);
  const saved = score.snapshot();
  const pattern = score.pattern();
  const edited = Composition.attacks(pattern,3,4).filter(h => h.value.note === 62);
  assert.equal(edited.length,1);
  assert.equal(Number(edited[0].whole.begin),63/16);
  assert.equal(Number(edited[0].duration),.5);
  assert.ok(pattern.queryArc(4.1,4.2).some(h => h.value.note === 62));
  assert.equal(edited[0].value.s,'biba_grand_piano');
  assert.deepEqual(saved.parts.slice(0,2), original.parts.slice(0,2));
  assert.equal(score.remove('hook',id), true);
  assert.equal(Composition.attacks(score.pattern(),3,4).filter(h => h.value.note === 62).length,0);
  assert.equal(score.undo(),true);
  assert.deepEqual(score.snapshot(),saved);
  const next = Conveyor.create(S,await fixture);
  assert.equal(next.restore(JSON.parse(JSON.stringify(saved)),{record:false}),true);
  assert.equal(next.canUndo,false);
  assert.deepEqual(signature(Composition.attacks(next.pattern(),0,8)),signature(Composition.attacks(pattern,0,8)));
  next.add('hook',{step:0,pitch:64});
  assert.equal(new Set(voice(next,'hook').notes.map(n=>n.id)).size,37);
  assert.equal(next.reset(),true);
  assert.deepEqual(next.snapshot(),original);
});

test('different gearbox ratios move independently and change native attack spacing and gate together', async () => {
  const score = Conveyor.create(S,await fixture);
  score.setSpeed('bass',2,0);
  score.setSpeed('kick',0.5,0);
  const state = score.snapshot();
  const sourceModule = (await fixture).modules;
  const output = Composition.attacks(score.pattern(),0,8);
  for (const [i,part] of state.parts.entries()) {
    const heard = output.filter(h => h.value._phaseCubePart === part.key);
    const source = Composition.attacks(sourceModule[i].variants[0].pattern,0,4);
    assert.equal(heard.length, source.length * 2 * part.speed);
    for (const h of heard) {
      const step = Conveyor.stepAt(part,Number(h.whole.begin));
      const n = part.notes.find(n => n.step === step);
      assert.ok(n);
      near(Number(h.duration)*16*part.speed,n.length);
      assert.equal(h.value.note,source[n.source].value.note);
    }
  }
  assert.equal(score.setSpeed('hook',3),false);
});

test('engagement anchors to the audible belt even when a pending revision has been replaced', async () => {
  const score = Conveyor.create(S,await fixture);
  score.setSpeed('hook',2,1.5);
  const audible = score.snapshot(), originalPart = voice(score,'hook');
  score.setSpeed('hook',.5,2);
  score.setSpeed('bass',2,2.25);
  score.edit('hook',originalPart.notes[0].id,{length:7});
  const desired = score.snapshot();
  const at = 2.75;
  const aligned = Conveyor.alignSpeeds(desired,audible,at);
  for (const p of aligned.parts) {
    const old = audible.parts.find(a => a.key === p.key);
    near(Conveyor.stepAt(old,at),Conveyor.stepAt(p,at));
    near(Conveyor.stepAt(p,at + .01), (Conveyor.stepAt(old,at) + .16*p.speed) % 64);
  }
  assert.equal(aligned.parts[2].notes[0].length,7);
  assert.deepEqual(desired,score.snapshot());
  const pattern = score.pattern(aligned);
  for (const h of Composition.attacks(pattern,at,at+8)) {
    const part = aligned.parts.find(p => p.key === h.value._phaseCubePart);
    const head = Conveyor.stepAt(part, Number(h.whole.begin));
    assert.ok(part.notes.some(n => Math.abs(head-n.step) < 1e-8));
  }
});

test('invalid imports and conflicting note moves do not partially mutate the score', async () => {
  const score = Conveyor.create(S,await fixture), initial = score.snapshot();
  const broken = score.snapshot();
  broken.parts[0].speed = .5;
  broken.parts[2].notes[0].source = -1;
  assert.throws(()=>score.restore(broken));
  const [first,second] = voice(score,'hook').notes;
  assert.equal(score.edit('hook',first.id,{step:second.step,pitch:second.pitch}),false);
  assert.equal(score.edit('hook',first.id,{length:-1}),false);
  assert.deepEqual(score.snapshot(),initial);
  assert.equal(score.canUndo,false);
});

test('solo audition uses the same native event as playback and never writes to the score', async () => {
  const score = Conveyor.create(S,await fixture);
  const id = score.add('hook',{step:63,pitch:66,length:5});
  score.setSpeed('hook',.5,1.75);
  const before = score.snapshot();
  const solo = score.noteEvent('hook',id);
  assert.equal(score.noteEvent('bass',id),null);
  const native = Composition.attacks(score.pattern(),0,8).find(h => h.value.note === 66);
  assert.deepEqual(signature([native]),signature([solo]));
  solo.value.gain = 0;
  assert.notEqual(score.noteEvent('hook',id).value.gain,0);
  assert.deepEqual(score.snapshot(),before);
});

test('paused audition plays one bounded native note and invalidates stale starts and suspended preview', async () => {
  const {create} = require('./audition.js');
  const score = Conveyor.create(S,await fixture), p = voice(score,'hook');
  const id = score.add('hook',{step:1,pitch:63,length:32});
  const calls = [], buses = [], resume = [];
  const mixer = {
    nodes:{},
    getOrbit(id) {
      const bus = {disconnected:false, disconnect(){this.disconnected=true;}, output:{
        connect(){},disconnect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){}}
      }};
      buses.push(bus); return this.nodes[id] = bus;
    }
  };
  const ctx = {
    state:'running', currentTime:12, destination:{},
    resume(){resume.push(true);return Promise.resolve();},
    createAnalyser(){return {connect(){}};}
  };
  const transport = {want:false,running:false,outputGain:1,stopPromise:Promise.resolve()};
  const mockS = {getAudioContext:()=>ctx,initAudio:async()=>{},getSound:()=>({type:'synth'}),
    getSuperdoughAudioController:()=>mixer, webaudioOutput:async (...args)=>calls.push(args)};
  const audition = create(mockS,transport,150);
  try {
    const original = score.snapshot();
    let release;
    transport.stopPromise = new Promise(r => { release=r; });
    const cancelled = audition.play(score,'hook',id);
    assert.equal(resume.length,1,'resume occurs synchronously in the user gesture');
    audition.stop(); release();
    assert.equal(await cancelled,false);
    assert.equal(calls.length,0);
    assert.equal(await audition.play(score,'hook',id),true);
    assert.equal(calls[0][0].value.note,63);
    assert.equal(calls[0][0].value.postgain,score.noteEvent('hook',id).value.postgain);
    assert.equal(calls[0][2],.5);
    assert.equal(calls[0][3],150/240);
    assert.ok(calls[0][4] > ctx.currentTime);
    assert.equal(await audition.play(score,'hook',p.notes[0].id),true);
    assert.equal(buses[0].disconnected,true);
    near(calls[1][2],Number(score.noteEvent('hook',p.notes[0].id).duration)*240/150);
    transport.want=true;
    assert.equal(await audition.play(score,'hook',id),false);
    assert.equal(buses[1].disconnected,true);
    assert.equal(calls.length,2);
    assert.deepEqual(score.snapshot(),original);
    assert.deepEqual(mixer.nodes,{});
  } finally { audition.stop(); }
});

test('earlier conveyor saves recover the native box heights and identical sound', async () => {
  const score=Conveyor.create(S,await fixture);
  const original=score.snapshot(), native=signature(Composition.attacks(score.pattern(),0,4));
  const legacy=score.snapshot();
  for (const part of legacy.parts) {
    delete part.level;
    delete part.phase;
    for (const note of part.notes) delete note.gain;
  }
  score.setLevel('hook',0);
  score.restore(legacy);
  assert.deepEqual(score.snapshot(), original);
  assert.deepEqual(signature(Composition.attacks(score.pattern(),0,4)), native);
});

test('box height and gear lift independently scale the same note in the mix and audition', async () => {
  const score=Conveyor.create(S,await fixture), source=voice(score,'hook').notes[0];
  const next=voice(score,'hook').notes[1], other=score.noteEvent('hook',next.id).value.postgain;
  const original=score.noteEvent('hook',source.id).value.postgain;
  assert.equal(score.edit('hook',source.id,{gain:source.gain/2}),true);
  near(score.noteEvent('hook',source.id).value.postgain,original/2);
  near(score.noteEvent('hook',next.id).value.postgain,other);
  score.setLevel('hook',.5);
  const event=score.noteEvent('hook',source.id);
  near(event.value.postgain,original/4);
  assert.ok(Composition.attacks(score.pattern(),0,4).some(h=>h.whole.begin.equals(event.whole.begin)&&h.value.note===event.value.note&&h.value.postgain===event.value.postgain));
  assert.equal(score.edit('hook',source.id,{gain:2.1}),false);
  score.edit('hook',source.id,{gain:0});
  assert.equal(score.noteEvent('hook',source.id).value.postgain,0);
  score.undo();
  near(score.noteEvent('hook',source.id).value.postgain,original/4);
});

test('rim phase delays the phrase and survives a queued change of speed', async () => {
  const score=Conveyor.create(S,await fixture), original=score.snapshot();
  const first=voice(score,'hook').notes[0], start=Number(score.noteEvent('hook',first.id).whole.begin);
  score.shiftPhase('hook',-1);
  assert.equal(voice(score,'hook').phase,63);
  score.shiftPhase('hook',4);
  near(Number(score.noteEvent('hook',first.id).whole.begin),start+3/16);
  assert.equal(score.shiftPhase('hook',64),false);
  score.setSpeed('hook',2,0);
  const aligned=Conveyor.alignSpeeds(score.snapshot(),original,2.5);
  score.restore(aligned,{record:false});
  const part=voice(score,'hook');
  near(Conveyor.stepAt(part,2.5),2.5*16-3);
  near(Conveyor.stepAt(part,Number(score.noteEvent('hook',first.id).whole.begin)),first.step);
  assert.deepEqual(voice(score,'bass'),original.parts[1]);
});
