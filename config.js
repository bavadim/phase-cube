/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Designer-owned sound and puzzle defaults. No browser or audio side effects. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PhaseCubeConfig=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const colors = { U:'#e9dca6', R:'#dc8e70', F:'#739e87', D:'#c5ad63', L:'#a4b6c3', B:'#a196b6' };
  const names = { U:'верх', R:'справа', F:'спереди', D:'низ', L:'слева', B:'сзади' };
  // Original project motifs, adapted from segment_rave.strudel and after_hours.strudel.
  // These are a listening fixture, not a native-level composition acceptance claim.
  const voices = [
    { name:'Бас', notes:'c2 ~ g2 ~', sound:'sine', gain:.17, attack:.008, decay:.22, sustain:0, release:.07, lpf:700, pan:.48, color:'#507c63', source:'after_hours · бас' },
    { name:'Рифф', notes:'c4 ~ g4 ~', sound:'sawtooth', gain:.052, attack:.003, decay:.13, sustain:.08, release:.05, lpf:1500, pan:.30, color:'#af7658', source:'segment_rave · lead' },
    { name:'Колокольчик', notes:'~ g5', sound:'sine', gain:.065, attack:.002, decay:.20, sustain:0, release:.10, lpf:6000, pan:.70, color:'#778aa8', source:'segment_rave · voice' },
    { name:'Ответ', notes:'c5 ~', sound:'triangle', gain:.07, attack:.008, decay:.22, sustain:0, release:.08, lpf:2600, pan:.60, color:'#a183a0', source:'segment_rave · voice_alt' },
    { name:'Аккорд', notes:'[c3,eb3,g3,bb3]', sound:'triangle', gain:.035, attack:.09, decay:.30, sustain:.12, release:.18, lpf:900, pan:.50, color:'#7f9360', source:'after_hours · первый аккорд' },
    { name:'Шумовой удар', notes:'~ white ~ white', sound:null, gain:.052, attack:.001, decay:.08, sustain:0, release:.02, hpf:1500, lpf:6500, pan:.53, color:'#b2924d', source:'after_hours · backbeat' },
    { name:'Хэты', notes:'hat*8', sound:null, gain:.075, attack:0, decay:0, sustain:1, release:.01, pan:.66, color:'#588c91', source:'after_hours · hat' },
    { name:'Пульс', notes:'c2 ~ c2 ~', sound:'square', gain:.025, attack:.002, decay:.08, sustain:0, release:.03, lpf:550, pan:.40, color:'#ab7270', source:'segment_rave · bass_alt' }
  ];
  // Calibrated +12.04 dB output trim; individual voice balance stays unchanged.
  return Object.freeze({voices,colors,names,bpm:144,volume:.65,outputGain:4,scrambleLength:3});
});
