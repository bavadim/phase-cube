/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Editable Strudel composition. Metadata and form live beside the actual music.
// Browser adaptation of levels/music/raves/elise_after_hours; no pre-rendered song audio.
export const metadata = {
  title: "Элиза после смены", style: "Piano / acid breakbeat", bpm: 150,
  download: 'assets/elise-after-hours-game.mp3',
    credit: "Ludwig van Beethoven / Mutopia 931 / Stelios Samelis (Public Domain); VCSL CC0; Biba arrangement"
};

export default function compose(S) {
  const {note, cat, stack, arrange, pure, silence, reify} = S;
  const sections = [
  {
    "name": "After-work call",
    "bars": 4
  },
  {
    "name": "Broken machine",
    "bars": 4
  },
  {
    "name": "Elise on the floor",
    "bars": 8
  },
  {
    "name": "Acid answer",
    "bars": 8
  },
  {
    "name": "Empty dancefloor",
    "bars": 4
  },
  {
    "name": "Alarm and silence",
    "bars": 4
  },
  {
    "name": "Piano rave",
    "bars": 8
  },
  {
    "name": "Double shift",
    "bars": 4
  },
  {
    "name": "One last round",
    "bars": 4
  }
];
  const bars = sections.reduce((n, section) => n + section.bars, 0);
  const lanes = {};

// Элиза после смены: musical patterns. One cycle = one 4/4 bar.
// phrase(notes, gate in quarter-note beats, velocity). Drum timing is on the 1/16 grid.
const phrase = (notes, gates, amps) => note(notes).duration(reify(gates).div(4)).velocity(amps)

// kick
const kickIntro = phrase("c2*2", 0.35, 1)
const kickBreakA = phrase("c2@6 c2@2 c2@3 c2@3 c2@2", 0.35, "1@6 0.85@2 1@3 0.85@3 0.85@2")
const kickBreakB = phrase("c2@3 c2@5 c2@2 c2@5 c2", 0.35, "1@3 0.85@5 1@2 0.85@5 0.85")
const kickDown = phrase("c2", 0.35, 1)
const kickBuild = phrase("c2 c2 c2@2", 0.35, "1 0.85 1@2")
const kickFour = phrase("c2*4", 0.35, "[1 0.85]*2")

// snare
const snare1 = phrase("~ c4@2 c4", 0.36, 0.9)
const snare2 = phrase("~@4 c4@3 c4@3 c4@2 c4@3 c4", "~@4 0.36@3 0.19@3 0.19@2 0.36@3 0.19", "~@4 0.9@3 0.23@3 0.23@2 0.9@3 0.23")
const snare3 = stack(phrase("c4*8", 0.17, 0.3), phrase("~ c4@2 c4", 0.36, 0.9))
const snare4 = stack(phrase("c4*8", 0.17, 0.42), phrase("~ c4@2 c4", 0.36, 0.9))
const snare5 = stack(phrase("c4*16", 0.17, 0.55), phrase("~ c4@2 c4", 0.36, 0.9))
const snare6 = stack(phrase("c4!12 ~@4", 0.17, 0.65), phrase("~ c4@3", 0.36, 0.9))
const snare7 = phrase("~ c4@2 c4", 0.36, "~ 0.9@2 0.85")

// clap
const clap1 = phrase("~ c4@2 c4", 0.32, 0.75)
const clap2 = phrase("~ c4@3", 0.32, 0.75)

// hat
const hatEighths = phrase("c4*8", 0.14, "[0.6 0.9]*4")
const hatFill = phrase("c4@2 c4@2 c4@2 c4@2 c4@2 c4 c4 c4@2 c4 c4", "0.14@2 0.14@2 0.14@2 0.14@2 0.14@2 0.14 0.12 0.14@2 0.14 0.12", "0.6@2 0.9@2 0.6@2 0.9@2 0.6@2 0.9 0.4 0.6@2 0.9 0.4")
const hatStop = phrase("c4@2 c4@2 c4@2 c4@2 c4@2 c4 c4@5", "0.14@2 0.14@2 0.14@2 0.14@2 0.14@2 0.14 0.12@5", "0.6@2 0.9@2 0.6@2 0.9@2 0.6@2 0.9 0.4@5")
const hatEnd = phrase("~ c4 c4 c4 c4 c4 c4 c4", 0.14, "~ 0.9 0.6 0.9 0.6 0.9 0.6 0.9")

// openhat
const openhat1 = phrase("~ c4@4 c4@3", 0.28, 0.7)

// metal
const metal1 = phrase("~@3 c4@8 c4@5", 0.2, 0.45)
const metal2 = phrase("~@3 c4@4 c4@4 c4@3 c4@2", 0.2, "~@3 0.45@4 0.65@4 0.45@3 0.65@2")
const metal3 = phrase("~@3 c4@4 c4@4 c4@5", 0.2, "~@3 0.45@4 0.65@4 0.45@5")

// bass
const bass1 = phrase("c2@3 c3@3 c2@3 g2@2 a#2@3 c3@2", "0.55@3 0.32@3 0.42@3 0.32@2 0.32@3 0.4@2", 0.9)
const bass2 = phrase("c2@2 c2@3 g2@3 c3@3 g2@3 c2@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.9)
const bass3 = phrase("g#1@2 g#1@3 d#2@3 g#2@3 d#2@3 g#1@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.9)
const bass4 = phrase("a#1@3 a#2@3 a#1@3 f2@2 g#2@3 a#2@2", "0.55@3 0.32@3 0.42@3 0.32@2 0.32@3 0.4@2", 0.9)
const bass5 = phrase("g1@2 g1@3 d2@3 g2@3 d2@3 g1@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.9)
const bass6 = phrase("c2@5 g2@3", "1.5@5 0.65@3", 0.9)
const bass7 = phrase("g1@2 g1@3 d2@3 g2@3 d2 c2@4", "0.6@2 0.26@3 0.4@3 0.5@3 0.3 0.7@4", "0.9@2 0.9@3 0.9@3 0.9@3 0.9 0.85@4")

// sub
const sub1 = phrase("c1@3 c2@3 c1@3 g1@2 a#1@3 c2@2", "0.55@3 0.32@3 0.42@3 0.32@2 0.32@3 0.4@2", 0.8)
const sub2 = phrase("c1@2 c1@3 g1@3 c2@3 g1@3 c1@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.8)
const sub3 = phrase("g#0@2 g#0@3 d#1@3 g#1@3 d#1@3 g#0@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.8)
const sub4 = phrase("a#0@3 a#1@3 a#0@3 f1@2 g#1@3 a#1@2", "0.55@3 0.32@3 0.42@3 0.32@2 0.32@3 0.4@2", 0.8)
const sub5 = phrase("g0@2 g0@3 d1@3 g1@3 d1@3 g0@2", "0.6@2 0.26@3 0.4@3 0.5@3 0.3@3 0.35@2", 0.8)
const sub6 = phrase("c1@5 g1@3", "1.5@5 0.65@3", 0.8)
const sub7 = phrase("g0@2 g0@3 d1@3 g1@3 d1 c1@4", "0.6@2 0.26@3 0.4@3 0.5@3 0.3 0.7@4", "0.8@2 0.8@3 0.8@3 0.8@3 0.8 0.85@4")

// riff
const riff1 = phrase("~@3 c4@4 d#4@4 g4@4 d#4", 0.28, 0.75)
const riff2 = phrase("~@3 g#3@4 c4@4 d#4@4 c4", 0.28, 0.75)
const riff3 = phrase("~@3 a#3@4 d4@4 f4@4 d4", 0.28, 0.75)
const riff4 = phrase("~@3 g3@4 b3@4 d4@4 b3", 0.28, 0.75)
const riff5 = phrase("~@3 g3@4 b3@4 d4@5", 0.28, 0.75)

// hook
const pianoCall = phrase("g4 f#4 g4@6", 0.3, 0.65)
const eliseA = phrase("g4 f#4 g4 f#4 g4@2 d4@2 f4@2 d#4@2 c4@4", "0.23 0.23 0.23 0.23 0.4@2 0.4@2 0.4@2 0.4@2 0.75@4", 0.98)
const pianoAb = phrase("g#4@3 c5@3 d#5@4 c5@4 a#4@2", "0.6@3 0.4@3 0.65@4 0.5@4 0.4@2", 0.88)
const pianoG = phrase("g4@4 b4@3 d5@4 c5@3 b4@2", "0.6@4 0.4@3 0.6@4 0.35@3 0.35@2", 0.88)
const pianoReply = phrase("c5@3 d#5@3 g5@4 f5@4 d#5@2", "0.6@3 0.4@3 0.6@4 0.5@4 0.4@2", 0.88)
const pianoBreak = phrase("a#4@4 d5@3 f5@5 d5@4", "0.65@4 0.45@3 0.6@5 0.5@4", 0.88)
const pianoRise = phrase("g4 f#4 g4 f#4 g4@2 d4@2 f4@2 d#4@2 c4@4", 0.7, 0.7)
const pianoCoda = phrase("~ g4@3 f4@2 c4@2", 0.7, 0.7)
const pianoEnd = phrase("g4@4 b4@3 d5@4 c5 c4@4", "0.6@4 0.4@3 0.6@4 0.35 0.8@4", "0.88@4 0.88@3 0.88@4 0.88 0.85@4")

// answer
const answer1 = phrase("~@14 g4 a#4", 0.22, 0.58)
const answer2 = phrase("~@2 c6@7 g5@5 a#5@2", 0.27, 0.5)

// stab
const stab1 = phrase("~@3 [c4,d#4,g4]@4 [c4,d#4,g4]", 0.42, 0.65)
const stab2 = phrase("~@3 [g#3,c4,d#4]@4 [g#3,c4,d#4]", 0.42, 0.65)
const stab3 = phrase("~@3 [a#3,d4,f4]@4 [a#3,d4,f4]", 0.42, 0.65)
const stab4 = phrase("~@3 [g3,b3,d4]@4 [g3,b3,d4]", 0.42, 0.65)
const stab5 = phrase("~@3 [g3,b3,d4]@3 c5@2", "~@3 0.42@3 0.55@2", "~@3 0.65@3 0.85@2")

// acid
const acid1 = phrase("c3@2 c3 c4@3 d#3@2 g3@2 a#3 g3@3 c4@2", 0.24, 0.46).lpf(600)
const acid2 = phrase("c3@2 c3 c4@3 d#3@2 g3@2 a#3 g3@3 c4@2", 0.24, 0.74).lpf("600@2 1250 2400@3 600@2 1250@2 2400 600@3 1250@2")
const acid3 = phrase("g#2@2 g#2 g#3@3 b2@2 d#3@2 f#3 d#3@3 g#3@2", 0.24, 0.74).lpf("1250@2 2400 600@3 1250@2 2400@2 600 1250@3 2400@2")
const acid4 = phrase("a#2@2 a#2 a#3@3 c#3@2 f3@2 g#3 f3@3 a#3@2", 0.24, 0.74).lpf("2400@2 600 1250@3 2400@2 600@2 1250 2400@3 600@2")
const acid5 = phrase("g2@2 g2 g3@3 a#2@2 d3@2 f3 d3@3 g3@2", 0.24, 0.74).lpf("600@2 1250 2400@3 600@2 1250@2 2400 600@3 1250@2")
const acid6 = phrase("c3@2 c3 c4@3 d#3@2 g3@2 a#3 g3@3 c4@2", 0.24, 0.74).lpf(600)
const acid7 = phrase("c3@2 c3 c4@3 d#3@2 g3@2 a#3 g3@3 c4@2", 0.24, 0.74).lpf(1250)
const acid8 = phrase("c3@2 c3 c4@3 d#3@2 g3@2 a#3 g3@5", 0.24, 0.74).lpf(1250)
const acid9 = phrase("g2@2 g2 g3@3 a#2@2 d3@2 f3 d3@5", 0.24, 0.74).lpf("600@2 1250 2400@3 600@2 1250@2 2400 600@5")

// noise
const noise1 = phrase("~@3 c4", 0.75, 0.55)
const noise2 = phrase("c4", 3.6, 0.2)
const noise3 = phrase("c4", 3.6, 0.34)
const noise4 = phrase("c4", 3.6, 0.48)
const noise5 = phrase("c4", 3, 0.62)

// Reusable multi-bar phrases.
const kickIgnitionLoop = cat(kickBreakA, kickBreakB)
const kickBreakLoop = cat(kickDown, silence)
const kickBuildLoop = cat(kickIntro, kickIntro, kickBuild, kickBuild)
const snareIntroLoop = cat(silence, silence, snare1, snare1)
const snareIgnitionLoop = cat(snare1, snare2)
const snareBuildLoop = cat(snare3, snare4, snare5, snare6)
const snareFinaleLoop = cat(snare1, snare1, snare1, snare7)
const clapFinaleLoop = cat(clap1, clap1, clap1, clap2)
const hatIgnitionLoop = cat(hatEighths, hatEighths, hatEighths, hatFill)
const hatBuildLoop = cat(hatEighths, hatEighths, hatEighths, hatStop)
const hatDropLoop = cat(hatEnd, hatEighths, hatEighths, hatFill, hatEighths, hatEighths, hatEighths, hatFill)
const metalFinaleLoop = cat(metal2, metal2, metal2, metal3)
const bassIgnitionLoop = cat(bass1, bass2)
const bassThemeALoop = cat(bass1, bass3, bass4, bass5)
const bassFinaleLoop = cat(bass1, bass3, bass4, bass7)
const subIgnitionLoop = cat(sub1, sub2)
const subThemeALoop = cat(sub1, sub3, sub4, sub5)
const subFinaleLoop = cat(sub1, sub3, sub4, sub7)
const riffThemeALoop = cat(riff1, riff2, riff3, riff4)
const riffFinaleLoop = cat(riff1, riff2, riff3, riff5)
const hookIgnitionLoop = cat(pianoCall, silence)
const hookThemeALoop = cat(eliseA, pianoAb, eliseA, pianoG)
const hookThemeBLoop = cat(pianoReply, pianoAb, pianoBreak, pianoG)
const hookBreakLoop = cat(pianoRise, pianoCoda, pianoCoda, pianoCoda)
const hookFinaleLoop = cat(eliseA, pianoAb, eliseA, pianoEnd)
const answerThemeALoop = cat(silence, silence, answer1, silence)
const answerFinaleLoop = cat(silence, silence, answer1)
const stabThemeALoop = cat(stab1, stab2, stab3, stab4)
const stabFinaleLoop = cat(stab1, stab2, stab3, stab5)
const acidThemeALoop = cat(silence, silence, silence, silence, acid2, acid3, acid4, acid5)
const acidThemeBLoop = cat(acid2, acid3, acid4, acid5)
const acidBuildLoop = cat(acid6, acid6, acid7, acid8)
const acidFinaleLoop = cat(acid2, acid3, acid4, acid9)
const noiseIgnitionLoop = cat(silence, silence, silence, noise1)
const noiseThemeALoop = cat(silence, silence, silence, silence, silence, silence, silence, noise1)
const noiseBuildLoop = cat(noise2, noise3, noise4, noise5)

// Элиза после смены: instruments, levels and the clip timeline. No note sequences.
// clip(from, to, pattern): zero-based bar positions; end excluded. Form loops at 48 bars.
const clip = (from, to, pattern) => arrange([to - from, pattern], [bars - to + from, silence]).late(from)
const introGain = level => arrange([8, pure(level * 0.8)], [40, pure(level)])

// Instrument settings and mix.
const kickSound = p => p.s("kick").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.02)
  .pan(0.5).postgain(0.621639652)
const snareSound = p => p.s("biba_snare").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.03)
  .pan(0.5).postgain(4.340177073)
const clapSound = p => p.s("biba_clap").gain(0.6).attack(0.001).decay(0.11).sustain(0).release(0.03)
  .pan(0.53).postgain(0.266789522)
const hatSound = p => p.s("biba_closed_hat").gain(0.7).attack(0.001).decay(0.035).sustain(0).release(0.01).hcutoff(4800)
  .pan(0.63).postgain(16.888566187)
const openhatSound = p => p.s("biba_open_hat").gain(0.8).attack(0.001).decay(0.13).sustain(0).release(0.04).hcutoff(5000)
  .pan(0.68).postgain(0.348179402)
const metalSound = p => p.s("biba_claves").gain(0.65).attack(0.001).decay(0.07).sustain(0).release(0.035).fmi(2.4).fmh(2.73).cutoff(6500).hcutoff(1000)
  .pan(0.76).postgain(9.626957276)
const bassSound = p => p.s("square").gain(0.8).attack(0.003).decay(0.08).sustain(0.38).release(0.035).cutoff(850).resonance(1.7).fmi(0.26).fmh(2)
  .pan(0.5).postgain(0.41008002)
const subSound = p => p.s("sine").gain(0.7).attack(0.006).decay(0.1).sustain(0.7).release(0.045).cutoff(160)
  .pan(0.5).postgain(0.427979617)
const riffSound = p => p.s("sine").gain(0.8).attack(0.002).decay(0.08).sustain(0.12).release(0.035).cutoff(3200).hcutoff(120).fmi(2.7).fmh(2)
  .pan(0.26).postgain(0.245934153)
const hookSound = p => p.s("biba_grand_piano").gain(0.8).attack(0.002).decay(0.2).sustain(0.65).release(0.085).cutoff(7000).unison(3).detune(0.13).spread(0.65)
  .pan(0.49).postgain(0.338801697)
const answerSound = p => p.s("square").gain(0.8).attack(0.002).decay(0.1).sustain(0.15).release(0.09).cutoff(3900).fmi(0.16).fmh(1)
  .pan(0.73).postgain(0.223760496)
const stabSound = p => p.s("sawtooth").gain(0.65).attack(0.002).decay(0.11).sustain(0.2).release(0.08).cutoff(5000).unison(3).detune(0.16).spread(0.75)
  .pan(0.4).postgain(0.449135191)
const acidSound = p => p.s("sawtooth").gain(0.75).attack(0.002).decay(0.1).sustain(0.25).release(0.025).resonance(3.4).lpenv(1.7).lpattack(0.001).lpdecay(0.12).lpsustain(0.1).lprelease(0.03)
  .pan(0.67).postgain(0.351875767)
const noiseSound = p => p.s("white").gain(0.4).attack(0.05).decay(0.08).sustain(0.8).release(0.15).hcutoff(1000).cutoff(8500)
  .pan(0.5).postgain(0.195349148)

// Stack the clips. Each line specifies its start, end and musical pattern.
lanes.kick = kickSound(stack(
  clip(0, 4, kickIntro),
  clip(4, 24, kickIgnitionLoop),
  clip(24, 28, kickBreakLoop),
  clip(28, 32, kickBuildLoop),
  clip(32, 40, kickFour),
  clip(40, 44, kickIgnitionLoop),
  clip(44, 48, kickFour)
))

lanes.snare = snareSound(stack(
  clip(0, 4, snareIntroLoop),
  clip(4, 24, snareIgnitionLoop),
  clip(28, 32, snareBuildLoop),
  clip(32, 40, snare1),
  clip(40, 44, snareIgnitionLoop),
  clip(44, 48, snareFinaleLoop)
))

lanes.clap = clapSound(stack(
  clip(8, 24, clap1),
  clip(32, 44, clap1),
  clip(44, 48, clapFinaleLoop)
))

lanes.hat = hatSound(stack(
  clip(4, 24, hatIgnitionLoop),
  clip(28, 32, hatBuildLoop),
  clip(32, 40, hatDropLoop),
  clip(40, 44, hatIgnitionLoop),
  clip(44, 48, hatBuildLoop)
))

lanes.openhat = openhatSound(stack(
  clip(8, 24, openhat1),
  clip(32, 48, openhat1)
))

lanes.metal = metalSound(stack(
  clip(0, 8, metal1),
  clip(8, 24, metal2),
  clip(24, 28, metal1),
  clip(32, 44, metal2),
  clip(44, 48, metalFinaleLoop)
))

lanes.bass = bassSound(stack(
  clip(4, 8, bassIgnitionLoop),
  clip(8, 24, bassThemeALoop),
  clip(24, 28, bass6),
  clip(32, 44, bassThemeALoop),
  clip(44, 48, bassFinaleLoop)
))

lanes.sub = subSound(stack(
  clip(4, 8, subIgnitionLoop),
  clip(8, 24, subThemeALoop),
  clip(24, 28, sub6),
  clip(32, 44, subThemeALoop),
  clip(44, 48, subFinaleLoop)
))

lanes.riff = riffSound(stack(
  clip(8, 24, riffThemeALoop),
  clip(32, 44, riffThemeALoop),
  clip(44, 48, riffFinaleLoop)
))

lanes.hook = hookSound(stack(
  clip(4, 8, hookIgnitionLoop),
  clip(8, 16, hookThemeALoop),
  clip(16, 24, hookThemeBLoop),
  clip(24, 28, hookBreakLoop),
  clip(32, 40, hookThemeALoop),
  clip(40, 44, hookThemeBLoop),
  clip(44, 48, hookFinaleLoop)
))

lanes.answer = answerSound(stack(
  clip(8, 16, answerThemeALoop),
  clip(16, 24, answer2),
  clip(32, 40, answerThemeALoop),
  clip(40, 44, answer2),
  clip(44, 48, answerFinaleLoop)
))

lanes.stab = stabSound(stack(
  clip(8, 24, stabThemeALoop),
  clip(32, 44, stabThemeALoop),
  clip(44, 48, stabFinaleLoop)
))

lanes.acid = acidSound(stack(
  clip(0, 4, acid1),
  clip(8, 16, acidThemeALoop),
  clip(16, 24, acidThemeBLoop),
  clip(28, 32, acidBuildLoop),
  clip(32, 44, acidThemeBLoop),
  clip(44, 48, acidFinaleLoop)
))

lanes.noise = noiseSound(stack(
  clip(4, 8, noiseIgnitionLoop),
  clip(8, 24, noiseThemeALoop),
  clip(28, 32, noiseBuildLoop),
  clip(32, 40, noiseThemeALoop),
  clip(40, 44, noiseIgnitionLoop)
))


  return {
    ...metadata,
    periodBars: 4, sections,
    playerParts: [
    {key:'bass', name:'Бас', pattern:stack(bassSound(bassThemeALoop), subSound(subThemeALoop))},
    {key:'riff', name:'FM-рифф', pattern:riffSound(riffThemeALoop)},
    {key:'acid', name:'Acid', pattern:acidSound(acidThemeBLoop)}
  ],
    backing: stack(...Object.entries(lanes).filter(([name]) => !["bass", "sub", "riff", "acid"].includes(name)).map(([key, p]) => p.withValue(v => ({...v, _phaseCubePart:key})))),

  };
}
