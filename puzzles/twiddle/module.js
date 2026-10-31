/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.TwiddlePuzzle=factory(root.TwiddleModel);})(globalThis,function(T){
  return {id:'twiddle',title:'Поворотные плитки 2×3',create:()=>new T.Model(),
    manifest:Object.freeze({schema:'music-puzzle/3',id:'twiddle',version:2,projection:'pose-phase/1',controls:2,fragments:6,pieceIds:[0,1,2,3,4,5],poseIds:[0,1,2,3,4,5],goalPolicy:'single-reference'})};
});
