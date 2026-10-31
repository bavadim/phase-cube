/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One movable picture piece per instrument. C4^N semidirect S_N. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'),require('../actions.js'));else root.ScratchModel=factory(root.PuzzleShuffle,root.PuzzleActions);})(globalThis,function(Shuffle,Actions){
  'use strict';
  const mod=(x,n)=>((x%n)+n)%n,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const keyFor=i=>i<26?String.fromCharCode(65+i):'P'+i;
  const amplitude=source=>[.48,.30,.18][source%3],timingDepth=.35,gainDepth=.6;
  const freeze=(order,turns)=>Object.freeze({order:Object.freeze(order),turns:Object.freeze(turns)});
  function field(piece,t){
    const a=amplitude(piece.source),k=piece.slot+1,home=piece.source+1;
    const angle=2*Math.PI*k*t+piece.phase*Math.PI/2,reference=2*Math.PI*home*t;
    // Integrating the oscillations divides by harmonic order. The time map
    // remains increasing for ANY number of pieces: h' >= 1 - 2*.35*.48.
    return{time:t+timingDepth*a/(2*Math.PI)*(Math.sin(angle)/k-Math.sin(reference)/home),
      gain:1+gainDepth*a*(Math.cos(angle)-Math.cos(reference)),
      derivative:1+timingDepth*a*(Math.cos(angle)-Math.cos(reference))};
  }
  class Model{
    constructor({count=3,names=[]}={}){if(!Number.isInteger(count)||count<1)throw Error('Неверное число партий');this.count=count;this.keys=Array.from({length:count},(_,i)=>keyFor(i));this.names=names;this.reset();}
    initialState(){return freeze(this.keys.map((_,i)=>i),this.keys.map(()=>0));}
    validate(state){if(!state||state.order?.length!==this.count||state.turns?.length!==this.count||new Set(state.order).size!==this.count||state.order.some(i=>!Number.isInteger(i)||i<0||i>=this.count)||state.turns.some(p=>!Number.isInteger(p)||p<0||p>3))throw Error('Неверное состояние пазла');}
    snapshot(){return this.current;}
    restore(state){this.validate(state);this.current=freeze([...state.order],[...state.turns]);this.path=null;this.pathKnown=this.solved(state);this.history=[];this.moves=[];}
    parameters(state=this.current){this.validate(state);return this.keys.map((key,slot)=>({key,slot,source:state.order[slot],phase:state.turns[slot]}));}
    coefficients(state=this.current){return this.parameters(state).map(p=>[amplitude(p.source)*Math.cos(p.phase*Math.PI/2),amplitude(p.source)*Math.sin(p.phase*Math.PI/2)]);}
    legalMoves(){return this.keys.flatMap(key=>[key,key+"'",...(this.count>1?[key+'x']:[])]);}
    moveTarget(move){const key=typeof move==='string'?move.replace(/['x]$/,''):move?.key;if(!this.keys.includes(key))throw Error('Неверное действие пазла');return key;}
    applyTo(state,move){
      this.validate(state);const key=this.moveTarget(move),i=this.keys.indexOf(key),order=[...state.order],turns=[...state.turns];
      let j=null,step=null;
      if(typeof move==='object'){
        if(!equal(state,move.from))throw Error('Устаревшее перетаскивание');
        if(move.kind==='piece-phase'&&Number.isInteger(move.turns)&&Math.abs(move.turns)<=2&&move.turns!==0)step=move.turns;
        else if(move.kind==='piece-swap'&&move.to!==key&&this.keys.includes(move.to))j=this.keys.indexOf(move.to);
        else throw Error('Неверное действие пазла');
      }else{
        if(!this.legalMoves().includes(move))throw Error('Неверное действие пазла');
        if(move.endsWith('x'))j=(i+1)%this.count;else step=move.endsWith("'")?-1:1;
      }
      if(j!==null){[order[i],order[j]]=[order[j],order[i]];[turns[i],turns[j]]=[turns[j],turns[i]];}
      else turns[i]=mod(turns[i]+step,4);
      return freeze(order,turns);
    }
    inverse(move){const key=this.moveTarget(move);if(typeof move==='object')return{...move,from:this.applyTo(move.from,move),...(move.kind==='piece-phase'?{turns:-move.turns}:{})};return move.endsWith('x')?move:move.endsWith("'")?key:move+"'";}
    validMove(move,state=this.current){try{return !equal(this.applyTo(state,move),state);}catch{return false;}}
    moveFor(key,inverted=false){if(!this.keys.includes(key))throw Error('Неизвестный паз');return key+(inverted?"'":'');}
    select(key){if(!this.keys.includes(key))throw Error('Неизвестный паз');this.selected=key;}
    choices(){return this.keys.map((key,i)=>({key,label:'Паз '+(i+1)}));}
    selectionLabel(){const source=this.current.order[this.keys.indexOf(this.selected)];return this.names[source]||'Партия '+(source+1);}
    actions(callbacks){
      const key=this.selected,i=this.keys.indexOf(key),hint=this.hint();
      const swap=typeof hint==='object'&&hint?.kind==='piece-swap'&&hint.key===key?hint:key+'x';
      const j=typeof swap==='object'?this.keys.indexOf(swap.to):(i+1)%this.count;
      return[
        {id:'turn-left',label:this.selectionLabel()+': повернуть против часовой стрелки',icon:{text:'↶'},move:key+"'"},
        {id:'turn-right',label:this.selectionLabel()+': повернуть по часовой стрелке',icon:{text:'↷'},move:key},
        ...(this.count>1?[{id:'swap-piece',label:'Поменять детали в пазах '+(i+1)+' и '+(j+1),icon:{text:'⇄'},move:swap}]:[])
      ].map(action=>Actions.move(this,callbacks,action));
    }
    editMove(key,phase,state=this.current){if(!this.keys.includes(key)||!Number.isFinite(phase))throw Error('Неверная фаза детали');const turns=mod(Math.round(phase)-state.turns[this.keys.indexOf(key)]+2,4)-2;return turns?{kind:'piece-phase',key,from:state,turns}:null;}
    swapMove(key,to,state=this.current){const move={kind:'piece-swap',key,to,from:state};return this.validMove(move,state)?move:null;}
    reset(seed=1730){this.current=this.initialState();this.path=null;this.pathKnown=true;this.history=[];this.moves=[];this.selected=this.keys[0];this.shuffler=new Shuffle.Generator(seed);}
    shuffle(){const move=this.shuffler.next(this);this.apply(move);this.history=[];this.moves=[];return move;}
    apply(move){
      const next=this.applyTo(this.current,move);this.history.push({state:this.current,move,path:this.path,pathKnown:this.pathKnown});
      const steps=move?.kind==='piece-phase'?Array.from({length:Math.abs(move.turns)},()=>move.key+(move.turns<0?"'":'')):[move];
      let state=this.current;
      for(const step of steps){const after=this.applyTo(state,step);if(this.pathKnown)this.path=this.solved(after)?null:this.path&&equal(after,this.path.before)?this.path.previous:{before:state,move:step,previous:this.path};state=after;}
      this.current=next;if(this.solved())this.pathKnown=true;this.moves.push(move);this.selected=this.moveTarget(move);
    }
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.path=old.path;this.pathKnown=old.pathKnown;this.moves.pop();this.selected=this.moveTarget(old.move);return this.inverse(old.move);}
    hint(){
      if(this.solved())return null;
      if(this.path)return this.inverse(this.path.move);
      // Constructive fallback for imported states, without enumerating 4^N N!.
      for(let i=0;i<this.count;i++)if(this.current.order[i]!==i){const j=this.current.order.indexOf(i);return this.keys[j-1]+'x';}
      const i=this.current.turns.findIndex(p=>p!==0);return this.keys[i]+(this.current.turns[i]===3?'':"'");
    }
    solved(state=this.current){return state.order.every((source,i)=>source===i&&state.turns[i]===0);}
    correct(state=this.current){return state.order.filter((source,i)=>source===i&&state.turns[i]===0).length;}
  }
  return{Model,amplitude,timingDepth,gainDepth,field};
});
