/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {openBrowser} from '../../qa/modules/browser.mjs';

const session=await openBrowser();
try{
  const page=await session.browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(session.url+'/disc/isometric/index.html');
  await page.locator('#play:enabled').waitFor();
  const state=()=>page.evaluate(()=>IsoBench.inspect().state);
  const station=id=>page.locator('[data-station="'+id+'"]');
  const step=page.locator('[data-key="step-2"]');
  const initial=await state();
  await step.tap();
  assert.equal((await state()).routes[2],!initial.routes[2]);
  assert.equal(await step.getAttribute('data-chosen'),'true');
  assert.deepEqual((await state()).source,initial.source);
  await page.locator('#undo').tap();
  assert.deepEqual(await state(),initial);

  // A physical tap generates pointerup and click on mobile. Editing a route,
  // selecting a new part and wiring each consume exactly one activation.
  await page.locator('#preset').selectOption('straight');
  await page.locator('#settings summary').tap();
  await page.locator('[data-key="wire-source:out"]').tap();
  await station('bell').tap();
  assert.equal((await state()).links['source:out'],'bell');
  assert.equal(await page.evaluate(()=>IsoBench.inspect().patch),null);
  await page.locator('#undo').tap();

  await station('delay').tap();
  await page.locator('[data-key="mount"]').tap();
  await page.locator('[data-key="insert-source:out"]').tap();
  const built=await state();
  assert.deepEqual(built.links,{'source:out':'delay','delay:out':'keys'});
  await page.locator('[data-key="delay-4"]').tap();
  assert.equal((await state()).delay,4);
  await page.reload();await page.locator('#play:enabled').waitFor();
  assert.equal((await state()).delay,4);
  assert.deepEqual((await state()).links,built.links);

  await page.locator('#part').selectOption('source');
  await page.locator('#settings summary').click();
  await page.locator('[data-key="wire-source:out"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>IsoBench.inspect().patch),'source:out');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>IsoBench.inspect().patch),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile route pads, undo, touch wiring, insert, save, keyboard cancellation.');
}finally{await session.close();}
