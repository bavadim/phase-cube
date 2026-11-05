/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openBrowser, root} from '../qa/modules/browser.mjs';

const directory = join(root, 'disc/qa');
const keys = ['kick', 'bass', 'hook'];
const browser = await openBrowser();
const report = {
  schema: 'music-gears-browser/1', engine: browser.engine, cases: [], errors: [], missing: [],
  physicalDevice: false, hardwareAudioLatencyVerified: false
};
let page;

function frame() {
  return page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function settled() {
  await frame();
  await page.waitForFunction(() => {
    const d = discTest.diagnostics();
    return !d.loading && !d.starting && !d.pending && !d.graphics.contextLost;
  });
}

async function load() {
  await page.goto(browser.url + '/disc/index.html?view=gears');
  await page.waitForFunction(() => window.discTest);
  await page.evaluate(() => discTest.ready);
  await settled();
  assert.equal(await page.evaluate(() => discTest.diagnostics().error), null);
}

const state = () => page.evaluate(() => discTest.state());
const checkGoal = () => page.evaluate(() => discTest.challenge());
const findPart = (state, key) => state.parts.find(part => part.key === key);

async function target(key, kind) {
  await settled();
  const location = await page.evaluate(({key, kind}) => {
    const at = discTest.locations().find(point => point.key === key && point.kind === kind);
    if (!at) return null;
    const hit = discTest.stage.pick(at.x, at.y);
    return {x: at.x, y: at.y, hit: [hit?.key, hit?.kind], front: document.elementFromPoint(at.x, at.y)?.tagName};
  }, {key, kind});
  assert.ok(location, 'Missing model control ' + key + '/' + kind);
  assert.deepEqual(location.hit, [key, kind]);
  assert.equal(location.front, 'CANVAS');
  return {x: location.x, y: location.y};
}

async function select(key, touch) {
  const at = await target(key, 'phase');
  const previous = await state();
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await page.waitForFunction(key => discTest.diagnostics().selected === key, key);
  assert.deepEqual(await state(), previous, 'Selection must preserve music');
}

async function phasePath(key, turns) {
  return page.evaluate(({key, turns}) => {
    const steps = 128;
    const path = discTest.ringPath(key, steps);
    const first = path.slice(0, steps).findIndex(point => {
      const hit = discTest.stage.pick(point.x, point.y);
      return hit?.key === key && hit?.kind === 'phase';
    });
    if (first < 0) throw Error('No accessible position on phase ring ' + key);
    const count = Math.round(Math.abs(turns) * steps);
    const sign = Math.sign(turns);
    return Array.from({length: count + 1}, (_, n) => path[(first + n * sign + steps) % steps]);
  }, {key, turns});
}

function gainPath(start, distance) {
  return Array.from({length: 13}, (_, i) => ({x: start.x, y: start.y - distance * i / 12}));
}

async function drag(context, path, touch, finish = 'commit') {
  const cdp = touch ? await context.newCDPSession(page) : null;
  const before = await state();
  const [start, ...rest] = path;
  try {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{id: 0, ...start}]});
    else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
    }
    for (const point of rest) {
      if (cdp) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{id: 0, ...point}]});
      else await page.mouse.move(point.x, point.y);
    }
    await page.waitForFunction(() => discTest.diagnostics().preview, null, {timeout: 3000});
    assert.deepEqual(await state(), before, 'Auditioning must leave committed settings intact until release');
    const handle = await page.evaluate(() => {
      const view = discTest.view();
      const wheel = view.wheels.find(w => w.key === view.selected);
      const turns = wheel.direction * (view.position - wheel.control.phase * view.periodBars) / wheel.periodBars;
      return {indexError: Math.abs(wheel.indexTurns - turns), control: wheel.control, key: wheel.key, kind: view.dragging};
    });
    assert.ok(handle.indexError < 1e-8, 'Calibration handle must track the current gesture');
    assert.notEqual(handle.control[handle.kind], findPart(before,handle.key)[handle.kind]);
    if (finish === 'context-loss') {
      await page.evaluate(() => {
        const stage = discTest.stage;
        const probe = new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial());
        probe.material.customProgramCacheKey = () => 'loss-during-first-material-frame';
        stage.active.scene.add(probe);
        try {
          stage.renderer.forceContextLoss();
          // The context is already unusable, but the DOM notification is a later task.
          // Demand a real render in that window with one yet-to-be-compiled material.
          stage.dirty = true;
          stage.frame(performance.now());
        } finally {
          stage.active.scene.remove(probe);
          probe.geometry.dispose();
          probe.material.dispose();
        }
      });
      await page.waitForFunction(() => discTest.stage.contextLost);
      assert.equal(await page.evaluate(() => discTest.diagnostics().preview), false);
    }
    if (cdp) await cdp.send('Input.dispatchTouchEvent', {type: finish === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: []});
    else await page.mouse.up();
    if (finish === 'context-loss') {
      await page.evaluate(() => discTest.stage.renderer.forceContextRestore());
      await page.waitForFunction(() => !discTest.stage.contextLost);
    }
    await settled();
    assert.equal(await page.evaluate(() => discTest.stage.pointer.gesture), null);
  } finally {
    if (cdp) await cdp.detach();
  }
}

