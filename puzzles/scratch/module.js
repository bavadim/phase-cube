/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.ScratchPuzzle=factory(root.ScratchModel);})(globalThis,function(F){
  return{id:'scratch',title:'Спектральный обруч',progressLabel:'волн\nна месте',create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/2',id:'scratch',version:1,projection:'fourier-scratch/1',controls:3,fragments:6,stateCount:F.stateCount,goalPolicy:'single-reference',
      operations:{phase:{order:4},swap:{order:2}},group:'C4^3 semidirect S3'})};
});
