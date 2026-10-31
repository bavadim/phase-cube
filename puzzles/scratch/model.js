/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* C4^3 semidirect S3: quarter phases and permutations of three Fourier modes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'),require('../actions.js'));else root.ScratchModel=factory(root.PuzzleShuffle,root.PuzzleActions);})(globalThis,function(Shuffle,Actions){
  'use strict';
  const keys=['A','B','C'],amplitudes=[.48,.30,.18],permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]],stateCount=384;
  const moves=keys.flatMap(key=>[key,key+"'",key+'x']),mod=(x,n)=>((x%n)+n)%n;
  const validState=state=>Number.isInteger(state)&&state>=0&&state<stateCount;
  function parameters(state){
    if(!validState(state))throw new Error('Неверное состояние спектрального обруча');
    const p=permutations[Math.floor(state/64)];return keys.map((key,i)=>({key,source:p[i],phase:Math.floor(state/4**i)%4}));
  }
  function encode(values){
    const p=permutations.findIndex(p=>p.every((v,i)=>v===values[i].source));
    if(p<0)throw new Error('Волны должны оставаться перестановкой');
    return p*64+values.reduce((sum,v,i)=>sum+mod(v.phase,4)*4**i,0);
  }
  const coefficients=state=>parameters(state).map(p=>[amplitudes[p.source]*Math.cos(p.phase*Math.PI/2),amplitudes[p.source]*Math.sin(p.phase*Math.PI/2)]);
  const edit=move=>move&&typeof move==='object'&&move.kind==='scratch-phase'&&keys.includes(move.key)&&validState(move.from)&&Number.isInteger(move.turns)&&move.turns!==0&&Math.abs(move.turns)<=2;
  function moveTarget(move){if(typeof move==='string'&&moves.includes(move))return move[0];if(edit(move))return move.key;throw new Error('Неверное действие спектрального обруча');}
  function applyTo(state,move){
    const i=keys.indexOf(moveTarget(move)),values=parameters(state);
    if(edit(move)){if(state!==move.from)throw new Error('Устаревшее перетаскивание');values[i].phase+=move.turns;}
    else if(move.endsWith('x')){const j=(i+1)%3;[values[i],values[j]]=[values[j],values[i]];}
    else values[i].phase+=move.endsWith("'")?-1:1;
    return encode(values);
  }
  function inverse(move){
    moveTarget(move);
    if(edit(move))return{...move,from:applyTo(move.from,move),turns:-move.turns};
    if(move.endsWith('x'))return move;return move.endsWith("'")?move[0]:move+"'";
  }
  function interpolate(state,move,t){
    const a=coefficients(state),i=keys.indexOf(moveTarget(move));applyTo(state,move);
    if(typeof move==='string'&&move.endsWith('x')){
      const j=(i+1)%3,p=a[i].map((v,k)=>(v+a[j][k])/2),d=a[i].map((v,k)=>(v-a[j][k])/2),angle=Math.PI*t;
      const v=[d[0]*Math.cos(angle)-d[1]*Math.sin(angle),d[0]*Math.sin(angle)+d[1]*Math.cos(angle)];
      a[i]=p.map((x,k)=>x+v[k]);a[j]=p.map((x,k)=>x-v[k]);
    }else{
      const angle=(edit(move)?move.turns:move.endsWith("'")?-1:1)*Math.PI*t/2,z=a[i];
      a[i]=[z[0]*Math.cos(angle)-z[1]*Math.sin(angle),z[0]*Math.sin(angle)+z[1]*Math.cos(angle)];
    }
    return a;
  }
  function field(c,t){
    let re=0,im=0,derivative=1;
    c.forEach((z,i)=>{const k=i+1,angle=2*Math.PI*k*t,x=z[0]-amplitudes[i],y=z[1];
      re+=x*Math.cos(angle)-y*Math.sin(angle);im+=x*Math.sin(angle)+y*Math.cos(angle);
      derivative+=.2*k*(x*Math.cos(angle)-y*Math.sin(angle));});
    return{time:t+.2*im/(2*Math.PI),gain:1+.4*re,derivative};
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
    moveFor(key,inverted=false){if(!keys.includes(key))throw new Error('Неизвестная волна');return key+(inverted?"'":'');}
    select(key){if(!keys.includes(key))throw new Error('Неизвестная волна');this.selected=key;}
    choices(){return keys.map((key,i)=>({key,label:'Волна '+(i+1)}));}
    selectionLabel(point){const i=keys.indexOf(this.selected),p=parameters(this.current)[i],phase=point?.phase??p.phase;
      return 'Волна '+(i+1)+' · '+Math.round(mod(phase,4)*90)+'° · '+amplitudes[p.source].toFixed(2).replace('.',',');}
    actions(callbacks){const key=this.selected,i=keys.indexOf(key),n=i+1,j=(i+1)%3+1;
      return[
        {id:'turn-left',label:'Волна '+n+': фаза −90°',icon:{text:'−'},group:'Фаза волны',move:key+"'"},
        {id:'turn-right',label:'Волна '+n+': фаза +90°',icon:{text:'+'},group:'Фаза волны',move:key},
        {id:'swap-wave',label:'Обменять волны '+n+' и '+j,icon:{text:'⇄'},group:'Обмен волн',move:key+'x'}
      ].map(action=>Actions.move(this,callbacks,action));
    }
    editMove(key,phase,state=this.current){
      if(!keys.includes(key)||!Number.isFinite(phase))throw new Error('Неверная фаза волны');
      const i=keys.indexOf(key),turns=mod(Math.round(phase)-parameters(state)[i].phase+2,4)-2;
      return turns?{kind:'scratch-phase',key,from:state,turns}:null;
    }
    reset(seed=1730){this.current=0;this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);}
    shuffle(){const move=this.shuffler.next(this);this.apply(move);this.history=[];this.moves=[];return move;}
    apply(move){const next=applyTo(this.current,move);this.history.push({state:this.current,move});this.current=next;this.moves.push(move);this.selected=moveTarget(move);}
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=moveTarget(old.move);return inverse(old.move);}
    hint(){return states().get(this.current).hint;}
    distance(state=this.current){return states().get(state).depth;}
    solved(state=this.current){return state===0;}
    correct(state=this.current){return parameters(state).filter((p,i)=>p.source===i&&p.phase===0).length;}
  }
  return{Model,keys,amplitudes,stateCount,parameters,coefficients,applyTo,inverse,interpolate,field,states,moves};
});