async function button(id, touch) {
  const locator = page.locator('#' + id);
  if (touch) await locator.tap();
  else await locator.click();
  await settled();
}

async function checkLayout(touch) {
  const result = await page.evaluate(() => {
    const view = discTest.view();
    const stage = discTest.stage;
    const project = point => stage.project(new THREE.Vector3(...point));
    const rect = stage.canvas.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      canvas: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      wheels: view.wheels.map(wheel => {
        const path = wheel.key === 'drive' ? [] : discTest.ringPath(wheel.key, 48);
        const span = axis => Math.max(...path.map(pt => pt[axis])) - Math.min(...path.map(pt => pt[axis]));
        return {
          key: wheel.key, teeth: wheel.teeth, direction: wheel.direction, periodBars: wheel.periodBars,
          center: project(wheel.center), reader: wheel.reader && project(wheel.reader),
          phaseRingPx: path.length ? [span('x'), span('y')].map(Math.round) : null
        };
      })
    };
  });
  assert.equal(result.overflow, false);
  const wheels = result.wheels;
  assert.equal(wheels.length, 4, 'Driver and three musical wheels');
  const handle = await target('kick','gain');
  result.kickGainHandle = await page.evaluate(at => {
    const stage = discTest.stage;
    const canGrab = (x, y) => {
      const hit = stage.pick(x, y);
      return document.elementFromPoint(x, y) === stage.canvas && hit?.key === 'kick' && hit.kind === 'gain';
    };
    const missed = [];
    for (const dx of [-34,-17,0,17,34]) {
      for (const dy of [-21,-10,0,10,21]) {
        if (!canGrab(at.x+dx, at.y+dy)) missed.push({dx,dy});
      }
    }
    return {center:at,testedWidthPx:68,testedHeightPx:42,points:25,missed};
  }, handle);
  assert.deepEqual(result.kickGainHandle.missed, [], 'The full drum gain handle must be reachable');
  for (const key of keys) {
    const wheel = wheels.find(wheel => wheel.key === key);
    assert.ok(wheel.reader, key + ' needs a reader');
    assert.ok(wheel.reader.y > wheel.center.y + 1, key + ' reader should be below center');
    assert.ok(Math.abs(wheel.reader.x - wheel.center.x) < 1, key + ' reader should be centered');
    for (const kind of ['phase', 'gain']) await target(key, kind);
    await select(key, touch);
  }
  return result;
}

