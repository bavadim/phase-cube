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
  const port=key=>page.locator('[data-hose-port="'+key+'"]');
  const state=()=>page.evaluate(()=>IsoBench.inspect().state);
  const waitView=id=>page.waitForFunction(expected=>{
    const g=window.IsoBench?.inspect().geometry;
    return g&&!g.contextLost&&!g.settling&&g.focus===expected;
  },id);
  async function open(id){await station(id).tap();await waitView(id);}
  async function back(){await page.locator('#back-to-table').tap();await waitView(null);}
  async function bareModel(){
    assert.doesNotMatch(await page.locator('#board').innerText(),/[\p{L}\p{N}]/u);
    assert.equal(await page.locator('[data-face-key*="-up"],[data-face-key*="-down"],[data-face-key*="-value"],[data-face-key^="test-"],[data-face-key^="port-"]').count(),0);
    assert.equal(await page.locator('#workbench-menu').isVisible(),false);
  }
  const entry=new URL(process.env.BIBA_BENCH_URL||session.url+'/disc/isometric/index.html');
  entry.searchParams.set('preset','duet');
  await page.goto(entry.href);await page.locator('#play:enabled').waitFor();await waitView(null);
  const initial=await state();
  for(const id of ['copy','keys','bell','bin']){
    const box=await station(id).boundingBox();
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await page.evaluate(()=>IsoBench.inspect().selected),null);
  }
  await open('router');await bareModel();
  for(const viewport of [{width:320,height:660},{width:667,height:375},{width:390,height:844}]){
    await page.setViewportSize(viewport);await waitView('router');
    for(let index=0;index<5;index++){
      await face('program-'+index).tap();
      assert.equal(await page.evaluate(()=>IsoFlow.routePresetIndex(IsoBench.inspect().state)),index);
    }
  }
  await face('program-2').tap();
  assert.deepEqual((await state()).routes,[true,true,false,false,true,true,false,false]);
  await page.locator('#undo').tap();assert.deepEqual((await state()).routes,Array(8).fill(false));
  await back();await open('source');await bareModel();
  await face('brush-67').tap();await face('pin-0').tap();
  assert.deepEqual((await state()).source.notes[0],[60,67]);
  await face('brush-rest').tap();await face('pin-0').tap();
  assert.equal((await state()).source.notes[0],null);
  await page.locator('#undo').tap();
  await face('rim-0').focus();await page.keyboard.press('ArrowRight');
  assert.equal((await state()).source.phase,(initial.source.phase+1)%8);
  const knob=await face('lift').boundingBox(),point={x:knob.x+knob.width/2,y:knob.y+knob.height/2};
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-28}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
  assert.equal((await state()).source.level,initial.source.level+.5);
  await back();
  // Replugging the occupied router intake is one action and one undo.
  await port('copy:out').tap();await port('router:in').tap();
  assert.equal((await state()).links['copy:out'],'router');
  assert.equal((await state()).links['source:out'],undefined);
  await page.locator('#undo').tap();await waitView(null);
  assert.deepEqual((await state()).links,initial.links);
  await open('delay');await face('delay-4').tap();await bareModel();await back();
  const saved=await state();
  await page.reload();await page.locator('#play:enabled').waitFor();await waitView(null);
  assert.deepEqual(await state(),saved);
  await open('router');await page.keyboard.press('Escape');await waitView(null);
  assert.deepEqual(errors,[]);
  console.log('PASS: bare mechanical controls, five barrel programs, passive bodies, touch lift, chord editing, atomic replug with undo, persistence and keyboard exit.');
}finally{await session.close();}
