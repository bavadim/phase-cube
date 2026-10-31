/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* C8 phases × bounded three-position radii, independently for each coefficient. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'),require('../actions.js'));else root.FourierModel=factory(root.PuzzleShuffle,root.PuzzleActions);})(globalThis,function(Shuffle,Actions){
  'use strict';
  const keys=['A','B','C','D'],levels=[.2,.4,.6],homePhase=[0,3,6,1],homeLevel=[2,1,1,0],stateCount=24**4;
  const mod=(n,d)=>((n%d)+d)%d,validState=s=>Number.isInteger(s)&&s>=0&&s<stateCount;
  const point=p=>p&&Number.isInteger(p.phase)&&p.phase>=0&&p.phase<8&&Number.isInteger(p.level)&&p.level>=0&&p.level<3;
  function parameters(state){
    if(!validState(state))throw new Error('Неверное состояние Фурье');
    return keys.map((_,i)=>{const digit=Math.floor(state/24**i)%24;return{phase:mod(homePhase[i]+digit%8,8),level:mod(homeLevel[i]+Math.floor(digit/8),3)};});
  }
  const encode=values=>values.reduce((s,p,i)=>s+(mod(p.phase-homePhase[i],8)+8*mod(p.level-homeLevel[i],3))*24**i,0);
  const coefficient=p=>[levels[p.level]*Math.cos(p.phase*Math.PI/4),levels[p.level]*Math.sin(p.phase*Math.PI/4)];
  const coefficients=state=>parameters(state).map(coefficient),reference=coefficients(0);
  const edit=move=>move&&typeof move==='object'&&move.kind==='coefficient'&&keys.includes(move.key)&&point(move.from)&&point(move.to);
  const match=(a,b)=>a.phase===b.phase&&a.level===b.level;
  function target(move){if(typeof move==='string'&&/^[ABCD]('|\+|-)?$/.test(move))return move[0];if(edit(move))return move.key;throw new Error('Неверное действие Фурье');}
  function applyTo(state,move){
    const values=parameters(state),i=keys.indexOf(target(move)),p=values[i];
    if(edit(move)){
      if(!match(p,move.from)||match(move.from,move.to))throw new Error('Устаревшее или пустое перетаскивание');
      values[i]={...move.to};
    }else if(move.endsWith('+')||move.endsWith('-')){
      const level=p.level+(move.endsWith('+')?1:-1);if(level<0||level>=levels.length)throw new Error('Модуль вне диапазона');
      values[i]={...p,level};
    }else values[i]={...p,phase:mod(p.phase+(move.endsWith("'")?1:-1),8)};
    return encode(values);
  }
  function inverse(move){
    target(move);
    if(edit(move))return{kind:'coefficient',key:move.key,from:{...move.to},to:{...move.from}};
    if(move.endsWith('+'))return move[0]+'-';if(move.endsWith('-'))return move[0]+'+';
    return move.endsWith("'")?move[0]:move+"'";
  }
  function interpolate(state,move,t){
    const a=parameters(state),b=parameters(applyTo(state,move)),i=keys.indexOf(target(move));
    const delta=edit(move)?mod(b[i].phase-a[i].phase+4,8)-4:typeof move==='string'&&move.endsWith("'")?1:typeof move==='string'&&move.length===1?-1:0;
    return a.map((p,j)=>{
      if(j!==i)return coefficient(p);
      const phase=(p.phase+delta*t)*Math.PI/4,radius=levels[p.level]+(levels[b[i].level]-levels[p.level])*t;
      return[radius*Math.cos(phase),radius*Math.sin(phase)];
    });
  }
  class Model{
    constructor(){this.count=4;this.reset();}
    snapshot(){return this.current;}
    initialState(){return 0;}
    parameters(state=this.current){return parameters(state);}
    coefficients(state=this.current){return coefficients(state);}
    legalMoves(state=this.current){const p=parameters(state);return keys.flatMap((key,i)=>[key,key+"'",...(p[i].level>0?[key+'-']:[]),...(p[i].level<2?[key+'+']:[])]);}
    applyTo(state,move){return applyTo(state,move);}
    inverse(move){return inverse(move);}
    validMove(move,state=this.current){try{return applyTo(state,move)!==state;}catch{return false;}}
    moveTarget(move){return target(move);}
    select(key){if(!keys.includes(key))throw new Error('Неверная гармоника');this.selected=key;}
    moveFor(key,inverted=false){return key+(inverted?"'":'');}
    choices(){return keys.map((key,i)=>({key,label:'Гармоника '+(i+1)}));}
    selectionLabel(){const i=keys.indexOf(this.selected),p=parameters(this.current)[i];return 'Гармоника '+(i+1)+' · '+p.phase*45+'° · '+levels[p.level].toFixed(1).replace('.',',');}
    actions(callbacks){
      const key=this.selected,n=keys.indexOf(key)+1;
      return [
        {id:'turn-left',label:'Гармоника '+n+': угол против часовой стрелки',icon:{text:'↶'},group:'Угол',move:key+"'"},
        {id:'turn-right',label:'Гармоника '+n+': угол по часовой стрелке',icon:{text:'↷'},group:'Угол',move:key},
        {id:'magnitude-down',label:'Гармоника '+n+': уменьшить модуль',icon:{text:'−'},group:'Модуль',move:key+'-'},
        {id:'magnitude-up',label:'Гармоника '+n+': увеличить модуль',icon:{text:'+'},group:'Модуль',move:key+'+'}
      ].map(action=>Actions.move(this,callbacks,action));
    }
    editMove(key,to,state=this.current){
      if(!keys.includes(key)||!point(to))throw new Error('Неверные координаты коэффициента');
      const from=parameters(state)[keys.indexOf(key)];return match(from,to)?null:{kind:'coefficient',key,from,to:{...to}};
    }
    snap(z){return{phase:mod(Math.round(Math.atan2(z[1],z[0])/(Math.PI/4)),8),level:Math.max(0,Math.min(2,Math.round((Math.hypot(...z)-levels[0])/.2)))};}
    restore(state){if(!validState(state))throw new Error('Неверное состояние Фурье');this.current=state;}
    reset(seed=1730){this.current=0;this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);this.shuffleStep=0;}
    shuffle(){
      const radius=this.shuffleStep++%2===1;
      const move=this.shuffler.next(this,{moves:this.legalMoves().filter(m=>/[+-]$/.test(m)===radius)});
      this.apply(move);this.history=[];this.moves=[];return move;
    }
    apply(move){
      const next=applyTo(this.current,move),saved=edit(move)?{kind:'coefficient',key:move.key,from:{...move.from},to:{...move.to}}:move;
      this.history.push({state:this.current,move:saved});this.current=next;this.moves.push(saved);this.selected=target(saved);
    }
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=target(old.move);return inverse(old.move);}
    hint(){
      const p=parameters(this.current);
      for(let i=0;i<4;i++){
        const delta=mod(homePhase[i]-p[i].phase,8);
        if(delta)return keys[i]+(delta<=4?"'":'');
        if(p[i].level!==homeLevel[i])return keys[i]+(p[i].level<homeLevel[i]?'+':'-');
      }
      return null;
    }
    distance(state=this.current){return parameters(state).reduce((sum,p,i)=>{const phase=mod(p.phase-homePhase[i],8);return sum+Math.min(phase,8-phase)+Math.abs(p.level-homeLevel[i]);},0);}
    solved(state=this.current){return state===0;}
    correct(state=this.current){return parameters(state).filter((p,i)=>p.phase===homePhase[i]&&p.level===homeLevel[i]).length;}
    probeStates(){
      const result=[0];for(let i=0;i<4;i++)for(let phase=0;phase<8;phase++)for(let level=0;level<3;level++){
        const p=parameters(0);p[i]={phase,level};result.push(encode(p));
      }
      return [...new Set(result)];
    }
  }
  return{Model,coefficients,parameters,interpolate,reference:reference.map(c=>[...c]),keys,levels,stateCount,orders:Object.fromEntries(keys.map(k=>[k,8]))};
});
