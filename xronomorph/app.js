/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const M=XronoModel,$=id=>document.getElementById(id),storage='biba-xronomorph/1';
  let state={...M.initial(),mode:'wf'},rows=[],layerButtons=[],error=null;
  const treeHistory=[],patternHistory=[];
  try{const saved=JSON.parse(localStorage.getItem(storage));if(saved)state=M.migrate(saved);}catch{}
  const requestedMode=new URLSearchParams(location.search).get('mode');
  if(['pb','wf','tree'].includes(requestedMode)&&state.mode!==requestedMode){state.mode=requestedMode;state.selected=requestedMode==='tree'?1:0;}
  const save=()=>{try{localStorage.setItem(storage,JSON.stringify(state));}catch{}};
  const fail=e=>{error=String(e.message||e);$('error').textContent=error;$('error').hidden=false;updateTransport();};
  const audio=new XronoAudio.Transport(strudel,{onChange:updateTransport,onError:fail});
  const view=new XronoView($('diagram'),{onSelect:id=>{state.selected=id;render();save();},
    onRotate:(id,phase)=>{state=M.rotate(state,id,phase);render();},onCommit:save,
    onRatio:ratio=>{state.wf.ratio=ratio;render();},onRatioCancel:ratio=>{state.wf.ratio=ratio;render();},
    onCancel:(id,phase)=>{const snap=state.snap;state.snap=0;state=M.rotate(state,id,phase);state.snap=snap;render();},onTreeAction:treeAction,onPatternAction:patternAction});
  const activeLayers=()=>state.mode==='pb'?state.pb:state.mode==='tree'?state.tree.layers:state.wf.layers;
  function treeAction(action){
    try{
      const next=XronoTree.apply(state.tree,{...action,owner:state.selected});
      if(JSON.stringify(next)===JSON.stringify(state.tree))return;
      treeHistory.push(M.clone(state.tree));if(treeHistory.length>48)treeHistory.shift();
      state.tree=next;render();save();
    }catch(e){fail(e);}
  }
  function rememberPattern(){const p=state.pb[state.selected];patternHistory.push({id:state.selected,rhythm:p.rhythm?M.clone(p.rhythm):null});if(patternHistory.length>48)patternHistory.shift();}
  function patternAction(action){
    try{const next=M.divide(state,state.selected,action);rememberPattern();state=next;render();save();}catch(e){fail(e);}
  }
  function mutate(change,persist=true){const next=M.clone(state);change(next);try{M.validate(next);state=next;render();if(persist)save();}catch(e){fail(e);render();}}
  function editLayer(change){mutate(s=>change(s.mode==='pb'?s.pb[s.selected]:s.mode==='tree'?s.tree.layers[s.selected]:s.wf.layers[s.selected]));}
  function value(id,n){if($(id).value!==String(n))$(id).value=String(n);}
  function updateTransport(){
    $('play').disabled=audio.starting;$('play').textContent=audio.starting?'Загрузка…':audio.running?'Стоп':'Слушать';$('play').setAttribute('aria-pressed',String(audio.running));
    $('audio-state').textContent=audio.starting?'Готовим звук…':audio.running?'Играет':error?'Можно повторить запуск':'Готов к прослушиванию';
  }
  function render(){
    const treeMode=state.mode==='tree',patternMode=state.mode==='pb';document.body.dataset.xronoMode=state.mode;
    rows=M.project(state);audio.update(state);view.set(state,rows);
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    $('wf-controls').hidden=state.mode!=='wf';$('shape-label').hidden=state.mode!=='pb';$('add-layer').hidden=state.mode!=='pb';$('add-layer').disabled=state.pb.length===8;
    $('hierarchy-options').hidden=state.mode!=='wf';$('phase-control').hidden=!patternMode;$('snap-label').hidden=!patternMode;
    document.querySelector('.selected-editor').hidden=treeMode;$('tree-tools').hidden=!(treeMode||patternMode);$('tree-palette-help').hidden=!treeMode;
    $('layers-title').textContent=treeMode?'Инструмент для нового удара':'Слои';$('tree-undo').disabled=treeMode?!treeHistory.length:!patternHistory.length;
    $('tree-undo').textContent=patternMode?'Отменить деление':'Отменить';$('tree-reset').textContent=patternMode?'Исходная фигура':'Исходный ритм';
    $('gesture-help').textContent=treeMode?'«+» делит интервал и добавляет удар. «−» сворачивает ветку. Нажмите на ноту, чтобы передать её выбранному инструменту.':patternMode?'Тяните цветную ноту — вращается рисунок её инструмента. «+» делит интервал выбранного инструмента, «−» сворачивает ветку.':'Тяните крупную круглую точку по окружности: меняется L/s. Сплошные дуги — длинные интервалы, пунктирные — короткие. Квадраты неподвижны.';
    const key=state.mode+':'+rows.length;
    if($('layers').dataset.key!==key){
      $('layers').dataset.key=key;$('layers').replaceChildren();layerButtons=[];
      rows.forEach((row,i)=>{
        const div=document.createElement('div');div.className='layer-row';
        const enabled=document.createElement('input');enabled.type='checkbox';enabled.setAttribute('aria-label','Звук слоя '+(i+1));enabled.addEventListener('change',()=>mutate(s=>{(s.mode==='pb'?s.pb:s.mode==='tree'?s.tree.layers:s.wf.layers)[i].enabled=enabled.checked;}));
        const button=document.createElement('button');button.type='button';button.style.setProperty('--part',view.colors[i]);
        const swatch=document.createElement('span');swatch.className='swatch';swatch.setAttribute('aria-hidden','true');
        const name=document.createElement('span');name.className='name';const count=document.createElement('small');button.append(swatch,name,count);
        button.addEventListener('click',()=>{state.selected=i;render();save();});div.append(enabled,button);$('layers').append(div);layerButtons.push({enabled,button,name,count});
      });
    }
    rows.forEach((row,i)=>{const b=layerButtons[i],instrument=M.instruments.find(v=>v.id===row.instrument);b.enabled.checked=row.enabled;b.enabled.hidden=treeMode;b.button.setAttribute('aria-pressed',String(i===state.selected));b.name.textContent=(treeMode?'':(i+1)+'. ')+instrument.label;b.count.textContent=row.points.length+(treeMode?'':' уд.');});
    const p=activeLayers()[state.selected],row=rows[state.selected];
    $('selected-title').textContent='Слой '+(state.selected+1)+(state.mode==='wf'?' · '+row.allPoints.length+' позиций':'');
    for(const[id,n]of Object.entries({rpm:state.rpm,volume:state.volume,shape:p.shape,snap:state.snap,phase:((state.mode==='pb'?p.phase:state.wf.phase)*360).toFixed(1),instrument:p.instrument,note:p.note,gate:p.gateMs,velocity:p.velocity,longs:state.wf.longs,shorts:state.wf.shorts,ratio:state.wf.ratio,'ratio-number':+state.wf.ratio.toFixed(6)}))value(id,n);
    $('rpm-value').textContent=Number(state.rpm.toFixed(1))+' об/мин · '+Number((60/state.rpm).toFixed(2))+' с';$('volume-value').textContent=Math.round(state.volume*100)+'%';
    $('phase-value').textContent=Math.round((state.mode==='pb'?p.phase:state.wf.phase)*360)+'°';$('velocity-value').textContent=Math.round(p.velocity*100)+'%';
    $('complement').checked=p.complement;$('complement').disabled=state.selected===0;
    $('reverse').checked=state.wf.reverse[state.selected];$('reverse').disabled=state.mode==='wf'&&!row.canReverse;
    const sounding=rows.filter(p=>p.enabled),all=sounding.flatMap(p=>p.points),status=treeMode?all.length+' ударов за цикл · '+sounding.filter(p=>p.points.length).length+' инструментов · до 16 ударов':state.mode==='pb'?'Баланс '+(all.length?M.balance(all).toFixed(3):'—')+' · '+sounding.length+' слоёв · '+all.length+' ударов за цикл':
      'L / s = '+Number(state.wf.ratio.toFixed(4))+' · '+all.length+' ударов · '+(row.split?'неравномерные интервалы':'равномерная сетка на этом уровне');
    if($('geometry-status').textContent!==status)$('geometry-status').textContent=status;
    updateTransport();
  }
  for(const shape of M.shapes){const option=document.createElement('option');option.value=shape.id;option.textContent=shape.label;$('shape').append(option);}
  for(const sound of M.instruments){const option=document.createElement('option');option.value=sound.id;option.textContent=sound.label;$('instrument').append(option);}
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{view.end(null,true);mutate(s=>{s.mode=b.dataset.mode;s.selected=s.mode==='tree'?1:0;});}));
  $('play').addEventListener('click',()=>{error=null;$('error').hidden=true;if(audio.running)audio.stop();else audio.start(state);});
  $('rpm').addEventListener('input',()=>mutate(s=>{s.rpm=+$('rpm').value;}));
  $('volume').addEventListener('input',()=>mutate(s=>{s.volume=+$('volume').value;}));
  $('shape').addEventListener('change',()=>{view.end(null,true);for(let i=patternHistory.length-1;i>=0;i--)if(patternHistory[i].id===state.selected)patternHistory.splice(i,1);editLayer(p=>{p.shape=$('shape').value;delete p.rhythm;});});
  $('snap').addEventListener('change',()=>mutate(s=>{s.snap=+$('snap').value;}));
  $('phase').addEventListener('input',()=>{state=M.rotate(state,state.selected,+$('phase').value/360);render();save();});
  $('instrument').addEventListener('change',()=>editLayer(p=>{p.instrument=$('instrument').value;p.note=M.instruments.find(v=>v.id===p.instrument).note;}));
  const numeric=(id,min,max,apply)=>$(id).addEventListener('change',()=>{if($(id).value.trim()===''||!Number.isFinite(+$(id).value)){render();return;}const n=Math.max(min,Math.min(max,+$(id).value));apply(n);});
  numeric('note',24,96,n=>editLayer(p=>{p.note=Math.round(n);}));numeric('gate',20,800,n=>editLayer(p=>{p.gateMs=n;}));
  $('velocity').addEventListener('input',()=>editLayer(p=>{p.velocity=+$('velocity').value;}));
  $('complement').addEventListener('change',()=>editLayer(p=>{p.complement=$('complement').checked;}));
  $('reverse').addEventListener('change',()=>mutate(s=>{s.wf.reverse[s.selected]=$('reverse').checked;}));
  numeric('longs',1,8,n=>mutate(s=>{s.wf.longs=Math.round(n);}));numeric('shorts',1,8,n=>mutate(s=>{s.wf.shorts=Math.round(n);}));
  $('ratio').addEventListener('input',()=>mutate(s=>{s.wf.ratio=+$('ratio').value;}));numeric('ratio-number',1,8,n=>mutate(s=>{s.wf.ratio=n;}));
  document.querySelectorAll('[data-ratio]').forEach(b=>b.addEventListener('click',()=>mutate(s=>{s.wf.ratio=b.dataset.ratio==='phi'?(1+Math.sqrt(5))/2:+b.dataset.ratio;})));
  $('add-layer').addEventListener('click',()=>mutate(s=>{if(s.pb.length>=8)return;const p=M.clone(s.wf.layers[s.pb.length%6]);p.shape='regular-4';p.phase=0;p.enabled=true;s.pb.push(p);s.selected=s.pb.length-1;}));
  $('tree-undo').addEventListener('click',()=>{
    if(state.mode==='pb'){const before=patternHistory.pop();if(!before)return;if(before.rhythm)state.pb[before.id].rhythm=before.rhythm;else delete state.pb[before.id].rhythm;state.selected=before.id;}
    else{if(!treeHistory.length)return;state.tree=treeHistory.pop();}render();save();
  });
  $('tree-reset').addEventListener('click',()=>{
    if(state.mode==='pb'){if(!state.pb[state.selected].rhythm)return;rememberPattern();delete state.pb[state.selected].rhythm;}
    else{const next=M.initialTree();if(JSON.stringify(state.tree)===JSON.stringify(next))return;treeHistory.push(M.clone(state.tree));if(treeHistory.length>48)treeHistory.shift();state.tree=next;}render();save();
  });
  function tick(){view.tick(audio.clock(),audio.running,audio.events,strudel.getAudioContext().currentTime);requestAnimationFrame(tick);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){view.end(null,true);audio.stop();}});
  window.addEventListener('pagehide',()=>audio.stop());
  render();tick();
  window.xronoLab={state:()=>M.clone(state),rows:()=>M.clone(rows),set:s=>{view.end(null,true);state=M.migrate(s);treeHistory.length=0;patternHistory.length=0;render();save();},treeAction,patternAction,treeHistory:()=>treeHistory.length,audio,view,model:M};
})();
