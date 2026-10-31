/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,actionPoint,selectionPoint,tap} from '../modules/field-input.mjs';
const rt=await openBrowser(),report={schema:'action-focus-score/1',engine:rt.engine,physicalDevice:false,cases:[],errors:[]};
await mkdir(join(root,'qa/focus'),{recursive:true});
try{
 const ctx=await rt.browser.newContext({viewport:{width:1280,height:800},hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.stack));
 await p.goto(rt.url+'/?debug=1');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 for(const puzzleId of ['twiddle','rubik','fourier']){
  await p.evaluate(id=>phaseCubeApp.choosePuzzle(id),puzzleId);await p.locator('#start').click();await settled(p);
  const snapshot=await p.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length}));
  await p.locator('#hint').click();
  const hint=await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus);
  assert.equal(hint.source,'hint');assert.equal(await p.locator('.puzzle-action.action-focused').count(),1);
  assert.equal(await p.locator('.puzzle-action.hinted').count(),1);assert(await p.locator('#orbit-score').evaluate(e=>e.classList.contains('has-move-preview')));
  assert.equal(await p.locator('#orbit-score').getAttribute('data-mode'),'preview');assert.equal(await p.locator('.orbit-legend').count(),0);
  await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion&&!phaseCubeApp.getPresentation().timelines.size);
  await p.evaluate(()=>window.qaEventNodes=[...document.querySelectorAll('.score-event')]);
  // The exact same move from the field must focus the same button and forecast.
  let point,move;
  if(puzzleId==='fourier'){
   const data=await p.evaluate(()=>{
    const m=phaseCubeApp.getPuzzle(),s=m.snapshot(),hint=phaseCubeApp.diagnostics().actionFocus.move,actions=m.actions();
    const a=actions.find(a=>a.enabled&&a.move!==hint&&a.id.startsWith('magnitude-'))||actions.find(a=>a.enabled&&a.move!==hint);
    const next=m.coefficients(m.applyTo(s,a.move))[FourierModel.keys.indexOf(m.selected)];
    return{move:a.move,...phaseCubeApp.getPresentation().project(new THREE.Vector3(next[0]*1.15/.6,next[1]*1.15/.6,0))};
   });point=data;move=data.move;
  }else{
   move=hint.key+(hint.move.endsWith("'")?'':"'");point=await actionPoint(p,hint.key,!move.endsWith("'")?false:true);
  }
  await p.mouse.move(point.x,point.y);await p.waitForFunction(()=>phaseCubeApp.diagnostics().actionFocus?.source==='field');
  assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus.move),move,'Field chooses its actual click action');
  const button=await p.locator('.puzzle-action.action-focused').getAttribute('id');assert.equal(await p.locator('.puzzle-action.action-focused').count(),1);
  const preview=await p.evaluate(()=>({move:phaseCubeApp.getEqualizer().forecast.move,positions:phaseCubeApp.getEqualizer().rows.map(r=>[...r.positions.values()].map(e=>[e.id,e.start])),heard:phaseCubeApp.getTransport().active.meta.state}));
  assert.equal(preview.move,move);assert.deepEqual(await p.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length})),snapshot,'Hover does not mutate game state');
  assert.deepEqual(preview.heard,snapshot.state,'Hover does not mutate audio state');
  assert.equal(await p.locator('.orbit-preview,.preview-event,.target-event,.orbit-target-rail').count(),0);
  assert(await p.locator('.target-slot').count()>0);assert.equal(await p.locator('.subdivision-line').count(),0);
  // The existing SVG event nodes move; no cloned forecast events are created.
  const motion=await p.evaluate(async()=>{
   const score=phaseCubeApp.getEqualizer(),nodes=[...document.querySelectorAll('.score-event')],from=score.rows.map(r=>[...r.positions.values()].map(e=>e.start));
   await new Promise(r=>setTimeout(r,350));
   return{same:nodes.every((n,i)=>n===document.querySelectorAll('.score-event')[i])&&qaEventNodes.every((n,i)=>n===document.querySelectorAll('.score-event')[i]),from,to:score.rows.map(r=>[...r.positions.values()].map(e=>e.start)),pending:!!score.motion};
  });assert(motion.same);assert(!motion.pending);assert.notDeepEqual(motion.from,motion.to,'The forecast animates a shift rather than only changing color');
  await p.screenshot({path:join(root,`qa/focus/${rt.engine}-${puzzleId}-hover.png`)});
  const expected=await p.evaluate(m=>phaseCubeApp.getPuzzle().applyTo(phaseCubeApp.state(),m),move);
  await p.mouse.click(point.x,point.y);await settled(p);
  assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),expected,'Click executes the previewed operation');
  await p.mouse.move(0,0);await p.locator('#undo').click();await settled(p);assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),snapshot.state);
  // Keyboard and hint use the same button/view/score focus, with no DOM focus theft from the canvas.
  await p.locator('#'+button).focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');
  assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus?.source),'button-keyboard');
  await p.locator('#hint').click();assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus.source),'hint');
  const highlight=await p.evaluate(()=>{
   const score=phaseCubeApp.getEqualizer();score.cancel();score.forecast=null;score.motion=null;
   const row=score.rows.find(r=>r.positions.size>1),event=[...row.positions.values()][0];
   score.frame(event.start,true);const local=row.current.querySelectorAll('.score-event.sounding').length;
   return{local,total:row.positions.size,whole:document.querySelectorAll('.playing-note').length};
  });assert.equal(highlight.whole,0);assert(highlight.local>0&&highlight.local<highlight.total,'Only simultaneous attacks flash, not the whole voice');
  await p.locator('#pause').click();assert.equal(await p.locator('.puzzle-action.action-focused').count(),0);assert.equal(await p.evaluate(()=>phaseCubeApp.diagnostics().actionFocus),null);
  assert.equal(await p.locator('#orbit-score').evaluate(e=>e.classList.contains('has-move-preview')),false);
  report.cases.push({puzzleId,hint:true,fieldAndButtonFocus:true,clickMatchesPreview:true,hoverIsSilent:true,persistentEventNodes:true,oneEventFlash:true,pauseClearsFocus:true});
 }
 // Touch keeps first-tap selection / second-tap rotation, without arming on pointerdown.
 await p.setViewportSize({width:390,height:844});
 for(const puzzleId of ['twiddle','rubik']){
  await p.evaluate(id=>phaseCubeApp.choosePuzzle(id),puzzleId);await p.locator('#start').click();await settled(p);
  const key=puzzleId==='twiddle'?'B':'F',before=await p.evaluate(()=>phaseCubeApp.state());
  await tap(p,await selectionPoint(p,key),true);await settled(p);assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),before);
  const move=key+"'",at=await actionPoint(p,key,true),expected=await p.evaluate(m=>phaseCubeApp.getPuzzle().applyTo(phaseCubeApp.state(),m),move);
  await tap(p,at,true);await settled(p);assert.deepEqual(await p.evaluate(()=>phaseCubeApp.state()),expected);
  await p.locator('#pause').click();report.cases.push({puzzleId,touchSelectionAndTurn:true});
 }
 // Reduced motion reaches preview/rollback positions without an active animation.
 const wells=await p.evaluate(()=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(svg);
  try{
   const target=[phaseCubeApp.getGame().targetRows[0]],score=new PuzzleEqualizer.Score(svg,[phaseCubeApp.getGame().voices[0]]),phases=[{aligned:true}];
   score.update({rows:target,target,phases});const filled=getComputedStyle(svg.querySelector('.orbit-target')).visibility;
   const moved=[target[0].map(e=>({...e,start:(e.start+.125)%1}))];
   score.update({rows:target,target,phases,forecast:{rows:moved,phases:[{aligned:false}],changed:[0],move:'test'}});
   return{filled,preview:getComputedStyle(svg.querySelector('.orbit-target')).visibility};
  }finally{svg.remove();}
 });assert.deepEqual(wells,{filled:'hidden',preview:'visible'});report.correctTrackDestinations=true;
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));await p.locator('#start').click();await settled(p);
 const enabled=await p.locator('.puzzle-action:enabled').first();await enabled.hover();assert.equal(await p.evaluate(()=>!!phaseCubeApp.getEqualizer().motion),false);
 await p.mouse.move(0,0);assert.equal(await p.evaluate(()=>!!phaseCubeApp.getEqualizer().motion),false);
 report.reducedMotion=true;await ctx.close();assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async path=>[path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')])));
 await writeFile(join(root,`qa/focus/${rt.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await rt.close();console.log(JSON.stringify({status:report.status,cases:report.cases.length,failure:report.failure}));
}
