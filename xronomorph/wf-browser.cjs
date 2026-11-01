/* SPDX-License-Identifier: AGPL-3.0-or-later */
const assert=require('node:assert/strict'),fs=require('node:fs'),{join}=require('node:path'),{createHash}=require('node:crypto');
(async()=>{
 const {openBrowser,root}=await import('../qa/modules/browser.mjs'),r=await openBrowser(),output=join(root,'xronomorph/qa');
 const report={schema:'wf-direct-control/1',engine:r.engine,physicalDevice:false,audioOutput:'native-null-sink',cases:[],errors:[]};let page;
 try{
  for(const [width,height]of [[1280,900],[390,844],[844,390],[320,740]]){
   const touch=width!==1280,context=await r.browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(r.url+'/xronomorph/index.html');await page.waitForFunction(()=>window.xronoLab);assert.equal(await page.evaluate(()=>xronoLab.state().mode),'wf');assert(await page.locator('#phase-control').isHidden());assert(await page.locator('#snap-label').isHidden());
   const cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
   const pointer=async(start,end,cancel=false)=>{
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...start}]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}]});await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});}
    else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});if(cancel)await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();}
   };
   const dragRatio=async(ratio,cancel=false)=>{
    await page.locator('#diagram').scrollIntoViewIfNeeded();
    const points=await page.evaluate(ratio=>{const v=xronoLab.view,w=xronoLab.state().wf,h=XronoModel.wfBoundaries(w).find(h=>h.movable),next=XronoModel.wfBoundaries({...w,ratio})[h.index],b=v.svg.getBoundingClientRect(),p=v.point(h.time+w.phase),q=v.point(next.time+w.phase);return{start:{x:p.x+b.x,y:p.y+b.y},end:{x:q.x+b.x,y:q.y+b.y}};},ratio);
    await pointer(points.start,points.end,cancel);
   };
   const before=await page.evaluate(()=>xronoLab.state());await page.evaluate(()=>{window.__ratioUpdates=[];const v=xronoLab.view,apply=v.onRatio;v.onRatio=n=>{__ratioUpdates.push(n);apply(n);};});
   await dragRatio(2.4);let state=await page.evaluate(()=>xronoLab.state());assert(Math.abs(state.wf.ratio-2.4)<.015);assert.equal(state.wf.phase,before.wf.phase);assert.deepEqual(state.pb,before.pb);assert.deepEqual(state.tree,before.tree);
   const updates=await page.evaluate(()=>__ratioUpdates);assert(updates.length>4);assert(new Set(updates.map(n=>n.toFixed(4))).size>4);
   const anchor=await page.evaluate(()=>{const v=xronoLab.view,b=v.svg.getBoundingClientRect(),p=v.point(xronoLab.state().wf.phase),q=v.point(xronoLab.state().wf.phase+.08);return{start:{x:p.x+b.x,y:p.y+b.y},end:{x:q.x+b.x,y:q.y+b.y}};});
   await pointer(anchor.start,anchor.end);assert.equal(await page.evaluate(()=>xronoLab.state().wf.ratio),state.wf.ratio);assert.equal(await page.evaluate(()=>xronoLab.state().wf.phase),before.wf.phase);
   await dragRatio(1.2,true);assert(Math.abs((await page.evaluate(()=>xronoLab.state().wf.ratio))-state.wf.ratio)<1e-10,'cancel restores ratio');assert.equal(await page.evaluate(()=>xronoLab.view.drag),null);
   await page.locator('[data-wf-index="1"]').focus();await page.locator('[data-wf-index="1"]').press('ArrowRight');assert((await page.evaluate(()=>xronoLab.state().wf.ratio))>state.wf.ratio);assert.equal(await page.evaluate(()=>document.activeElement.dataset.wfIndex),'1');
   await page.evaluate(()=>{const s=xronoLab.state();s.wf.longs=3;s.wf.shorts=2;s.wf.reverse[0]=true;s.wf.phase=.6;s.wf.ratio=1.1;xronoLab.set(s);});
   await dragRatio(3.6);state=await page.evaluate(()=>xronoLab.state());assert(Math.abs(state.wf.ratio-3.6)<.04);assert.equal(state.wf.phase,.6);assert.deepEqual(state.wf.reverse,[true,false,false,false,false,false]);
   await page.reload();await page.waitForFunction(()=>window.xronoLab);assert(Math.abs((await page.evaluate(()=>xronoLab.state().wf.ratio))-state.wf.ratio)<1e-12);
   await page.evaluate(()=>{const s=xronoLab.state();s.wf.longs=1;s.wf.shorts=1;s.wf.reverse[0]=false;s.wf.phase=0;s.wf.ratio=1.7;xronoLab.set(s);});
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(150);await page.screenshot({path:join(output,'wf-drag-'+r.engine+'-'+width+'.png'),fullPage:true});
   if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));await page.locator('#play').click();await page.waitForFunction(()=>xronoLab.audio.running||document.querySelector('#error').textContent);assert(await page.evaluate(()=>xronoLab.audio.running));
   await page.waitForFunction(()=>{window.__wfRms=Math.max(window.__wfRms||0,xronoLab.audio.rms());return __wfRms>.0001;});
   const clock=await page.evaluate(()=>xronoLab.audio.clock());await dragRatio(1.8);assert((await page.evaluate(()=>xronoLab.audio.clock()))>clock);const native=await page.evaluate(()=>xronoLab.audio.current.queryArc(0,1).filter(h=>h.hasOnset()).map(h=>h.whole.begin.valueOf()).sort());
   const score=await page.evaluate(()=>XronoModel.score(xronoLab.state()).map(e=>e.start).sort());assert.equal(native.length,score.length);native.forEach((n,i)=>assert(Math.abs(n-score[i])<1e-8));
   await page.locator('[data-mode="pb"]').click();const base=await page.evaluate(()=>xronoLab.rows());const click=async l=>{await l.scrollIntoViewIfNeeded();await l[touch?'tap':'click']();};
   const split=key=>page.locator(`[data-pattern-kind="split"][data-pattern-key="${key}"]`),merge=key=>page.locator(`[data-pattern-kind="merge"][data-pattern-key="${key}"]`);
   await click(split('0'));assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),5);assert.deepEqual((await page.evaluate(()=>xronoLab.rows())).slice(1),base.slice(1));
   await click(split('0R'));assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),6);
   await page.locator('#diagram').scrollIntoViewIfNeeded();let points=await page.evaluate(()=>{const v=xronoLab.view,b=v.svg.getBoundingClientRect(),p=v.point(xronoLab.rows()[0].points[0]),q=v.point(xronoLab.rows()[0].points[0]+.12);return{start:{x:b.x+p.x,y:b.y+p.y},end:{x:b.x+q.x,y:b.y+q.y}};});await pointer(points.start,points.end);
   const rotated=await page.evaluate(()=>xronoLab.state().pb[0].phase);assert(Math.abs(rotated-.12)<.003);assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),6);assert.deepEqual((await page.evaluate(()=>xronoLab.rows())).slice(1),base.slice(1));
   await click(merge('0'));assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),4);await click(page.locator('#tree-undo'));assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),6);assert.equal(await page.evaluate(()=>xronoLab.state().pb[0].phase),rotated);
   assert.equal(await page.evaluate(()=>xronoLab.audio.current.queryArc(0,1).filter(h=>h.hasOnset()).length),14);
   await page.reload();await page.waitForFunction(()=>window.xronoLab);assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),6);assert.equal(await page.evaluate(()=>xronoLab.state().pb[0].phase),rotated);
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(150);await page.screenshot({path:join(output,'pb-divide-'+r.engine+'-'+width+'.png'),fullPage:true});
   await click(page.locator('#tree-reset'));assert.equal(await page.evaluate(()=>xronoLab.rows()[0].points.length),4);assert.equal(await page.evaluate(()=>xronoLab.state().pb[0].phase),rotated);
   const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(layout.viewport<=width);assert(layout.scrollWidth<=width);
   report.cases.push({width,height,input:cdp?'native CDP touch':'mouse',ratioFollowsPointer:true,continuousUpdates:updates.length,phaseAnchored:true,cancelRestoresState:true,keyboard:true,reversedMultiIntervalWord:true,persistence:true,nativeOnsets:score.length,editingPreservesClock:true,splitRotateMergeUndo:true,independentInstruments:true,layout});await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(output,'wf-drag-failure.png'),fullPage:true});report.debug=await page.evaluate(()=>({state:xronoLab.state(),drag:xronoLab.view.drag,error:document.querySelector('#error').textContent}));}catch{}throw e;}
 finally{report.sourceSha256=Object.fromEntries(['tree.js','model.js','transport.js','view.js','app.js','index.html','style.css'].map(f=>[f,createHash('sha256').update(fs.readFileSync(join(root,'xronomorph',f))).digest('hex')]));fs.writeFileSync(join(output,'wf-drag-report.json'),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
