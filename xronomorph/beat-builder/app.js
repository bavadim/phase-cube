/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
'use strict';
const B=BeatBuilder,R=RhythmMethods,$=s=>document.querySelector(s),key='biba-beat-builder/1';
let project=B.initial(),pattern='A',track=2,task='foundation',playback='pattern',draft=null,compare='after',history=[],gesture=null,notice='';
try{const raw=localStorage.getItem(key);if(raw)project=B.validate(JSON.parse(raw));}catch{notice='Сохранение не прочитано. Открыт стартовый бит.';}
const projection={clone:B.clone,instruments:XronoModel.instruments,score:s=>s.events};
const audio=new XronoAudio.Transport(strudel,{projection,sampleBase:new URL('../../assets/samples/',document.baseURI).href,onChange:player,onError:showError});
const chosen=()=>project.patterns[pattern][track],heard=()=>draft&&compare==='after'?draft.project:project,visible=()=>heard().patterns[pattern][track];
function audioState(){return{rpm:project.bpm/16,volume:1,events:B.score(heard(),{pattern,chain:playback==='chain'})};}
function sync(){audio.update(audioState());}
function save(){try{localStorage.setItem(key,JSON.stringify(project));$('#save-state').textContent='Правки сохранены в браузере';}catch{$('#save-state').textContent='Сохранение недоступно · скачайте JSON';}}
function showError(e){$('#error').hidden=false;$('#error').textContent=e.message||String(e);}
function push(old){if(JSON.stringify(old)!==JSON.stringify(project)){history.push(old);if(history.length>50)history.shift();save();}}
function resetPreview(){draft=null;compare='after';}
function mutate(fn,message='',rebuild=false){circle.cancel();endGesture();const old=B.clone(project);resetPreview();fn();B.validate(project);push(old);notice=message;sync();if(rebuild)buildTools();paint();}
function beginGesture(){endGesture();if(draft){resetPreview();notice='Проба сброшена: редактируется сохранённая партия.';}gesture=B.clone(project);}
function endGesture(){if(!gesture)return;const old=gesture;gesture=null;B.validate(project);push(old);paint();}
function cancelGesture(){if(!gesture)return;project=gesture;gesture=null;notice='Жест отменён';sync();paint();}
const circle=new BeatCircle($('#rhythm-circle'),{
 blocked:()=>{notice='Примените или отбросьте пробу перед ручной правкой.';paint();},
 begin:beginGesture,move:(i,value)=>{if(chosen().events[i])Object.assign(chosen().events[i],value);sync();paint();},end:endGesture,cancel:cancelGesture,repaint:paint,
 add:(time,velocity)=>mutate(()=>{if(chosen().events.length<64)chosen().events.push({time,velocity});},'Удар добавлен'),remove:i=>mutate(()=>chosen().events.splice(i,1),'Удар удалён')
});
function preview(kind,params={}){
 circle.cancel();endGesture();const p=B.clone(project),t=p.patterns[pattern][track],source=chosen().events;let description='',result;
 if(kind==='preset'){const preset=B.presets.find(x=>x.id===params.id);t.events=B.events(preset.points,.8);description=`${preset.label} · заменит только выбранную партию.`;}
 if(kind==='rotate'){t.events=B.rotate(source,params.steps/16);description=`Сдвиг на ${params.steps>0?'+':''}${params.steps}/16 такта.`;}
 if(kind==='groove'){t.events=B.accent(B.swing(source,params.swing),params.accent);description='Сдвинуты слабые шестнадцатые; опорные четверти сохранены. Акценты меняют только силу ударов.';}
 if(kind==='mirror'){
  if(!B.isGrid(chosen())){notice='Для зеркала нужна сетка 1/16. Свободные позиции сначала привяжите к сетке.';paint();return;}
  if(B.grid(chosen()).some(v=>v>1+B.EPS)){notice='Для зеркала оставьте не более одного полного удара на клетку.';paint();return;}
  t.events=B.mirror(source,params.axis,params.amount);description='Зеркальная проекция силы ударов. Может добавить ответные удары; сумма силы сохранена.';
 }
 if(kind==='response'||kind==='canon'){
  if(params.reference===track){notice='Выберите другую партию для ответа.';paint();return;}
  const ref=project.patterns[pattern][params.reference];result=kind==='canon'?B.canon(ref):B.complement(ref,params.count);
  if(result.error){resetPreview();notice=result.error;sync();paint();return;}
  t.events=result.events;description=kind==='canon'?`Точное покрытие: ${result.copies} сдвинутых копий мотива дополняют ${B.voices[params.reference].label.toLowerCase()}.`:`${result.events.length} ударов в свободных клетках. Исходная партия остаётся на месте.`;
 }
 if(kind==='fill'){t.events=B.fill(source,params.count);description='Первые три доли сохранены. Изменена только последняя четверть такта.';}
 if(kind==='scratch'){
  result=B.scratch(source,params.k,params.phase*Math.PI/180,params.magnitude);t.events=result.events;description=`a${params.k} меняет время и силу всей выбранной партии.${result.limited?' Достигнут предел силы 100%.':''} Другие инструменты не затронуты.`;
 }
 B.validate(p);draft={project:p,kind,params,description};compare='after';notice='';sync();paint();
}
function labelRange(id,label,min,max,step,value,suffix=''){return`<label class="tool-label" for="${id}">${label}<output id="${id}-value">${value}${suffix}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;}
function buildTools(){
 const t=chosen(),host=$('#tool-content');
 if(task==='foundation')host.innerHTML='<h3>С чего начнём?</h3><p class="tool-copy">Выберите роль рисунка. Послушайте его вместе с остальными партиями и оставьте удачный вариант.</p><div class="preset-grid">'+B.presets.map(p=>`<button class="preset" data-preset="${p.id}"><svg viewBox="0 0 110 22" aria-hidden="true">${p.points.length?p.points.map(i=>`<rect x="${i*6.5+2}" y="${i%4?10:4}" width="4" height="${i%4?10:16}" rx="1" fill="currentColor"/>`).join(''):'<path d="M2 18H108" stroke="currentColor" stroke-dasharray="3 4"/>'}</svg><b>${p.label}</b><small>${p.detail}</small></button>`).join('')+'</div><div class="tool-section"><h3>Необязательно рисовать с нуля</h3><p id="motif-analysis"></p></div>';
 if(task==='groove')host.innerHTML='<h3>Тот же рисунок, другой характер</h3><p class="tool-copy">Свинг задерживает слабые шестнадцатые. Контраст выделяет опорные доли — без новых ударов.</p>'+labelRange('swing','Свинг',0,100,1,0,'%')+labelRange('accent','Контраст акцентов',0,100,1,0,'%')+'<div class="tool-section"><h3>Поставить в другое место</h3><div class="small-actions"><button data-shift="-1">← На шаг раньше</button><button data-shift="1">На шаг позже →</button></div></div><details class="tool-section"><summary>Зеркальный ответ внутри партии</summary><p>Отразить рисунок вокруг оси; подмешать отражение по силе.</p>'+labelRange('axis','Ось отражения',0,15,1,0)+labelRange('symmetry','Доля отражения',0,100,1,0,'%')+'</details>';
 if(task==='dialogue'){
  const reference=track===0?1:0;
  host.innerHTML='<h3>Оставить место друг другу</h3><p class="tool-copy">Напишите ответ в паузах другой партии. Совпадения не запрещены вообще: это приём для контраста.</p><label class="tool-label">Кому отвечаем?<select id="reference">'+B.voices.map((v,i)=>i!==track?`<option value="${i}"${i===reference?' selected':''}>${v.label}</option>`:'').join('')+'</select></label>'+labelRange('density','Ударов в ответе',1,12,1,4)+'<button id="response" class="wide">Подобрать ответ в паузах</button><p id="dialogue-analysis" class="tool-copy"></p><details class="tool-section"><summary>Точное дополнение копиями мотива</summary><p>Найти сдвинутые копии, чтобы вместе с исходной партией закрыть все 16 шагов ровно по одному разу. Подходит не каждому мотиву.</p><button id="canon" class="wide">Найти точное дополнение</button></details>';
 }
 if(task==='variation'){
  const k=t.events.length>1?1:0,coeff=t.events.length?R.dft(t.events.map(e=>R.polar(e.velocity*2,B.TAU*e.time))):[],mag=coeff.length?R.abs(coeff[k]):0;
  host.innerHTML='<h3>Узнаваемый бит, новое окончание</h3><p class="tool-copy">Скопируйте A в B, затем измените одну вещь. Поставьте B в последний такт цепочки.</p><button id="tool-copy" class="wide">'+pattern+' → '+(pattern==='A'?'B':'A')+' · скопировать и открыть</button><div class="tool-section"><h3>Заполнение на последней доле</h3><p>Начало сохраняется, меняется только концовка.</p>'+labelRange('fill-count','Ударов в заполнении',1,8,1,4)+'<button id="fill" class="wide">Попробовать заполнение</button></div><details class="tool-section"><summary>Спектральная деформация фразы</summary><p>Fourier scratching: один коэффициент влияет на время и силу нескольких ударов. Это поиск нового материала, а не обычный сдвиг.</p><label class="tool-label">Коэффициент<select id="coefficient"'+(!coeff.length?' disabled':'')+'>'+coeff.map((_,i)=>`<option value="${i}"${i===k?' selected':''}>a${i}</option>`).join('')+'</select></label>'+labelRange('phase','Угол вклада',-180,180,1,0,'°')+labelRange('magnitude','Модуль вклада',0,2,.005,Number(mag.toFixed(3)))+'<p class="subtle">Позиции становятся свободными, не только 1/16. Силу ограничиваем 100%.</p></details>';
 }
}
function drawGrid(){
 const ts=heard().patterns[pattern],host=$('#beat-grid'),focus=host.contains(document.activeElement)?document.activeElement?.dataset.cell:null;
 let html='<div></div>'+Array.from({length:16},(_,i)=>`<div class="step-number ${i%4===0?'strong':''}">${i%4===0?i/4+1:'·'}</div>`).join('');
 ts.forEach((t,index)=>{const v=B.voices[index],xs=B.grid(t);html+=`<div class="track-label" style="--track:${v.color}"><button class="track-select" data-track="${index}" aria-pressed="${track===index}">${v.label}</button><button class="mix" data-mute="${index}" aria-label="Выключить ${v.label}" aria-pressed="${t.mute}">M</button><button class="mix" data-solo="${index}" aria-label="Соло ${v.label}" aria-pressed="${t.solo}">S</button></div>`;
 for(let i=0;i<16;i++){const off=t.events.some(e=>B.wrap(Math.round(e.time*16)/16)===i/16&&Math.abs(e.time*16-Math.round(e.time*16))>1e-5);html+=`<button class="step ${i%4===0?'beat-start ':''}${xs[i]>.00001?'on ':''}${off?'off-grid':''}" data-cell="${index}:${i}" style="--track:${v.color};--strength:${Math.min(1,xs[i])}" aria-label="${v.label}, доля ${Math.floor(i/4)+1}, шаг ${i%4+1}" aria-pressed="${xs[i]>B.EPS}"></button>`;}
 });host.innerHTML=html;if(focus)host.querySelector(`[data-cell="${focus}"]`)?.focus({preventScroll:true});
 const t=ts[track],xs=B.grid(t),pads=$('#touch-steps'),padFocus=pads.contains(document.activeElement)?document.activeElement.dataset.pad:null;
 pads.innerHTML=xs.map((v,i)=>`<button class="step ${v>B.EPS?'on ':''}${i%4===0?'beat-start':''}" data-pad="${track}:${i}" style="--track:${B.voices[track].color};--strength:${Math.min(1,v)}" aria-label="Шаг ${i+1} выбранной партии" aria-pressed="${v>B.EPS}"><span>${i%4===0?i/4+1:['','e','&','a'][i%4]}</span></button>`).join('');if(padFocus)pads.querySelector(`[data-pad="${padFocus}"]`)?.focus({preventScroll:true});
}
function paint(){
 const t=visible(),v=B.voices[track],reference=$('#reference'),ref=reference?Number(reference.value):track===0?1:0;
 document.documentElement.style.setProperty('--track',v.color);$('#title').value=project.title;$('#bpm').value=project.bpm;$('#undo').disabled=!history.length;$('#copy').textContent=pattern+' → '+(pattern==='A'?'B':'A')+' · сделать вариант';$('#editor-title').textContent=v.label;$('#tools-title').textContent='Работаем: '+v.label.toLowerCase();$('#track-role').textContent=v.role+' · вариант '+pattern;$('#sound').value=t.sound;$('#gain').value=t.gain;$('#gain-value').value=Math.round(t.gain*100)+'%';$('#hit-count').textContent=t.events.length;
 $('#hit-count').textContent=t.events.filter(e=>e.velocity>B.EPS).length;$('#timing-state').textContent=B.isGrid(t)?'Все удары на сетке 1/16':'Есть свободные позиции · точнее видны на круге';
 for(const b of document.querySelectorAll('[data-pattern]'))b.setAttribute('aria-pressed',String(b.dataset.pattern===pattern));for(const b of document.querySelectorAll('[data-task]'))b.setAttribute('aria-pressed',String(b.dataset.task===task));for(const b of document.querySelectorAll('[data-playback]'))b.setAttribute('aria-pressed',String(b.dataset.playback===playback));for(const b of document.querySelectorAll('[data-compare]'))b.setAttribute('aria-pressed',String(b.dataset.compare===compare));
 $('#preview').hidden=!draft;$('#preview-description').textContent=draft?.description||'';$('#notice').textContent=notice;for(const id of ['save','export'])$('#'+id).disabled=!!draft;
 const a=B.analysis(t,heard().patterns[pattern][ref]);if($('#motif-analysis'))$('#motif-analysis').textContent=a.atoms?`Текущий рисунок: ${a.hits} ударов, ${a.atoms.length} ${a.atoms.length===1?'мотив':'мотива/мотивов'} из словаря. Можно менять любую точку вручную.`:'Свободный рисунок: сохраняем точное время каждого удара.';
 if($('#dialogue-analysis'))$('#dialogue-analysis').textContent=`Сейчас совпадают ${a.coincident} атак. Общих пустых шагов: ${a.free}. Это диагностика, не оценка качества.`;
 drawGrid();circle.disabled=!!draft;circle.draw(t,v.color,$('#snap').checked);const chain=$('#chain');chain.innerHTML=project.chain.map((key,i)=>`<button data-bar="${i}" aria-label="Такт ${i+1}: ${key}, переключить вариант"><small>ТАКТ ${i+1}</small><b>${key}</b></button>`).join('');player();
}
function player(){if(!audio)return;$('#play').innerHTML=audio.starting?'… <span>Включаю</span>':audio.running?'Ⅱ <span>Пауза</span>':'▶ <span>Слушать</span>';$('#play').disabled=audio.starting;$('#play').setAttribute('aria-pressed',String(audio.running));$('#play-state').textContent=audio.running?(draft?(compare==='after'?'Проба в общем миксе':'Исходный бит'):'Звучит '+(playback==='chain'?'цепочка A/B':'вариант '+pattern)):'Готов к прослушиванию';}
function copyPattern(){mutate(()=>{const other=pattern==='A'?'B':'A';project.patterns[other]=B.clone(project.patterns[pattern]);pattern=other;},'Копия открыта. Измените концовку и послушайте цепочку.',true);}
$('#sound').innerHTML=B.voices.map(v=>`<option value="${v.id}">${v.label}</option>`).join('');
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.pattern){circle.cancel();endGesture();resetPreview();pattern=b.dataset.pattern;circle.selected=-1;buildTools();sync();paint();return;}
 if(b.dataset.task){circle.cancel();endGesture();resetPreview();task=b.dataset.task;notice='';buildTools();sync();paint();return;}
 if(b.dataset.track!==undefined){circle.cancel();endGesture();resetPreview();track=Number(b.dataset.track);circle.selected=-1;buildTools();sync();paint();return;}
 if(b.dataset.playback){playback=b.dataset.playback;sync();paint();return;}
 if(b.dataset.compare){compare=b.dataset.compare;sync();paint();return;}
 if(b.dataset.cell||b.dataset.pad){const[ti,cell]=(b.dataset.cell||b.dataset.pad).split(':').map(Number);if(b.dataset.cell&&matchMedia('(max-width:600px)').matches){circle.cancel();endGesture();resetPreview();track=ti;buildTools();sync();paint();$('#editor-title').scrollIntoView({block:'start',behavior:'smooth'});return;}if(draft){notice='Примените или отбросьте пробу перед ручной правкой.';paint();return;}mutate(()=>{track=ti;const t=chosen(),near=e=>R.mod(Math.round(e.time*16),16)===cell;if(t.events.some(near))t.events=t.events.filter(e=>!near(e));else t.events.push({time:cell/16,velocity:.8});},'',true);return;}
 if(b.dataset.mute!==undefined||b.dataset.solo!==undefined){const flag=b.dataset.mute!==undefined?'mute':'solo',i=Number(b.dataset[flag]);mutate(()=>{const t=project.patterns[pattern][i];t[flag]=!t[flag];});return;}
 if(b.dataset.preset){preview('preset',{id:b.dataset.preset});return;}
 if(b.dataset.shift){const steps=(draft?.kind==='rotate'?draft.params.steps:0)+Number(b.dataset.shift);preview('rotate',{steps});return;}
 if(b.dataset.bar!==undefined){mutate(()=>{const i=Number(b.dataset.bar);project.chain[i]=project.chain[i]==='A'?'B':'A';});return;}
 if(b.id==='copy'||b.id==='tool-copy'){copyPattern();return;}
 if(b.id==='apply'&&draft){const old=B.clone(project);project=draft.project;resetPreview();push(old);notice='Вариант применён';sync();buildTools();paint();return;}
 if(b.id==='discard'){resetPreview();notice='Исходный бит сохранён';sync();buildTools();paint();return;}
 if(b.id==='response'||b.id==='canon'){preview(b.id==='response'?'response':'canon',{reference:Number($('#reference').value),count:Number($('#density').value)});return;}
 if(b.id==='fill'){preview('fill',{count:Number($('#fill-count').value)});return;}
 if(b.id==='undo'){circle.cancel();endGesture();const old=history.pop();if(old){project=old;resetPreview();notice='Изменение отменено';save();buildTools();sync();paint();}return;}
 if(b.id==='play'){circle.cancel();endGesture();$('#error').hidden=true;if(audio.running)audio.stop();else audio.start(audioState());return;}
 if(b.id==='save'){download(JSON.stringify(project,null,2)+'\n','beat-project.json','application/json');return;}
 if(b.id==='export'){try{download(B.exportStrudel(project,'https://bavadim.github.io/phase-cube/assets/samples/'),'beat.strudel','text/plain');notice='Экспортирована вся цепочка с темпом, звуками и акцентами';paint();}catch(error){showError(error);}}
});
$('#tool-content').addEventListener('input',e=>{const id=e.target.id,v=Number(e.target.value);if(e.target.type!=='range')return;
 if($('#'+id+'-value'))$('#'+id+'-value').value=v+(['swing','accent','symmetry'].includes(id)?'%':id==='phase'?'°':'');
 if(id==='swing'||id==='accent')preview('groove',{swing:Number($('#swing').value)/100,accent:Number($('#accent').value)/100});
 if(id==='axis'||id==='symmetry')preview('mirror',{axis:Number($('#axis').value),amount:Number($('#symmetry').value)/100});
 if(id==='density')preview('response',{reference:Number($('#reference').value),count:v});
 if(id==='fill-count')preview('fill',{count:v});
 if(id==='phase'||id==='magnitude')preview('scratch',{k:Number($('#coefficient').value),phase:Number($('#phase').value),magnitude:Number($('#magnitude').value)});
});
$('#tool-content').addEventListener('change',e=>{
 if(e.target.id==='coefficient'){
  const es=chosen().events,k=Number(e.target.value),cs=R.dft(es.map(a=>R.polar(a.velocity*2,B.TAU*a.time)));$('#phase').value=0;$('#phase-value').value='0°';$('#magnitude').value=R.abs(cs[k]);$('#magnitude-value').value=R.abs(cs[k]).toFixed(3);resetPreview();sync();paint();
 }
 if(e.target.id==='reference'){resetPreview();sync();paint();}
});
$('#snap').addEventListener('change',()=>paint());
$('#gain').addEventListener('input',e=>{if(!gesture)beginGesture();chosen().gain=Number(e.target.value);sync();paint();});$('#gain').addEventListener('change',endGesture);
$('#sound').addEventListener('change',e=>mutate(()=>{chosen().sound=e.target.value;},'Звук заменён. Ритм сохранён.'));
$('#bpm').addEventListener('change',e=>{const v=Number(e.target.value);if(v<50||v>200||!Number.isFinite(v)){e.target.value=project.bpm;return;}mutate(()=>{project.bpm=v;});});
$('#title').addEventListener('change',e=>mutate(()=>{project.title=e.target.value.slice(0,80);}));
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#load').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>150000)throw Error('Файл больше 150 КБ');const p=B.validate(JSON.parse(await file.text()));mutate(()=>{project=B.clone(p);},'Проект открыт',true);}catch(error){showError(error);}finally{e.target.value='';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){circle.cancel();cancelGesture();if(draft){resetPreview();sync();buildTools();paint();}}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#undo').click();}});
window.addEventListener('pagehide',()=>{circle.cancel();endGesture();audio.stop();});
window.beatBuilder={project:()=>B.clone(project),heard:()=>B.clone(heard()),state:()=>({pattern,track,task,playback,compare,preview:!!draft,history:history.length}),score:()=>B.score(heard(),{pattern,chain:playback==='chain'}),audio,circle};
buildTools();sync();paint();
requestAnimationFrame(function tick(){const c=audio.clock()*4,phase=B.wrap(c);circle.tick(phase);const step=Math.floor(phase*16);for(const b of document.querySelectorAll('[data-cell]'))b.classList.toggle('playing',audio.running&&Number(b.dataset.cell.split(':')[1])===step);for(const b of document.querySelectorAll('[data-bar]')){const active=audio.running&&playback==='chain'&&Number(b.dataset.bar)===Math.floor(c)%4;b.classList.toggle('playing',active);if(active)b.style.setProperty('--bar-progress',phase*100+'%');}$('#meter-fill').style.width=Math.min(100,audio.rms()*900)+'%';requestAnimationFrame(tick);});
})();
