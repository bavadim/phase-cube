/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const play = document.getElementById('play');
  const undo = document.getElementById('undo');
  const host = document.getElementById('machine');
  const help = document.getElementById('help');
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
    scene.render({state:line.score.snapshot(), audibleState:sounding, model, playing:heard,
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
  function pitchName(pitch) {
    return ['До','До♯','Ре','Ми♭','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Си♭','Си'][pitch % 12] + (Math.floor(pitch / 12) - 1);
  }
  function act({type, index, delta = 1}) {
    if (!line) return;
    const before = line.score.snapshot();
    if (!line.edit(type, index, delta)) return;
    if (edits.length === 64) edits.shift();
    edits.push(before);
    const state = line.score.snapshot();
    let text;
    switch (type) {
      case 'note': text = 'Коробка ' + (index + 1) + ' · ' + pitchName(state.notes[index]); break;
      case 'tab': text = 'Язычок ' + (index + 1) + ' направляет коробку в ' + (state.routes[index] ? 'металл.' : 'стекло.'); break;
      case 'rotor': text = 'Барабан сдвинут. Теперь язычки встречают другие коробки.'; break;
      case 'disc': text = 'Диск повёрнут. Штамп срабатывает, когда обе прорези открыты и выбран металл.'; break;
      case 'clutch': text = state.clutch ? 'Муфта включена. До штампа доходят удары в совпавших прорезях.' : 'Прямой привод. Каждый удар по металлу приводит штамп в движение.'; break;
    }
    if (text) help.textContent = text;
    if (!line.wanted && (type === 'note' || type === 'tab')) {
      const step = type === 'note' ? index : (index + state.rotor) % model.STEPS;
      line.preview(step).catch(showError);
    }
    render();
    controls();
    persist();
  }
  function undoEdit() {
    if (!edits.length) return;
    line.restore(edits.pop());
    help.textContent = 'Последнее изменение отменено.';
    render();
    controls();
    persist();
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
    } else if (event.code === 'Space' && !event.target.closest('button,a,[role=button]')) {
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
