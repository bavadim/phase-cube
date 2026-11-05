/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {openBrowser} from '../../qa/modules/browser.mjs';

const session=await openBrowser();
try {
  const page=await session.browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const station=id=>page.locator('[data-station="'+id+'"]');
  const face=key=>page.locator('[data-face-key="'+key+'"]');
  const state=()=>page.evaluate(()=>IsoBench.inspect().state);
  async function checkUnlabelledBoard() {
    const printed=await page.locator('#board').evaluate(board=>board.innerText);
    assert.doesNotMatch(printed,/[\p{L}\p{N}]/u,'mechanisms use shapes and programme marks');
    assert.equal(await page.locator('footer.bench-foot:visible').count(),0);
  }
  async function atFollower(i) {
    await page.waitForFunction(index=>document.querySelector('[data-face-key="step-'+index+'"]')?.dataset.atReader==='true',i);
  }
  const waitView=id=>page.waitForFunction(expected=>{
    const geometry=window.IsoBench?.inspect().geometry;
    return geometry?.webgl && !geometry.contextLost && !geometry.settling && geometry.focus===expected;
  },id,{polling:100});
  async function back() {
    await page.locator('#back-to-table').tap();
    await waitView(null);
  }

  await page.goto(session.url+'/disc/isometric/index.html');
  await page.locator('#play:enabled').waitFor();
  await waitView(null);
  const initial=await state();
  await checkUnlabelledBoard();
  const overviewZoom=await page.evaluate(()=>IsoBench.inspect().geometry.zoom);

  await station('router').tap();
  await waitView('router');
  assert.ok(await page.evaluate(()=>IsoBench.inspect().geometry.zoom)>overviewZoom);
  await checkUnlabelledBoard();
  await face('step-0').tap();
  assert.deepEqual(await state(),initial,'first touch of initial sector must inspect it');
  await face('step-2').tap();
  await atFollower(2);
  assert.deepEqual(await state(),initial,'picking a cam sector must not change its profile');
  assert.equal(await page.evaluate(()=>IsoBench.inspect().previewStep),2);
  const branch=await page.evaluate(()=>IsoBench.inspect().geometry.selectedBranch);
  assert.equal(branch,initial.routes[2]?'router:straight':'router:side');
  await face('lever').tap();
  const flipped=await state();
  assert.deepEqual(flipped.routes,initial.routes.map((v,i)=>i===2?!v:v),'touch click must flip once');
  await page.locator('#undo').tap();
  assert.deepEqual(await state(),initial);
  await face('step-5').tap();
  await atFollower(5);
  await face('step-5').tap();
  assert.deepEqual((await state()).routes,initial.routes.map((v,i)=>i===5?!v:v),'a second tap of the indexed cam sector toggles only it');
  await page.locator('#undo').tap();
  assert.deepEqual(await state(),initial);
  await back();

  await page.locator('#preset').selectOption('straight');
  await waitView(null);
  await station('source').tap();
  await waitView('source');
  const before=await state();
  // The eighth pin is adjacent to the outlet; its centre must still select a note.
  await face('pin-7').tap();
  assert.notEqual((await state()).source.notes[7],before.source.notes[7]);
  await face('phase-up').tap();
  assert.equal((await state()).source.phase,(before.source.phase+1)%8);
  await face('level-down').tap();
  assert.ok((await state()).source.level<before.source.level);
  await face('port-source:out').tap();
  await waitView(null);
  await station('bell').tap();
  assert.equal((await state()).links['source:out'],'bell');
  assert.equal(await page.evaluate(()=>IsoBench.inspect().patch),null);
  await page.locator('#undo').tap();
  await waitView('source');

  await face('port-source:out').focus();
  await page.keyboard.press('Enter');
  await waitView(null);
  assert.equal(await page.evaluate(()=>IsoBench.inspect().patch),'source:out');
  await page.keyboard.press('Escape');
  await waitView('source');
  await page.keyboard.press('Escape');
  await waitView(null);

  await station('delay').tap();
  await waitView('delay');
  await face('delay-4').tap();
  await page.locator('#mount-part').tap();
  await waitView(null);
  // Use a real projected point on the cable between the source and the keys.
  const point=await page.evaluate(()=>{
    const points=IsoBench.inspect().geometry.beltPoints['source:out'];
    return points[Math.floor(points.length/2)];
  });
  await page.touchscreen.tap(point.x,point.y);
  assert.deepEqual((await state()).links,{'source:out':'delay','delay:out':'keys'});
  await page.reload();
  await page.locator('#play:enabled').waitFor();
  await waitView(null);
  assert.equal((await state()).delay,4);
  assert.deepEqual((await state()).links,{'source:out':'delay','delay:out':'keys'});
  assert.deepEqual(errors,[]);
  console.log('PASS: cam indexing, slide gate and one-sector edits; unlabelled models, touch wiring, insertion, sound settings, undo, save and keyboard exit.');
} finally {
  await session.close();
}
