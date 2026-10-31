/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FourierModel=factory();})(globalThis,function(){
  'use strict';
  const reference=[[.61,.17],[.29,.43]],q=Math.SQRT1_2;
  const identity=[[1,0],[0,0],[0,0],[1,0]];
  const generators={A:[[0,1],[0,0],[0,0],[1,0]],B:[[1,0],[0,0],[0,0],[0,1]],M:[[q,0],[-q,0],[q,0],[q,0]]};
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
  const product=(a,b)=>Array.from({length:4},(_,j)=>add(mul(a[Math.floor(j/2)*2],b[j%2]),mul(a[Math.floor(j/2)*2+1],b[j%2+2])));
  const key=m=>m.flat().map(x=>Math.round(x*1e9)).join(',');
  const inverse=move=>move.endsWith("'")?move[0]:move+"'",moves=['A',"A'",'B',"B'",'M',"M'"];
  const adjoint=m=>[m[0],m[2],m[1],m[3]].map(([r,i])=>[r,-i]);
  const matrices=[identity],index=new Map([[key(identity),0]]),depth=[0],hints=[null];
  // Enumerate this specific finite matrix group once. Playable states are integer
  // IDs, so inverse/period checks never depend on accumulated floating point error.
  for(let i=0;i<matrices.length;i++)for(const move of moves){
    const g=generators[move[0]],matrix=product(move.endsWith("'")?adjoint(g):g,matrices[i]),k=key(matrix);
    if(!index.has(k)){
      if(matrices.length>=512)throw new Error('Фурье: группа вышла за заявленный конечный домен');
      index.set(k,matrices.length);matrices.push(matrix);depth.push(depth[i]+1);hints.push(inverse(move));
    }
  }
  if(matrices.length!==192)throw new Error('Изменилась группа Фурье-печати');
  const transitions=matrices.map(matrix=>Object.fromEntries(moves.map(move=>{
    const g=generators[move[0]],next=index.get(key(product(move.endsWith("'")?adjoint(g):g,matrix)));
    if(next===undefined)throw new Error('Группа Фурье не замкнута');return[move,next];
  })));
  const valid=state=>Number.isInteger(state)&&state>=0&&state<matrices.length;
  const coefficients=state=>{if(!valid(state))throw new Error('Неверное состояние Фурье');const m=matrices[state];return[add(mul(m[0],reference[0]),mul(m[1],reference[1])),add(mul(m[2],reference[0]),mul(m[3],reference[1]))];};
  function interpolate(state,move,t){
    const c=coefficients(state),sign=move.endsWith("'")?-1:1;
    if(move[0]==='M'){const a=sign*t*Math.PI/4,s=Math.sin(a),r=Math.cos(a);return[c[0].map((v,j)=>r*v-s*c[1][j]),c[0].map((v,j)=>s*v+r*c[1][j])];}
    const a=sign*t*Math.PI/2,k=move[0]==='A'?0:1;c[k]=mul(c[k],[Math.cos(a),Math.sin(a)]);return c;
  }
  class Model{
    constructor(){this.current=0;this.count=2;this.selected='A';this.history=[];this.moves=[];}
    snapshot(){return this.current;}
    initialState(){return 0;}
    allStates(){return matrices.map((_,i)=>i);}
    legalMoves(){return [...moves];}
    applyTo(state,move){if(!valid(state)||!moves.includes(move))throw new Error('Неверный ход Фурье');return transitions[state][move];}
    inverse(move){if(!moves.includes(move))throw new Error('Неверный ход Фурье');return inverse(move);}
    validMove(move){return moves.includes(move);}
    restore(state){if(!valid(state))throw new Error('Неверное состояние Фурье');this.current=state;}
    moveTarget(move){return move[0];}
    select(key){if(!generators[key])throw new Error('Неверный регулятор Фурье');this.selected=key;}
    moveFor(key,inverted=false){return key+(inverted?"'":'');}
    choices(){return[{key:'A',label:'Первая волна'},{key:'B',label:'Вторая волна'},{key:'M',label:'Перелив волн'}];}
    actionLabel(key,inverted){return key==='M'?'Перелить волны на '+(inverted?'−45°':'+45°'):'Повернуть '+(key==='A'?'первую':'вторую')+' волну на '+(inverted?'−90°':'+90°');}
    reset(seed=1730,level=3){const pool=depth.map((d,i)=>({d,i})).filter(e=>e.d===Math.min(Math.max(1,level),Math.max(...depth)));this.current=pool[(seed>>>0)%pool.length].i;this.history=[];this.moves=[];this.selected='A';}
    apply(move){const next=this.applyTo(this.current,move);this.history.push({state:this.current,move});this.current=next;this.moves.push(move);this.selected=this.moveTarget(move);}
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=this.moveTarget(old.move);return this.inverse(old.move);}
    hint(){return hints[this.current];}
    distance(){return depth[this.current];}
    solved(state=this.current){return state===0;}
    correct(state=this.current){return coefficients(state).filter((z,i)=>z.every((v,j)=>Math.abs(v-reference[i][j])<1e-8)).length;}
    coefficients(state=this.current){return coefficients(state);}
  }
  return{Model,coefficients,interpolate,reference:reference.map(z=>[...z]),matrices:()=>matrices.map(m=>m.map(z=>[...z])),orders:{A:4,B:4,M:8}};
});
