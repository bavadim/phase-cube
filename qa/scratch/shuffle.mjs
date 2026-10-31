/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'scratch-piece-count-shuffle/1',physicalDevice:false,engine:r.engine,cases:[],errors:[]};
try{
 const page=await r.browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(r.url+'/?debug=1&puzzle=scratch&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 for(const [songId,count]of [['turkish-circuit',13],['steel-shift',14],['elise-after-hours',14]]){
  if(songId!=='turkish-circuit')await page.evaluate(songId=>phaseCubeApp.chooseSong(songId),songId);
  const before=await page.evaluate(()=>({state:phaseCubeApp.state(),shuffle:phaseCubeApp.diagnostics().shuffle,tiles:phaseCubeApp.getGame().layout.movingCells.length,solved:phaseCubeApp.getPuzzle().solved()}));
  assert(before.solved);assert.equal(before.tiles,count);assert.equal(before.shuffle.total,count);assert.equal(before.shuffle.moves.length,0);
  await page.evaluate(()=>{window.shuffleTrace=[];const model=phaseCubeApp.getPuzzle(),shuffle=model.shuffle.bind(model);model.shuffle=()=>{const before=model.snapshot(),move=shuffle();shuffleTrace.push({before,move,after:model.snapshot(),expected:model.applyTo(before,move),locked:phaseCubeApp.diagnostics().sessionPhase==='shuffling'&&phaseCubeApp.getPresentation().disabled,history:model.history.length});return move;};});
  await page.locator('#start').tap();await page.waitForFunction(()=>phaseCubeApp.diagnostics().shuffle.moves.length>0&&!phaseCubeApp.diagnostics().starting);
  assert.equal(await page.locator('#hint').isDisabled(),true);await settled(page);
  const result=await page.evaluate(()=>({d:phaseCubeApp.diagnostics(),trace:shuffleTrace,history:phaseCubeApp.getPuzzle().history.length}));
  assert.equal(result.d.shuffle.moves.length,count);assert.equal(result.trace.length,count);assert(result.d.shuffle.complete);assert.equal(result.d.sessionPhase,'playing');assert.equal(result.history,0);
  for(const step of result.trace){assert(step.locked);assert.equal(step.history,0);assert.deepEqual(step.after,step.expected);assert.notDeepEqual(step.after,step.before);}
  assert.deepEqual(result.trace[0].before,before.state);
  await page.locator('#pause').tap();await page.locator('#start').tap();await settled(page);
  assert.equal(await page.evaluate(()=>shuffleTrace.length),count,'Resume must preserve the completed shuffle');
  report.cases.push({songId,movableTiles:count,shownMoves:result.d.shuffle.moves.length,replayable:true,inputLocked:true,undoHistoryEmpty:true,pausePreserves:true});
 }
 for(const puzzleId of ['twiddle','rubik','fourier']){await page.evaluate(puzzleId=>phaseCubeApp.choosePuzzle(puzzleId),puzzleId);assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().shuffle.total),3);}
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const files=['app.js','puzzles/scratch/module.js','index.html','config.js'];report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(root,file))).digest('hex')])));
 await writeFile(join(root,`qa/scratch/${r.engine}-shuffle-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));
}
