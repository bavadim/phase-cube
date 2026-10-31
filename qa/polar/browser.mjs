/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select,turnPuzzle} from '../modules/field-input.mjs';
const runtime=await openBrowser(),report={schema:'polar-actions/1',engine:runtime.engine,physicalDevice:false,cases:[],errors:[]};
try{
 for(const [width,height,touch]of [[1280,800,false],[390,844,true],[320,568,true]]){
  const ctx=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),page=await ctx.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(runtime.url+'/?debug=1&puzzle=fourier');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  const canvas=await page.locator('#puzzle-stage canvas').elementHandle();
  for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
   await page.evaluate(songId=>phaseCubeApp.choose({songId,puzzleId:'fourier'}),songId);
   await page.locator('#start').click();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().playing&&phaseCubeApp.diagnostics().rms>.0001);
   const initial=await page.evaluate(()=>phaseCubeApp.state()),d=await page.evaluate(()=>phaseCubeApp.diagnostics());
   assert.equal(d.projection,'complex-riff/1');assert.equal(d.masterGain,1);assert.equal(d.fragmentCount,6);assert.equal(d.pieceCount,6);
   assert.equal(await page.locator('.puzzle-actions-left .puzzle-action').count(),2);assert.equal(await page.locator('.puzzle-actions-right .puzzle-action').count(),2);
   assert.equal(await page.locator('#hint').count(),1);assert.equal((await targets(page)).filter(p=>p.kind==='point').length,6);
   assert(d.shuffle.moves.some(m=>/[+-]$/.test(m)),'Intro must demonstrate radius too');
   for(const key of songId==='turkish-circuit'?['A','B','C','D','E','F']:['A']){
    await select(page,key,touch);await select(page,key,touch);
    await turnPuzzle(page,key,false,touch);await turnPuzzle(page,key,true,touch);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),initial);
    const enabled=await page.evaluate(()=>phaseCubeApp.getPuzzle().actions().find(a=>a.enabled&&a.id.startsWith('magnitude-')).id);
    const expected=await page.evaluate(id=>{const m=phaseCubeApp.getPuzzle(),a=m.actions().find(a=>a.id===id);return m.applyTo(m.snapshot(),a.move);},enabled);
    await page.locator('#'+enabled).click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),expected);
    await page.locator(enabled==='magnitude-up'?'#magnitude-down':'#magnitude-up').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),initial);
   }
   // Actual mouse drag of one coefficient, changing both its coordinates.
   await select(page,'A',touch);
   const before=await page.evaluate(()=>{const m=phaseCubeApp.getPuzzle(),p=m.parameters()[0];return{state:m.snapshot(),count:m.history.length,to:{phase:(p.phase+2)%8,level:(p.level+1)%3}};});
   const tip=(await targets(page)).find(t=>t.kind==='point'&&t.key==='A');
   const destination=await page.evaluate(to=>{const a=to.phase*Math.PI/4,r=FourierModel.levels[to.level]*1.15/Math.max(...FourierModel.levels);return phaseCubeApp.getPresentation().project(new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),0));},before.to);
   await page.mouse.move(tip.x,tip.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:8});
   assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state,'Preview must not mutate model/audio state');
   await page.mouse.up();await settled(page);
   const after=await page.evaluate(()=>{const m=phaseCubeApp.getPuzzle();return{state:m.snapshot(),count:m.history.length,move:m.history.at(-1).move,parameter:m.parameters()[0]};});
   assert.equal(after.count,before.count+1);assert.equal(after.move.kind,'coefficient');assert.deepEqual(after.parameter,before.to);
   await page.locator('#undo').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);
   // Cancel must discard the preview and leave no stale captured pointer.
   const from=(await targets(page)).find(t=>t.kind==='point'&&t.key==='A');
   await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:5});
   await page.evaluate(()=>{const s=phaseCubeApp.getPresentation();s.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:s.pointer.gesture.id,bubbles:true}));});await page.mouse.up();
   assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
   // Distinct fixed labels preserve selection even if all tips coincide.
   await page.evaluate(()=>{const m=phaseCubeApp.getPuzzle();window.qaSaved=m.snapshot();for(const key of FourierModel.keys){const move=m.editMove(key,{phase:1,level:1});if(move)m.restore(m.applyTo(m.snapshot(),move));}phaseCubeApp.getPresentation().update(false);});
   for(const key of ['A','B','C','D','E','F'])await select(page,key,touch);
   await page.evaluate(()=>{phaseCubeApp.getPuzzle().restore(qaSaved);phaseCubeApp.getPresentation().update(false);});
   await select(page,'B',touch);await page.screenshot({path:join(root,`qa/polar/${runtime.engine}-${songId}-${width}.png`)});
   await page.locator('#pause').click();await page.waitForFunction(()=>phaseCubeApp.diagnostics().context==='suspended');await page.locator('#start').click();await settled(page);
   await page.evaluate(()=>phaseCubeApp.seekSong(16));await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase),'playing');
   let steps=0;
   while(await page.evaluate(()=>phaseCubeApp.diagnostics().sessionPhase!=='won')){
    await page.locator('#hint').click();assert.equal(await page.locator('.puzzle-action.hinted').count(),1);
    await page.locator('.puzzle-action.hinted').click();await settled(page);assert(++steps<=36);
   }
   await page.waitForFunction(()=>document.querySelector('#result-dialog').open);assert.equal(await page.locator('#correct-count').textContent(),'6/6');
   assert.equal(await page.locator('#celebration .firework-spark').count(),70);
   await page.locator('#play-again').click();await settled(page);assert.equal(await page.locator('#undo').isDisabled(),true);await page.locator('#pause').click();
   report.cases.push({width,height,touch,songId,selection:true,phaseAndRadius:true,mouseDragOneMove:true,cancel:true,coincidentTips:true,undo:true,winReplay:true,steps});
  }
  for(const id of ['rubik','twiddle']){
   await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);await page.locator('#start').click();await settled(page);
   assert.equal(await page.locator('.puzzle-actions-left .puzzle-action').count(),1);assert.equal(await page.locator('.puzzle-actions-right .puzzle-action').count(),1);
   const key=await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace);await select(page,key,touch);await turnPuzzle(page,key,false,touch);await turnPuzzle(page,key,true,touch);
   assert(await page.evaluate(c=>document.querySelector('#puzzle-stage canvas')===c,canvas));await page.locator('#pause').click();
  }
  await ctx.close();
 }
 // Exercise arbitrary action lists, icons, labels and callback reconciliation.
 const c=await runtime.browser.newContext(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(runtime.url+'/?debug=1');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 const generic=await p.evaluate(()=>{
  const original=document.getElementById('hint');original.id='qa-real-hint';const host=document.createElement('div'),hint=document.createElement('button');hint.id='hint';host.append(hint);document.body.append(host);
  let count=5,called=0,previewed=0;const fake={actions:()=>Array.from({length:count},(_,i)=>({id:'qa-action-'+i,label:'Действие '+i,icon:i?{text:String(i)}:{src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII='},enabled:true,onInvoke:()=>called++,onPreview:()=>previewed++}))};
  const control=new PuzzleActionControls(host,{model:fake,onMove(){},onPreview(){}});
  try{
   control.update(false);const split=[host.querySelectorAll('.puzzle-actions-left button').length,host.querySelectorAll('.puzzle-actions-right button').length];
   host.querySelector('#qa-action-0').click();host.querySelector('#qa-action-0').dispatchEvent(new FocusEvent('focus'));
   const image=host.querySelector('img')?.getAttribute('src'),label=host.querySelector('button.puzzle-action').getAttribute('aria-label');
   count=7;control.update(false);const seven=[host.querySelectorAll('.puzzle-actions-left button').length,host.querySelectorAll('.puzzle-actions-right button').length];
   count=1;control.update(false);const removed=host.querySelectorAll('.puzzle-action').length;count=0;control.update(false);const empty=host.querySelectorAll('.puzzle-action').length;
   return{split,seven,removed,empty,called,previewed,image:!!image,label,hints:host.querySelectorAll('#hint').length};
  }finally{control.destroy();host.remove();original.id='hint';}
 });
 assert.deepEqual(generic,{split:[3,2],seven:[4,3],removed:1,empty:0,called:1,previewed:1,image:true,label:'Действие 0',hints:1});report.genericActions=generic;await c.close();
 const offline=await runtime.browser.newContext(),single=await offline.newPage();single.on('pageerror',e=>report.errors.push(e.message));
 await single.route('**/*',r=>r.request().isNavigationRequest()?r.continue():r.abort());await single.goto(runtime.url+'/steel-shift-cube.html?debug=1&puzzle=fourier');await single.waitForFunction(()=>window.phaseCubeApp);await single.evaluate(()=>phaseCubeApp.ready);await offline.setOffline(true);
 await single.locator('#start').click();await settled(single);await single.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);assert.equal(await single.locator('.puzzle-action').count(),4);await offline.close();report.offline=true;
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,`qa/polar/${runtime.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify({status:report.status,cases:report.cases.length,failure:report.failure}));
}
