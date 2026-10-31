/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'));else root.FourierModel=factory(root.PuzzleShuffle);})(globalThis,function(Shuffle){
  'use strict';
  const reference=[[.52,0],[-.32,.32],[0,-.40],[.30,.30]],keys=['A','B','C','D'];
  const pairs=keys.map((_,i)=>[i,(i+1)%keys.length]),moves=keys.flatMap(key=>[key,key+"'"]);
  const inverse=move=>{if(!moves.includes(move))throw new Error('Неверный ход Фурье');return move.endsWith("'")?move[0]:move+"'";};
  // Exact signed permutations: a quarter turn of the selected coefficient pair
  // (a,b) -> (-b,a). No floating-point matrix identification or infinite orbit.
  function turn(state,move){
    const [a,b]=pairs[keys.indexOf(move[0])],out=[...state],sign=move.endsWith("'")?-1:1;
    out[a]=-sign*state[b];out[b]=sign*state[a];return out;
  }
  const states=[[1,2,3,4]],index=new Map([['1,2,3,4',0]]),depth=[0],hints=[null];
  for(let i=0;i<states.length;i++)for(const move of moves){
    const next=turn(states[i],move),key=next.join(',');
    if(!index.has(key)){index.set(key,states.length);states.push(next);depth.push(depth[i]+1);hints.push(inverse(move));}
  }
  if(states.length!==192)throw new Error('Изменилась группа Фурье-точек');
  const transitions=states.map(state=>Object.fromEntries(moves.map(move=>[move,index.get(turn(state,move).join(','))])));
  const valid=state=>Number.isInteger(state)&&state>=0&&state<states.length;
  const coefficients=state=>{
    if(!valid(state))throw new Error('Неверное состояние Фурье');
    return states[state].map(id=>reference[Math.abs(id)-1].map(v=>Math.sign(id)*v));
  };
  function interpolate(state,move,t){
    if(!moves.includes(move))throw new Error('Неверный ход Фурье');
    const c=coefficients(state),[a,b]=pairs[keys.indexOf(move[0])],angle=(move.endsWith("'")?-1:1)*t*Math.PI/2,r=Math.cos(angle),s=Math.sin(angle),x=c[a],y=c[b];
    c[a]=x.map((v,j)=>r*v-s*y[j]);c[b]=x.map((v,j)=>s*v+r*y[j]);return c;
  }
  class Model{
    constructor(){this.count=4;this.reset();}
    snapshot(){return this.current;}
    initialState(){return 0;}
    allStates(){return states.map((_,i)=>i);}
    legalMoves(){return [...moves];}
    applyTo(state,move){if(!valid(state)||!moves.includes(move))throw new Error('Неверный ход Фурье');return transitions[state][move];}
    inverse(move){return inverse(move);}
    validMove(move){return moves.includes(move);}
    restore(state){if(!valid(state))throw new Error('Неверное состояние Фурье');this.current=state;}
    moveTarget(move){return move[0];}
    select(key){if(!keys.includes(key))throw new Error('Неверная точка Фурье');this.selected=key;}
    moveFor(key,inverted=false){return key+(inverted?"'":'');}
    choices(){return keys.map((key,i)=>({key,label:'Точка '+(i+1)}));}
    pair(key=this.selected){return [...pairs[keys.indexOf(key)]];}
    operationLabel(){const [a,b]=this.pair();return 'Связь '+(a+1)+' ↔ '+(b+1);}
    actionLabel(key,inverted){const [a,b]=this.pair(key);return 'Точки '+(a+1)+' и '+(b+1)+': '+(inverted?'обратный':'прямой')+' ход';}
    reset(seed=1730){this.current=0;this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);this.shuffleKeys=new Set();}
    shuffle(){
      if(this.shuffleKeys.size===keys.length)this.shuffleKeys.clear();
      const move=this.shuffler.next(this,{moves:moves.filter(move=>!this.shuffleKeys.has(this.moveTarget(move)))});
      this.shuffleKeys.add(this.moveTarget(move));this.apply(move);this.history=[];this.moves=[];return move;
    }
    apply(move){const next=this.applyTo(this.current,move);this.history.push({state:this.current,move});this.current=next;this.moves.push(move);this.selected=this.moveTarget(move);}
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=this.moveTarget(old.move);return this.inverse(old.move);}
    hint(){return hints[this.current];}
    distance(state=this.current){return depth[state];}
    solved(state=this.current){return state===0;}
    correct(state=this.current){return coefficients(state).filter((z,i)=>z.every((v,j)=>Math.abs(v-reference[i][j])<1e-8)).length;}
    coefficients(state=this.current){return coefficients(state);}
  }
  return{Model,coefficients,interpolate,reference:reference.map(z=>[...z]),states:()=>states.map(s=>[...s]),orders:Object.fromEntries(keys.map(key=>[key,4])),keys};
});
