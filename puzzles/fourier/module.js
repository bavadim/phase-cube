/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.FourierPuzzle=factory(root.FourierModel);})(globalThis,function(F){
  return{id:'fourier',title:'Совещание',progressLabel:'рифов\nна месте',create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/3',id:'fourier',version:7,projection:'complex-riff/3',controls:6,fragments:6,goalPolicy:'single-reference',stateSpace:'C8^6 × [0,2]^6',gridPresetStates:F.stateCount,
      parameters:{phases:8,magnitudes:{min:0,max:2,continuous:true},gridPresets:F.levels},operations:{phase:{order:8},magnitude:{kind:'bounded-continuous',min:0,max:2},drag:{kind:'coefficient-edit'}}})};
});
