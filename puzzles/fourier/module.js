/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.FourierPuzzle=factory(root.FourierModel);})(globalThis,function(F){
  return{id:'fourier',title:'Фурье-точки',progressLabel:'точек\nна месте',create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/2',id:'fourier',version:2,projection:'fourier-time/2',fragments:6,goalPolicy:'single-reference',operations:{A:4,B:4,C:4,D:4},stateCount:192})};
});
