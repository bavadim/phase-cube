/* SPDX-License-Identifier: AGPL-3.0-or-later */
const assert=require('node:assert/strict'),fs=require('node:fs'),{join}=require('node:path'),{createHash}=require('node:crypto');
(async()=>{
 const {openBrowser,root}=await import('../qa/modules/browser.mjs'),r=await openBrowser();
 const output=join(root,'xronomorph/qa');fs.mkdirSync(output,{recursive:true});
 const report={schema:'rhythm-tree-browser/1',engine:r.engine,physicalDevice:false,audioOutput:'native-null-sink',cases:[],errors:[]};let page;
 try{
  for(const [width,height]of [[1280,900],[390,844],[844,390],[320,740]]){
   const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(r.url+'/xronomorph/index.html?mode=tree');await page.waitForFunction(()=>window.xronoLab);
   const targets=kind=>page.locator(`[data-tree-kind="${kind}"]`),target=(kind,key)=>page.locator(`[data-tree-kind="${kind}"][data-tree-key="${key}"]`);
   const count=()=>page.evaluate(()=>XronoModel.score(xronoLab.state()).length),snapshot=()=>page.evaluate(()=>xronoLab.state().tree);
   const click=async locator=>{await locator.scrollIntoViewIfNeeded();await locator[touch?'tap':'click']();};
   assert.equal(await count(),4);assert.equal(await targets('split').count(),4);assert.equal(await targets('merge').count(),0);
   assert.equal(await page.evaluate(()=>xronoLab.state().selected),1);assert(await page.locator('.selected-editor').isHidden());
   await click(target('split','0'));assert.equal(await count(),5);assert.equal(await targets('merge').count(),1);
   let score=await page.evaluate(()=>XronoModel.score(xronoLab.state()));assert(score.some(e=>e.start===.125&&e.part===1));
   const beforePaint=score.map(e=>e.start).sort();await click(page.locator('#layers .layer-row button').nth(3));await click(target('paint','0R'));
   score=await page.evaluate(()=>XronoModel.score(xronoLab.state()));assert.equal(score.length,5);assert.deepEqual(score.map(e=>e.start).sort(),beforePaint);assert(score.some(e=>e.start===.125&&e.part===3));
   await click(target('split','0R'));assert.equal(await count(),6);const beforeMerge=await snapshot();
   await click(target('merge','0'));assert.equal(await count(),4);await click(page.locator('#tree-undo'));assert.deepEqual(await snapshot(),beforeMerge);
   // Keyboard triggers the same command and retains a useful focused control.
   await target('split','1').focus();await target('split','1').press('Enter');assert.equal(await count(),7);
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.treeKey),'1');
   // Dragging/canceling an affordance must not accidentally edit the rhythm.
   const old=await snapshot(),b=await target('split','2').boundingBox();
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+35,b.y+b.height/2+25,{steps:4});await page.mouse.up();assert.deepEqual(await snapshot(),old);
   await page.reload();await page.waitForFunction(()=>window.xronoLab);assert.deepEqual(await snapshot(),old);assert.equal(await count(),7);assert.equal(await page.evaluate(()=>xronoLab.state().selected),3);
   // Fill to the supported limit through the real controls. All targets must
   // remain reachable in dense states, including on the smallest viewport.
   while(await targets('split').count())await click(targets('split').first());assert.equal(await count(),16);
   await click(page.locator('#layers .layer-row button').nth(2));
   for(const key of ['0LL','0LR','0RL','0RR','3RR'])await click(target('paint',key));
   assert.equal(await page.evaluate(()=>xronoLab.rows()[2].points.length),5);
   await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:join(output,'tree-'+r.engine+'-'+width+'.png'),fullPage:true});
   const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,field:document.querySelector('#diagram').getBoundingClientRect().width}));assert(layout.viewport<=width);assert(layout.scrollWidth<=width);
   if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
   await click(page.locator('#play'));await page.waitForFunction(()=>xronoLab.audio.running||document.querySelector('#error').textContent);assert(await page.evaluate(()=>xronoLab.audio.running));
   await page.waitForFunction(()=>{window.__treeRms=Math.max(window.__treeRms||0,xronoLab.audio.rms());return window.__treeRms>.0001&&xronoLab.audio.events.length>8;});
   const nativeCount=await page.evaluate(()=>xronoLab.audio.current.queryArc(0,1).filter(h=>h.hasOnset()).length);assert.equal(nativeCount,16);
   const beforeClock=await page.evaluate(()=>xronoLab.audio.clock());await click(target('merge','2'));await page.waitForTimeout(100);assert((await page.evaluate(()=>xronoLab.audio.clock()))>beforeClock);
   assert.equal(await page.evaluate(()=>xronoLab.audio.current.queryArc(0,1).filter(h=>h.hasOnset()).length),13);
   const pcm=await page.evaluate(()=>({rmsPeak:window.__treeRms,events:xronoLab.audio.events.length}));await click(page.locator('#play'));assert(!await page.evaluate(()=>xronoLab.audio.running));
   await click(page.locator('#tree-reset'));assert.equal(await count(),4);assert.equal(await targets('merge').count(),0);
   report.cases.push({width,height,input:touch?'native touch taps':'mouse',splitAddsOnset:true,paintTransfersOnset:true,mergeCollapsesBranch:true,undoRestoresSubtree:true,keyboard:true,gestureSlop:true,persistence:true,denseTargets:true,maxOnsets:16,nativeEvents:nativeCount,editingPreservesClock:true,nativePCM:pcm,layout});
   await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(output,'tree-failure.png'),fullPage:true});report.debug=await page.evaluate(()=>({state:xronoLab.state(),error:document.querySelector('#error').textContent,playing:xronoLab.audio.running,stack:xronoLab.audio.error?.stack}));}catch{}throw e;}
 finally{report.sourceSha256=Object.fromEntries(['tree.js','model.js','transport.js','view.js','app.js','index.html','style.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(join(root,'xronomorph',f))).digest('hex')]));fs.writeFileSync(join(output,'tree-report.json'),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
