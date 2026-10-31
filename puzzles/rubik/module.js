/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../vendor/cube-1.3.2.js'));else root.RubikPuzzle=factory(root.PhaseCube,root.Cube);})(globalThis,function(M,Cube){
  const colors={U:'#e9dca6',R:'#dc8e70',F:'#739e87',D:'#c5ad63',L:'#a4b6c3',B:'#a196b6'};
  // A physical 2x2 is assembled in any of its 24 rigid orientations.
  const goals=[],seen=new Set(),queue=[new Cube()];
  for(let i=0;i<queue.length;i++){
    const state=M.snapshot(queue[i]),key=JSON.stringify(state);if(seen.has(key))continue;
    seen.add(key);goals.push(state);
    for(const turn of ['x','y','z']){const c=M.restore(new Cube(),state);c.move(turn);if(!seen.has(JSON.stringify(M.snapshot(c))))queue.push(c);}
  }
  const correct=state=>Math.max(...goals.map(goal=>state.cp.reduce((n,id,slot)=>n+(id===goal.cp[slot]&&state.co[slot]===goal.co[slot]),0)));
  class Model{
    constructor(){this.cube=new Cube();this.count=8;this.selected='F';this.history=[];this.path=[];this.moves=[];}
    snapshot(){return M.snapshot(this.cube);}
    initialState(){return M.snapshot(new Cube());}
    goalStates(){return goals.map(s=>({cp:[...s.cp],co:[...s.co]}));}
    legalMoves(){return M.FACES.flatMap(face=>[face,face+"'"]);}
    placements(state=this.snapshot()){return M.placements(state);}
    restore(state){M.restore(this.cube,state);}
    applyTo(state,move){return M.snapshot(M.restore(new Cube(),state).move(move));}
    inverse(move){return M.inverse(move);}
    validMove(move){return /^([URFDLB])('|2)?$/.test(move);}
    select(value){if(!M.FACES.includes(value))throw new Error('Неверная грань');this.selected=value;}
    moveFor(value,inverted=false){return value+(inverted?"'":'');}
    choices(){return M.FACES.map((key,i)=>({key,label:['Сверху','Справа','Спереди','Снизу','Слева','Сзади'][i]}));}
    reset(seed,depth){this.cube.identity();this.path=M.scramble(seed,depth);this.cube.move(this.path.join(' '));this.history=[];this.moves=[];this.selected='F';}
    apply(move){this.history.push({state:this.snapshot(),path:[...this.path],move});this.cube.move(move);this.path=M.appendPath(this.path,move);this.moves.push(move);this.selected=move[0];}
    undo(){const old=this.history.pop();if(!old)return null;M.restore(this.cube,old.state);this.path=old.path;this.moves.pop();this.selected=old.move[0];return M.inverse(old.move);}
    hint(){return this.path.length?M.inverse(this.path[this.path.length-1]):null;}
    solved(state=this.snapshot()){return correct(state)===8;}
    correct(state=this.snapshot()){return correct(state);}
  }
  return {id:'rubik',title:'Кубик 2×2',colors,goals,create:()=>new Model(),
    manifest:Object.freeze({schema:'music-puzzle/1',id:'rubik',version:1,pieceIds:[0,1,2,3,4,5,6,7],poseIds:Array.from({length:8},(_,slot)=>[0,1,2].map(o=>slot+':'+o)).flat(),goalPolicy:'all-solved-to-reference'})};
});
