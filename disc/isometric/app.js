/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const F = window.IsoFlow;
  const names = {source:'Нотная шестерня', copy:'Копир', delay:'Накопитель', router:'Муфта и развилка', keys:'Клавиши', bell:'Колокольчик', bin:'Корзина'};
  const portNames = {out:'Выход', copy:'Копия', straight:'Прямо', side:'Вбок'};
  const notes = {60:'До', 64:'Ми', 67:'Соль'};
  const hints = {
    source:'Коснитесь штифта, чтобы сменить ноту. Доверните втулку для сдвига фразы или поднимите её для усиления.',
    copy:'Перетащите подпись «Копир» на ленту. Копия ноты пойдёт по второму выходу.',
    delay:'Перетащите подпись «Накопитель» на ленту. Каждый карман задержит ноту на одну восьмую.',
    router:'Потяните подпись на ленту для врезки. Совместите окна дисков под щупом — коробка пойдёт прямо.',
    keys:'Каждая пришедшая коробка нажимает клавишу. Цвет коробки определяет её ноту.',
    bell:'Колокольчик играет ноты, поступившие по его лентам.',
    bin:'Коробки с этой ветви падают в корзину. В партии появляется пауза.'
  };
  const storageKey = 'biba.note-conveyor.iso.v1';
  function presetState(id) {
    const s = F.initial();
    if (id === 'straight') return F.restore({...s, links:{'source:out':'keys'}});
    if (id === 'answer') return F.restore({...s, links:{'source:out':'copy','copy:out':'keys','copy:copy':'router','router:side':'bin','router:straight':'delay','delay:out':'bell'}});
    return s;
  }
  function same(a,b) {
    return JSON.stringify([a.source,a.delay,a.discs,a.clutch,Object.entries(a.links).sort()]) ===
      JSON.stringify([b.source,b.delay,b.discs,b.clutch,Object.entries(b.links).sort()]);
  }
  let state = F.initial();
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) state = F.restore(JSON.parse(saved));
  } catch { /* A new bench also works offline or with an obsolete save. */ }
  let revision = F.revision(state), scene, audio, selected = '', patch = null, starting = false;
  let cachedRevision, cachedTick, eventFrame, lastLamp = -2, raf = 0;
  const undo = [];
  function notice(text) {
    $('notice').textContent = text;
    $('notice').hidden = !text;
  }
  function updateState(next, remember = true) {
    if (same(state,next)) return;
    if (remember) {
      undo.push(state);
      if (undo.length > 96) undo.shift();
    }
    state = next;
    revision = F.revision(state);
    audio?.queue(state);
    try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch { /* Session edits still work. */ }
    notice('');
    refresh();
  }
  function act(action) {
    try { updateState(F.apply(state,action)); return true; }
    catch (err) { notice(err.message); return false; }
  }
  function rewind() {
    const previous = undo.pop();
    if (previous) updateState(previous,false);
  }
  function patchChanged(key) { patch = key; guide(); }
  function clearPatch() { scene?.setPatch(null); patchChanged(null); }
  function guide() {
    $('guidance').textContent = patch
      ? names[patch.split(':')[0]] + ' · ' + portNames[patch.split(':')[1]] + '. Коснитесь входа другой детали, чтобы провести ленту.'
      : selected ? hints[selected] : $('preset').value === 'echo'
        ? 'Запустите машину и доверните оранжевый диск развилки. Послушайте, какие ноты теперь доходят до колокольчика.'
        : $('preset').value === 'straight' ? 'Перетащите подпись «Копир» на ленту к клавишам. Протяните ленту от второго выхода к колокольчику.'
        : 'Коснитесь детали, чтобы её настроить. Для новой ленты соедините выход одной детали со входом другой.';
    $('cancel-patch').hidden = !patch;
  }
  function select(id) {
    selected = Object.hasOwn(names,id) ? id : '';
    $('part').value = selected;
    guide();
    settings();
  }
  function element(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function command(label, title, handler) {
    const b = element('button','',label);
    b.type = 'button'; b.title = title; b.setAttribute('aria-label',title);
    b.onclick = handler;
    return b;
  }
  function picker(label) {
    const s = element('select'); s.setAttribute('aria-label',label); return s;
  }
  function setting(row, label, value, action, amount, min, max) {
    const group = element('div','step-control');
    const down = command('−','Уменьшить: '+label,()=>act({...action,delta:-amount}));
    const up = command('+','Увеличить: '+label,()=>act({...action,delta:amount}));
    if (min !== undefined) down.disabled = value <= min;
    if (max !== undefined) up.disabled = value >= max;
    const display = action.type === 'level' ? Math.round(value*100)+'%' : value;
    group.append(element('span','',label+' · '+display),down,up);
    row.append(group);
  }
  function settings() {
    const host = $('settings'), disclosureOpen = host.querySelector('details')?.open || false;
    // Preserve keyboard focus when a change rebuilds the contextual controls.
    const focused = host.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    host.replaceChildren();
    if (!selected) return;
    const row = element('div','settings-row');
    if (selected === 'source') {
      setting(row,'Сдвиг в восьмых',state.source.phase,{type:'phase'},1);
      setting(row,'Громкость',state.source.level,{type:'level'},.25,0,2);
      host.append(row);
      const pins = element('div','pin-grid');
      pins.setAttribute('role','group'); pins.setAttribute('aria-label','Ноты по восьмым');
      state.source.notes.forEach((pitch,i)=>{
        const name = pitch == null ? '—' : notes[pitch] || String(pitch);
        const b = command(name,'Сменить ноту на шаге '+(i+1),()=>act({type:'note',index:i}));
        b.prepend(element('small','',String(i+1))); b.dataset.tone = pitch == null ? 'off' : 'on'; pins.append(b);
      });
      host.append(pins);
    } else if (selected === 'delay') {
      setting(row,'Карманов',state.delay,{type:'delay'},1,0,F.MAX_DELAY); host.append(row);
    } else if (selected === 'router') {
      const cassette = command(state.clutch?'Вынуть кассету':'Вставить кассету','Снять или установить кассету',()=>act({type:'clutch'}));
      row.append(cassette);
      if (state.clutch) state.discs.forEach((v,i)=>setting(row,'Диск '+['I','II'][i],v,{type:'disc',index:i},1));
      host.append(row);
    }
    const ports = F.PORTS[selected];
    if (ports.length) {
      const details = element('details');
      details.open = disclosureOpen;
      details.append(element('summary','','Ленты и монтаж'));
      const routing = element('div','settings-row');
      for (const port of ports) {
        const key = selected+':'+port;
        const label = element('label','link-edit',portNames[port]+' → ');
        const output = picker('Назначение: '+portNames[port]);
        output.add(new Option('Свободно',''));
        Object.entries(names).filter(([id])=>id !== 'source' && id !== selected).forEach(([id,name])=>output.add(new Option(name,id)));
        output.value = state.links[key] || '';
        output.onchange = () => {
          const ok = act(output.value ? {type:'connect',from:key,to:output.value} : {type:'disconnect',from:key});
          if (!ok) output.value = state.links[key] || '';
        };
        label.append(output); routing.append(label);
      }
      details.append(routing);
      if (['copy','router','delay'].includes(selected)) {
        const install = element('div','settings-row'), belt = picker('Выбрать ленту для врезки');
        for (const [from,to] of Object.entries(state.links)) {
          const [owner,port] = from.split(':');
          if (owner === selected || to === selected) continue;
          belt.add(new Option(names[owner]+' ('+portNames[port]+') → '+names[to],from));
        }
        if (belt.options.length) install.append(belt,command('Врезать сюда','Вставить деталь в выбранную ленту',()=>act({type:'insert',node:selected,from:belt.value})));
        if (Object.values(state.links).includes(selected)) install.append(command('Обойти деталь','Пустить ленту в обход детали',()=>act({type:'bypass',node:selected})));
        details.append(install);
      }
      host.append(details);
    } else {
      const incoming = Object.entries(state.links).filter(([,to])=>to === selected).map(([from])=>{
        const [n,p] = from.split(':'); return names[n]+' ('+portNames[p].toLowerCase()+')';
      });
      host.append(element('div','settings-row',incoming.length ? 'Лента от: '+incoming.join(', ') : 'Свободный вход'));
    }
    if (focused) Array.from(host.querySelectorAll('[aria-label]')).find(e=>e.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
  }
  function refresh() {
    $('preset').value = ['echo','answer','straight'].find(p=>same(state,presetState(p))) || 'custom';
    $('undo').disabled = !undo.length;
    settings(); guide();
  }
  function transportUI() {
    const running = Boolean(audio?.wanted());
    $('play').disabled = !audio || starting;
    $('play').setAttribute('aria-pressed',String(running));
    $('play').querySelector('span').textContent = starting ? 'Запуск…' : running ? 'Пауза' : 'Запустить';
  }
  async function toggleAudio() {
    if (!audio || starting) return;
    if (audio.wanted()) { audio.pause(); transportUI(); return; }
    starting = true; transportUI(); notice('');
    try { await audio.start(state); }
    catch (err) { notice('Не удалось включить звук. '+err.message); }
    finally { starting = false; transportUI(); }
  }
  const lamps = Array.from({length:F.STEPS},()=>element('i'));
  $('beat').append(...lamps);
  function render() {
    raf = 0;
    if (document.hidden) return;
    const playing = Boolean(audio?.playing()), active = (playing && audio.audible()) || revision;
    const time = Math.max(0,audio?.clock() || 0);
    const tick = Math.floor(time*F.STEPS);
    if (tick !== cachedTick || active !== cachedRevision) {
      eventFrame = F.tick(active,tick);
      cachedTick = tick; cachedRevision = active;
    }
    const lamp = playing ? eventFrame.step : -1;
    if (lamp !== lastLamp) {
      lamps[lastLamp]?.classList.remove('on'); lamps[lamp]?.classList.add('on'); lastLamp = lamp;
    }
    scene?.render({state:active.state,revision:active,selected:selected||null,time,playing,tick:eventFrame});
    raf = requestAnimationFrame(render);
  }
  Object.entries(names).forEach(([id,name])=>$('part').add(new Option(name,id)));
  $('part').onchange = () => { clearPatch(); select($('part').value); };
  $('preset').onchange = () => { clearPatch(); updateState(presetState($('preset').value)); };
  $('cancel-patch').onclick = clearPatch;
  $('undo').onclick = rewind;
  $('play').onclick = toggleAudio;
  document.addEventListener('keydown',e=>{
    if (e.key === 'Escape') clearPatch();
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); rewind(); }
  });
  try {
    scene = window.IsoScene.mount($('board'),{
      select, act, notice, patchChanged,
      connect:(from,to)=>act({type:'connect',from,to}),
      disconnect:from=>act({type:'disconnect',from})
    });
  } catch (err) {
    $('board').textContent = 'Для модели требуется WebGL. Детали и ленты доступны в редакторе под полем.';
    notice(err.message);
  }
  const stop = () => { audio?.pause(); transportUI(); };
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) { stop(); cancelAnimationFrame(raf); raf=0; }
    else if (!raf) raf=requestAnimationFrame(render);
  });
  window.addEventListener('pagehide',stop);
  // Used by the existing browser harness to verify raycasting, audio and drawing against the same snapshot.
  window.IsoBench = Object.freeze({inspect:()=>({state,selected,patch,geometry:scene?.inspect(),playing:audio?.playing(),time:audio?.clock(),active:audio?.audible()})});
  refresh(); transportUI(); render();
  window.IsoAudio.create({onChange:transportUI,onError:err=>notice('Ошибка звука. '+(err?.message||err))})
    .then(engine=>{audio=engine;transportUI();})
    .catch(err=>notice('Не удалось загрузить звук. '+err.message));
})();
