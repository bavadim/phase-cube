/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./maze-model.js'));else root.FourierPuzzle=factory(root.FourierMazeModel);})(globalThis,function(M){
  return{id:'fourier',title:'Звучащий лабиринт',progressLabel:'узлов\nсоединено',shuffleSteps:6,create:()=>new M.Model(),
    manifest:Object.freeze({schema:'music-puzzle/3',id:'fourier',version:8,projection:'complex-riff/3',controls:6,fragments:6,goalPolicy:'single-reference',stateSpace:'C8^6 × {0,0.5,1,1.5,2}^6',gridPresetStates:M.stateCount,
      interaction:{requiresSelection:true,hoverActions:false,selectionPrompt:'Соедините вход и выход'},
      parameters:{phases:8,magnitudes:{min:0,max:2,continuous:false,step:M.gainStep,values:M.gains}},operations:{phase:{order:8},magnitude:{kind:'bounded-step',step:M.gainStep,min:0,max:2},drag:{kind:'coefficient-edit'}}})};
});
