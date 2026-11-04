/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Six independent riffs: C8 phase and continuous gain from zero to double. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../shuffle.js'),require('../actions.js'));else root.FourierModel=factory(root.PuzzleShuffle,root.PuzzleActions);})(globalThis,function(Shuffle,Actions){
  'use strict';
  const keys=['A','B','C','D','E','F'],levels=Array.from({length:9},(_,i)=>i/4),homePhase=[0,1,3,4,5,7],homeLevel=keys.map(()=>4),radix=8*levels.length,stateCount=radix**keys.length;
  const mod=(n,d)=>((n%d)+d)%d,round=n=>Math.round(n*1e9)/1e9;
  const validGrid=s=>Number.isInteger(s)&&s>=0&&s<stateCount;
  const validState=s=>validGrid(s)||s?.kind==='continuous-levels/1'&&Array.isArray(s.values)&&s.values.length===keys.length&&s.values.every(p=>point(p)&&p.phase>=0&&p.phase<8);
  const point=p=>p&&Number.isSafeInteger(p.phase)&&Number.isFinite(p.level)&&p.level>=0&&p.level<=8;
  function parameters(state){
    if(!validState(state))throw new Error('Неверное состояние Фурье');
    if(!validGrid(state))return state.values.map(p=>({...p}));
    return keys.map((_,i)=>{const digit=Math.floor(state/radix**i)%radix;return{phase:mod(homePhase[i]+digit%8,8),level:mod(homeLevel[i]+Math.floor(digit/8),levels.length)};});
  }
  // Keep compact numeric presets; only fractional gains need a structured state.
  // Canonical decimal precision makes edit/inverse/replay independent of FP drift.
  const encode=input=>{
    const values=input.map(p=>({phase:mod(p.phase,8),level:round(p.level)}));
    return values.every(p=>Number.isInteger(p.level))
      ?values.reduce((s,p,i)=>s+(mod(p.phase-homePhase[i],8)+8*mod(p.level-homeLevel[i],levels.length))*radix**i,0)
      :Object.freeze({kind:'continuous-levels/1',values:Object.freeze(values.map(p=>Object.freeze(p)))});
  };
  const gain=p=>p.level/4;
  const coefficient=p=>[gain(p)*Math.cos(p.phase*Math.PI/4),gain(p)*Math.sin(p.phase*Math.PI/4)];
  const coefficients=state=>parameters(state).map(coefficient),reference=coefficients(0);
  const edit=move=>move&&typeof move==='object'&&move.kind==='coefficient'&&keys.includes(move.key)&&point(move.from)&&point(move.to);
  const match=(a,b)=>mod(a.phase,8)===mod(b.phase,8)&&round(a.level)===round(b.level);
  function target(move){if(typeof move==='string'&&/^[ABCDEF]('|\+|-)?$/.test(move))return move[0];if(edit(move))return move.key;throw new Error('Неверное действие Фурье');}
  function applyTo(state,move){
    const values=parameters(state),i=keys.indexOf(target(move)),p=values[i];
    if(edit(move)){
      if(!match(p,move.from)||match(move.from,move.to))throw new Error('Устаревшее или пустое перетаскивание');
      values[i]={phase:mod(move.to.phase,8),level:move.to.level};
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
      const phase=(p.phase+delta*t)*Math.PI/4,radius=gain(p)+(gain(b[i])-gain(p))*t;
      return[radius*Math.cos(phase),radius*Math.sin(phase)];
    });
  }
  class Model{
    constructor(){this.count=keys.length;this.reset();}
    snapshot(){return this.current;}
    initialState(){return 0;}
    parameters(state=this.current){return parameters(state);}
    coefficients(state=this.current){return coefficients(state);}
    legalMoves(state=this.current){return keys.flatMap(key=>[key,key+"'",...[-1,1].map(d=>this.levelMove(key,d,state)).filter(Boolean)]);}
    applyTo(state,move){return applyTo(state,move);}
    inverse(move){return inverse(move);}
    validMove(move,state=this.current){try{return this.applyTo(state,move)!==state;}catch{return false;}}
    moveTarget(move){return target(move);}
    select(key){if(!keys.includes(key))throw new Error('Неверный риф');this.selected=key;}
    moveFor(key,inverted=false){return key+(inverted?"'":'');}
    choices(){return keys.map((key,i)=>({key,label:'Риф '+(i+1)}));}
    selectionLabel(preview){const i=keys.indexOf(this.selected),p=parameters(this.current)[i],phase=preview?.phase??p.phase,gain=preview?.gain??p.level/4;return 'Риф '+(i+1)+' · '+Math.round(mod(phase-homePhase[i],8)*45)+'° · '+Math.round(gain*100)+'%';}
    levelMove(key,direction,state=this.current){
      const p=parameters(state)[keys.indexOf(key)];
      if(Number.isInteger(p.level))return this.validMove(key+(direction>0?'+':'-'),state)?key+(direction>0?'+':'-'):null;
      let level=Math.max(0,Math.min(8,p.level+direction));
      if((p.level-4)*(level-4)<=0)level=4;
      return this.editMove(key,{...p,level},state);
    }
    actions(callbacks){
      const key=this.selected,n=keys.indexOf(key)+1;
      return [
        {id:'turn-left',label:'Риф '+n+': угол против часовой стрелки',icon:{text:'↶'},group:'Фаза',move:key+"'"},
        {id:'turn-right',label:'Риф '+n+': угол по часовой стрелке',icon:{text:'↷'},group:'Фаза',move:key},
        {id:'magnitude-down',label:'Риф '+n+': тише',icon:{text:'−'},group:'Громкость',move:this.levelMove(key,-1)},
        {id:'magnitude-up',label:'Риф '+n+': громче',icon:{text:'+'},group:'Громкость',move:this.levelMove(key,1)}
      ].map(action=>Actions.move(this,callbacks,action));
    }
    editMove(key,to,state=this.current){
      if(!keys.includes(key)||!point(to))throw new Error('Неверные координаты коэффициента');
      const from=parameters(state)[keys.indexOf(key)];return match(from,to)?null:{kind:'coefficient',key,from,to:{phase:mod(to.phase,8),level:round(to.level)}};
    }
    editPoint(key,{phase,gain},state=this.current){
      if(!Number.isFinite(phase)||!Number.isFinite(gain)||gain<0||gain>2)throw new Error('Неверные координаты редактирования');
      // Continuous previews end at an exact C8 seat, including wrapped/negative angles.
      return this.editMove(key,{phase:mod(Math.round(phase),8),level:gain*4},state);
    }
    restore(state){if(!validState(state))throw new Error('Неверное состояние Фурье');this.current=encode(parameters(state));}
    reset(seed=1730){this.current=0;this.history=[];this.moves=[];this.selected='A';this.shuffler=new Shuffle.Generator(seed);this.shuffleStep=0;}
    shuffle(){
      const radius=this.shuffleStep++%2===1;
      const move=this.shuffler.next(this,{moves:this.legalMoves().filter(m=>/[+-]$/.test(m)===radius)});
      this.apply(move);this.history=[];this.moves=[];return move;
    }
    apply(move){
      const next=this.applyTo(this.current,move),saved=edit(move)?{kind:'coefficient',key:move.key,from:{...move.from},to:{...move.to}}:move;
      this.history.push({state:this.current,move:saved});this.current=next;this.moves.push(saved);this.selected=target(saved);
    }
    undo(){const old=this.history.pop();if(!old)return null;this.current=old.state;this.moves.pop();this.selected=target(old.move);return inverse(old.move);}
    hint(){
      const p=parameters(this.current);
      for(let i=0;i<keys.length;i++){
        const delta=mod(homePhase[i]-p[i].phase,8);
        if(delta)return keys[i]+(delta<=4?"'":'');
        if(p[i].level!==homeLevel[i])return this.levelMove(keys[i],p[i].level<homeLevel[i]?1:-1);
      }
      return null;
    }
    distance(state=this.current){return parameters(state).reduce((sum,p,i)=>{const phase=mod(p.phase-homePhase[i],8);return sum+Math.min(phase,8-phase)+Math.abs(p.level-homeLevel[i]);},0);}
    solved(state=this.current){return this.correct(state)===this.count;}
    correct(state=this.current){return parameters(state).filter((p,i)=>p.phase===homePhase[i]&&p.level===homeLevel[i]).length;}
    probeStates(){
      const result=[0];for(let i=0;i<keys.length;i++)for(let phase=0;phase<8;phase++)for(let level=0;level<levels.length;level++){
        const p=parameters(0);p[i]={phase,level};result.push(encode(p));
      }
      for(let i=0;i<keys.length;i++)for(const level of [.492,2.924,5.348,7.996]){const p=parameters(0);p[i].level=level;result.push(encode(p));}
      return [...new Set(result)];
    }
  }
  return{Model,gain,coefficients,parameters,interpolate,homePhase:[...homePhase],reference:reference.map(c=>[...c]),keys,levels,stateCount,orders:Object.fromEntries(keys.map(k=>[k,8]))};
});
