/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Only the four-bar repeating riff is editable. The song is a separate lane. */
window.PhaseCubeMusic=(()=>{
  const eventKey=rows=>JSON.stringify(rows);
  function eventsOf(p,bars=4){return p.queryArc(0,bars).filter(h=>h.hasOnset()).map(h=>({start:Number(h.whole.begin)/bars,duration:Number(h.duration)/bars,value:h.value}));}
  class Music{
    constructor(S,M,Cube,voices){Object.assign(this,{S,M,Cube,voices});this.localBars=PhaseCubeConfig.localBars;
      this.basePatterns=voices.map((v,id)=>S.s(v.sound).slow(4).late(S.Fraction([id,2])).duration(.5).gain(1).attack(.002).release(.005).withValue(v=>({...v,_steelVoice:id})));
    }
    shifted(state){const ps=this.M.phases(state);return this.basePatterns.map((p,id)=>p.late(this.S.Fraction([ps[id].ticks*4,24])));}
    rows(s){return this.shifted(s).map(p=>eventsOf(p,4));}
    predict(move,state,currentRows){const c=new this.Cube();this.M.restore(c,state);c.move(move);const next=this.M.snapshot(c),phases=this.M.phases(next),before=this.M.phases(state),rows=this.rows(next);return{move,phases,rows,phaseChanged:phases.filter((p,i)=>p.ticks!==before[i].ticks).map(p=>p.id),changed:rows.map((r,i)=>eventKey(r)!==eventKey(currentRows[i])?i:-1).filter(i=>i>=0)};}
    pattern(state,{solo=-1,muted=[]},respectMix=true){const ps=this.shifted(state).filter((p,id)=>!respectMix||(!muted.includes(id)&&(solo<0||solo===id)));return ps.length?this.S.stack(...ps):this.S.silence;}
    code(state,mix,bpm){const phases=this.M.phases(state);return [`// Вся песня: 48 тактов. Редактируется только riffThemeALoop, 4 такта.`,`setcpm(${bpm}/4)`,'stack(',...this.voices.map((v,i)=>`  s("${v.sound}").slow(4).duration(0.5).late(${i}/2 + ${phases[i].ticks}*4/24),`),')','// Остальные 13 партий исполняются отдельной непрерывной дорожкой.'].join('\n');}
  }
  return {Music,eventsOf,eventKey};
})();
