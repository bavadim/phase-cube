/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Editable Strudel composition. Metadata and form live beside the actual music.
// Browser adaptation of levels/music/raves/turkish_circuit; no pre-rendered song audio.
export const metadata = {
  schema: "music-composition/1", version: 1,
  title: "Моцарт на конвейере", style: "Piano / industrial rave", bpm: 150,
  download: 'assets/turkish-circuit-game.mp3',
    credit: "Wolfgang Amadeus Mozart / Mutopia 108 (Public Domain); VCSL CC0; Biba arrangement"
};

export default function compose(S) {
  const {note, cat, stack, arrange, pure, silence, reify} = S;
  const sections = [
  {
    "name": "Открытый контур",
    "bars": 4
  },
  {
    "name": "Зубчатая передача",
    "bars": 4
  },
  {
    "name": "Турецкий цех",
    "bars": 8
  },
  {
    "name": "Неоновая линия",
    "bars": 8
  },
  {
    "name": "Пустой коридор",
    "bars": 4
  },
  {
    "name": "Набор давления",
    "bars": 4
  },
  {
    "name": "Возврат с искрой",
    "bars": 8
  },
  {
    "name": "Ломаная передача",
    "bars": 8
  },
  {
    "name": "Общий разгон",
    "bars": 8
  },
  {
    "name": "Обходной путь",
    "bars": 4
  },
  {
    "name": "Следующий оборот",
    "bars": 4
  }
];
  const bars = sections.reduce((n, section) => n + section.bars, 0);
  const lanes = {};

// Моцарт на конвейере. One cycle = one 4/4 bar. No mix settings here.
// Three player loops repeat unchanged from bar 0 through bar 64.
const phrase = (notes, gate, amp) => note(notes).duration(reify(gate).div(4)).velocity(amp)

const bassAm = phrase("a2@3 a2@3 a3@2 a2@3 e3@3 a3@2", 0.36, 0.9)
const riffAm = phrase("~@2 e4@5 a3@3 c4@5 e4", 0.24, 0.82)
const pluckAm = phrase("~ c6@4 e6@7 a5@2 e6@2", 0.23, 0.78)
const stabAm = phrase("~@3 [a4,c5,e5]@4 [a4,c5,e5]", 0.35, 0.66)
const bassF = phrase("f2@3 f2@3 f3@2 f2@3 c3@3 f3@2", 0.36, 0.9)
const riffF = phrase("~@2 c4@5 f3@3 a3@5 c4", 0.24, 0.82)
const pluckF = phrase("~ a5@4 c6@7 f5@2 c6@2", 0.23, 0.78)
const stabF = phrase("~@3 [f4,a4,c5]@4 [f4,a4,c5]", 0.35, 0.66)
const bassDm = phrase("d2@3 d2@3 d3@2 d2@3 a2@3 d3@2", 0.36, 0.9)
const riffDm = phrase("~@2 a3@5 d3@3 f3@5 a3", 0.24, 0.82)
const pluckDm = phrase("~ f5@4 a5@7 d5@2 a5@2", 0.23, 0.78)
const stabDm = phrase("~@3 [d4,f4,a4]@4 [d4,f4,a4]", 0.35, 0.66)
const bassE = phrase("e2@3 e2@3 e3@2 e2@3 b2@3 e3@2", 0.36, 0.9)
const riffE = phrase("~@2 b3@5 e3@3 g#3@5 b3", 0.24, 0.82)
const pluckE = phrase("~ g#5@4 b5@7 e5@2 b5@2", 0.23, 0.78)
const stabE = phrase("~@3 [e4,g#4,b4]@4 [e4,g#4,b4]", 0.35, 0.66)
const kickFour = phrase("c2*4", 0.35, 1)
const snareBack = phrase("~ c4@2 c4", 0.32, 0.88)
const snareHalf = phrase("~ c4", 0.32, 0.78)
const snareBroken = phrase("~@2 c4@3 c4@2 c4", 0.23, 0.7)
const snareFill = phrase("~@4 c4@8 c4@2 c4 c4", 0.23, 0.74)
const rollEighth = phrase("c4*8", 0.16, 0.4)
const rollSixteenth = phrase("c4*16", 0.14, 0.48)
const clapBack = phrase("~ c4@2 c4", 0.3, 0.7)
const hatOff = phrase("~ c4@2 c4@2 c4@2 c4", 0.13, 0.8)
const hatEighth = phrase("c4*8", 0.13, 0.72)
const hatShuffle = phrase("c4@2 c4@3 c4 c4@2 c4@2 c4@3 c4 c4@2", 0.11, 0.7)
const openOff = phrase("~@3 c4@4 c4", 0.25, 0.7)
const claves = phrase("~@3 c4@4 c4@4 c4@5", 0.18, 0.72)
const noiseShort = phrase("~@3 c4", 0.9, 0.65)
const noiseLong = phrase("c4*1", 3.7, 0.48)
const turkishAm = phrase("b4 a4 g#4 a4 c5@4 d5 c5 b4 c5 e5@4", 0.24, 0.93)
const turkishF = phrase("c5 a4 g4 a4 f5@4 e5 d5 c5 d5 a5@4", 0.24, 0.89)
const turkishDm = phrase("f5 e5 d5 e5 a5 g5 f5 d5", 0.36, 0.89)
const turkishE = phrase("b4@2 e5@2 g#5@3 b5@3 a5@2 g#5@2 e5@2", 0.32, 0.88)
const hintAm = phrase("b4 a4 g#4 a4 c5@12", 0.24, 0.78)
const hintF = phrase("~@4 c5 a4 g4 a4", 0.3, 0.76)
const hintDm = phrase("~@4 f5 e5 d5@2", 0.3, 0.76)
const hintE = phrase("~@5 b4 g#4 e5", 0.3, 0.78)
const neon1 = phrase("a5@3 e5@3 c5@4 e5@4 g5@2", 0.53, 0.88)
const neon2 = phrase("a5@4 g5@3 f5@3 e5@3 c5@3", 0.53, 0.88)
const neon3 = phrase("d5@3 f5@3 a5@4 g5@4 f5@2", 0.53, 0.88)
const neon4 = phrase("e5@3 g#5@3 b5@4 a5@4 g#5@2", 0.53, 0.88)
const glass1 = phrase("c6@5 b5@3 a5@6 e5@2", 0.63, 0.79)
const glass2 = phrase("~ a5@2 c6@2 a5@2 g5", 0.63, 0.79)
const glass3 = phrase("f5@5 a5@3 d6@5 c6@3", 0.63, 0.79)
const glass4 = phrase("b5 g#5 e5 d5", 0.63, 0.79)
const bridgeAm = phrase("~ e5@2 c5@2 a4@3", 0.42, 0.76)
const bridgeF = phrase("~ a4 c5 f5", 0.42, 0.76)
const bridgeDm = phrase("a5 f5 e5 d5", 0.43, 0.76)
const bridgeE = phrase("b4@2 d5@2 e5@2 b4 g#4", 0.35, 0.78)

// Four-bar phrases: period of the player controls = 4 bars.
const bassLoop = cat(bassAm, bassF, bassDm, bassE)
const riffLoop = cat(riffAm, riffF, riffDm, riffE)
const pluckLoop = cat(pluckAm, pluckF, pluckDm, pluckE)
const chordLoop = cat(stabAm, stabF, stabDm, stabE)
const brokenDrums = cat(snareBroken, snareBack, snareBroken, snareFill)
const turkishA = cat(turkishAm, turkishF, turkishDm, turkishE)
const hints = cat(hintAm, hintF, hintDm, hintE)
const neonB = cat(neon1, neon2, neon3, neon4)
const glassC = cat(glass1, glass2, glass3, glass4)
const circularBridge = cat(bridgeAm, bridgeF, bridgeDm, bridgeE)

// Моцарт на конвейере. Instrument settings and arrangement; no note sequences.
// Core period = 4 bars. Whole-song period = 64 bars. No intro/outro muting.
const clip = (from, to, p) => arrange([to - from, p], [bars - to + from, silence]).late(from)

const kickSound = p => p.s("kick").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.02).pan(0.5).postgain(0.318856303550)
const snareSound = p => p.s("biba_snare").gain(0.8).attack(0.001).decay(0.12).sustain(0).release(0.03).pan(0.5).postgain(1.869913043478)
const clapSound = p => p.s("biba_clap").gain(0.6).attack(0.001).decay(0.11).sustain(0).release(0.03).pan(0.54).postgain(0.122409195402)
const hatSound = p => p.s("hat").gain(0.8).attack(0.001).decay(0.045).sustain(0).release(0.01).pan(0.62).postgain(0.130309214355)
const openhatSound = p => p.s("biba_open_hat").gain(0.8).attack(0.001).decay(0.13).sustain(0).release(0.04).hcutoff(5000).pan(0.7).postgain(0.150879811098)
const metalSound = p => p.s("biba_claves").gain(0.8).attack(0.001).decay(0.07).sustain(0).release(0.035).fmi(2.4).fmh(2.73).cutoff(6700).hcutoff(1300).pan(0.24).postgain(3.475393939394)
const bassSound = p => p.s("sawtooth").gain(0.8).attack(0.003).decay(0.09).sustain(0.42).release(0.035).cutoff(1150).resonance(1.4).pan(0.5).postgain(0.324620359827)
const riffSound = p => p.s("sine").gain(0.8).attack(0.002).decay(0.075).sustain(0.12).release(0.035).cutoff(2900).hcutoff(220).fmi(2.1).fmh(2).pan(0.34).postgain(0.165253351029)
const hookSound = p => p.s("biba_grand_piano").gain(0.7).attack(0.002).decay(0.16).sustain(0.48).release(0.1).cutoff(6500).unison(3).detune(0.13).spread(0.65).pan(0.49).postgain(0.208589373621)
const stabSound = p => p.s("biba_tx_piano").gain(0.7).attack(0.002).decay(0.15).sustain(0.15).release(0.06).cutoff(4300).hcutoff(600).pan(0.26).postgain(0.185604315577)
const noiseSound = p => p.s("white").gain(0.4).attack(0.05).decay(0.08).sustain(0.8).release(0.15).hcutoff(1000).cutoff(8500).pan(0.5).postgain(0.064617747794)
const pluckSound = p => p.s("triangle").gain(0.7).attack(0.002).decay(0.085).sustain(0.08).release(0.065).cutoff(5600).hcutoff(1100).fmi(0.5).fmh(3).pan(0.68).postgain(0.211740379092)
const leadSound = p => p.s("sawtooth").gain(0.55).attack(0.008).decay(0.14).sustain(0.4).release(0.12).cutoff(3900).hcutoff(650).unison(3).detune(0.12).spread(0.55).pan(0.56).postgain(0.238816627677)

