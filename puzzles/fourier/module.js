/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.FourierPuzzle=factory(root.FourierModel);})(globalThis,function(F){
  return{id:'fourier',title:'Фурье-печать',progressLabel:'волн\nсовпало',create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/2',id:'fourier',version:1,projection:'fourier-time/1',fragments:6,goalPolicy:'single-reference',operations:{A:4,B:4,M:8},stateCount:192})};
});
