/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhaseCubeConfig=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const palette=['#507c63','#739774','#af7658','#c5966a','#588c91','#809eaf','#a183a0','#ab7270'];
  return Object.freeze({palette,volume:1,outputGain:1,scrambleLength:3,shufflePreviewMs:80,shuffleMoveMs:200,shuffleHoldMs:15,defaultPuzzle:'bounce',defaultSong:'turkish-circuit'});
});
