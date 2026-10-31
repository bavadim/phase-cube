/* SPDX-License-Identifier: AGPL-3.0-or-later */
const assert=require('node:assert/strict');
const S=require('./session.js');
let checks=0;
function expect(state,{phase,mode,audible,movable}){
  assert.equal(state.phase,phase);assert.equal(state.mode,mode);
  assert.equal(S.shouldPlay(state),audible);assert.equal(S.canMove(state),movable);checks++;
}
let state=S.initial();
expect(state,{phase:'ready',mode:'current',audible:false,movable:false});
// Audition can start and stop before the game, without unlocking puzzle moves.
state=S.transition(state,'target');
expect(state,{phase:'ready',mode:'target',audible:true,movable:false});
state=S.transition(state,'target');
expect(state,{phase:'ready',mode:'current',audible:false,movable:false});
state=S.transition(S.transition(state,'target'),'start');
expect(state,{phase:'playing',mode:'current',audible:true,movable:true});
// Target audition during play returns to current sound without pausing the game.
state=S.transition(state,'target');
expect(state,{phase:'playing',mode:'target',audible:true,movable:true});
state=S.transition(state,'move');
expect(state,{phase:'playing',mode:'current',audible:true,movable:true});
state=S.transition(state,'pause');
expect(state,{phase:'paused',mode:'current',audible:false,movable:false});
state=S.transition(state,'target');
expect(state,{phase:'paused',mode:'target',audible:true,movable:false});
state=S.transition(state,'target');
expect(state,{phase:'paused',mode:'current',audible:false,movable:false});
// Shuffle does not silently resume a paused game; resume restores current mix.
state=S.transition(S.transition(state,'target'),'shuffle');
expect(state,{phase:'paused',mode:'current',audible:false,movable:false});
state=S.transition(state,'start');
expect(state,{phase:'playing',mode:'current',audible:true,movable:true});
const original=S.initial();S.transition(original,'start');
state=S.transition(S.transition(S.initial(),'start'),'complete');
expect(state,{phase:'won',mode:'current',audible:true,movable:false});
state=S.transition(state,'restart');
expect(state,{phase:'ready',mode:'current',audible:false,movable:false});
state=S.transition(state,'start');
expect(state,{phase:'playing',mode:'current',audible:true,movable:true});
assert.deepEqual(original,S.initial());checks++;
assert.throws(()=>S.transition(state,'unknown'));checks++;
state=S.transition(S.initial(),'shuffle-start');
expect(state,{phase:'shuffling',mode:'current',audible:true,movable:false});
state=S.transition(state,'shuffle-complete');
expect(state,{phase:'playing',mode:'current',audible:true,movable:true});
state=S.transition(S.transition(S.initial(),'shuffle-start'),'pause');
expect(state,{phase:'paused',mode:'current',audible:false,movable:false});
assert.deepEqual(S.transition(state,'shuffle-complete'),state,'An interrupted shuffle cannot resume the level');checks++;
console.log(`Session: ${checks} checks passed`);
