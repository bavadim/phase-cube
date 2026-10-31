/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('./partition.js'));else root.ScratchPuzzle=factory(root.ScratchModel,root.ScratchPartition);})(globalThis,function(F,Partition){
  const puzzle={id:'scratch',title:'Портрет директора',progressLabel:'партий\nна месте',
    configure(S,song,options){const game=Partition.build(S,song,options);return{module:{...this,create:()=>new F.Model({count:game.count,names:game.voices.map(v=>v.name)}),manifest:{...this.manifest,controls:game.count,fragments:game.count,group:'C4^'+game.count+' semidirect S_'+game.count}},game};},
    create:()=>new F.Model(),
    manifest:Object.freeze({schema:'music-puzzle/3',id:'scratch',version:3,projection:'spectral-riff/2',controls:3,fragments:3,goalPolicy:'single-reference',
      operations:{phase:{order:4},swap:{order:2}},group:'C4^N semidirect S_N'})};
  return puzzle;
});
