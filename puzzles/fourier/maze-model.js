/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* C8 rotations and five lift positions, using the existing complex-riff action. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('./maze.js'),require('../actions.js'));else root.FourierMazeModel=factory(root.FourierModel,root.FourierMaze,root.PuzzleActions);})(globalThis,function(F,Maze,Actions){
  'use strict';
  const levelStep=Maze.gainStep*4;
  class Model extends F.Model{
    constructor(){super();this.gains=Maze.gains;}
    parameters(state=this.current){const p=super.parameters(state);if(p.some(v=>!Maze.gains.includes(F.gain(v))))throw new Error('Высота между уровнями');return p;}
    maze(state=this.current){return Maze.analyze(this.parameters(state).map((p,i)=>({phase:p.phase-F.homePhase[i],gain:F.gain(p)})));}
    solved(state=this.current){return this.maze(state).passable;}
    correct(state=this.current){return this.maze(state).correct;}
    choices(){return F.keys.map((key,i)=>({key,label:'Платформа '+(i+1)}));}
    selectionLabel(preview){const i=F.keys.indexOf(this.selected),p=this.parameters()[i];return 'Платформа '+(i+1)+' · '+Math.round((preview?.gain??F.gain(p))*100)+'%';}
    editPoint(key,{phase,gain},state=this.current){return super.editPoint(key,{phase,gain:Maze.snapGain(gain)},state);}
    editMove(key,to,state=this.current){if(!Maze.gains.includes(to?.level/4))throw new Error('Высота между уровнями');return super.editMove(key,to,state);}
    applyTo(state,move){
      this.parameters(state);
      if(typeof move!=='string'){this.editMove(move?.key,move?.to,state);return super.applyTo(state,move);}
      if(!/[+-]$/.test(move))return super.applyTo(state,move);
      const key=this.moveTarget(move),p=this.parameters(state)[F.keys.indexOf(key)],edit=this.editMove(key,{...p,level:p.level+(move.endsWith('+')?levelStep:-levelStep)},state);
      return super.applyTo(state,edit);
    }
    levelMove(key,direction,state=this.current){const move=key+(direction>0?'+':'-');return this.validMove(move,state)?move:null;}
    restore(state){this.parameters(state).forEach((p,i)=>this.editMove(F.keys[i],p,0));super.restore(state);}
    distance(state=this.current){return this.parameters(state).reduce((sum,p,i)=>{const d=((p.phase-F.homePhase[i])%8+8)%8;return sum+Math.min(d,8-d)+Math.abs(p.level-4)/levelStep;},0);}
    actions(callbacks){
      const key=this.selected,n=F.keys.indexOf(key)+1;
      return[
        {id:'turn-left',label:'Платформа '+n+': повернуть влево',icon:{text:'↶'},group:'Поворот',move:key+"'"},
        {id:'turn-right',label:'Платформа '+n+': повернуть вправо',icon:{text:'↷'},group:'Поворот',move:key},
        {id:'magnitude-down',label:'Платформа '+n+': опустить',icon:{text:'−'},group:'Высота',move:this.levelMove(key,-1)},
        {id:'magnitude-up',label:'Платформа '+n+': поднять',icon:{text:'+'},group:'Высота',move:this.levelMove(key,1)}
      ].map(a=>Actions.move(this,callbacks,a));
    }
    probeStates(){
      const states=[0];for(const key of F.keys)for(let phase=0;phase<8;phase++)for(const gain of Maze.gains){const move=this.editMove(key,{phase,level:gain*4},0);if(move)states.push(this.applyTo(0,move));}return states;
    }
  }
  return{Model,gains:Maze.gains,gainStep:Maze.gainStep,stateCount:(8*Maze.gains.length)**F.keys.length};
});