// Player parts: immutable four-bar loops, no section-dependent controls.
lanes.bass = bassSound(bassLoop)
lanes.riff = riffSound(riffLoop)
lanes.pluck = pluckSound(pluckLoop)

// Fixed backing: the full 64-bar arrangement, heard continuously.
lanes.kick = kickSound(stack(
  clip(0, 64, kickFour)
))
lanes.hat = hatSound(stack(
  clip(0, 8, hatOff),
  clip(8, 24, hatEighth),
  clip(24, 28, hatOff),
  clip(28, 40, hatEighth),
  clip(40, 48, hatShuffle),
  clip(48, 56, hatEighth),
  clip(56, 64, hatOff)
))
lanes.snare = snareSound(stack(
  clip(4, 24, snareBack),
  clip(32, 40, snareBack),
  clip(48, 56, snareBack),
  clip(24, 28, snareHalf),
  clip(28, 30, rollEighth),
  clip(30, 32, rollSixteenth),
  clip(40, 48, brokenDrums)
))
lanes.clap = clapSound(stack(
  clip(4, 24, clapBack),
  clip(32, 40, clapBack),
  clip(48, 56, clapBack)
))
lanes.openhat = openhatSound(stack(
  clip(4, 24, openOff),
  clip(32, 40, openOff),
  clip(48, 56, openOff)
))
lanes.metal = metalSound(stack(
  clip(4, 24, claves),
  clip(36, 56, claves)
))
lanes.noise = noiseSound(stack(
  clip(15, 16, noiseShort),
  clip(23, 24, noiseShort),
  clip(31, 32, noiseShort),
  clip(39, 40, noiseShort),
  clip(47, 48, noiseShort),
  clip(55, 56, noiseShort),
  clip(30, 32, noiseLong)
))
lanes.hook = hookSound(stack(
  clip(0, 8, hints),
  clip(8, 16, turkishA),
  clip(24, 28, glassC),
  clip(32, 40, turkishA),
  clip(40, 48, glassC),
  clip(48, 52, turkishA),
  clip(56, 60, hints),
  clip(60, 64, circularBridge)
))
lanes.lead = leadSound(stack(
  clip(16, 24, neonB),
  clip(52, 56, neonB)
))
lanes.stab = stabSound(stack(
  clip(12, 24, chordLoop),
  clip(36, 40, chordLoop),
  clip(48, 56, chordLoop)
))


  return {
    ...metadata,
    periodBars: 4, sections,
    playerParts: [
    {key:'bass', name:'Бас', pattern:bassSound(bassLoop)},
    {key:'riff', name:'Металлический рифф', pattern:riffSound(riffLoop)},
    {key:'pluck', name:'Щипковый ответ', pattern:pluckSound(pluckLoop)}
  ],
    backing: stack(...Object.entries(lanes).filter(([name]) => !["bass", "riff", "pluck"].includes(name)).map(([key, p]) => p.withValue(v => ({...v, _phaseCubePart:key})))),

  };
}
