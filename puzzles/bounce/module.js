/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Terrain is an alternative instrument for the existing independent-riff contract. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fourier/module.js'),require('../fourier/model.js'));else root.BouncePuzzle=factory(root.FourierPuzzle,root.FourierModel);})(globalThis,function(Base,F){
  class Model extends F.Model{
    selectionLabel(){return 'Дорожка '+(F.keys.indexOf(this.selected)+1);}
    actions(callbacks){return super.actions(callbacks).map(a=>({...a,group:a.group==='Фаза'?'Ритм':'Рельеф'}));}
  }
  return{id:'bounce',title:'Прыгучий ритм',progressLabel:'партий\nв ритме',shuffleSteps:6,create:()=>new Model(),
    manifest:Object.freeze({...Base.manifest,id:'bounce',version:1})};
});
