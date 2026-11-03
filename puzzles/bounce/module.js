/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Rhythm gears use the shared independent-riff and interaction contracts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fourier/module.js'),require('../fourier/model.js'));else root.BouncePuzzle=factory(root.FourierPuzzle,root.FourierModel);})(globalThis,function(Base,F){
  class Model extends F.Model{
    selectionLabel(preview){const p=this.parameters()[F.keys.indexOf(this.selected)];return 'Партия '+(F.keys.indexOf(this.selected)+1)+' · '+Math.round((preview?.gain??F.gain(p))*100)+'%';}
  }
  return{id:'bounce',title:'Шестерёнки ритма',progressLabel:'партий\nв ритме',shuffleSteps:6,create:()=>new Model(),
    manifest:Object.freeze({...Base.manifest,id:'bounce',version:3,
      interaction:{requiresSelection:true,allowDeselect:true,hoverActions:false,buttonPreview:false,selectionPrompt:'Выберите шестерёнку'}})};
});
