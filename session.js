/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Session intent is independent of the asynchronous audio transport. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PhaseCubeSession=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const initial=()=>({phase:'ready',mode:'current'});
  function transition(state,action){
    switch(action){
      case 'start': return {phase:'playing',mode:'current'};
      case 'pause': return {phase:state.phase==='ready'?'ready':'paused',mode:'current'};
      case 'target': return {...state,mode:state.mode==='target'?'current':'target'};
      case 'move':
      case 'shuffle': return {...state,mode:'current'};
      default: throw new Error(`Unknown session action: ${action}`);
    }
  }
  const shouldPlay=state=>state.phase==='playing'||state.mode==='target';
  const canMove=state=>state.phase==='playing';
  return {initial,transition,shouldPlay,canMove};
});
