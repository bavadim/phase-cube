/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Editable Strudel composition. Metadata and form live beside the actual music.
// Browser adaptation of levels/music/raves/steel_shift; no pre-rendered song audio.
export const metadata = {
  title: "Цех горного короля", style: "Industrial rave", bpm: 140,
  download: 'assets/steel-shift-game.mp3',
    credit: "Edvard Grieg / Mutopia 1888 (Public Domain); VCSL CC0; Biba arrangement"
};

export default function compose(S) {
  const {note, cat, stack, arrange, pure, silence, reify} = S;
  const sections = [
  {
    "name": "Factory gates",
    "bars": 4
  },
  {
    "name": "Ignition",
    "bars": 4
  },
  {
    "name": "King shift A",
    "bars": 8
  },
  {
    "name": "Assembly line B",
    "bars": 8
  },
  {
    "name": "Power cut",
    "bars": 4
  },
  {
    "name": "Pressure",
    "bars": 4
  },
  {
    "name": "Overdrive A",
    "bars": 8
  },
  {
    "name": "Night crew B",
    "bars": 4
  },
  {
    "name": "Last shift",
    "bars": 4
  }
];
  const bars = sections.reduce((n, section) => n + section.bars, 0);
  const lanes = {};

// Цех горного короля: musical patterns. One cycle = one 4/4 bar.
// phrase(notes, gate in quarter-note beats, velocity). Drum timing is on the 1/16 grid.
const phrase = (notes, gates, amps) => note(notes).duration(reify(gates).div(4)).velocity(amps)

// kick
const kickIntro = phrase("c2", 0.35, 0.72)
const kickFour = phrase("c2*4", 0.35, 1)
const kickFill = phrase("c2@2 c2@2 c2@2 c2 c2", 0.35, "1@2 1@2 1@2 1 0.76")
const kickBroken = phrase("c2@6 c2@2 c2@3 c2@3 c2@2", 0.35, "1@6 0.76@2 1@3 0.76@3 0.76@2")
const kickHalf = phrase("c2*2", 0.35, 1)
const kickStop = phrase("c2 c2 c2@2", 0.35, 1)
const kickEnd = phrase("c2*4", 0.35, "1 1 1 0.9")

// snare
const snare1 = phrase("~@3 c4", 0.4, 0.95)
const snare2 = phrase("~@10 c4@2 c4 c4 c4 c4", "~@10 0.24@2 0.4 0.24 0.24 0.24", "~@10 0.22@2 0.95 0.28 0.45 0.65")
const snare3 = phrase("~ c4@2 c4", 0.4, 0.95)
const snare4 = phrase("~@4 c4@6 c4@2 c4 c4 c4 c4", "~@4 0.4@6 0.24@2 0.4 0.24 0.24 0.24", "~@4 0.95@6 0.22@2 0.95 0.28 0.45 0.65")
const snare5 = stack(phrase("c4*8", 0.18, 0.31), phrase("~ c4@2 c4", 0.4, 0.95))
const snare6 = stack(phrase("c4*8", 0.18, 0.45), phrase("~ c4@2 c4", 0.4, 0.95))
const snare7 = stack(phrase("c4*16", 0.18, 0.59), phrase("~ c4@2 c4", 0.4, 0.95))
const snare8 = stack(phrase("c4!12 ~@4", 0.18, 0.71), phrase("~@2 c4@3 c4@3", "~@2 0.4@3 0.24@3", "~@2 0.95@3 0.22@3"))
const snare9 = phrase("~ c4@2 c4", 0.4, "~ 0.95@2 0.9")

// clap
const clap1 = phrase("~ c4@2 c4", 0.4, 0.8)
const clap2 = phrase("~ c4@3", 0.4, 0.8)

// hat
const hatOffbeat = phrase("~ c4@2 c4@2 c4@2 c4", 0.18, 1)
const hatEighths = phrase("c4*8", 0.18, "[0.7 1]*4")
const hatFill = phrase("c4@2 c4@2 c4@2 c4@2 c4@2 c4 c4 c4@2 c4 c4", "0.18@2 0.18@2 0.18@2 0.18@2 0.18@2 0.18 0.12 0.18@2 0.18 0.12", "0.7@2 1@2 0.7@2 1@2 0.7@2 1 0.42 0.7@2 1 0.42")
const hatStop = phrase("c4 c4 c4 c4 c4 c4@3", 0.18, "0.7 1 0.7 1 0.7 1@3")
const hatEnd = phrase("c4@2 c4@2 c4@2 c4@2 c4@2 c4 c4 c4@4", "0.18@2 0.18@2 0.18@2 0.18@2 0.18@2 0.18 0.12 0.18@4", "0.7@2 1@2 0.7@2 1@2 0.7@2 1 0.42 0.7@4")

// openhat
const openhat1 = phrase("~ c4@4 c4@3", 0.4, 0.8)

// metal
const metal1 = phrase("d4@3 d4@3 d5@5 d4@3 d5@2", 0.22, "0.62@3 0.45@3 0.8@5 0.5@3 0.72@2")
const metal2 = phrase("d4@3 d4@3 d5@5 d4@5", 0.22, "0.62@3 0.45@3 0.8@5 0.5@5")

// bass
const bass1 = phrase("d2@3 d2@3 d3@2 d2@2 f2@4 c2@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "1@3 0.8@3 0.9@2 1@2 0.8@4 0.9@2")
const bass2 = phrase("a#1@3 a#1@3 a#2@2 a#1@2 c#2@4 g#1@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "1@3 0.8@3 0.9@2 1@2 0.8@4 0.9@2")
const bass3 = phrase("c2@3 c2@3 c3@2 c2@2 d#2@4 a#1@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "1@3 0.8@3 0.9@2 1@2 0.8@4 0.9@2")
const bass4 = phrase("d2@3 d3@2 d2@2 f2@3 g2@4 f2@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "1@3 0.9@2 0.8@2 0.9@3 1@4 0.8@2")
const bass5 = phrase("a#1@3 a#2@2 a#1@2 c#2@3 d#2@4 c#2@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "1@3 0.9@2 0.8@2 0.9@3 1@4 0.8@2")
const bass6 = phrase("c2@3 c3@2 c2@2 d#2@3 f2@4 d#2@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "1@3 0.9@2 0.8@2 0.9@3 1@4 0.8@2")
const bass7 = phrase("d2@5 d2@3", "1.4@5 0.6@3", "0.85@5 0.7@3")
const bass8 = phrase("c2@3 c2@3 c3@2 c2@2 d#2@2 d2@4", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@2 0.8@4", "1@3 0.8@3 0.9@2 1@2 0.8@2 0.9@4")

// sub
const sub1 = phrase("d1@3 d1@3 d2@2 d1@2 f1@4 c1@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "0.88@3 0.704@3 0.792@2 0.88@2 0.704@4 0.792@2")
const sub2 = phrase("a#0@3 a#0@3 a#1@2 a#0@2 c#1@4 g#0@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "0.88@3 0.704@3 0.792@2 0.88@2 0.704@4 0.792@2")
const sub3 = phrase("c1@3 c1@3 c2@2 c1@2 d#1@4 a#0@2", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@4 0.35@2", "0.88@3 0.704@3 0.792@2 0.88@2 0.704@4 0.792@2")
const sub4 = phrase("d1@3 d2@2 d1@2 f1@3 g1@4 f1@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "0.88@3 0.792@2 0.704@2 0.792@3 0.88@4 0.704@2")
const sub5 = phrase("a#0@3 a#1@2 a#0@2 c#1@3 d#1@4 c#1@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "0.88@3 0.792@2 0.704@2 0.792@3 0.88@4 0.704@2")
const sub6 = phrase("c1@3 c2@2 c1@2 d#1@3 f1@4 d#1@2", "0.6@3 0.35@2 0.35@2 0.35@3 0.55@4 0.35@2", "0.88@3 0.792@2 0.704@2 0.792@3 0.88@4 0.704@2")
const sub7 = phrase("d1@5 d1@3", "1.4@5 0.6@3", "0.748@5 0.616@3")
const sub8 = phrase("c1@3 c1@3 c2@2 c1@2 d#1@2 d1@4", "0.6@3 0.35@3 0.4@2 0.55@2 0.35@2 0.8@4", "0.88@3 0.704@3 0.792@2 0.88@2 0.704@2 0.9@4")

// riff
const riff1 = phrase("d3@2 d3@3 a3@3 d3@3 f3@3 g3@2", "0.42@2 0.25@3 0.4@3 0.42@3 0.3@3 0.35@2", 0.45)
const riff2 = phrase("d3@2 d3@3 a3@3 d3@2 f3@2 g3@2 a3@2", "0.42@2 0.25@3 0.4@3 0.42@2 0.35@2 0.3@2 0.3@2", 0.45)
const riff3 = phrase("d3@2 d3@3 a3@3 d3@3 f3@3 g3@2", "0.42@2 0.25@3 0.4@3 0.42@3 0.3@3 0.35@2", 0.7)
const riff4 = phrase("d3@2 d3@3 a3@3 d3@2 f3@2 g3@2 a3@2", "0.42@2 0.25@3 0.4@3 0.42@2 0.35@2 0.3@2 0.3@2", 0.7)
const riff5 = phrase("d3@2 d3@3 a3@3 d3@3 f3@3 g3@2", "0.42@2 0.25@3 0.4@3 0.42@3 0.3@3 0.35@2", 0.9)
const riff6 = phrase("a#2@2 a#2@3 f3@3 a#2@3 c#3@3 d#3@2", "0.42@2 0.25@3 0.4@3 0.42@3 0.3@3 0.35@2", 0.9)
const riff7 = phrase("c3@2 c3@3 g3@3 c3@2 d#3@2 f3@2 g3@2", "0.42@2 0.25@3 0.4@3 0.42@2 0.35@2 0.3@2 0.3@2", 0.9)
const riff8 = phrase("c3@2 c3@3 g3@3 c3@2 d#3@2 d3@4", "0.42@2 0.25@3 0.4@3 0.42@2 0.35@2 0.6@4", 0.9)

// hook
const kingA1 = phrase("d4 e4 f4 g4 a4 f4 a4@2", "0.32 0.32 0.32 0.32 0.32 0.32 0.475@2", 0.88)
const kingA2 = phrase("g#4 e4 g#4@2 g4 d#4 g4@2", "[0.32 0.32 0.475@2]*2", 0.88)
const kingA3 = phrase("d4 e4 f4 g4 a4 f4 a4 d5", 0.32, 0.88)
const kingA4 = phrase("c5 a4 f4 a4 c5@4", "0.32 0.32 0.32 0.32 1.6625@4", 0.88)
const lineB1 = phrase("d5@4 f5@3 a5@5 g5@4", "0.7@4 0.45@3 0.8@5 0.6@4", 0.9)
const lineB2 = phrase("~ f5@2 d5@2 c5@2 a4", "~ 0.5@2 0.6@2 0.45@2 0.4", 0.9)
const lineB3 = phrase("a#4@4 d5@3 f5@5 d5@4", "0.65@4 0.45@3 0.7@5 0.5@4", 0.9)
const lineB4 = phrase("c5@5 e5@5 g5@4 a5@2", "0.6@5 0.6@5 0.45@4 0.35@2", 0.9)
const kingEnd = phrase("c5 a4 f4 a4 c5@2 d5@2", "0.32 0.32 0.32 0.32 1.6625@2 0.8@2", "0.88 0.88 0.88 0.88 0.88@2 0.9@2")

// answer
const answer1 = phrase("d5@3 f5@3 a5@2", 0.35, 0.6)
const answer2 = phrase("~@5 a5 g5 f5", 0.32, 0.6)
const answer3 = phrase("~@3 d6@8 a5@5", 0.25, 0.55)
const answer4 = phrase("d5 e5 f5 g5 a5 f5 a5@2", 0.35, 0.75)
const answer5 = phrase("g#5 e5 g#5@2 g5 d#5 g5@2", 0.35, 0.75)
const answer6 = phrase("d5 e5 f5 g5 a5 f5 a5 d6", 0.35, 0.75)
const answer7 = phrase("c6 a5 f5 a5 c6@4", 0.35, 0.75)

// stab
const stab1 = phrase("~@3 [d4,f4,a4]@4 [d4,f4,a4]", 0.5, 0.8)
const stab2 = phrase("~ [d4,f4,a4]@4 [d4,f4,a4]@3", 0.5, 0.8)
const stab3 = phrase("~@3 [a#3,c#4,f4]@4 [a#3,c#4,f4]", 0.5, 0.8)
const stab4 = phrase("~ [c4,e4,g4]@4 [c4,e4,g4]@3", 0.5, 0.8)

// acid
const acid1 = phrase("~ d4@3 d4@3 f4@2 a4@3 g4@3 f4", 0.28, 0.65)
const acid2 = phrase("~ d4@3 f4@3 a4@2 g4@3 f4@3 d4", 0.28, 0.65)
const acid3 = phrase("~ f4@3 a4@3 g4@2 f4@3 d4@3 d4", 0.28, 0.65)
const acid4 = phrase("~ a4@3 g4@3 f4@2 d4@3 d4@3 f4", 0.28, 0.65)
const acid5 = phrase("~ d4@3 d4@3 f4@2 a4@3 g4@3 f4", 0.28, 0.42)
const acid6 = phrase("~ d4@3 f4@3 a4@2 g4@3 f4@3 d4", 0.28, 0.42)
const acid7 = phrase("~ f4@3 a4@3 g4@2 f4@3 d4@3 d4", 0.28, 0.42)
const acid8 = phrase("~ a4@3 g4@3 f4@2 d4@7", 0.28, 0.42)

// noise
const noise1 = phrase("~@3 c4", 0.8, 0.65)
const noise2 = phrase("c4", 3.7, 0.22)
const noise3 = phrase("c4", 3.7, 0.38)
const noise4 = phrase("c4", 3.7, 0.54)
const noise5 = phrase("c4", 3, 0.7)

// Reusable multi-bar phrases.
const kickIntroLoop = cat(kickIntro, silence)
const kickIgnitionLoop = cat(kickFour, kickFour, kickFour, kickFill)
const kickThemeALoop = cat(kickFour, kickFour, kickFour, kickFour, kickFour, kickFour, kickFour, kickFill)
const kickThemeBLoop = cat(kickFour, kickBroken, kickFour, kickBroken, kickFour, kickBroken, kickFour, kickFill)
const kickBuildLoop = cat(kickHalf, kickHalf, kickFour, kickStop)
const kickReturnBLoop = cat(kickFour, kickBroken, kickFour, kickFill)
const kickFinaleLoop = cat(kickFour, kickFour, kickFour, kickEnd)
const snareIntroLoop = cat(silence, silence, snare1, snare1)
const snareIgnitionLoop = cat(snare1, snare1, snare1, snare2)
const snareThemeALoop = cat(snare3, snare3, snare3, snare3, snare3, snare3, snare3, snare4)
const snareBuildLoop = cat(snare5, snare6, snare7, snare8)
const snareFinaleLoop = cat(snare3, snare3, snare3, snare9)
const clapFinaleLoop = cat(clap1, clap1, clap1, clap2)
const hatThemeALoop = cat(hatEighths, hatEighths, hatEighths, hatFill)
const hatBuildLoop = cat(hatEighths, hatEighths, hatEighths, hatStop)
const hatFinaleLoop = cat(hatEighths, hatEighths, hatEighths, hatEnd)
const metalFinaleLoop = cat(metal1, metal1, metal1, metal2)
const bassThemeALoop = cat(bass1, bass1, bass2, bass3)
const bassThemeBLoop = cat(bass4, bass4, bass5, bass6)
const bassFinaleLoop = cat(bass1, bass1, bass2, bass8)
const subThemeALoop = cat(sub1, sub1, sub2, sub3)
const subThemeBLoop = cat(sub4, sub4, sub5, sub6)
const subFinaleLoop = cat(sub1, sub1, sub2, sub8)
const riffIntroLoop = cat(riff1, riff1, riff1, riff2)
const riffIgnitionLoop = cat(riff3, riff3, riff3, riff4)
const riffThemeALoop = cat(riff5, riff5, riff6, riff7)
const riffFinaleLoop = cat(riff5, riff5, riff6, riff8)
const hookThemeALoop = cat(kingA1, kingA2, kingA3, kingA4)
const hookThemeBLoop = cat(lineB1, lineB2, lineB3, lineB4)
const hookFinaleLoop = cat(kingA1, kingA2, kingA3, kingEnd)
const answerIgnitionLoop = cat(silence, silence, answer1, answer1)
const answerThemeALoop = cat(silence, silence, silence, answer2)
const answerBreakLoop = cat(answer4, answer5, answer6, answer7)
const stabThemeALoop = cat(stab1, stab2, stab3, stab4)
const stabFinaleLoop = cat(stab1, stab2, stab3, silence)
const acidThemeALoop = cat(silence, silence, silence, silence, acid1, acid2, acid3, acid4)
const acidThemeBLoop = cat(acid1, acid2, acid3, acid4)
const acidBuildLoop = cat(acid5, acid6, acid7, acid8)
const acidFinaleLoop = cat(acid1, acid2, acid3, silence)
const noiseIgnitionLoop = cat(silence, silence, silence, noise1)
const noiseThemeALoop = cat(silence, silence, silence, silence, silence, silence, silence, noise1)
const noiseBuildLoop = cat(noise2, noise3, noise4, noise5)

// Цех горного короля: instruments, levels and the clip timeline. No note sequences.
// clip(from, to, pattern): zero-based bar positions; end excluded. Form loops at 48 bars.
const clip = (from, to, pattern) => arrange([to - from, pattern], [bars - to + from, silence]).late(from)
const introGain = level => arrange([8, pure(level * 0.8)], [40, pure(level)])

// Instrument settings and mix.
const kickSound = p => p.s("kick").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.02)
  .pan(0.5).postgain(0.661745436)
const snareSound = p => p.s("biba_snare").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.03)
  .pan(0.5).postgain(4.340177073)
const clapSound = p => p.s("biba_clap").gain(0.6).attack(0.001).decay(0.11).sustain(0).release(0.03)
  .pan(0.53).postgain(0.266789522)
const hatSound = p => p.s("hat").gain(0.8).attack(0.001).decay(0.045).sustain(0).release(0.01)
  .pan(0.63).postgain(0.27809305)
const openhatSound = p => p.s("biba_open_hat").gain(0.8).attack(0.001).decay(0.13).sustain(0).release(0.04).hcutoff(5000)
  .pan(0.68).postgain(0.348179402)
const metalSound = p => p.s("sine").gain(0.8).attack(0.001).decay(0.07).sustain(0).release(0.035).fmi(2.4).fmh(2.73).cutoff(6500).hcutoff(450)
  .pan(0.24).postgain(0.172336322)
const bassSound = p => p.s("sawtooth").gain(0.8).attack(0.003).decay(0.08).sustain(0.5).release(0.035).cutoff(1600).resonance(1.4)
  .pan(0.5).postgain(introGain(0.518014418))
const subSound = p => p.s("sine").gain(0.7).attack(0.006).decay(0.1).sustain(0.7).release(0.045).cutoff(160)
  .pan(0.5).postgain(0.420791314)
const riffSound = p => p.s("square").gain(0.8).attack(0.002).decay(0.1).sustain(0.33).release(0.035).cutoff(2400).hcutoff(120).fmi(0.12).fmh(1.99)
  .pan(0.39).postgain(0.204759758)
const hookSound = p => p.s("sawtooth").gain(0.7).attack(0.005).decay(0.13).sustain(0.6).release(0.12).cutoff(4400).unison(3).detune(0.13).spread(0.65)
  .pan(0.55).postgain(0.621802309)
const answerSound = p => p.s("triangle").gain(0.8).attack(0.002).decay(0.09).sustain(0.15).release(0.07).cutoff(6000).fmi(0.7).fmh(2)
  .pan(0.74).postgain(0.269979598)
const stabSound = p => p.s("biba_tx_piano").gain(0.7).attack(0.002).decay(0.15).sustain(0.15).release(0.08).cutoff(4700)
  .pan(0.27).postgain(0.711232816)
const acidSound = p => p.s("sawtooth").gain(0.75).attack(0.002).decay(0.1).sustain(0.25).release(0.025).cutoff(850).resonance(3.5).lpenv(2).lpattack(0.001).lpdecay(0.14).lpsustain(0.1).lprelease(0.03)
  .pan(0.62).postgain(introGain(0.254807843))
const noiseSound = p => p.s("white").gain(0.4).attack(0.05).decay(0.08).sustain(0.8).release(0.15).hcutoff(1000).cutoff(8500)
  .pan(0.5).postgain(0.178843831)

// Stack the clips. Each line specifies its start, end and musical pattern.
lanes.kick = kickSound(stack(
  clip(0, 4, kickIntroLoop),
  clip(4, 8, kickIgnitionLoop),
  clip(8, 16, kickThemeALoop),
  clip(16, 24, kickThemeBLoop),
  clip(24, 28, kickIntroLoop),
  clip(28, 32, kickBuildLoop),
  clip(32, 40, kickThemeALoop),
  clip(40, 44, kickReturnBLoop),
  clip(44, 48, kickFinaleLoop)
))

lanes.snare = snareSound(stack(
  clip(0, 4, snareIntroLoop),
  clip(4, 8, snareIgnitionLoop),
  clip(8, 24, snareThemeALoop),
  clip(28, 32, snareBuildLoop),
  clip(32, 40, snareThemeALoop),
  clip(40, 44, snare3),
  clip(44, 48, snareFinaleLoop)
))

lanes.clap = clapSound(stack(
  clip(8, 24, clap1),
  clip(32, 44, clap1),
  clip(44, 48, clapFinaleLoop)
))

lanes.hat = hatSound(stack(
  clip(4, 8, hatOffbeat),
  clip(8, 24, hatThemeALoop),
  clip(28, 32, hatBuildLoop),
  clip(32, 44, hatThemeALoop),
  clip(44, 48, hatFinaleLoop)
))

lanes.openhat = openhatSound(stack(
  clip(8, 24, openhat1),
  clip(32, 48, openhat1)
))

lanes.metal = metalSound(stack(
  clip(0, 4, metal1),
  clip(8, 28, metal1),
  clip(32, 44, metal1),
  clip(44, 48, metalFinaleLoop)
))

lanes.bass = bassSound(stack(
  clip(4, 8, bass1),
  clip(8, 16, bassThemeALoop),
  clip(16, 24, bassThemeBLoop),
  clip(24, 28, bass7),
  clip(32, 40, bassThemeALoop),
  clip(40, 44, bassThemeBLoop),
  clip(44, 48, bassFinaleLoop)
))

lanes.sub = subSound(stack(
  clip(4, 8, sub1),
  clip(8, 16, subThemeALoop),
  clip(16, 24, subThemeBLoop),
  clip(24, 28, sub7),
  clip(32, 40, subThemeALoop),
  clip(40, 44, subThemeBLoop),
  clip(44, 48, subFinaleLoop)
))

lanes.riff = riffSound(stack(
  clip(0, 4, riffIntroLoop),
  clip(4, 8, riffIgnitionLoop),
  clip(8, 24, riffThemeALoop),
  clip(32, 44, riffThemeALoop),
  clip(44, 48, riffFinaleLoop)
))

lanes.hook = hookSound(stack(
  clip(8, 16, hookThemeALoop),
  clip(16, 24, hookThemeBLoop),
  clip(32, 40, hookThemeALoop),
  clip(40, 44, hookThemeBLoop),
  clip(44, 48, hookFinaleLoop)
))

lanes.answer = answerSound(stack(
  clip(4, 8, answerIgnitionLoop),
  clip(8, 16, answerThemeALoop),
  clip(16, 24, answer3),
  clip(24, 28, answerBreakLoop),
  clip(32, 40, answerThemeALoop),
  clip(40, 44, answer3)
))

lanes.stab = stabSound(stack(
  clip(8, 24, stabThemeALoop),
  clip(32, 44, stabThemeALoop),
  clip(44, 48, stabFinaleLoop)
))

lanes.acid = acidSound(stack(
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
    playerParts: [{key:'riff', name:'Рифф', split:'time', pattern:riffSound(riffThemeALoop)}],
    backing: stack(...Object.entries(lanes).filter(([name]) => !["riff"].includes(name)).map(([key, p]) => p.withValue(v => ({...v, _phaseCubePart:key})))),

  };
}
