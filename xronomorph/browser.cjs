/* SPDX-License-Identifier: AGPL-3.0-or-later */
const assert=require('node:assert/strict'),{mkdirSync,writeFileSync,readFileSync}=require('node:fs'),{join}=require('node:path'),{createHash}=require('node:crypto');
(async()=>{
 const {openBrowser,root}=await import('../qa/modules/browser.mjs'),r=await openBrowser();
 const output=join(root,'xronomorph/qa');mkdirSync(output,{recursive:true});
 const report={schema:'xronomorph-browser/1',engine:r.engine,physicalDevice:false,audioOutput:'native-null-sink',cases:[],errors:[]};
 let page;
 try{
  for(const [width,height] of [[1280,900],[390,844],[844,390]]){
   const context=await r.browser.newContext({viewport:{width,height},hasTouch:width!==1280,isMobile:width!==1280});page=await context.newPage();page.setDefaultTimeout(12000);
   page.on('pageerror',e=>report.errors.push(e.message));await page.goto(r.url+'/xronomorph/index.html');
   await page.waitForFunction(()=>window.xronoLab);await page.waitForTimeout(100);
   const rows=()=>page.evaluate(()=>xronoLab.rows());
   const before=await rows();assert.equal(before.length,3);assert(Math.abs(await page.evaluate(()=>XronoModel.balance(xronoLab.rows().flatMap(p=>p.points)))-1)<1e-10);
   const locator=page.locator('[data-event="0:0"] circle').nth(1),b=await locator.boundingBox();
   const target=await page.evaluate(()=>{const s=document.querySelector('#diagram'),b=s.getBoundingClientRect(),v=xronoLab.view;return{x:b.x+v.cx+v.radius,y:b.y+v.cy};});
   const touch=width!==1280,cdp=touch&&r.engine==='chromium'?await context.newCDPSession(page):null;
   const start={x:b.x+b.width/2,y:b.y+b.height/2};
   if(cdp){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...start}]});
    for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:start.x+(target.x-start.x)*step/8,y:start.y+(target.y-start.y)*step/8}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:8});await page.mouse.up();}
   const after=await rows();assert(Math.abs(after[0].phase-.25)<.003);assert.deepEqual(after.slice(1),before.slice(1));
   await page.selectOption('#shape','irregular-4');assert.equal((await rows())[0].points.length,8);assert(Math.abs(await page.evaluate(()=>XronoModel.balance(xronoLab.rows()[0].points))-1)<1e-10);
   // Fractional free rotation is preserved: no hidden quantization to 1/8.
   await page.evaluate(()=>{const s=xronoLab.state();s.pb[0].phase=.13729;xronoLab.set(s);});
   await page.locator('#phase').focus();await page.locator('#phase').press('ArrowRight');
   const fractional=await page.evaluate(()=>xronoLab.state().pb[0].phase);assert(Math.abs(fractional*8-Math.round(fractional*8))>.01);
   await page.locator('[data-mode="wf"]').click();assert.equal((await rows()).length,6);
   const wfBefore=await rows();await page.locator('#ratio-number').fill('1.5');await page.locator('#ratio-number').press('Tab');
   assert.equal(await page.evaluate(()=>xronoLab.state().wf.ratio),1.5);assert.notDeepEqual(await rows(),wfBefore);
   await page.locator('[data-ratio="phi"]').click();await page.locator('#layers .layer-row button').nth(2).click();
   await page.locator('#complement').check();const complementary=await rows();assert(complementary[2].points.length<complementary[2].allPoints.length);
   await page.locator('#reverse').check();const reversed=await rows();assert.deepEqual(reversed.slice(0,2),complementary.slice(0,2));assert.notDeepEqual(reversed[2].allPoints,complementary[2].allPoints);
   // One shared phase leaves all hierarchy intervals intact.
   await page.evaluate(()=>{const s=xronoLab.state();s.wf.phase=.23;xronoLab.set(s);});
   const shifted=await rows();assert(Math.abs(shifted[0].points[0]-.23)<1e-9);
   await page.reload();await page.waitForFunction(()=>window.xronoLab);assert.equal(await page.evaluate(()=>xronoLab.state().wf.phase),.23);
   if(r.engine==='chromium')await page.evaluate(()=>strudel.getAudioContext().setSinkId({type:'none'}));
   await page.locator('#play').click();await page.waitForFunction(()=>xronoLab.audio.running||document.querySelector('#error').textContent);assert(await page.evaluate(()=>xronoLab.audio.running));
   await page.waitForFunction(()=>{window.__xronoPeakRms=Math.max(window.__xronoPeakRms||0,xronoLab.audio.rms());return xronoLab.audio.events.length>3&&window.__xronoPeakRms>.00005;});
   const clock=await page.evaluate(()=>xronoLab.audio.clock());
   await page.locator('#ratio-number').fill('1.7');await page.locator('#ratio-number').press('Tab');
   await page.waitForTimeout(120);assert((await page.evaluate(()=>xronoLab.audio.clock()))>clock,'editing must not reset transport');
   const pcm=await page.evaluate(()=>({observedPeakRms:window.__xronoPeakRms,events:xronoLab.audio.events.length}));
   await page.locator('#play').click();assert.equal(await page.evaluate(()=>xronoLab.audio.running),false);
   await page.waitForTimeout(1100);
   const silent=await page.evaluate(()=>xronoLab.audio.rms());assert(silent<.0001,'stop must silence retained voices');
   assert.equal(await page.evaluate(()=>Object.keys(strudel.getSuperdoughAudioController().nodes).filter(k=>+k>=2000).length),0,'stopped sessions must release cached mixer buses');
   const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,field:document.querySelector('#diagram').getBoundingClientRect().width}));assert(layout.width<=width);assert(layout.viewport<=width);
   await page.screenshot({path:join(output,r.engine+'-'+width+'.png'),fullPage:true});
   report.cases.push({width,height,input:cdp?'native CDP touch':'mouse',independentRotation:true,irregular:true,continuousPhase:fractional,wfHierarchy:true,complement:true,reverse:true,persistence:true,nativePCM:pcm,editingPreservesClock:true,stopRms:silent,layout});
   await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;try{await page.screenshot({path:join(output,'failure.png'),fullPage:true});report.debug=await page.evaluate(()=>({state:xronoLab.state(),running:xronoLab.audio.running,starting:xronoLab.audio.starting,context:strudel.getAudioContext().state,error:document.querySelector('#error').textContent,stack:xronoLab.audio.error?.stack,sound:strudel.getSound('xrono_kick'),events:xronoLab.audio.events.slice(-8)}));}catch{}throw e;}
 finally{report.sourceSha256=Object.fromEntries(['model.js','transport.js','view.js','app.js','index.html','style.css'].map(f=>[f,createHash('sha256').update(readFileSync(join(root,'xronomorph',f))).digest('hex')]));writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
