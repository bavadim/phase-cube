/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.FourierPuzzle=factory(root.FourierModel);})(globalThis,function(F){
  return{id:'fourier',title:'Фаза и громкость',progressLabel:'рифов\nна месте',create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/3',id:'fourier',version:6,projection:'complex-riff/2',controls:6,fragments:6,goalPolicy:'single-reference',stateCount:F.stateCount,
      parameters:{phases:8,magnitudes:F.levels},operations:{phase:{order:8},magnitude:{kind:'bounded-step',levels:F.levels.length},drag:{kind:'coefficient-edit'}}})};
});
