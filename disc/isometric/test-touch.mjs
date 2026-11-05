/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {openBrowser} from '../../qa/modules/browser.mjs';

const session = await openBrowser();
try {
  const page = await session.browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(session.url+'/disc/isometric/index.html');
  await page.locator('#play:enabled').waitFor();
  await page.locator('#preset').selectOption('straight');
  const board = page.locator('#board');
  const outlet = board.locator('[data-port="source:out"]');
  const input = board.locator('[data-port="bell:in"]');

  // Chromium sends a zero-detail click after touch pointerup. A second
  // activation used to undo the selection before the next tap could connect.
  await outlet.tap();
  assert.equal(await outlet.getAttribute('aria-pressed'),'true');
  await input.tap();
  assert.equal(await page.evaluate(()=>IsoBench.inspect().state.links['source:out']),'bell');
  assert.equal(await outlet.getAttribute('aria-pressed'),'false');

  await outlet.focus();
  await page.keyboard.press('Enter');
  assert.equal(await outlet.getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await outlet.getAttribute('aria-pressed'),'false');
  console.log('PASS: touch wiring and keyboard activation.');
} finally {
  await session.close();
}
