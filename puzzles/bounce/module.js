/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Terrain is an alternative instrument for the existing independent-riff contract. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fourier/module.js'),require('../fourier/model.js'));else root.BouncePuzzle=factory(root.FourierPuzzle,root.FourierModel);})(globalThis,function(Base,F){
  class Model extends F.Model{
    selectionLabel(preview){const p=this.parameters()[F.keys.indexOf(this.selected)];return 'Партия '+(F.keys.indexOf(this.selected)+1)+' · '+Math.round((preview?.gain??F.gain(p))*100)+'%';}
    actions(callbacks){return super.actions(callbacks).map(a=>({...a,group:a.group==='Фаза'?'Ритм':'Размер'}));}
  }
  return{id:'bounce',title:'Шестерёнки ритма',progressLabel:'партий\nв ритме',shuffleSteps:6,create:()=>new Model(),
    manifest:Object.freeze({...Base.manifest,id:'bounce',version:2})};
});
