/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,targets,select} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'scratch-touch/1',engine:r.engine,physicalDevice:false,errors:[],cases:[]};
try{
  for(const [width,height]of [[390,844],[844,390]]){
    const context=await r.browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(r.url+'/?debug=1&puzzle=scratch');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);await page.locator('#start').tap();await settled(page);await select(page,'A',true);
    const cdp=r.engine==='chromium'?await context.newCDPSession(page):null;let last=null;
    async function touch(type,point){
      if(cdp){
        if(type==='touchMove')for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[{id:0,x:last.x+(point.x-last.x)*i/8,y:last.y+(point.y-last.y)*i/8}]});await page.waitForTimeout(16);}
        else await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{id:0,x:point.x,y:point.y}]});
      }else await page.evaluate(({type,point})=>{phaseCubeApp.getPresentation().canvas.dispatchEvent(new PointerEvent({touchStart:'pointerdown',touchMove:'pointermove',touchEnd:'pointerup',touchCancel:'pointercancel'}[type],{pointerId:714,pointerType:'touch',isPrimary:true,button:0,buttons:type==='touchEnd'||type==='touchCancel'?0:1,clientX:point?.x||0,clientY:point?.y||0,bubbles:true,cancelable:true}));},{type,point});
      last=type==='touchEnd'||type==='touchCancel'?null:point;
    }
    const origin=()=>targets(page).then(a=>a.find(p=>p.key==='A'&&p.kind==='point'));
    const before=await page.evaluate(()=>({state:phaseCubeApp.state(),history:phaseCubeApp.getPuzzle().history.length}));
    const destination=await page.evaluate(()=>{const m=phaseCubeApp.getPuzzle(),phase=m.parameters()[0].phase+.9,a=phase*Math.PI/2;return phaseCubeApp.getPresentation().project(new THREE.Vector3(-1.04+.25*Math.cos(a),-1.43+.25*Math.sin(a),.12));});
    await touch('touchStart',await origin());await touch('touchMove',destination);
    assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture.custom),true);
    assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);
    assert.equal(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast?.continuous),true);
    await touch('touchEnd',destination);await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),before.history+1);
    await page.locator('#undo').tap();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);
    await select(page,'A',true);await touch('touchStart',await origin());await touch('touchMove',destination);await touch('touchCancel',destination);
    assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),before.history);
    assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
    await touch('touchStart',await origin());await touch('touchMove',destination);await page.locator('#pause').evaluate(b=>b.click());await touch('touchEnd',destination);
    assert.equal(await page.evaluate(()=>phaseCubeApp.state()),before.state);assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
    await page.locator('#start').tap();await settled(page);await select(page,'A',true);
    await touch('touchStart',await origin());await touch('touchMove',destination);await page.evaluate(()=>phaseCubeApp.choosePuzzle('fourier'));await touch('touchEnd',destination);
    assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzleModule().id),'fourier');assert.equal(await page.evaluate(()=>phaseCubeApp.getPresentation().pointer.gesture),null);
    await page.evaluate(()=>phaseCubeApp.choosePuzzle('scratch'));assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().solved()),true);assert.equal(await page.locator('#puzzle-stage canvas').count(),1);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvas:phaseCubeApp.getPresentation().canvas.getBoundingClientRect().toJSON()}));assert(!layout.overflow);
    await page.screenshot({path:join(root,`qa/scratch/${r.engine}-touch-${width}.png`)});
    report.cases.push({width,height,input:cdp?'native CDP touch':'synthetic touch PointerEvents',commitUndo:true,cancel:true,pause:true,switch:true,layout});
    if(cdp)await cdp.detach();await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;throw error;}
finally{
  const files=['index.html','puzzles/scratch/model.js','puzzles/scratch/three-view.js','graphics/pointer.js','controls/puzzle.js'];report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(root,file))).digest('hex')])));
  await writeFile(join(root,`qa/scratch/${r.engine}-touch-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,cases:report.cases,failure:report.failure}));
}