async function checkAdjustment(context, touch) {
  const before = await state();
  const frozen = await page.evaluate(() => discTest.view().wheels.map(w => [w.key,w.meshTurns]));
  const direction = await page.evaluate(() => discTest.view().wheels.find(w => w.key === 'bass').direction);
  await drag(context, await phasePath('bass', 1/8), touch);
  const shifted = await state();
  assert.equal(findPart(shifted,'bass').phase, (1 + findPart(before,'bass').phase - direction / 8) % 1);
  assert.deepEqual(frozen, await page.evaluate(() => discTest.view().wheels.map(w => [w.key,w.meshTurns])),
    'Reorienting the note sleeve cannot disengage any moving tooth');
  await button('undo', touch);
  assert.deepEqual(await state(), before);

  const gain = findPart(before,'bass').gain;
  const distance = gain >= 1 ? -85 : 85;
  const oldHeight = await page.evaluate(() => discTest.view().wheels.find(w => w.key === 'bass').center[1]);
  await drag(context, gainPath(await target('bass','gain'), distance), touch);
  const adjusted = await state();
  assert.notEqual(findPart(adjusted,'bass').gain, gain);
  assert.equal((findPart(adjusted,'bass').gain * 2) % 1, 0);
  assert.notEqual(await page.evaluate(() => discTest.view().wheels.find(w => w.key === 'bass').center[1]), oldHeight);
  for (const key of ['kick','hook']) assert.deepEqual(findPart(adjusted,key), findPart(before,key));
  await button('undo', touch);
  assert.deepEqual(await state(), before);
  await drag(context, gainPath(await target('bass','gain'), distance), touch, touch ? 'cancel' : 'context-loss');
  assert.deepEqual(await state(), before);

  // The small drum gear is the most demanding touch target in portrait.
  await drag(context, await phasePath('kick', 3/8), touch);
  assert.notEqual(findPart(await state(),'kick').phase, findPart(before,'kick').phase);
  await button('undo',touch);
  const gainDistance = findPart(before,'kick').gain >= 1 ? -85 : 85;
  const handle = await target('kick','gain');
  // A fingertip lands near the corner of the protruding grip, not its exact center.
  await drag(context, gainPath({x:handle.x+28,y:handle.y+15}, gainDistance), touch);
  assert.notEqual(findPart(await state(),'kick').gain, findPart(before,'kick').gain);
  await button('undo',touch);
  assert.deepEqual(await state(), before);
}

async function checkPlayback(touch) {
  await button('play', touch);
  await page.waitForFunction(() => discTest.diagnostics().rms > .0001);
  const evidence = await page.evaluate(async () => {
    const dist = (a, b) => Math.abs((((a - b + .5) % 1) + 1) % 1 - .5);
    const baseline = discTest.view();
    let maxAngleError = 0, maxSpeedError = 0, maxClockLagMs = 0, markers = 0;
    let readerErrors = 0;
    const readerFlashes = {kick:0, bass:0, hook:0};
    for (let sample = 0; sample < 75; sample++) {
      await new Promise(requestAnimationFrame);
      const view = discTest.view(), clock = discTest.clock(), rows = discTest.rows();
      maxClockLagMs = Math.max(maxClockLagMs, 1000 * Math.abs(clock.position - discTest.transport.clock()) * clock.periodSeconds / clock.periodBars);
      for (const wheel of view.wheels) {
        const initial = baseline.wheels.find(w => w.key === wheel.key);
        const expectedTurns = initial.meshTurns + wheel.direction * (view.position - baseline.position) / wheel.periodBars;
        maxSpeedError = Math.max(maxSpeedError, dist(expectedTurns,wheel.meshTurns));
        if (!wheel.events?.length) continue;
        const nativeRow = rows[discTest.state().parts.findIndex(p => p.key === wheel.key)];
        const lit = nativeRow.some(note => {
          const elapsed = ((view.position / clock.periodBars - note.start) % 1 + 1) % 1;
          return note.audible && elapsed * clock.periodSeconds < Math.min(.1, note.duration * clock.periodSeconds);
        });
        if (wheel.active !== lit) readerErrors++;
        if (wheel.active) readerFlashes[wheel.key]++;
        const rendered = wheel.events.map(event => {
          const point = event.point;
          return {angle: Math.atan2(point[0] - wheel.center[0], point[2] - wheel.center[2]) / (2*Math.PI), pitch: event.pitch};
        });
        for (const event of nativeRow) {
          const expected = wheel.direction * (view.position - event.start * clock.periodBars) / wheel.periodBars;
          const matching = rendered.filter(mark => mark.pitch === event.pitch);
          if (!matching.length) throw Error('Missing pitch in ' + wheel.key + ': ' + event.pitch);
          maxAngleError = Math.max(maxAngleError, Math.min(...matching.map(mark => dist(mark.angle, expected))));
          markers++;
        }
      }
    }
    const clock = discTest.clock(), rows = discTest.rows().flat();
    const output = discTest.transport.log.filter(e => e.type === 'event' && e.revision === discTest.transport.active.id);
    const scheduleErrors = output.filter(e =>
      !rows.some(r => dist(r.start,e.cycle/clock.periodBars) < 1e-7 && r.value.s === e.sound && String(r.value.note) === String(e.note)) ||
      Math.abs(discTest.transport.timeAt(e.cycle) - e.targetAudio) > 1e-5
    );
    return {markers,maxAngleError,maxSpeedError,maxClockLagMs,readerErrors,readerFlashes,scheduledEvents:output.length,scheduleErrors};
  });
  assert.ok(evidence.markers > 0 && evidence.scheduledEvents > 0);
  assert.ok(evidence.maxAngleError < 1e-6, 'Visible notes and actual sound events differ: ' + JSON.stringify(evidence));
  assert.ok(evidence.maxSpeedError < 1e-7, 'Tooth speeds disagree with the gear ratio');
  assert.ok(evidence.maxClockLagMs < 150);
  assert.equal(evidence.readerErrors, 0);
  assert.ok(Object.values(evidence.readerFlashes).every(count => count > 0));
  assert.deepEqual(evidence.scheduleErrors, []);
  return evidence;
}

