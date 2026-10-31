/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from './browser.mjs';
const runtime=await openBrowser(),report={schema:'puzzle-input/1',cases:[],errors:[],physicalDevice:false};
const settled=p=>p.waitForFunction(()=>{const d=phaseCubeApp.diagnostics();return d.playing&&!d.starting&&!d.busy&&!d.pending&&!d.loading;});
async function facePoints(page){return page.evaluate(()=>{
 const paths=[...document.querySelectorAll('.cube-hit')];
 return [...new Set(paths.map(p=>p.dataset.face))].map(face=>{
  const tiles=paths.filter(p=>p.dataset.face===face),r=tiles[0].ownerSVGElement.getBoundingClientRect();
  const pts=tiles.flatMap(e=>{const a=e.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return Array.from({length:a.length/2},(_,i)=>[a[2*i],a[2*i+1]]);});
  return{face,x:r.x+pts.reduce((s,p)=>s+p[0],0)/pts.length,y:r.y+pts.reduce((s,p)=>s+p[1],0)/pts.length};
 });
});}
async function tilePoint(page,slot){return page.evaluate(slot=>{
 const svg=document.querySelector('.twiddle-stage>svg'),x=slot%3+.5,y=Math.floor(slot/3)+.5;
 const p=new DOMPoint(154+(x-y)*57,28+(x+y)*31).matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};
},slot);}
async function pick(page,p,want,touch){
 const before=await page.evaluate(()=>phaseCubeApp.state());
 if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
 assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),want,'Selection at '+JSON.stringify(p));
 assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before,'Selection must not move pieces');
}
async function gesture(cdp,p,dx,end='touchEnd'){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:p.x,y:p.y}]});
 if(dx)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:p.x+dx,y:p.y+1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:end,touchPoints:[]});
}
try{
 for(const [width,height,touch]of [[1280,800,false],[390,844,true],[320,568,true]]){
  const ctx=await runtime.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(runtime.url+'/?debug=1&puzzle=rubik&song=elise-after-hours');
  await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
  const entry={width,height,touch,faceTaps:0,tileTaps:0,switches:0};
  for(const id of ['rubik','twiddle','rubik','twiddle']){
   if(await page.evaluate(()=>phaseCubeApp.diagnostics().puzzleId)!==id){await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);entry.switches++;}
   await page.locator('#start').click();await settled(page);
   if(id==='rubik'){
    for(const p of await facePoints(page)){await pick(page,p,p.face,touch);entry.faceTaps++;}
    if(touch){
     const cdp=await ctx.newCDPSession(page),points=await facePoints(page),p=points.find(p=>p.face==='R')||points[0];
     const geometry=await page.locator('.cube-hit').first().getAttribute('d'),before=await page.evaluate(()=>phaseCubeApp.state());
     await gesture(cdp,p,8);assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),p.face);
     assert.equal(await page.locator('.cube-hit').first().getAttribute('d'),geometry,'Small finger drift must not turn the camera');
     await gesture(cdp,p,0,'touchCancel');await pick(page,points[0],points[0].face,true);
     const selected=await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace);
     await gesture(cdp,p,45);
     await page.waitForFunction(old=>document.querySelector('.cube-hit')?.getAttribute('d')!==old,geometry);
     assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),selected,'Drag must not select a face');
     assert.deepEqual(await page.evaluate(()=>phaseCubeApp.state()),before,'Camera gestures must not make moves');
     for(const q of await facePoints(page)){await pick(page,q,q.face,true);entry.faceTaps++;}
     await cdp.detach();entry.fingerDrift=true;entry.drag=true;entry.cancel=true;
    }
    await page.screenshot({path:join(root,'qa/modules/input-rubik-'+width+'.png')});
   }else{
    for(const slot of [2,0,5,3,1,1,4,4,2,0]){
     const selected=await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),col=slot%3;
     const want=col===1?(selected==='A'?'B':'A'):col===0?'A':'B';
     await pick(page,await tilePoint(page,slot),want,touch);entry.tileTaps++;
    }
    await page.screenshot({path:join(root,'qa/modules/input-twiddle-'+width+'.png')});
   }
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
