/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* The cube shifts eight note patterns; the full Strudel backing stays independent. */
window.PhaseCubeMusic=(()=>{
  const eventKey=rows=>JSON.stringify(rows);
  const eventsOf=PhaseCubeLibrary.eventsOf;
  class Music{
    constructor(S,M,Cube,song){Object.assign(this,{S,M,Cube,song});this.voices=song.game.voices;this.localBars=song.game.periodBars;
      this.basePatterns=song.game.basePatterns;
    }
    shifted(state){const ps=this.M.phases(state);return this.basePatterns.map((p,id)=>p.late(this.S.Fraction([ps[id].ticks*this.localBars,24])));}
    rows(s){return this.shifted(s).map(p=>eventsOf(p,this.localBars));}
    predict(move,state,currentRows){const c=new this.Cube();this.M.restore(c,state);c.move(move);const next=this.M.snapshot(c),phases=this.M.phases(next),before=this.M.phases(state),rows=this.rows(next);return{move,phases,rows,phaseChanged:phases.filter((p,i)=>p.ticks!==before[i].ticks).map(p=>p.id),changed:rows.map((r,i)=>eventKey(r)!==eventKey(currentRows[i])?i:-1).filter(i=>i>=0)};}
    pattern(state,{solo=-1,muted=[]},respectMix=true){const ps=this.shifted(state).filter((p,id)=>!respectMix||(!muted.includes(id)&&(solo<0||solo===id)));return ps.length?this.S.stack(...ps):this.S.silence;}
    code(state){const phases=this.M.phases(state);return [`// ${this.song.title}: ${this.song.bars} тактов. Игровой период: ${this.localBars}.`,`// compositions/${this.song.id}.strudel.mjs`,`setcpm(${this.song.bpm}/4)`,'stack(',...this.voices.map((v,i)=>`  pieces[${i}].late(${phases[i].ticks}*${this.localBars}/24), // ${v.name}`),'  backing',')'].join('\n');}
  }
  return {Music,eventsOf,eventKey};
})();
