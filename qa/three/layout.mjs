/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from '../modules/browser.mjs';
const runtime=await openBrowser(),report={status:'RUNNING',engine:runtime.engine,layouts:[],errors:[],physicalDevice:false};
const sizes=[[320,568],[375,667],[390,724],[390,844],[430,932],[568,320],[844,390],[1280,800],[1440,900],[1512,982],[1920,1080]];
try{
 const context=await runtime.browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(runtime.url+'/?debug=1');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
 for(const puzzleId of ['twiddle','rubik','fourier']){
  if(puzzleId!=='twiddle')await page.evaluate(id=>phaseCubeApp.choosePuzzle(id),puzzleId);
  await page.locator('#start').click();
  await page.waitForFunction(()=>phaseCubeApp.diagnostics().playing&&!phaseCubeApp.diagnostics().starting);
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(requestAnimationFrame));
   const layout=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    return{width:innerWidth,height:innerHeight,rootFont:parseFloat(getComputedStyle(document.documentElement).fontSize),
     flow:getComputedStyle(document.querySelector('.app')).display,direction:getComputedStyle(document.querySelector('.app')).flexDirection,document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
     header:rect('.game-status'),field:rect('.playfield'),board:rect('.orbital-workspace'),footer:rect('.controls-dock'),
     controls:[...document.querySelectorAll('.puzzle-action,#hint,#undo,#pause,#song-seek')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})};
   });
   const {header:h,board:b,footer:f,field}=layout;
   assert.equal(layout.flow,'flex');assert(layout.rootFont>=16);
   assert(layout.document[0]<=width+1&&layout.document[1]<=height+1,'Document overflow '+JSON.stringify(layout));
   if(layout.direction==='column'){
    assert(h.y+h.h<=b.y+1&&b.y+b.h<=f.y+1,'Status/board/controls overlap');
    assert(Math.abs((b.y-h.y-h.h)-(f.y-b.y-b.h))<=2,'Unequal vertical space');
   }else{
    assert(h.x+h.w<=b.x+1&&b.x+b.w<=f.x+1,'Side panels overlap the field');
    assert(Math.abs((b.x-h.x-h.w)-(f.x-b.x-b.w))<=2,'Unequal horizontal space');
   }
   assert(Math.abs(b.x+b.w/2-field.x-field.w/2)<=1,'Board is not horizontally centered');
   assert(Math.abs(b.w-Math.min(field.w,field.h))<=2,'Board does not use available space');
   for(const c of layout.controls)assert(c.x>=0&&c.y>=0&&c.x+c.w<=width+1&&c.y+c.h<=height+1&&c.w>=44&&c.h>=44,'Clipped or small control');
   assert.equal(await page.locator('#puzzle-stage canvas').count(),1);
   if(puzzleId!=='rubik'&&(width<=430||height<=520)){
    const targets=await page.evaluate(()=>phaseCubeApp.getPresentation().locations().map(t=>({w:Math.max(...t.region.map(p=>p.x))-Math.min(...t.region.map(p=>p.x)),h:Math.max(...t.region.map(p=>p.y))-Math.min(...t.region.map(p=>p.y))})));
    assert(targets.every(t=>t.w>=44&&t.h>=44),'Small touch region: '+JSON.stringify(targets));layout.tileTouchBounds=targets;
   }
   if([390,568,1440,1920].includes(width))await page.screenshot({path:join(root,`qa/three/${puzzleId}-${width}x${height}.png`)});
   await page.locator('#pause').click();
   const dialog=await page.locator('#session-overlay').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,scroll:e.scrollHeight-e.clientHeight};});
   assert(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.w<=width+1&&dialog.y+dialog.h<=height+1&&dialog.scroll<=1,'Start dialog clips content '+JSON.stringify(dialog));
   if(width===390||width===568)await page.screenshot({path:join(root,`qa/three/start-${width}x${height}.png`)});
   await page.locator('#start').click();await page.waitForFunction(()=>phaseCubeApp.diagnostics().playing&&!phaseCubeApp.diagnostics().starting);
   report.layouts.push({puzzleId,...layout});
  }
  await page.locator('#pause').click();
 }
 await context.close();assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
 await writeFile(join(root,'qa/three/layout-report.json'),JSON.stringify(report,null,2)+'\n');await runtime.close();console.log(JSON.stringify({status:report.status,layouts:report.layouts.length,failure:report.failure}));
}
