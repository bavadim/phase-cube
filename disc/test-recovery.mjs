/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A real WebGL loss during a drag must cancel the gesture, preserve music and recover input. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openBrowser,root} from '../qa/modules/browser.mjs';
const run=await openBrowser(),out=join(root,'disc/qa');
try{
  const page=await run.browser.newPage({viewport:{width:1280,height:800}});
  await page.goto(run.url+'/disc/index.html');await page.waitForFunction(()=>window.discTest);await page.evaluate(()=>discTest.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForFunction(()=>!discTest.stage.contextLost);
  await page.evaluate(async()=>{const ctx=strudel.getAudioContext();if(ctx.setSinkId)await ctx.setSinkId({type:'none'});});
  await page.locator('#play').click();await page.waitForFunction(()=>discTest.diagnostics().rms>.0001);
  const before=await page.evaluate(()=>discTest.state());
  const at=await page.evaluate(()=>discTest.locations().find(p=>p.key==='bass'&&p.kind==='gain'));
  await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x,at.y-70,{steps:10});
  await page.waitForFunction(()=>discTest.diagnostics().preview);
  await page.evaluate(()=>discTest.stage.renderer.forceContextLoss());
  await page.waitForFunction(()=>discTest.stage.contextLost);
  assert.deepEqual(await page.evaluate(()=>discTest.state()),before);
  assert.equal(await page.evaluate(()=>discTest.diagnostics().preview),false);
  assert.equal(await page.evaluate(()=>discTest.stage.pointer.gesture),null);
  await page.mouse.up();
  await page.evaluate(()=>discTest.stage.renderer.forceContextRestore());
  await page.waitForFunction(()=>!discTest.stage.contextLost);
  const head=await page.evaluate(()=>discTest.locations().find(p=>p.key==='hook'&&p.kind==='toggle'));
  await page.mouse.click(head.x,head.y);await page.waitForFunction(()=>!discTest.state().parts.find(p=>p.key==='hook').installed);
  await page.locator('#undo').click();assert.deepEqual(await page.evaluate(()=>discTest.state()),before);
  await page.locator('#play').click();await page.waitForFunction(()=>discTest.diagnostics().playing&&discTest.diagnostics().rms>.0001);
  await page.locator('#play').click();
  const report={status:'PASS',realWebGLContextLoss:true,cancelledGesture:true,settingsPreserved:true,inputRecovered:true,audioRestarted:true};
  await mkdir(out,{recursive:true});await writeFile(join(out,'recovery-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await run.close();}
