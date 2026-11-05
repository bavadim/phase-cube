/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const play = document.getElementById('play');
  const undo = document.getElementById('undo');
  const host = document.getElementById('machine');
  const help = document.getElementById('help');
  const guide = document.getElementById('guide');
  const partSelect = document.getElementById('part-select');
  const notice = document.getElementById('notice');
  const playLabel = play.querySelector('span');
  const model = window.FactoryScore;
  const storageKey = 'biba.line.turkish-circuit.v1';
  const edits = [], paper = [];
  let line, scene, loadFailed = false;
  let frameId = 0, lastContact = -1, previousSound;

  function controls() {
    const wanted = Boolean(line?.wanted);
    play.setAttribute('aria-pressed', String(wanted));
    play.disabled = !line && !loadFailed;
    playLabel.textContent = loadFailed ? 'Повторить' : !line ? 'Загрузка…' : wanted ? 'Пауза' : 'Запустить';
    undo.disabled = !edits.length;
  }
  function showError(error) {
    notice.hidden = false;
    notice.textContent = error?.message || String(error);
    console.error(error);
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(line.score.snapshot())); }
    catch { /* The line also works with browser storage disabled. */ }
  }
  function render() {
    if (!scene || !line) return;
    const sounding = line.audible();
    const time = line.clock(), position = time * model.STEPS;
    const absoluteStep = Math.floor(position), step = absoluteStep % model.STEPS;
    const active = line.transport.active;
    const heard = line.playing && window.strudel.getAudioContext().currentTime >= active.audioBegin;
    if (heard && absoluteStep > lastContact) {
      // Catch up if a frame straddled the switch to a new audio revision.
      // Preroll can briefly report bar zero before the first scheduled attack.
      for (let i = Math.max(lastContact + 1, absoluteStep - 23); i <= absoluteStep; i++) {
        const state = i / model.STEPS < active.begin && previousSound ? previousSound : sounding;
        paper.push({...model.eventAt(state, i), absoluteStep:i});
      }
      if (paper.length > 24) paper.splice(0, paper.length - 24);
      lastContact = absoluteStep;
    }
    previousSound = sounding;
    scene.render({state:line.score.snapshot(), audibleState:sounding, model, playing:heard, gearMarks:line.score.gearMarks,
      step, phase:position - absoluteStep, time, history:paper});
  }
  function frame() {
    frameId = 0;
    render();
    if (line?.playing && !document.hidden) frameId = requestAnimationFrame(frame);
  }
  function startFrames() {
    if (!frameId) frame();
  }
  function stop() {
    if (!line) return;
    render();
    cancelAnimationFrame(frameId);
    frameId = 0;
    line.pause().catch(showError);
    render();
    controls();
  }
  function togglePlay() {
    if (loadFailed) { location.reload(); return; }
    if (!line) return;
    notice.hidden = true;
    if (line.wanted) { stop(); return; }
    line.start().then(startFrames).catch(showError);
    controls();
  }
  function refreshGuide() {
    if (!guide.open) return;
    const part = LineParts.parts[partSelect.value];
    for (const key of ['ports','gesture','cycle']) {
      document.getElementById('part-' + key).textContent = part[key];
    }
    document.getElementById('part-now').textContent = line ? part.now(line.score.snapshot()) : 'Загрузка сборки…';
  }
  for (const [id, part] of Object.entries(LineParts.parts)) partSelect.add(new Option(part.name, id));
  partSelect.value = 'clutch';
  partSelect.addEventListener('change', refreshGuide);
  guide.addEventListener('toggle', refreshGuide);
  document.getElementById('guide-open').addEventListener('click', () => {
    guide.open = true;
    refreshGuide();
    partSelect.focus({preventScroll:true});
    guide.scrollIntoView({block:'start'});
  });
  let inspected;
  function inspectControl(event) {
    if (event.type === 'pointermove' && (event.buttons || event.pointerType === 'touch')) return;
    const control = event.target.closest('[data-action]');
    if (control === inspected) return;
    inspected = control;
    const entry = LineParts.operations[control?.dataset.action];
    if (entry) help.textContent = entry[1];
  }
  host.addEventListener('pointermove', inspectControl);
  host.addEventListener('focusin', inspectControl);
  function act({type, index, delta = 1}) {
    if (!line) return;
    const before = line.score.snapshot();
    const entry = LineParts.operations[type];
    if (!entry) return;
    partSelect.value = entry[0];
    if (!line.edit(type, index, delta)) {
      help.textContent = LineParts.feedback(type, index, before);
      refreshGuide();
      return;
    }
    if (edits.length === 64) edits.shift();
    edits.push(before);
    const state = line.score.snapshot();
    help.textContent = LineParts.feedback(type, index, state);
    if (!line.wanted && (type === 'note' || type === 'tab')) {
      const step = type === 'note' ? index : (index + state.rotor) % model.STEPS;
      line.preview(step).catch(showError);
    } else if (!line.wanted && type === 'gearLevel') {
      line.previewGearLevel(index).catch(showError);
    }
    render();
    controls();
    persist();
    refreshGuide();
  }
  function undoEdit() {
    if (!edits.length) return;
    line.restore(edits.pop());
    help.textContent = 'Последнее изменение отменено.';
    render();
    controls();
    persist();
    refreshGuide();
  }
  async function init() {
    line = await FactoryMusic.create({onChange:controls, onError:showError});
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) line.restore(JSON.parse(saved));
    } catch { /* Discard incompatible saves and open the authored machine. */ }
    scene = LineScene.mount(host, {onAction:act});
    document.querySelector('.tempo').textContent = line.bpm + ' BPM';
    document.querySelector('.song span').textContent = line.title;
    host.setAttribute('aria-busy', 'false');
    controls();
    render();
    refreshGuide();
    const context = window.strudel.getAudioContext();
    context.addEventListener('statechange', () => {
      if (line.playing && context.state !== 'running') stop();
    });
  }
  play.addEventListener('click', togglePlay);
  undo.addEventListener('click', undoEdit);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.target.closest('input,textarea,select,[contenteditable]')) return;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.code === 'KeyZ') {
      event.preventDefault(); undoEdit();
    } else if (event.code === 'Space' && !event.target.closest('button,a,summary,[role=button]')) {
      event.preventDefault(); togglePlay();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  init().catch(error => {
    line = undefined;
    loadFailed = true;
    host.setAttribute('aria-busy','false');
    showError(error);
    controls();
  });
})();
