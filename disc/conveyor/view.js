/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.ConveyorBoxes = (() => {
  const palette = ['#ed8573','#f6a071','#efc167','#d5d16c','#a8c86e','#76bd88','#65c0a9','#59bacb','#78a8de','#9299df','#b294d9','#d494bb'];
  const names = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  return {
    color:pitch => palette[pitch % 12], name:pitch => names[pitch % 12] + (Math.floor(pitch / 12) - 1),
    classes:names
  };
})();

window.ConveyorView = (() => {
  'use strict';
  function pressButton(button, activate, opts) {
    let start=null, touchAt=-Infinity;
    button.addEventListener('pointerdown', event=>{
      if (!event.isPrimary) return;
      if (event.pointerType==='mouse') touchAt=-Infinity;
      if (event.pointerType==='touch') start={id:event.pointerId,x:event.clientX,y:event.clientY};
    },opts);
    button.addEventListener('pointercancel',()=>{start=null;},opts);
    button.addEventListener('pointerup',event=>{
      if (!start||start.id!==event.pointerId) return;
      const down=start; start=null;
      if (Math.hypot(event.clientX-down.x,event.clientY-down.y)>9 || button.disabled ||
          !button.contains(document.elementFromPoint(event.clientX,event.clientY))) return;
      touchAt=performance.now(); activate();
    },opts);
    button.addEventListener('click',event=>{
      if (event.detail>0 && performance.now()-touchAt<700) return;
      if (!button.disabled) activate();
    },opts);
  }
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const icons = {
    belt:'<rect x="2" y="10" width="20" height="8" rx="4"/><path d="M5 10V6h5v4m3 0V4h5v6"/><path d="M6 14h.01M18 14h.01"/>',
    gear:'<path d="m10 3 .5-1h3l.5 2 2 .9 1.8-.8 2 2-1 1.9.8 2 2.4.5v3l-2.3.6-.9 2 1 1.8-2 2-2-1-2 .9-.5 2.2h-3l-.5-2.2-2-.9-2 1-2-2 1-1.8-.8-2-2.3-.6v-3l2.3-.5.8-2-1-1.9 2-2 1.9.9 2-.9z"/><circle cx="12" cy="12" r="3.4"/>'
  };
  const icon=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  function create(host, cb) {
    const lifetime = new AbortController(), opts = {signal:lifetime.signal};
    host.innerHTML = '<div class="machine-rail"><div class="form-switch" role="group" aria-label="Форма выбранного сэмпла">'+
      '<button type="button" data-representation="belt">'+icon('belt')+'Лента</button><button type="button" data-representation="gear">'+icon('gear')+'Шестерёнка</button></div>'+
      '<div class="bar-picks" role="group" aria-label="Такт ленты"><span>Такт</span></div>'+
      '<div class="rate-picks" role="group" aria-label="Передача сэмпла" hidden><span>Ход</span></div>'+
      '<div class="paint-station"><button type="button" data-edit-box aria-expanded="false" aria-controls="box-tools"><i></i><b></b><span>▾</span></button>'+
      '<div id="box-tools" data-box-tools hidden><div class="paint-title"><strong></strong><button type="button" data-close aria-label="Закрыть настройки коробки">×</button></div>'+
      '<div class="pitch-palette" role="group" aria-label="Цвет и нота"></div>'+
      '<div class="box-row"><span>Октава</span><button type="button" data-octave="-1" aria-label="Октавой ниже">−</button><output data-value="octave"></output><button type="button" data-octave="1" aria-label="Октавой выше">+</button></div>'+
      '<div class="note-rows"></div><button type="button" data-eject>Снять коробку</button></div></div></div>'+
      '<div class="sample-stage"></div>';
    const find=s=>host.querySelector(s);
    const all=s=>Array.from(host.querySelectorAll(s));
    const bind=(el,fn)=>pressButton(el,fn,opts);
    function button(parent,label,attr,value,fn,title) {
      const b=document.createElement('button'); b.type='button'; b.textContent=label;
      b.setAttribute(attr,value); if(title)b.setAttribute('aria-label',title);
      parent.append(b); bind(b,fn); return b;
    }
    let data=null, component=null, form=null, lastClock=null, lastBeat=-1;
    const selectedNote=()=>data?.part.notes.find(n=>n.id===data.selectedId);
    const paintPitch=()=>selectedNote()?.pitch ?? data.brushPitch;
    const paint=find('[data-edit-box]'), tools=find('[data-box-tools]');
    function closeTools() {
      tools.hidden=true; paint.setAttribute('aria-expanded','false');
    }
    bind(paint,()=>{ tools.hidden=!tools.hidden; paint.setAttribute('aria-expanded',String(!tools.hidden)); });
    bind(find('[data-close]'),()=>{closeTools();paint.focus();});
    document.addEventListener('pointerdown',e=>{if(!tools.hidden&&!find('.paint-station').contains(e.target))closeTools();},opts);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tools.hidden){closeTools();paint.focus();}},opts);
    const barButtons = Array.from({length:4},(_,i)=>button(find('.bar-picks'),String(i+1),'data-bar',i,()=>cb.onBar(i),'Такт '+(i+1)));
    const rateButtons = [.5,1,2].map((r,i)=>button(find('.rate-picks'),['½×','1×','2×'][i],'data-speed',r,()=>cb.onRate(r),'Передача '+r));
    const formButtons=all('[data-representation]');
    for (const b of formButtons) bind(b,()=>cb.onForm(b.dataset.representation));
    const pitches=ConveyorBoxes.classes.map((name,i)=>{
      const b=button(find('.pitch-palette'),name,'data-pitch',i,()=>cb.onPaint(Math.floor(paintPitch()/12)*12+i),name);
      b.style.setProperty('--swatch',ConveyorBoxes.color(i)); return b;
    });
    for(const b of all('[data-octave]'))bind(b,()=>cb.onPaint(paintPitch()+Number(b.dataset.octave)*12));
    const fields=[['step','Шаг'],['gain','Громкость'],['length','Длина']];
    for(const [key,title] of fields){
      const row=document.createElement('div'); row.className='box-row';
      const label=document.createElement('span'); label.textContent=title; row.append(label);
      for(const delta of [-1,1]){
        if(delta===1){const out=document.createElement('output');out.dataset.value=key;row.append(out);}
        const b=button(row,delta<0?'−':'+','data-field',key,()=>{
          const n=selectedNote();if(!n)return;
          const value=key==='step'?(n.step+delta+64)%64:key==='gain'?clamp(Math.round(n.gain*10+delta)/10,0,2):clamp(Math.round(n.length)+delta,1,64);
          cb.onEdit(n.id,{[key]:value});
        },title+(delta<0?' меньше':' больше'));
        b.dataset.delta=delta;
      }
      find('.note-rows').append(row);
    }
    bind(find('[data-eject]'),()=>{const n=selectedNote();if(n){closeTools();cb.onDelete(n.id);}});
    function updateTools(){
      const note=selectedNote(), p=paintPitch(), octave=Math.floor(p/12);
      paint.querySelector('i').style.background=ConveyorBoxes.color(p);
      paint.querySelector('b').textContent=ConveyorBoxes.name(p);
      paint.setAttribute('aria-label', 'Цвет и параметры '+(note?'выбранной':'новой')+' коробки');
      find('.paint-title strong').textContent=note?'Выбранная коробка':'Цвет новой коробки';
      for(const [i,b] of pitches.entries()){
        b.disabled=octave*12+i>127; b.setAttribute('aria-pressed',String(i===p%12));
      }
      find('[data-value="octave"]').textContent=String(octave-1);
      for(const b of all('[data-octave]')){const next=p+12*Number(b.dataset.octave);b.disabled=next<0||next>127;}
      find('.note-rows').hidden=!note; find('[data-eject]').hidden=!note;
      if(note){
        find('[data-value="step"]').textContent=(1+Math.floor(note.step/16))+' · '+(1+note.step%16);
        find('[data-value="gain"]').textContent=Math.round(note.gain*100)+'%';
        find('[data-value="length"]').textContent=Number(note.length.toFixed(2))+' / 16';
      }
    }
    function update(next){
      const replace=form!==next.form;
      if(replace||data?.part.key!==next.part.key)closeTools();
      data=next;
      if(replace){
        component?.destroy(); form=next.form;
        component=(form==='gear'?ConveyorSampleGear:ConveyorBelt).create(find('.sample-stage'),cb);
      }
      for(const b of formButtons)b.setAttribute('aria-pressed',String(b.dataset.representation===form));
      find('.bar-picks').hidden=form!=='belt';find('.rate-picks').hidden=form!=='gear';
      for(const b of rateButtons)b.setAttribute('aria-pressed',String(+b.dataset.speed===next.part.speed));
      lastBeat=-1;
      updateTools(); component.update(next);
    }
    function clock(value){
      lastClock=value;
      const b=value.playing?Math.floor(value.step/16):data.bar;
      if (lastBeat!==b||barButtons[0].disabled!==value.playing){
        lastBeat=b;
        for(const [i,btn] of barButtons.entries()){
          btn.disabled=value.playing;btn.setAttribute('aria-pressed',String(i===b));
        }
      }
      component.clock(value);
    }
    return {update,clock,component:()=>component,
      inspect:()=>({...component?.inspect(),form,selectedId:data?.selectedId,step:lastClock?.step}),
      destroy(){lifetime.abort();component?.destroy();host.replaceChildren();}};
  }
  return {create,pressButton,icon};
})();
