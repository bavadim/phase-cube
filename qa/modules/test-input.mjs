/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from './browser.mjs';
import {settled,targets,selectionPoint,actionPoint,select,turnPuzzle} from './field-input.mjs';
const runtime=await openBrowser(),report={schema:'puzzle-input/2',cases:[],errors:[],physicalDevice:false};
const geometry=page=>page.evaluate(()=>JSON.stringify(phaseCubeApp.getPresentation().locations()));
const state=page=>page.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length,selected:phaseCubeApp.diagnostics().selectedFace}));
async function gesture(page,ctx,p,dx,touch,end='touchEnd'){
 if(touch){
  const cdp=await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:p.x,y:p.y}]});
  if(dx)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:p.x+dx,y:p.y+1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:end,touchPoints:[]});await cdp.detach();
 }else{
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+1);await page.mouse.up();
 }
}
try{
 for(const [width,height,touch]of [[1280,800,false],[390,844,true],[320,568,true]]){
  const ctx=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(runtime.url+'/?debug=1&puzzle=rubik&song=elise-after-hours');
  await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  const canvas=await page.locator('#puzzle-stage canvas').elementHandle();
  const entry={width,height,touch,turns:0,switches:0,memory:[]};
  for(const id of ['rubik','twiddle','rubik','twiddle']){
   if(await page.evaluate(()=>phaseCubeApp.diagnostics().puzzleId)!==id){await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);entry.switches++;}
   await page.locator('#start').click();await settled(page);
   assert(await page.evaluate(original=>document.querySelector('#puzzle-stage canvas')===original,canvas),'Switching must reuse the canvas/context');
   const initial=await state(page);
   // Hover arms a mouse action; the first touch selects without rotating.
   await select(page,initial.selected,touch);
   await turnPuzzle(page,initial.selected,false,touch);await turnPuzzle(page,initial.selected,true,touch);entry.turns+=2;
   assert.deepEqual((await state(page)).state,initial.state,'Opposite clicks restore the original position');
   const keys=id==='rubik'?(await targets(page)).map(t=>t.key):['B','A'];
   for(const key of keys.filter(k=>k!==initial.selected)){
    await select(page,key,touch);
    const before=(await state(page)).state;
    await turnPuzzle(page,key,true,touch);await turnPuzzle(page,key,false,touch);entry.turns+=2;
    assert.deepEqual((await state(page)).state,before);
   }
   if(id==='rubik'){
    const before=await state(page),projection=await geometry(page),p=await selectionPoint(page,before.selected);
    if(touch){
     await gesture(page,ctx,p,0,true,'touchCancel');assert.deepEqual(await state(page),before,'Cancellation must not turn/select');
     await turnPuzzle(page,before.selected,false,true,p=>gesture(page,ctx,p,8,true));
     assert.equal(await geometry(page),projection,'Small finger drift must not rotate the camera');
     await turnPuzzle(page,before.selected,true,true);entry.turns+=2;entry.fingerDrift=true;entry.cancel=true;
    }
    const preDrag=await state(page);
    await gesture(page,ctx,p,45,touch);
    assert.notEqual(await geometry(page),projection,'Drag rotates the camera');
    assert.deepEqual(await state(page),preDrag,'Drag must not turn pieces or select a face');entry.drag=true;
    // Validate direction using the new projected halves after camera rotation.
    const selected=(await state(page)).selected,other=(await targets(page)).find(t=>t.key!==selected).key;
    await select(page,other,touch);await turnPuzzle(page,other,false,touch);await turnPuzzle(page,other,true,touch);entry.turns+=2;
   }else{
    // The shared middle column belongs to the selected block, without toggling it.
    for(const key of ['B','A']){
     if((await state(page)).selected!==key)await select(page,key,touch);
     const middle=key==='B';await turnPuzzle(page,key,middle,touch);await turnPuzzle(page,key,!middle,touch);entry.turns+=2;
     assert.equal((await state(page)).selected,key,'Shared tiles preserve selected block');
    }
    entry.sharedColumn=true;
   }
   if(touch){const before=await state(page);await page.waitForTimeout(350);assert.deepEqual(await state(page),before,'Compatibility click must not cause a second turn');}
   const key=(await state(page)).selected,p=await actionPoint(page,key,true);
   if(touch){
    const cdp=await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:p.x,y:p.y}]});
    await page.screenshot({path:join(root,'qa/modules/input-'+id+'-'+width+'.png')});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
   }else{await page.mouse.move(p.x,p.y);await page.screenshot({path:join(root,'qa/modules/input-'+id+'-'+width+'.png')});}
   const memory=await page.evaluate(()=>phaseCubeApp.getPresentation().info());
   assert(memory.geometries<=(id==='rubik'?16:12)&&memory.textures<=(id==='rubik'?48:6),'Graphics resources accumulate across switches');entry.memory.push(memory);
   await page.locator('#pause').click();
  }
  report.cases.push(entry);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,'qa/modules/input-report.json'),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify(report,null,2));
}
