/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {openBrowser} from '../../qa/modules/browser.mjs';

const session=await openBrowser();
try{
  const page=await session.browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const entry=new URL(process.env.BIBA_BENCH_URL||session.url+'/disc/isometric/index.html');
  entry.searchParams.set('preset','hydraulic');
  await page.goto(entry.href);
  await page.locator('#play:enabled').waitFor();
  const face=key=>page.locator('[data-face-key="'+key+'"]');
  const port=key=>page.locator('[data-hose-port="'+key+'"]');
  const station=id=>page.locator('[data-station="'+id+'"]');
  const state=()=>page.evaluate(()=>IsoBench.inspect().state);
  const settle=id=>page.waitForFunction(id=>{
    const rig=IsoBench.inspect().geometry;
    return !rig.settling&&!rig.contextLost&&rig.focus===id;
  },id);
  async function open(id){await station(id).tap();await settle(id);}
  async function back(){await page.locator('#back-to-table').tap();await settle(null);}
  await settle(null);
  const initial=await state();
  assert.deepEqual(initial.source.notes[0],[60,64]);

  await open('source');
  await face('brush-67').tap();await face('pin-0').tap();
  assert.deepEqual((await state()).source.notes[0],[60,64,67]);
  assert.equal(await face('pin-0').getAttribute('data-tones'),'60,64,67');
  await page.locator('#undo').tap();
  assert.deepEqual(await state(),initial);
  await back();
  await page.locator('#play').tap();
  await page.waitForFunction(()=>document.querySelector('#mix-glass').dataset.pitches==='60,64,67');
  await page.locator('#play').tap();

  // Directly select a fitted outlet, detach it, then rejoin through its intake.
  await port('delay:out').tap();
  await page.getByRole('button',{name:'Снять шланг'}).tap();
  assert.equal((await state()).links['delay:out'],undefined);
  await port('delay:out').tap();await port('bell:in').tap();
  assert.deepEqual((await state()).links,initial.links);
  await open('copy');await face('test-copy').tap();
  assert.deepEqual((await state()).links,initial.links);
  await back();
  await open('delay');
  await face('delay-4').tap();
  assert.equal((await state()).delay,4);
  await face('test-delay').tap();
  await page.waitForFunction(()=>document.querySelector('#mix-glass').dataset.pitches==='60,64,67');
  await back();
  await page.reload();await page.locator('#play:enabled').waitFor();
  assert.equal((await state()).delay,4);
  assert.deepEqual(errors,[]);
  console.log('PASS: authored chords, audible mix from different branches, detach and reattach, test dose and the four-step delay.');
}finally{await session.close();}
