/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Three picture pieces: slot rotations and permutations, C4^3 semidirect S3. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'),require('../actions.js'));else root.ScratchModel=factory(root.PuzzleShuffle,root.PuzzleActions);})(globalThis,function(Shuffle,Actions){
  'use strict';
  const keys=['A','B','C'],amplitudes=[.48,.30,.18],permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]],stateCount=384;
  const moves=keys.flatMap(key=>[key,key+"'",key+'x']),mod=(x,n)=>((x%n)+n)%n;
  const validState=state=>Number.isInteger(state)&&state>=0&&state<stateCount;
  const timingDepth=.35,gainDepth=.6;
  function parameters(state){
    if(!validState(state))throw new Error('Неверное состояние пазла');
    const p=permutations[Math.floor(state/64)];return keys.map((key,slot)=>({key,slot,source:p[slot],phase:Math.floor(state/4**slot)%4}));
  }
  function encode(values){
    const p=permutations.findIndex(p=>p.every((v,i)=>v===values[i].source));
    if(p<0)throw new Error('Детали должны оставаться перестановкой');
    return p*64+values.reduce((sum,v,i)=>sum+mod(v.phase,4)*4**i,0);
  }
  const coefficients=state=>parameters(state).map(p=>[amplitudes[p.source]*Math.cos(p.phase*Math.PI/2),amplitudes[p.source]*Math.sin(p.phase*Math.PI/2)]);
  const phaseEdit=m=>m&&m.kind==='piece-phase'&&keys.includes(m.key)&&validState(m.from)&&Number.isInteger(m.turns)&&m.turns!==0&&Math.abs(m.turns)<=2;
  const swapEdit=m=>m&&m.kind==='piece-swap'&&keys.includes(m.key)&&keys.includes(m.to)&&m.to!==m.key&&validState(m.from);
  function moveTarget(move){if(typeof move==='string'&&moves.includes(move))return move[0];if(phaseEdit(move)||swapEdit(move))return move.key;throw new Error('Неверное действие пазла');}
  function applyTo(state,move){
    const i=keys.indexOf(moveTarget(move)),values=parameters(state);
    if(phaseEdit(move)||swapEdit(move)){
      if(state!==move.from)throw new Error('Устаревшее перетаскивание');
      if(phaseEdit(move))values[i].phase+=move.turns;
      else{const j=keys.indexOf(move.to);[values[i],values[j]]=[values[j],values[i]];}
    }else if(move.endsWith('x')){const j=(i+1)%3;[values[i],values[j]]=[values[j],values[i]];}
    else values[i].phase+=move.endsWith("'")?-1:1;
    return encode(values);
  }
  function inverse(move){
    moveTarget(move);
    if(phaseEdit(move))return{...move,from:applyTo(move.from,move),turns:-move.turns};
    if(swapEdit(move))return{...move,from:applyTo(move.from,move)};
    if(move.endsWith('x'))return move;return move.endsWith("'")?move[0]:move+"'";
  }
  // Each immutable source riff follows its picture piece between frequency slots.
  function field(piece,t){
    const a=amplitudes[piece.source],k=piece.slot+1,home=piece.source+1;
    const angle=2*Math.PI*k*t+piece.phase*Math.PI/2,reference=2*Math.PI*home*t;
    const re=a*(Math.cos(angle)-Math.cos(reference)),im=a*(Math.sin(angle)-Math.sin(reference));
    return{time:t+timingDepth*im/(2*Math.PI),gain:1+gainDepth*re,
      derivative:1+timingDepth*a*(k*Math.cos(angle)-home*Math.cos(reference))};
  }
  let graph;
  function states(){
    if(graph)return graph;
    graph=new Map([[0,{state:0,depth:0,hint:null}]]);const queue=[0];
    for(let i=0;i<queue.length;i++)for(const move of moves){const next=applyTo(queue[i],move);if(!graph.has(next)){graph.set(next,{state:next,depth:graph.get(queue[i]).depth+1,hint:inverse(move)});queue.push(next);}}
    return graph;
  }
  class Model{
    constructor(){this.count=3;this.reset();}
    initialState(){return 0;}
    snapshot(){return this.current;}
    restore(state){parameters(state);this.current=state;}
    parameters(state=this.current){return parameters(state);}
    coefficients(state=this.current){return coefficients(state);}
    legalMoves(){return [...moves];}
    allStates(){return [...states().keys()];}
    applyTo(state,move){return applyTo(state,move);}
    inverse(move){return inverse(move);}
    validMove(move,state=this.current){try{return applyTo(state,move)!==state;}catch{return false;}}
    moveTarget(move){return moveTarget(move);}
    moveFor(key,inverted=false){if(!keys.includes(key))throw new Error('Неизвестный паз');return key+(inverted?"'":'');}
    select(key){if(!keys.includes(key))throw new Error('Неизвестный паз');this.selected=key;}
    choices(){return keys.map((key,i)=>({key,label:'Фрагмент в пазу '+(i+1)}));}
    selectionLabel(){return 'Фрагмент '+(parameters(this.current)[keys.indexOf(this.selected)].source+1);}
    actions(callbacks){
      const key=this.selected,i=keys.indexOf(key),n=i+1,j=(i+1)%3+1;
      return[
        {id:'turn-left',label:'Паз '+n+': повернуть против часовой стрелки',icon:{text:'↶'},move:key+"'"},
        {id:'turn-right',label:'Паз '+n+': повернуть по часовой стрелке',icon:{text:'↷'},move:key},
        {id:'swap-piece',label:'Поменять детали в пазах '+n+' и '+j,icon:{text:'⇄'},move:key+'x'}
      ].map(action=>Actions.move(this,callbacks,action));
    }
    editMove(key,phase,state=this.current){
      if(!keys.includes(key)||!Number.isFinite(phase))throw new Error('Неверная фаза детали');
      const i=keys.indexOf(key),turns=mod(Math.round(phase)-parameters(state)[i].phase+2,4)-2;
      return turns?{kind:'piece-phase',key,from:state,turns}:null;
    }
    swapMove(key,to,state=this.current){const move={kind:'piece-swap',key,to,from:state};return this.validMove(move,state)?move:null;}
    reset(seed=1730){this.current=0;this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);}
    shuffle(){const move=this.shuffler.next(this);this.apply(move);this.history=[];this.moves=[];return move;}
    apply(move){const next=applyTo(this.current,move);this.history.push({state:this.current,move});this.current=next;this.moves.push(move);this.selected=moveTarget(move);}
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=moveTarget(old.move);return inverse(old.move);}
    hint(){return states().get(this.current).hint;}
    distance(state=this.current){return states().get(state).depth;}
    solved(state=this.current){return state===0;}
    correct(state=this.current){return parameters(state).filter((p,i)=>p.source===i&&p.phase===0).length;}
  }
  return{Model,keys,amplitudes,timingDepth,gainDepth,stateCount,parameters,coefficients,applyTo,inverse,field,states,moves};
});
