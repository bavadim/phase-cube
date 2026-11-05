/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const S = window.strudel;
  const element = id => document.getElementById(id);
  const storageKey = 'biba.conveyor.turkish-circuit.v1';
  const library = new PuzzleCompositions.Loader(S);
  const transport = new PhaseCubeTransport(S, {outputGain:1, onChange:updateControls, onError:fail});
  let song, score, snapshot, view, audition;
  let selected = 'hook', bar = 0, selectedId = null;
  const forms = {kick:'belt',bass:'belt',hook:'belt'};
  const brush = {kick:36,bass:45,hook:71};
  let ready = false, starting = false, frameId = 0;
  const partOf = (state, key) => state.parts.find(part => part.key === key);

  function notice(message = '') {
    element('notice').textContent = message;
    element('notice').hidden = !message;
  }
  function updateControls() {
    const play = element('play');
    play.disabled = !ready || starting;
    play.setAttribute('aria-pressed', String(transport.want));
    play.querySelector('span').textContent = !ready ? 'Загрузка…' : starting ? 'Пуск…' : transport.want ? 'Пауза' : 'Слушать';
    element('undo').disabled = !ready || !score?.canUndo;
    for (const button of element('parts').querySelectorAll('button')) {
      button.disabled = !ready;
      button.setAttribute('aria-pressed', String(button.dataset.part === selected));
      const form=forms[button.dataset.part], symbol=button.querySelector('i');
      if (symbol.dataset.form!==form) {
        symbol.dataset.form=form;
        symbol.innerHTML=ConveyorView.icon(form);
        button.title=button.textContent.trim()+' · '+(form==='gear'?'Шестерёнка':'Лента');
      }
    }
  }
  function fail(error) {
    console.error(error);
    notice(error?.message || String(error));
    starting = false;
    if (transport.want) transport.stop();
    updateControls();
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({state:snapshot, selected, bar, forms, brush}));
    } catch {
      notice('Браузер не смог сохранить правки. Они доступны до закрытия страницы.');
    }
  }
  function restoreSaved() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      score.restore(saved.state, {record:false});
      if (partOf(saved.state, saved.selected)) selected = saved.selected;
      if (Number.isInteger(saved.bar) && saved.bar >= 0 && saved.bar < 4) bar = saved.bar;
      for (const key of Object.keys(forms)) {
        if (saved.forms?.[key] === 'gear') forms[key] = 'gear';
        const pitch=saved.brush?.[key];
        if (Number.isInteger(pitch) && pitch>=0 && pitch<=127) brush[key]=pitch;
      }
    } catch {
      notice('Открыта исходная партия — сохранённую сборку прочитать не удалось.');
    }
  }

  function paintClock() {
    if (!view || !snapshot) return;
    const bars = transport.clock();
    const heard = transport.active?.meta?.state || snapshot;
    const part = partOf(heard, selected);
    const step = ConveyorScore.stepAt(part, bars);
    const activeIds = transport.running && part.level>0 ? part.notes.filter(note =>
      note.gain>0 && (step - note.step + 64) % 64 < note.length
    ).map(note => note.id) : [];
    view.clock({step, playing:transport.running, activeIds, rate:part.speed, driveTurns:bars, part});
  }
  function frame() {
    frameId = 0;
    transport.poll();
    paintClock();
    if (transport.running && !document.hidden) frameId = requestAnimationFrame(frame);
  }
  function refreshView() {
    const part = partOf(snapshot, selected);
    if (!part.notes.some(note => note.id === selectedId)) selectedId = null;
    view.update({part, selectedId, bar, form:forms[selected], brushPitch:brush[selected]});
    element('gesture-help').textContent = forms[selected]==='gear'
      ? 'Поверните обод для сдвига всей фразы. Поднимите или опустите втулку, чтобы изменить громкость сэмпла.'
      : 'Касание ставит коробку. Тяните её вдоль ленты для сдвига, вверх для громкости, за край для длины. Цвет выбирается в палитре.';
    paintClock();
    updateControls();
  }
  function commit() {
    snapshot = score.snapshot();
    if (transport.running) {
      transport.queue(at => {
        const aligned = ConveyorScore.alignSpeeds(snapshot, transport.active.meta.state, at);
        const pattern = score.pattern(aligned);
        score.restore(aligned, {record:false});
        snapshot = aligned;
        return {pattern, meta:{state:aligned}};
      });
    }
    refreshView();
    persist();
  }
  function undo() {
    if (ready && score.undo()) { audition.stop(); commit(); }
  }
  function soundTile(id) {
    if (id && !transport.want && !starting)
      audition.play(score, selected, id).catch(error => notice(error.message));
  }
  function setRate(rate) {
    if (score.setSpeed(selected, rate, transport.clock())) commit();
  }
  function setBar(index) {
    if (!Number.isInteger(index) || index < 0 || index > 3 || index === bar) return;
    bar = index;
    selectedId = null;
    refreshView();
    persist();
  }
  function editBox(id, patch) {
    if (!score.edit(selected,id,patch)) return false;
    selectedId=id;
    if (patch.pitch!==undefined) brush[selected]=patch.pitch;
    if (!transport.running && patch.step!==undefined) bar=Math.floor(patch.step/16);
    notice(); commit(); soundTile(id);
    return true;
  }
  function pause() {
    // If pause overtakes an upcoming gear change, engage the requested gear
    // at the stopped position. Resuming should start at the tooth just heard.
    if (transport.pending && snapshot) {
      const aligned = ConveyorScore.alignSpeeds(snapshot, transport.active.meta.state, transport.clock());
      score.restore(aligned, {record:false});
      snapshot = aligned;
      persist();
    }
    const stopped = transport.stop();
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (view) refreshView();
    return stopped;
  }
  async function togglePlayback() {
    if (!ready || starting) return;
    audition.stop();
    if (transport.want) { await pause(); return; }
    notice();
    starting = true;
    updateControls();
    try {
      await transport.start(() => ({pattern:score.pattern(snapshot), meta:{state:snapshot}}), song.bpm, 1);
      if (transport.running && !frameId) frame();
    } catch (error) { fail(error); }
    finally { starting = false; updateControls(); }
  }

  async function init() {
    const wait = PuzzleAsync.wait;
    const repl = await wait(S.initStrudel({
      sync:false, miniAllStrings:true,
      setInterval:window.setInterval.bind(window), clearInterval:window.clearInterval.bind(window),
      prebake:() => PhaseCubeBank.register(S),
      defaultOutput:(...args) => transport.output(...args),
      onUpdateState:state => { if (state.error) fail(state.error); }
    }), 'Не удалось открыть звуковой движок.', 15000);
    transport.attach(repl);
    song = await wait(library.load('turkish-circuit'), 'Не удалось открыть композицию.', 20000);
    const prepared = DiscMusic.prepare(S, song);
    score = ConveyorScore.create(S, prepared);
    audition = ConveyorAudition.create(S, transport, song.bpm);
    const original = score.pattern();
    restoreSaved();
    snapshot = score.snapshot();
    transport.setComposition({...song, backing:S.silence, stats:{...song.stats, maxGateBars:Math.max(8, song.stats.maxGateBars)}});
    await wait(PhaseCubeBank.preload(S, S.stack(original, score.pattern(snapshot)), 8), 'Не удалось загрузить инструменты.', 30000);
    view = ConveyorView.create(element('machine'), {
      onRate:setRate, onBar:setBar,
      onForm:form=>{
        if (!['belt','gear'].includes(form)||forms[selected]===form) return;
        forms[selected]=form;
        refreshView();persist();
      },
      onPhase:delta=>{if (score.shiftPhase(selected,delta)) commit();},
      onLevel:level=>{if (score.setLevel(selected,level)) commit();},
      onPaint:pitch=>{
        if (!Number.isInteger(pitch)||pitch<0||pitch>127) return;
        if (selectedId) {
          const current=partOf(snapshot,selected).notes.find(n=>n.id===selectedId);
          if (current?.pitch!==pitch&&!editBox(selectedId,{pitch})) notice('На этом шаге уже стоит коробка этой ноты.');
        } else { brush[selected]=pitch; refreshView(); persist(); }
      },
      onSelect:id => {
        selectedId = id;
        const n=partOf(snapshot,selected).notes.find(n=>n.id===id);
        if (n) { brush[selected]=n.pitch; bar=Math.floor(n.step/16); }
        refreshView();
        soundTile(id);
      },
      onAdd:note => {
        const pitch=note.pitch??brush[selected];
        const id = score.add(selected, {...note,pitch});
        if (id) { selectedId = id; brush[selected]=pitch; bar=Math.floor(note.step/16); commit(); soundTile(id); }
      },
      onEdit:editBox,
      onDelete:id => {
        if (score.remove(selected, id)) { audition.stop(); selectedId = null; commit(); }
      }
    });
    element('machine').setAttribute('aria-busy','false');
    element('song').textContent = song.title;
    element('tempo').textContent = song.bpm + ' BPM';
    ready = true;
    refreshView();
    S.getAudioContext().addEventListener('statechange', () => {
      if (S.getAudioContext().state !== 'running' && transport.running) pause();
    });
  }

  for (const button of element('parts').querySelectorAll('[data-part]')) ConveyorView.pressButton(button, () => {
    if (!ready || button.dataset.part === selected) return;
    audition.stop();
    selected = button.dataset.part;
    selectedId = null;
    refreshView();
    persist();
  });
  ConveyorView.pressButton(element('undo'), undo);
  ConveyorView.pressButton(element('play'), togglePlayback);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.target.closest('input,select,textarea,[contenteditable]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); undo();
    } else if (event.code === 'Space' && !event.target.closest('button,a,[role=button]')) {
      event.preventDefault(); togglePlayback();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { audition?.stop(); if (transport.want) pause(); }
  });
  window.addEventListener('pagehide', () => { audition?.stop(); if (transport.want) pause(); });

  window.conveyorTest = {
    state:() => score?.snapshot(), selected:() => selected, bar:() => bar,
    view:() => view?.inspect(), clock:() => transport.clock(), transport,
    auditionMeter:() => audition?.analyser,
    component:()=>view?.component(),
    cellPoint:(...args) => view.component().cellPoint?.(...args), notePoint:(...args) => view.component().notePoint(...args),
    ready:init().catch(error => { element('machine').setAttribute('aria-busy','false'); fail(error); element('play').querySelector('span').textContent='Ошибка загрузки'; })
  };
})();