async function solve(context, touch) {
  const direction = await page.evaluate(() => discTest.view().wheels.find(w => w.key === 'bass').direction);
  await page.evaluate(direction => {
    for (const part of discTest.state().parts) discTest.change(part.key, {phase:part.key === 'bass' ? direction/8 : 0,gain:1});
  }, direction);
  await settled();
  assert.equal((await checkGoal()).solved, false);
  await drag(context, await phasePath('bass',1/8), touch);
  assert.equal((await checkGoal()).solved, true, 'Final orientation gesture should solve the ensemble');
  assert.equal(await page.locator('#gear-progress').getAttribute('aria-live'), 'polite');
  assert.match(await page.locator('#gear-progress').innerText(), /три партии настроены/);
  assert.equal(await page.evaluate(() => discTest.diagnostics().playing), true);
  await button('undo', touch);
  assert.equal((await checkGoal()).solved, false);
  assert.match(await page.locator('#gear-progress').innerText(), /2 из 3/);
  await page.evaluate(() => {discTest.change('bass',{phase:0});discTest.change('kick',{phase:1/16});});
  await settled();
  assert.equal((await checkGoal()).solved, true, 'Kick equivalent orientation repeats every quarter note');
  await page.evaluate(() => discTest.change('bass',{phase:1/4}));
  await settled();
  assert.equal((await checkGoal()).solved, false, 'The bass changes pitches between similar rhythmic bars');
  await button('open-library',touch);
  assert.equal(await page.locator('#library').evaluate(element => element.open), true);
  await button('new-setup',touch);
  assert.equal(await page.locator('#library').evaluate(element => element.open), false);
  assert.equal((await checkGoal()).matched, 0);
}

await mkdir(directory,{recursive:true});
try {
  for (const [width,height,touch] of [[1280,800,false],[390,844,true]]) {
    if (process.env.GEAR_TEST_WIDTH && Number(process.env.GEAR_TEST_WIDTH) !== width) continue;
    const context = await browser.browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
    page = await context.newPage();
    page.on('pageerror',e => {
      const error = {width,message:e.message,stack:e.stack};
      report.errors.push(error);
      console.error('Browser error',error);
    });
    page.on('response',r => {if (r.status() >= 400) report.missing.push([r.status(),r.url()]);});
    await load();
    if (browser.engine === 'chromium') await page.evaluate(async () => {const ctx = strudel.getAudioContext();if(ctx.setSinkId)await ctx.setSinkId({type:'none'});});
    assert.equal((await checkGoal()).solved,false);
    const screenshot = join(directory, 'gear-' + width + '.png');
    await page.screenshot({path: screenshot});
    const layout = await checkLayout(touch);
    await checkAdjustment(context,touch);
    const synchronization = await checkPlayback(touch);
    await page.screenshot({path: screenshot});
    await solve(context,touch);
    report.cases.push({width,height,input:touch?'native CDP touch':'mouse',layout,synchronization,solvedByDrag:true,undo:true,interruptedEdit:touch?'touchCancel':'WebGL context loss'});
    console.log('PASS',width,JSON.stringify(synchronization));
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
  report.status = 'PASS';
} catch (e) {
  report.status = 'FAIL'; report.failure = e.stack;
  try {
    report.last = await page.evaluate(() => ({state:discTest.state(),challenge:discTest.challenge?.(),view:discTest.view()}));
    await page.screenshot({path:join(directory,'gear-failure.png')});
  } catch {}
  throw e;
} finally {
  await writeFile(join(directory,'gear-'+(process.env.GEAR_TEST_WIDTH||'all')+'-report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
