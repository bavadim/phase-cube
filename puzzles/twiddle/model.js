/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'));else root.TwiddleModel=factory(root.PuzzleShuffle);})(globalThis,function(Shuffle){
  'use strict';
  const HOME=[0,1,2,3,4,5],rings={A:[0,1,4,3],B:[1,2,5,4]},key=s=>s.join('');
  const inverse=m=>m.endsWith("'")?m[0]:m+"'";
  const moves=['A',"A'",'B',"B'"];
  function applyTo(state,move){
    if(!moves.includes(move))throw new Error('Неверный поворот Twiddle');
    const next=[...state],ring=rings[move[0]],step=move.endsWith("'")?-1:1;
    ring.forEach((slot,i)=>{next[ring[(i+step+4)%4]]=state[slot];});return next;
  }
  let graph;
  function states(){
    if(graph)return graph;
    graph=new Map([[key(HOME),{state:HOME,depth:0,hint:null}]]);const queue=[HOME];
    for(let i=0;i<queue.length;i++)for(const move of moves){
      const next=applyTo(queue[i],move),k=key(next);
      if(!graph.has(k)){graph.set(k,{state:next,depth:graph.get(key(queue[i])).depth+1,hint:inverse(move)});queue.push(next);}
    }
    return graph;
  }
  class Model{
    constructor(){this.count=6;this.reset();}
    snapshot(){return [...this.current];}
    initialState(){return [...HOME];}
    legalMoves(){return [...moves];}
    allStates(){return [...states().values()].map(e=>[...e.state]);}
    placements(state=this.current){return state.map((pieceId,slot)=>({pieceId,poseId:slot}));}
    restore(state){if(!states().has(key(state)))throw new Error('Недостижимая позиция Twiddle');this.current=[...state];}
    applyTo(state,move){return applyTo(state,move);}
    inverse(move){return inverse(move);}
    validMove(move){return moves.includes(move);}
    select(value){if(!rings[value])throw new Error('Неверный блок');this.selected=value;}
    moveFor(value,inverted=false){return value+(inverted?"'":'');}
    moveTarget(move){return move[0];}
    choices(){return [{key:'A',label:'Левый блок'},{key:'B',label:'Правый блок'}];}
    reset(seed=1730){this.current=[...HOME];this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);}
    shuffle(){const move=this.shuffler.next(this);this.apply(move);this.history=[];this.moves=[];return move;}
    apply(move){this.history.push({state:this.snapshot(),move});this.current=applyTo(this.current,move);this.moves.push(move);this.selected=move[0];}
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=old.move[0];return inverse(old.move);}
    hint(){return states().get(key(this.current)).hint;}
    distance(state=this.current){return states().get(key(state)).depth;}
    solved(state=this.current){return state.every((id,slot)=>id===slot);}
    correct(state=this.current){return state.filter((id,slot)=>id===slot).length;}
  }
  return {Model,applyTo,inverse,states,rings,moves};
});
