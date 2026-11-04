/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Gear rules: seats fit the authored rhythm; five exact size/gain levels. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fourier/module.js'),require('../fourier/model.js'),require('../fourier/binding.js'),require('./terrain.js'),require('../../controls/pattern-pieces.js'));else root.BouncePuzzle=factory(root.FourierPuzzle,root.FourierModel,root.FourierBinding,root.BounceTerrain,root.PuzzleParts);})(globalThis,function(Base,F,Binding,B,Parts){
  'use strict';
  const mod=n=>((n%8)+8)%8,levelStep=B.gainStep*4;
  class Model extends F.Model{
    constructor(steps=F.keys.map(()=>1)){super();if(steps.length!==6||steps.some(s=>![1,2,4,8].includes(s)))throw new Error('Неверные посадочные места');this.seatSteps=Object.freeze([...steps]);}
    selectionLabel(preview){const p=this.parameters()[F.keys.indexOf(this.selected)];return 'Партия '+(F.keys.indexOf(this.selected)+1)+' · '+Math.round((preview?.gain??F.gain(p))*100)+'%';}
    snapPoint(key,{phase,gain}){
      const i=F.keys.indexOf(key);if(i<0||!Number.isFinite(phase)||!Number.isFinite(gain))throw new Error('Неверные координаты шестерёнки');
      const step=this.seatSteps[i],home=F.homePhase[i],delta=B.delta(home/8,phase/8)*8;
      // Prefer the target at a tie, including the 0°/360° seam.
      const offset=Math.abs(delta)<=step/2+1e-9?0:Math.round(delta/step)*step;
      return{phase:mod(home+offset),gain:B.snapGain(gain)};
    }
    editPoint(key,point,state=this.current){const p=this.snapPoint(key,point);return this.editMove(key,{phase:p.phase,level:p.gain*4},state);}
    editMove(key,to,state=this.current){
      const i=F.keys.indexOf(key),step=this.seatSteps[i];
      if(i<0||mod(to.phase-F.homePhase[i])%step||!B.gains.includes(to.level/4))throw new Error('Между посадочными местами');
      return super.editMove(key,to,state);
    }
    applyTo(state,move){
      if(typeof move!=='string'){this.editMove(move?.key,move?.to,state);return super.applyTo(state,move);}
      const key=this.moveTarget(move),i=F.keys.indexOf(key),p=this.parameters(state)[i];
      const to=/[+-]$/.test(move)?{...p,level:p.level+(move.endsWith('+')?levelStep:-levelStep)}:{...p,phase:mod(p.phase+(move.endsWith("'")?1:-1)*this.seatSteps[i])};
      const edit=this.editMove(key,to,state);if(!edit)throw new Error('Пустой поворот');return super.applyTo(state,edit);
    }
    levelMove(key,direction,state=this.current){const move=key+(direction>0?'+':'-');return this.validMove(move,state)?move:null;}
    legalMoves(state=this.current){return F.keys.flatMap(key=>[key,key+"'",key+'-',key+'+'].filter(move=>this.validMove(move,state)));}
    restore(state){this.parameters(state).forEach((p,i)=>this.editMove(F.keys[i],p,0));super.restore(state);}
    distance(state=this.current){return this.parameters(state).reduce((sum,p,i)=>{const d=mod(p.phase-F.homePhase[i]);return sum+Math.min(d,8-d)/this.seatSteps[i]+Math.abs(p.level-4)/levelStep;},0);}
    shuffle(){
      const radius=this.shuffleStep++%2===1,legal=this.legalMoves(),moves=legal.filter(m=>/[+-]$/.test(m)===radius);
      const move=this.shuffler.next(this,{moves:moves.length?moves:legal});this.apply(move);this.history=[];this.moves=[];return move;
    }
    probeStates(){
      const result=[this.initialState()];
      for(let i=0;i<F.keys.length;i++){
        for(let offset=this.seatSteps[i];offset<8;offset+=this.seatSteps[i])result.push(this.applyTo(0,this.editMove(F.keys[i],{phase:mod(F.homePhase[i]+offset),level:4},0)));
        for(const gain of B.gains)if(gain!==1)result.push(this.applyTo(0,this.editMove(F.keys[i],{phase:F.homePhase[i],level:gain*4},0)));
      }
      return result;
    }
  }
  const manifest=steps=>({...Base.manifest,id:'bounce',version:5,stateSpace:'rhythm seats × {0,0.5,1,1.5,2}^6',gridPresetStates:steps.reduce((n,s)=>n*(8/s)*B.gains.length,1),
    parameters:{phases:steps.map(s=>8/s),seatSteps:[...steps],magnitudes:{min:0,max:2,step:B.gainStep,values:B.gains,continuous:false}},
    operations:{phase:{orders:steps.map(s=>8/s)},magnitude:{kind:'bounded-step',step:B.gainStep,min:0,max:2},drag:{kind:'coefficient-edit'}},
    interaction:{requiresSelection:true,allowDeselect:true,hoverActions:false,buttonPreview:false,selectionPrompt:'Выберите шестерёнку'}});
  return{id:'bounce',title:'Шестерёнки ритма',progressLabel:'партий\nв ритме',shuffleSteps:6,create:()=>new Model(),manifest:Object.freeze(manifest(F.keys.map(()=>1))),
    configure(S,song,options){
      const game=Parts.build(S,song,{...options,count:F.keys.length}),steps=game.targetRows.map(row=>B.seatStep(B.attacks(row,Binding.period(row))));
      return{module:{...this,create:()=>new Model(steps),manifest:Object.freeze(manifest(steps))},game};
    }};
});
