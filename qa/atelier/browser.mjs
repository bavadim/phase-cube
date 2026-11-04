/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select,turnPuzzle} from '../modules/field-input.mjs';
const run=await openBrowser(),report={schema:'puzzle-atelier/1',engine:run.engine,physicalDevice:false,cases:[],errors:[]};let page;
try{
 for(const [width,height] of [[1280,800],[390,844],[844,390]].filter(([w])=>!process.env.ART_SIZE||+process.env.ART_SIZE===w)){
  const touch=width!==1280,context=await run.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(run.url+'/?debug=1&puzzle=twiddle&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  if(run.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
  const click=locator=>locator[touch?'tap':'click']();
  for(const id of ['twiddle','rubik','fourier','scratch','bounce'].filter(id=>!process.env.ART_PUZZLE||process.env.ART_PUZZLE===id)){
   if(id!=='twiddle')await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);
   await settled(page);await click(page.locator('#start'));await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const initial=await page.evaluate(()=>phaseCubeApp.state());
   const all=await targets(page),first=all[0];assert(first);
   if(['rubik','twiddle'].includes(id)){
    const key=id==='twiddle'?'A':first.key;await select(page,key,touch);await turnPuzzle(page,key,false,touch);
    await click(page.locator('#undo'));await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),initial);
   }else{
    await (touch?page.touchscreen.tap(first.x,first.y):page.mouse.click(first.x,first.y));
    await page.waitForFunction(key=>phaseCubeApp.getPuzzle().selected===key,first.key);
    // A hold-to-brake tap can itself commit a rounded tick; revert it before checking buttons.
    if(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length)) {await click(page.locator('#undo'));await settled(page);}
    const before=await page.evaluate(()=>phaseCubeApp.state());
    await click(page.locator('.puzzle-action:enabled:not(#next-object)').first());await settled(page);
    await page.waitForFunction(()=>phaseCubeApp.getPuzzle().history.length>0);
    await click(page.locator('#undo'));await settled(page);assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before);
   }
   await click(page.locator('#hint'));await settled(page);assert(await page.locator('.puzzle-action.hinted').count());
   await page.screenshot({path:join(root,`qa/atelier/${run.engine}-${width}-${id}.png`)});
   const metrics=await page.evaluate(()=>{
    const s=phaseCubeApp.getPresentation();s.renderer.render(s.active.scene,s.active.view.camera);
    const rect=s.canvas.getBoundingClientRect(),commands=[...document.querySelectorAll('.puzzle-action,#hint')].map(b=>b.getBoundingClientRect());
    const shapeErrors=[];for(const [key,g] of s.active.resources.shapes){g.computeBoundingBox();const dims=key.split(':').map(Number),v=g.boundingBox.getSize(new THREE.Vector3()).toArray();if(v.some((x,i)=>Math.abs(x-dims[i])>1e-5))shapeErrors.push({key,v});}
    return {stage:{width:rect.width,height:rect.height},canvasCount:document.querySelectorAll('#puzzle-stage canvas').length,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,
     minControl:Math.min(...commands.map(r=>Math.min(r.width,r.height))),offscreenControl:commands.some(r=>r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1),
     memory:{...s.renderer.info.memory},render:{...s.renderer.info.render},shapeErrors};
   });
   assert.equal(metrics.canvasCount,1);assert(!metrics.overflow);assert(!metrics.offscreenControl);assert(metrics.minControl>=44);assert.deepEqual(metrics.shapeErrors,[]);
   assert(metrics.render.triangles<220000,'Mobile geometry budget');assert(metrics.render.calls<500,'Mobile draw-call budget');assert(metrics.memory.textures<45,'Texture budget');
   report.cases.push({id,width,height,input:touch?'touch':'mouse',fieldSelection:true,actionUndo:true,hint:true,metrics});
   console.log(JSON.stringify({id,width,engine:run.engine,calls:metrics.render.calls,triangles:metrics.render.triangles,status:'PASS'}));
  }
  // Same renderer, repeat complete mount/dispose cycles. Stable counts, no retained GPU objects.
  const memory=[];
  for(let i=0;i<3;i++){await page.evaluate(()=>phaseCubeApp.choosePuzzle('twiddle'));await settled(page);await page.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));await settled(page);memory.push(await page.evaluate(()=>{const s=phaseCubeApp.getPresentation();s.renderer.render(s.active.scene,s.active.view.camera);return {...s.renderer.info.memory};}));}
  assert.deepEqual(memory[1],memory[2]);report.cases.at(-1).repeatedMountMemory=memory;
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(root,`qa/atelier/${run.engine}-failure.png`)});}catch{}throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=[...new Set(['index.html',...[...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1].split('?')[0])])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(join(root,f))).digest('hex')])));
 await writeFile(join(root,`qa/atelier/${run.engine}-${process.env.ART_SIZE||'all'}${process.env.ART_PUZZLE?'-'+process.env.ART_PUZZLE:''}-report.json`),JSON.stringify(report,null,2));await run.close();
}
