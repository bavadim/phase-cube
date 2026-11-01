/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
'use strict';const M=RhythmMethods,$=s=>document.querySelector(s),key='biba-rhythm-methods/1',controls=$('#mode-controls'),editor=$('#edit-controls');
let state=M.initial(),before=null,history=[],message='',storageError=false;
try{const raw=localStorage.getItem(key);if(raw)state=M.validate(JSON.parse(raw));}catch{message='Сохранение не прочитано. Открыт исходный пример.';}
const projection={clone:M.clone,instruments:XronoModel.instruments,score:s=>s.events};
const audio=new XronoAudio.Transport(strudel,{projection,sampleBase:new URL('../../assets/samples/',document.baseURI).href,onChange:player,onError:e=>{$('#error').hidden=false;$('#error').textContent=e.message||String(e);player();}});
function syncAudio(){audio.update({rpm:state.bpm/4,volume:state.volume,events:M.score(state)});}
function save(){try{localStorage.setItem(key,JSON.stringify(state));storageError=false;}catch{storageError=true;}}
function musical(s){const t=M.clone(s);delete t.comparison;delete t.bpm;delete t.volume;delete t.sound;return JSON.stringify(t);}
function begin(role,index){finish();if(role==='coefficient')state.scratch.selected=index;if(role==='entry')state.canon.selected=index;if(role==='atom')state.dictionary.selected=index;before=M.clone(state);message='';paint();}
function finish(){if(!before)return;const old=before;before=null;if(musical(old)!==musical(state)){history.push(old);if(history.length>50)history.shift();save();}$('#undo').disabled=!history.length;}
function cancel(){if(before){state=before;before=null;message='Жест отменён';syncAudio();paint();}}
function edit(fn,{rebuild=false}={}){view.cancel();begin();try{fn();M.validate(state);finish();if(rebuild)build();syncAudio();paint();}catch(e){cancel();showError(e);}}
function change(payload){const{role,index,value}=payload;
 if(role==='coefficient'){const v=M.setCoefficient(state.scratch,index,value);message=v.limited?'Достигнута граница силы ударов 2.':'';}
 if(role==='axis')state.mirror.axis=value;
 if(role==='strength')state.mirror.source[index]=value;
 if(role==='cell'){const a=state.canon.motif;state.canon.motif=a.includes(index)?a.filter(j=>j!==index):a.concat(index).sort((a,b)=>a-b);}
 if(role==='entry')state.canon.entries[index]=value;
 if(role==='atom')Object.assign(state.dictionary.atoms[index],value);
 syncAudio();paint();
}
const view=new RhythmMethodsView($('#control'),$('#result'),{begin,move:change,end:finish,cancel});
function button(label,attr,value,pressed=false){return`<button type="button" ${attr}="${value}"${pressed?' aria-pressed="true"':''}>${label}</button>`;}
function parameters(items){return'<div class="parameters">'+items.map(({label,id,min,max,step})=>`<label>${label}<input id="${id}" type="range" min="${min}" max="${max}" step="${step}"><output for="${id}" id="${id}-value"></output></label>`).join('')+'</div>';}
function build(){
 const d=M.descriptions[state.mode];$('#task-title').textContent=d.title;$('#help').textContent={scratch:'Тяните конец стрелки: угол и длина меняют всю фразу.',mirror:'Тяните ось зеркала; радиус удара меняет его силу.',canon:'Нарисуйте мотив слева → подберите вступления копий.',dictionary:'Нарисуйте цель → разложите на мотивы → вращайте фигуры.'}[state.mode];$('#control-title').textContent=d.control;$('#result-title').textContent=d.result;$('#source-link').textContent=d.source;$('#source-link').href=d.url;$('#formula').textContent=d.formula;$('#guarantee').textContent=d.help+' '+d.guarantee;
 controls.innerHTML='';editor.innerHTML='';
 if(state.mode==='scratch'){
  controls.innerHTML='<div class="controls">'+button('8 равномерных ударов','data-preset','regular')+button('Клаве · 5 ударов','data-preset','clave')+'</div><div class="selection">'+state.scratch.coefficients.map((_,i)=>button(`a${i}`,'data-coefficient',i)).join('')+'</div>';
  editor.innerHTML=parameters([{label:'Фаза вклада',id:'phase',min:-180,max:180,step:1},{label:'Модуль вклада',id:'magnitude',min:0,max:2,step:.005}]);
 }
 if(state.mode==='mirror')editor.innerHTML=parameters([{label:'Ось',id:'axis',min:0,max:15,step:1},{label:'Симметрия',id:'amount',min:0,max:1,step:.01}]);
 if(state.mode==='canon'){
  controls.innerHTML='<div class="controls">'+button('Подобрать','data-action','solve-canon')+button('Вариант →','data-action','next-canon')+button('+ Копия','data-action','add-copy')+button('− Копия','data-action','remove-copy')+'</div>';
  editor.innerHTML='<div class="selection" id="part-selection"></div>'+parameters([{label:'Начало копии',id:'entry',min:0,max:15,step:1}]);
 }
 if(state.mode==='dictionary'){
  controls.innerHTML='<div class="controls">Целевой рисунок '+button('Разложить','data-action','decompose')+'</div><div class="step-grid" aria-label="Целевой рисунок">'+Array.from({length:16},(_,i)=>button(i+1,'data-target',i)).join('')+'</div>';
  editor.innerHTML='<div class="selection" id="part-selection"></div><div class="actions">'+M.dictionary.map(d=>button('+ '+d.label,'data-add',d.id)).join('')+button('Удалить выбранный','data-action','remove-atom')+'</div>'+parameters([{label:'Сдвиг мотива',id:'shift',min:0,max:15,step:1},{label:'Сила мотива',id:'gain',min:0,max:2,step:.01}]);
 }
 selection();paint();
}
function selection(){const node=$('#part-selection');if(!node)return;
 if(state.mode==='canon')node.innerHTML=state.canon.entries.map((_,i)=>button(`Копия ${i+1}`,'data-part',i)).join('');
 if(state.mode==='dictionary')node.innerHTML=state.dictionary.atoms.map((a,i)=>button(`${i+1} · ${M.dictionary.find(m=>m.id===a.kind).label}`,'data-part',i)).join('');
}
function value(id,v,label,disabled=false){const el=$('#'+id);if(!el)return;el.value=v;el.disabled=disabled;$('#'+id+'-value').value=label;}
function paint(){
 view.draw(state);player();$('#bpm').value=state.bpm;$('#bpm-value').value=state.bpm+' BPM';$('#sound').value=state.sound;$('#undo').disabled=!history.length;
 for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));
 for(const b of document.querySelectorAll('[data-compare]'))b.setAttribute('aria-pressed',String(b.dataset.compare===state.comparison));
 let summary='';
 if(state.mode==='scratch'){
  const s=state.scratch,c=s.coefficients[s.selected],phase=M.abs(c)>1e-10?Math.atan2(c[1],c[0])*180/Math.PI:0;
  for(const b of controls.querySelectorAll('[data-coefficient]'))b.setAttribute('aria-pressed',String(Number(b.dataset.coefficient)===s.selected));
  for(const b of controls.querySelectorAll('[data-preset]'))b.setAttribute('aria-pressed',String(b.dataset.preset===s.preset));
  value('phase',phase,Math.round(phase)+'°');value('magnitude',M.abs(c),M.abs(c).toFixed(3));const events=M.scratchPoints(s),silent=events.filter(e=>e.time===null).length;
  summary=`a${s.selected} · событий ${events.length}, звучит ${events.length-silent} · модуль меняет силу деформации, не громкость одного удара`;
 }
 if(state.mode==='mirror'){
  const s=state.mirror,y=M.resultVector(state);value('axis',s.axis,(s.axis*180/16).toFixed(1)+'°');value('amount',s.amount,Math.round(s.amount*100)+'%');
  summary=`Асимметрия ${(M.mirrorError(y,s.axis)*100).toFixed(1)}% · суммарная сила ${y.reduce((a,b)=>a+b,0).toFixed(2)} сохранена`;
 }
 if(state.mode==='canon'){
  const s=state.canon,c=M.resultVector(state),holes=c.filter(v=>v===0).length,over=c.filter(v=>v>1).length;
  value('entry',s.entries[s.selected]||0,`${s.entries[s.selected]||0}/16`,!s.entries.length);
  const node=$('#part-selection');if(node&&node.children.length!==s.entries.length)selection();
  for(const b of editor.querySelectorAll('[data-part]'))b.setAttribute('aria-pressed',String(Number(b.dataset.part)===s.selected));
  summary=holes||over?`Пропусков ${holes} · совпадений ${over}`:'Точное покрытие · 16 шагов, ни одного пропуска или совпадения';
 }
 if(state.mode==='dictionary'){
  const s=state.dictionary,a=s.atoms[s.selected],y=M.resultVector(state),err=y.reduce((v,x,i)=>v+Math.abs(x-s.target[i]),0);
  value('shift',a?.shift||0,`${a?.shift||0}/16`,!a);value('gain',a?.gain||0,(a?.gain||0).toFixed(2)+'×',!a);
  const node=$('#part-selection');if(node&&node.children.length!==s.atoms.length)selection();
  for(const b of editor.querySelectorAll('[data-part]'))b.setAttribute('aria-pressed',String(Number(b.dataset.part)===s.selected));
  for(const b of controls.querySelectorAll('[data-target]'))b.setAttribute('aria-pressed',String(!!s.target[Number(b.dataset.target)]));
  summary=`Мотивов ${s.atoms.length} · ${err<1e-8?'рисунок совпадает с целью':'расхождение с целью '+err.toFixed(2)}`;
 }
 $('#status').textContent=(message?message+' ':'')+summary+(storageError?' · локальное сохранение недоступно':'');
}
function player(){if(!audio)return;$('#play').textContent=audio.starting?'Включаю…':audio.running?'Пауза':'Слушать';$('#play').setAttribute('aria-pressed',String(audio.running));$('#play').disabled=audio.starting;$('#audio-state').textContent=audio.running?(state.comparison==='source'?'Звучит исходник':'Звучит результат'):'Звук включается кнопкой «Слушать»';}
function showError(e){$('#error').hidden=false;$('#error').textContent=e.message||String(e);}
function handleClick(e){const b=e.target.closest('button');if(!b)return;
 if(b.dataset.coefficient!==undefined){state.scratch.selected=Number(b.dataset.coefficient);message='';save();paint();return;}
 if(b.dataset.part!==undefined){state[state.mode].selected=Number(b.dataset.part);message='';save();paint();return;}
 if(b.dataset.preset){edit(()=>{state.scratch=M.scratchPreset(b.dataset.preset);},{rebuild:true});return;}
 if(b.dataset.target!==undefined){edit(()=>{const i=Number(b.dataset.target);state.dictionary.target[i]=1-state.dictionary.target[i];});return;}
 if(b.dataset.add){edit(()=>{if(state.dictionary.atoms.length>=16)throw Error('До 16 мотивов в одном эскизе');state.dictionary.atoms.push({kind:b.dataset.add,shift:0,gain:1});state.dictionary.selected=state.dictionary.atoms.length-1;},{rebuild:true});return;}
 const action=b.dataset.action;if(!action)return;
 edit(()=>{
  if(action==='solve-canon'||action==='next-canon'){
   const c=state.canon,solutions=M.complements(16,c.motif);if(!solutions.length){message='Для этого мотива точного покрытия нет. Измените удары слева.';return;}
   const index=solutions.findIndex(a=>a.join(',')===c.entries.slice().sort((a,b)=>a-b).join(',')),next=action==='next-canon'?(index+1)%solutions.length:0;c.entries=solutions[next].slice();c.selected=0;message=`Покрытие ${next+1} из ${solutions.length}.`;
  }
  if(action==='add-copy'){if(state.canon.entries.length>=16)return;state.canon.entries.push(0);state.canon.selected=state.canon.entries.length-1;}
  if(action==='remove-copy'){state.canon.entries.splice(state.canon.selected,1);state.canon.selected=Math.max(0,state.canon.entries.length-1);}
  if(action==='decompose'){state.dictionary.atoms=M.decompose(state.dictionary.target);state.dictionary.selected=0;message='Минимальное точное разложение по выбранному словарю.';}
  if(action==='remove-atom'){state.dictionary.atoms.splice(state.dictionary.selected,1);state.dictionary.selected=Math.max(0,state.dictionary.atoms.length-1);}
 },{rebuild:true});
}
controls.addEventListener('click',handleClick);editor.addEventListener('click',handleClick);
function input(e){if(e.target.type!=='range')return;const id=e.target.id,v=Number(e.target.value);if(!before)begin();
 if(state.mode==='scratch'&&['phase','magnitude'].includes(id)){
  const a=state.scratch,c=a.coefficients[a.selected],angle=M.abs(c)>1e-10?Math.atan2(c[1],c[0]):0,result=id==='phase'?M.setPhase(a,a.selected,v*Math.PI/180):M.setCoefficient(a,a.selected,M.polar(v,angle));message=result.limited?'Достигнута граница силы ударов 2.':'';
 }
 if(id==='axis')state.mirror.axis=v;if(id==='amount')state.mirror.amount=v;if(id==='entry'&&state.canon.entries.length)state.canon.entries[state.canon.selected]=v;
 if(id==='shift'&&state.dictionary.atoms.length)state.dictionary.atoms[state.dictionary.selected].shift=v;
 if(id==='gain'&&state.dictionary.atoms.length)state.dictionary.atoms[state.dictionary.selected].gain=v;
 syncAudio();paint();
}
editor.addEventListener('input',input);editor.addEventListener('change',finish);
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{view.cancel();finish();state.mode=b.dataset.mode;message='';save();build();syncAudio();});
for(const b of document.querySelectorAll('[data-compare]'))b.addEventListener('click',()=>{state.comparison=b.dataset.compare;syncAudio();save();paint();});
$('#play').addEventListener('click',()=>{view.cancel();finish();$('#error').hidden=true;if(audio.running)audio.stop();else audio.start({rpm:state.bpm/4,volume:state.volume,events:M.score(state)});});
$('#bpm').addEventListener('input',e=>{state.bpm=Number(e.target.value);syncAudio();paint();});$('#bpm').addEventListener('change',save);
$('#sound').addEventListener('change',e=>{state.sound=e.target.value;syncAudio();save();paint();});
$('#undo').addEventListener('click',()=>{view.cancel();finish();const old=history.pop();if(!old)return;state={...old,bpm:state.bpm,volume:state.volume,sound:state.sound,comparison:state.comparison};message='Правка отменена';save();build();syncAudio();});
$('#save').addEventListener('click',()=>{view.cancel();finish();const blob=new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rhythm-methods.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#load').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('Файл больше 100 КБ');const loaded=M.validate(JSON.parse(await file.text()));edit(()=>{state=loaded;message='Рисунок открыт';},{rebuild:true});}catch(error){showError(error);}finally{e.target.value='';}});
window.addEventListener('pagehide',()=>{view.cancel();finish();audio.stop();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&before)cancel();});
window.rhythmMethods={state:()=>M.clone(state),audio,view,history:()=>history.length,score:()=>M.score(state)};
build();syncAudio();requestAnimationFrame(function tick(){view.tick(audio.clock());requestAnimationFrame(tick);});
})();
