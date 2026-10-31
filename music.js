/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Native Strudel phase transforms, independent of puzzle geometry or piece count. */
window.PuzzleMusic=(()=>{
  const eventsOf=(p,bars)=>PhaseCubeLibrary.eventsOf(p,bars),eventKey=rows=>JSON.stringify(rows);
  class Music{
    constructor(S,prepared){Object.assign(this,{S,model:prepared.model,game:prepared.fragments,song:prepared.composition,puzzle:prepared.puzzle,binding:prepared.phaseMap});this.basePatterns=this.game.basePatterns;this.localBars=this.game.periodBars;}
    phases(state){return PuzzlePhases.projectMusic(this.binding,this.puzzle,state);}
    shifted(state){const phases=this.phases(state);return this.basePatterns.map((p,id)=>p.late(this.S.Fraction([phases[id].ticks*this.localBars,this.binding.gridSteps])));}
    rows(state){return this.shifted(state).map(p=>eventsOf(p,this.localBars));}
    predict(move,state,currentRows=this.rows(state)){
      const next=this.model.applyTo(state,move),phases=this.phases(next),rows=this.rows(next);
      return {move,phases,rows,changed:rows.map((row,i)=>eventKey(row)!==eventKey(currentRows[i])?i:-1).filter(i=>i>=0)};
    }
    pattern(state){return this.S.stack(...this.shifted(state));}
    code(state){return '// '+this.song.title+' / '+this.game.count+' fragments\n'+this.phases(state).map((p,i)=>'pieces['+i+'].late('+p.ticks+'*'+this.localBars+'/'+this.binding.gridSteps+')').join('\n');}
  }
  return {Music,eventsOf,eventKey};
})();
