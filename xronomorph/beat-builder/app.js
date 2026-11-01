/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
'use strict';
const B=BeatBuilder,R=RhythmMethods,$=s=>document.querySelector(s),key='biba-beat-builder/1';
const titles={draw:'Время и сила',shift:'Повернуть рисунок',groove:'Изменить грув',dialogue:'Ответить другой партии',variation:'Развить рисунок',foundation:'Начать с мотива'};
let project=B.initial(),pattern='A',track=2,task='draw',playback='pattern',selection=[],multi=false,draft=null,compare='after',history=[],gesture=null,notice='';
try{const raw=localStorage.getItem(key);if(raw)project=B.validate(JSON.parse(raw));}catch{notice='Сохранение не прочитано. Открыт стартовый бит.';}
const projection={clone:B.clone,instruments:XronoModel.instruments,score:s=>s.events};
const audio=new XronoAudio.Transport(strudel,{projection,sampleBase:new URL('../../assets/samples/',document.baseURI).href,onChange:player,onError:showError});
const chosen=()=>project.patterns[pattern][track],heard=()=>draft&&compare==='after'?draft.project:project,visible=()=>heard().patterns[pattern][track];
const capture=()=>({project:B.clone(project),pattern,track,selection:selection.slice()});
const scope=()=>selection.length?`Выбрано ${selection.length} из ${chosen().events.length} ударов`:'Вся партия';
const partial=kind=>['rotate','groove'].includes(kind);
function audioState(){return{rpm:project.bpm/16,volume:1,events:B.score(heard(),{pattern,chain:playback==='chain'})};}
function sync(){audio.update(audioState());}
function save(){try{localStorage.setItem(key,JSON.stringify(project));$('#save-state').textContent='Правки сохранены в браузере';}catch{$('#save-state').textContent='Сохранение недоступно · скачайте JSON';}}
function showError(e){$('#error').hidden=false;$('#error').textContent=e.message||String(e);}
function push(old){if(JSON.stringify(old.project)!==JSON.stringify(project)){history.push(old);if(history.length>50)history.shift();save();}}
function restore(s){project=s.project;pattern=s.pattern;track=s.track;selection=s.selection;}
function resetPreview(){draft=null;compare='after';}
function blocked(){notice='Примените или отбросьте пробу перед ручной правкой.';paint();}
function mutate(fn,message=''){circle.cancel();endGesture();const old=capture();resetPreview();fn();B.validate(project);push(old);notice=message;buildTools();sync();paint();}
// Mixing and tempo can be auditioned without throwing away a rhythm proposal.
function globalEdit(fn){circle.cancel();endGesture();const old=capture();fn(project);if(draft)fn(draft.project);B.validate(project);push(old);sync();paint();}
function choosePoints(ids){if(draft){blocked();return;}selection=[...new Set(ids)].filter(i=>chosen().events[i]);notice='';buildTools();paint();}
function removePoints(ids){if(draft){blocked();return;}if(!ids.length)return;mutate(()=>{const removed=new Set(ids);chosen().events=chosen().events.filter((_,i)=>!removed.has(i));selection=[];},'Удары удалены');}
function beginGesture(payload){endGesture();gesture={snapshot:capture(),...payload,source:B.clone(chosen().events),ids:B.indices(chosen().events,selection)};}
function moveGesture(value){
 if(!gesture||gesture.kind==='mix')return;const g=gesture;
 let delta,velocity=0;
 if(g.kind==='rotate')delta=$('#snap').checked?Math.round(value.turn*16)/16:value.turn;
 else{const anchor=g.source[g.index],time=$('#snap').checked?B.wrap(Math.round(value.time*16)/16):value.time;delta=B.wrap(time-anchor.time+.5)-.5;velocity=value.velocity-anchor.velocity;}
 chosen().events=B.move(g.source,g.ids,delta,velocity);sync();paint();
}
function endGesture(){if(!gesture)return;const old=gesture.snapshot;gesture=null;B.validate(project);push(old);buildTools();paint();}
function cancelGesture(){if(!gesture)return;const g=gesture;gesture=null;restore(g.snapshot);if(g.kind==='mix')draft=g.draftBefore;notice='Жест отменён';buildTools();sync();paint();}
const circle=new BeatCircle($('#rhythm-circle'),{
 blocked,select:choosePoints,toggle:i=>choosePoints(selection.includes(i)?selection.filter(j=>j!==i):selection.concat(i)),
 begin:beginGesture,move:moveGesture,end:endGesture,cancel:cancelGesture,
 add:(time,velocity)=>{if(draft){blocked();return;}mutate(()=>{if(chosen().events.length>=64){notice='До 64 ударов в одной партии';return;}chosen().events.push({time,velocity});selection=[chosen().events.length-1];},'Удар добавлен');},
 remove:removePoints,nudge:({time,velocity})=>mutate(()=>{chosen().events=B.move(chosen().events,selection,time,velocity);})
});
function refuse(message){resetPreview();notice=message;sync();paint();}
function preview(kind,params={}){
 circle.cancel();endGesture();const p=B.clone(project),t=p.patterns[pattern][track],source=chosen().events;let description='',result;
 if(kind==='preset'){const preset=B.presets.find(x=>x.id===params.id);t.events=B.events(preset.points,.8);description=`${preset.label}: заменит выбранную партию целиком.`;}
 if(kind==='rotate'){t.events=B.move(source,selection,params.steps/16);description=`Сдвиг на ${params.steps>0?'+':''}${params.steps}/16. ${selection.length?'Остальные удары остаются на месте.':'Интервалы и сила ударов сохраняются.'}`;}
 if(kind==='groove'){t.events=B.subset(source,selection,es=>B.accent(B.swing(es,params.swing),params.accent));description='Свинг сдвигает слабые шестнадцатые; контраст меняет силу между опорными долями.';}
 if(kind==='mirror'){
  if(!B.isGrid(chosen())){refuse('Для зеркала нужна сетка 1/16. Свободные позиции сохраняем без округления.');return;}
  if(B.grid(chosen()).some(v=>v>1+B.EPS)){refuse('Для зеркала оставьте не более одного полного удара на клетку.');return;}
  t.events=B.mirror(source,params.axis,params.amount);description='Зеркало всей партии: отражение может добавить удары. Сумма силы сохраняется.';
 }
 if(kind==='response'||kind==='canon'){
  if(params.reference===track){refuse('Выберите другую партию для ответа.');return;}
  const ref=project.patterns[pattern][params.reference];result=kind==='canon'?B.canon(ref):B.complement(ref,params.count);
  if(result.error){refuse(result.error);return;}
  t.events=result.events;description=kind==='canon'?`${result.copies} копии мотива дополняют другую партию до полного покрытия 16 шагов.`:`${result.events.length} ударов в паузах. Другая партия не меняется.`;
 }
 if(kind==='fill'){t.events=B.fill(source,params.count);description='Изменена только последняя четверть такта. Первые три доли сохранены.';}
 if(kind==='scratch'){result=B.scratch(source,params.k,params.phase*Math.PI/180,params.magnitude);t.events=result.events;description=`a${params.k} меняет время и силу событий всей партии.${result.limited?' Достигнут предел силы 100%.':''}`;}
 B.validate(p);draft={project:p,kind,params,description,scope:partial(kind)?scope():kind==='fill'?'Последняя доля · вся партия':'Вся партия'};compare='after';notice='';sync();paint();
}
function labelRange(id,label,min,max,step,value,suffix='',disabled=false){return`<label class="tool-label" for="${id}">${label}<output id="${id}-value">${value}${suffix}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"${disabled?' disabled':''}>`;}
function buildTools(){
 const t=chosen(),host=$('#tool-content');
 if(task==='draw')host.innerHTML='<p class="tool-copy">Нажмите пустое место на круге — добавить удар. Тяните точку: по кругу меняется время, к центру — сила.</p><div class="point-readout"><div><strong id="point-time">—</strong><small id="point-time-label">ШАГ / 16</small></div><div><strong id="point-velocity">—</strong><small>СИЛА УДАРА</small></div></div><div class="small-actions"><button id="select-all">Выбрать все</button><button id="delete-points">Удалить</button></div><p class="subtle">Включите «Выделение» и отметьте несколько точек. Обод повернёт их вместе.</p><div class="tool-section keyboard-help"><kbd>←</kbd> <kbd>→</kbd> — время<br><kbd>↑</kbd> <kbd>↓</kbd> — сила<br><kbd>Shift</kbd> + клик — выделить ещё<br><kbd>Delete</kbd> — удалить выделенное</div>';
 if(task==='shift')host.innerHTML='<p class="tool-copy">Тяните внешний обод кольца. Выделенные удары двигаются вместе; без выделения вращается вся партия.</p><div class="small-actions"><button data-shift="-1">← Раньше</button><button data-shift="1">Позже →</button></div>'+labelRange('rotation','Сдвиг в шагах',-16,16,1,0)+'<p class="subtle">Один шаг — 1/16 такта. Полный оборот возвращает тот же рисунок.</p>';
 if(task==='foundation')host.innerHTML='<p class="tool-copy">Готовая фигура заменит партию на кольце. Остальные инструменты сохраняются.</p><div class="preset-grid">'+B.presets.map(p=>`<button class="preset" data-preset="${p.id}"><svg viewBox="0 0 110 30" aria-hidden="true">${p.points.length?p.points.map(i=>`<rect x="${i*6.5+2}" y="${i%4?13:7}" width="4" height="${i%4?10:16}" rx="1" fill="currentColor"/>`).join(''):'<path d="M2 22H108" stroke="currentColor" stroke-dasharray="3 4"/>'}</svg><b>${p.label}</b><small>${p.detail}</small></button>`).join('')+'</div>';
 if(task==='groove')host.innerHTML='<p class="tool-copy">Изменить характер выбранных ударов. Если ничего не выделено — всей партии.</p>'+labelRange('swing','Свинг',0,100,1,0,'%')+labelRange('accent','Контраст акцентов',0,100,1,0,'%')+'<details class="tool-section"><summary>Зеркало всей партии</summary><p>Перестраивает всю фигуру, включая невыделенные точки.</p>'+labelRange('axis','Ось отражения',0,15,1,0)+labelRange('symmetry','Доля отражения',0,100,1,0,'%')+'</details>';
 if(task==='dialogue'){
  const reference=track===0?1:0;
  host.innerHTML='<p class="tool-copy">Риски снаружи кольца показывают удары другой партии. Создайте свой ответ в её паузах.</p><label class="tool-label">Кому отвечаем?<select id="reference">'+B.voices.map((v,i)=>i!==track?`<option value="${i}"${i===reference?' selected':''}>${v.label}</option>`:'').join('')+'</select></label><p id="reference-label" class="reference-label"></p>'+labelRange('density','Ударов в ответе',1,12,1,4)+'<button id="response" class="wide">Подобрать ответ</button><details class="tool-section"><summary>Точное дополнение</summary><p>Закрыть все 16 шагов сдвинутыми копиями мотива. Подходит не каждому рисунку.</p><button id="canon" class="wide">Найти дополнение</button></details>';
 }
 if(task==='variation'){
  const k=t.events.length>1?1:0,coeff=t.events.length?R.dft(t.events.map(e=>R.polar(e.velocity*2,B.TAU*e.time))):[],mag=coeff.length?R.abs(coeff[k]):0;
  host.innerHTML='<p class="tool-copy">Скопируйте '+pattern+' в '+(pattern==='A'?'B':'A')+', измените концовку и поставьте новый вариант в последний такт.</p><button id="tool-copy" class="wide">'+pattern+' → '+(pattern==='A'?'B':'A')+' · сделать копию</button><div class="tool-section"><h3>Заполнение последней доли</h3>'+labelRange('fill-count','Ударов',1,8,1,4)+'<button id="fill" class="wide">Попробовать заполнение</button></div><details class="tool-section"><summary>Спектральная деформация</summary><p>Fourier scratching перестраивает время и силу всей партии. Выделение не ограничивает это действие.</p><label class="tool-label">Коэффициент<select id="coefficient"'+(!coeff.length?' disabled':'')+'>'+coeff.map((_,i)=>`<option value="${i}"${i===k?' selected':''}>a${i}</option>`).join('')+'</select></label>'+labelRange('phase','Угол вклада',-180,180,1,0,'°',!coeff.length)+labelRange('magnitude','Модуль вклада',0,2,.005,Number(mag.toFixed(3)),'',!coeff.length)+'<p class="subtle">Получаются свободные позиции между шагами 1/16.</p></details>';
 }
}
function drawParts(){
 const host=$('#part-list'),active=document.activeElement,focused=host.contains(active)?['track','mute','solo'].map(k=>active.dataset[k]!==undefined?{key:k,value:active.dataset[k]}:null).find(Boolean):null;
 host.innerHTML=heard().patterns[pattern].map((t,i)=>{const v=B.voices[i],hits=t.events.filter(e=>e.velocity>B.EPS).length;return`<section class="part ${i===track?'active':''}" style="--track:${v.color}"><button class="part-select" data-track="${i}" aria-pressed="${track===i}"><strong>${v.label}</strong><small>${hits}</small></button><svg class="part-preview" viewBox="0 0 160 28" aria-hidden="true"><path d="M0 25H160" stroke="#354835"/>${t.events.map(e=>`<rect x="${e.time*155}" y="${24-e.velocity*20}" width="3" height="${Math.max(1,e.velocity*20)}" rx="1" fill="${v.color}" opacity="${t.mute?.2:.75}"/>`).join('')}</svg><div class="part-mix"><span>${v.role}</span><button data-mute="${i}" aria-label="Выключить ${v.label}" aria-pressed="${t.mute}">M</button><button data-solo="${i}" aria-label="Соло ${v.label}" aria-pressed="${t.solo}">S</button></div></section>`;}).join('');
 if(focused)host.querySelector(`[data-${focused.key}="${focused.value}"]`)?.focus({preventScroll:true});
}
function paint(){
 const t=visible(),v=B.voices[track];selection=selection.filter(i=>chosen().events[i]);document.documentElement.style.setProperty('--track',v.color);
 if(document.activeElement!==$('#title'))$('#title').value=project.title;if(document.activeElement!==$('#bpm'))$('#bpm').value=project.bpm;
 $('#undo').disabled=!history.length;$('#copy').textContent=pattern+' → '+(pattern==='A'?'B':'A');$('#editor-title').textContent=v.label;$('#track-role').textContent=v.role+' · вариант '+pattern;$('#sound').value=t.sound;$('#gain').value=t.gain;$('#gain-value').value=Math.round(t.gain*100)+'%';
 $('#tools-title').textContent=titles[task];$('#action-target').textContent=draft?.scope||(['draw','shift','groove'].includes(task)?scope():'Вся партия');$('#multi').setAttribute('aria-pressed',String(multi));$('#multi').textContent=multi?'Выбирайте точки':'Выделение';$('#scope-all').textContent=selection.length?'Вся партия ↶':'Вся партия';
 $('#gesture-help').textContent=multi?'Касайтесь точек, чтобы добавить или убрать их из выделения. Затем тяните обод.':selection.length>1?'Тяните выбранную точку: группа меняет время и силу вместе. Обод вращает выделение.':'Точка — время и сила удара. Нажмите пустое место, чтобы добавить. Тяните обод для вращения.';
 for(const name of ['pattern','task','playback','compare'])for(const b of document.querySelectorAll(`[data-${name}]`))b.setAttribute('aria-pressed',String(b.dataset[name]===({pattern,task,playback,compare})[name]));
 $('#preview').hidden=!draft;$('#preview-description').textContent=draft?.description||'';$('#notice').textContent=notice;for(const id of ['save','export'])$('#'+id).disabled=!!draft;
 const point=selection.length===1?t.events[selection[0]]:null;
 if($('#point-time')){$('#point-time').textContent=point?(point.time*16+1).toFixed(2):String(selection.length||t.events.length);$('#point-time-label').textContent=point?'ШАГ / 16':selection.length?'ВЫБРАНО УДАРОВ':'УДАРОВ В ПАРТИИ';$('#point-velocity').textContent=point?Math.round(point.velocity*100)+'%':'—';$('#delete-points').disabled=!selection.length||!!draft;$('#select-all').disabled=!t.events.length||!!draft;}
 let reference=null;if(task==='dialogue'&&$('#reference')){const ri=Number($('#reference').value),rv=B.voices[ri];reference={events:heard().patterns[pattern][ri].events,color:rv.color};const label=$('#reference-label');label.style.setProperty('--reference',rv.color);label.innerHTML='<i></i>'+rv.label+' · удары на внешних рисках';}
 drawParts();circle.disabled=!!draft;circle.draw(t,v.color,{selection:draft&&!partial(draft.kind)?[]:selection,snap:$('#snap').checked,multi,reference});
 const chain=$('#chain'),focus=chain.contains(document.activeElement)?document.activeElement.dataset.bar:null;chain.innerHTML=project.chain.map((key,i)=>`<button data-bar="${i}" aria-label="Такт ${i+1}: ${key}, переключить вариант"><small>${i+1}</small><b>${key}</b></button>`).join('');if(focus!==undefined&&focus!==null)chain.querySelector(`[data-bar="${focus}"]`)?.focus({preventScroll:true});player();
}
function player(){if(!audio)return;$('#play').innerHTML=audio.starting?'… <span>Включаю</span>':audio.running?'Ⅱ <span>Пауза</span>':'▶ <span>Слушать</span>';$('#play').disabled=audio.starting;$('#play').setAttribute('aria-pressed',String(audio.running));$('#play-state').textContent=audio.running?(draft?(compare==='after'?'Проба в общем миксе':'Исходный бит'):'Звучит '+(playback==='chain'?'цепочка A/B':'вариант '+pattern)):'Готов к прослушиванию';}
function copyPattern(){mutate(()=>{const other=pattern==='A'?'B':'A';project.patterns[other]=B.clone(project.patterns[pattern]);pattern=other;selection=[];},'Копия открыта. Измените рисунок на кольце.');}
function changeContext(fn){circle.cancel();endGesture();resetPreview();fn();notice='';buildTools();sync();paint();}
$('#sound').innerHTML=B.voices.map(v=>`<option value="${v.id}">${v.label}</option>`).join('');
function handleButton(b){if(!b||b.disabled)return;
 if(b.dataset.pattern){changeContext(()=>{pattern=b.dataset.pattern;selection=[];});return;}
 if(b.dataset.task){changeContext(()=>{task=b.dataset.task;});return;}
 if(b.dataset.track!==undefined){changeContext(()=>{track=Number(b.dataset.track);selection=[];});return;}
 if(b.dataset.playback){playback=b.dataset.playback;sync();paint();return;}
 if(b.dataset.compare){compare=b.dataset.compare;sync();paint();return;}
 if(b.dataset.mute!==undefined||b.dataset.solo!==undefined){const flag=b.dataset.mute!==undefined?'mute':'solo',i=Number(b.dataset[flag]);globalEdit(p=>{const t=p.patterns[pattern][i];t[flag]=!t[flag];});return;}
 if(b.id==='scope-all'){choosePoints([]);return;}
 if(b.id==='multi'){if(draft){blocked();return;}multi=!multi;paint();return;}
 if(b.id==='select-all'){choosePoints(chosen().events.map((_,i)=>i));return;}
 if(b.id==='delete-points'){removePoints(selection);return;}
 if(b.dataset.preset){preview('preset',{id:b.dataset.preset});return;}
 if(b.dataset.shift){const steps=(draft?.kind==='rotate'?draft.params.steps:0)+Number(b.dataset.shift);if($('#rotation')){$('#rotation').value=steps;$('#rotation-value').value=steps;}preview('rotate',{steps});return;}
 if(b.dataset.bar!==undefined){globalEdit(p=>{const i=Number(b.dataset.bar);p.chain[i]=p.chain[i]==='A'?'B':'A';});return;}
 if(b.id==='copy'||b.id==='tool-copy'){copyPattern();return;}
 if(b.id==='apply'&&draft){const old=capture(),keep=partial(draft.kind);project=draft.project;resetPreview();if(!keep)selection=[];push(old);notice='Применено к рисунку';buildTools();sync();paint();return;}
 if(b.id==='discard'){resetPreview();notice='Исходный рисунок сохранён';buildTools();sync();paint();return;}
 if(b.id==='response'||b.id==='canon'){preview(b.id==='response'?'response':'canon',{reference:Number($('#reference').value),count:Number($('#density').value)});return;}
 if(b.id==='fill'){preview('fill',{count:Number($('#fill-count').value)});return;}
 if(b.id==='undo'){circle.cancel();endGesture();const old=history.pop();if(old){restore(old);resetPreview();notice='Изменение отменено';save();buildTools();sync();paint();}return;}
 if(b.id==='play'){circle.cancel();endGesture();$('#error').hidden=true;if(audio.running)audio.stop();else audio.start(audioState());return;}
 if(b.id==='save'){download(JSON.stringify(project,null,2)+'\n','beat-project.json','application/json');return;}
 if(b.id==='export'){try{download(B.exportStrudel(project,'https://bavadim.github.io/phase-cube/assets/samples/'),'beat.strudel','text/plain');notice='Цепочка экспортирована в Strudel';paint();}catch(error){showError(error);}}
}
// Touch commands commit on a completed tap. Waiting for a synthesized click
// can lose an action when the next gesture scrolls/rebuilds its DOM target.
// Keep click for mouse, keyboard and assistive technology; consume only the
// compatibility click from an already handled touch.
let touchDown=null,handledTouch=null;
document.addEventListener('pointerdown',e=>{handledTouch=null;if(e.pointerType!=='touch'||!e.isPrimary)return;const button=e.target.closest('button');touchDown=button?{button,id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
document.addEventListener('pointercancel',()=>{touchDown=null;});
document.addEventListener('pointerup',e=>{const t=touchDown;touchDown=null;if(!t||e.pointerId!==t.id||e.target.closest('button')!==t.button||Math.hypot(e.clientX-t.x,e.clientY-t.y)>8||t.button.disabled)return;handledTouch={button:t.button,time:performance.now()};e.preventDefault();handleButton(t.button);});
document.addEventListener('click',e=>{if(e.detail>0&&handledTouch&&performance.now()-handledTouch.time<800){e.preventDefault();e.stopImmediatePropagation();return;}handleButton(e.target.closest('button'));},true);
$('#tool-content').addEventListener('input',e=>{const id=e.target.id,v=Number(e.target.value);if(e.target.type!=='range')return;const out=$('#'+id+'-value');if(out)out.value=v+(['swing','accent','symmetry'].includes(id)?'%':id==='phase'?'°':'');
 if(id==='rotation')preview('rotate',{steps:v});
 if(id==='swing'||id==='accent')preview('groove',{swing:Number($('#swing').value)/100,accent:Number($('#accent').value)/100});
 if(id==='axis'||id==='symmetry')preview('mirror',{axis:Number($('#axis').value),amount:Number($('#symmetry').value)/100});
 if(id==='density')preview('response',{reference:Number($('#reference').value),count:v});
 if(id==='fill-count')preview('fill',{count:v});
 if(id==='phase'||id==='magnitude')preview('scratch',{k:Number($('#coefficient').value),phase:Number($('#phase').value),magnitude:Number($('#magnitude').value)});
});
$('#tool-content').addEventListener('change',e=>{
 if(e.target.id==='coefficient'){const es=chosen().events,k=Number(e.target.value),cs=R.dft(es.map(a=>R.polar(a.velocity*2,B.TAU*a.time)));$('#phase').value=0;$('#phase-value').value='0°';$('#magnitude').value=R.abs(cs[k]);$('#magnitude-value').value=R.abs(cs[k]).toFixed(3);resetPreview();sync();paint();}
 if(e.target.id==='reference'){resetPreview();sync();paint();}
});
$('#snap').addEventListener('change',()=>paint());
$('#gain').addEventListener('input',e=>{if(!gesture)gesture={snapshot:capture(),kind:'mix',draftBefore:draft?B.clone(draft):null};const value=Number(e.target.value);chosen().gain=value;if(draft)draft.project.patterns[pattern][track].gain=value;sync();paint();});$('#gain').addEventListener('change',endGesture);
$('#sound').addEventListener('change',e=>{const sound=e.target.value;globalEdit(p=>{p.patterns[pattern][track].sound=sound;});});
$('#bpm').addEventListener('change',e=>{const value=Number(e.target.value);if(value<50||value>200||!Number.isFinite(value)){e.target.value=project.bpm;return;}globalEdit(p=>{p.bpm=value;});});
$('#title').addEventListener('change',e=>{const value=e.target.value.slice(0,80);globalEdit(p=>{p.title=value;});});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#load').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>150000)throw Error('Файл больше 150 КБ');const p=B.validate(JSON.parse(await file.text()));mutate(()=>{project=B.clone(p);selection=[];},'Проект открыт');}catch(error){showError(error);}finally{e.target.value='';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){const editing=!!gesture;circle.cancel();cancelGesture();if(editing)return;if(draft){resetPreview();sync();buildTools();paint();}else if(selection.length)choosePoints([]);}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#undo').click();}});
window.addEventListener('pagehide',()=>{circle.cancel();endGesture();audio.stop();});
window.beatBuilder={project:()=>B.clone(project),heard:()=>B.clone(heard()),state:()=>({pattern,track,task,playback,compare,preview:!!draft,history:history.length,selection:selection.slice(),multi}),score:()=>B.score(heard(),{pattern,chain:playback==='chain'}),audio,circle};
buildTools();sync();paint();
requestAnimationFrame(function tick(){const c=audio.clock()*4,phase=B.wrap(c);circle.tick(phase);for(const b of document.querySelectorAll('[data-bar]')){const active=audio.running&&playback==='chain'&&Number(b.dataset.bar)===Math.floor(c)%4;b.classList.toggle('playing',active);if(active)b.style.setProperty('--bar-progress',phase*100+'%');}$('#meter-fill').style.width=Math.min(100,audio.rms()*900)+'%';requestAnimationFrame(tick);});
})();
