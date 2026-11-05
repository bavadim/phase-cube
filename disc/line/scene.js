/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';

  const ink = '#223545', ivory = '#fff6da', cobalt = '#4e6dd7', shadow = '#263e81';
  const aqua = '#7fcebb', rust = '#e27c56', acid = '#dce965';
  const noteColors = ['#a8d5bf','#a9bfe9','#acbeee','#a1c3d4','#f1ad79','#f1bd77',
    '#d4c68f','#e1d675','#cedc8f','#a6d3b9','#d7a6bd','#e1a6a1'];
  const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const wrap = n => ((n % 8) + 8) % 8;
  const noteName = n => names[n % 12] + (Math.floor(n / 12) - 1);
  const polar = (r,a) => [r*Math.sin(a),-r*Math.cos(a)];
  const path = (d,fill,stroke=ink,w=2,extra='') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  const circle = (x,y,r,fill,stroke=ink,w=2,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  const rect = (x,y,w,h,fill,r=0,stroke=ink,sw=2,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
  const text = (x,y,copy,cls='ls-tag',anchor='middle',extra='') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${copy}</text>`;
  const bolt = (x,y) => circle(x,y,3.1,ivory,ink,1.3)+path(`M${x-1.6} ${y+1.1} l3.2 -2.2`,'none',ink,.8);
  const group = (x,y,content,extra='') => `<g transform="translate(${x} ${y})" ${extra}>${content}</g>`;
  const button = (action,label,index) =>
    `data-action="${action}" ${index===undefined?'':`data-index="${index}"`} role="button" tabindex="0" aria-label="${label}"><title>${label}</title>`;
  const elements = (n,build) => Array.from({length:n},(_,i)=>build(i)).join('');
  function teeth(n,inside,outside) {
    const pts=[];
    for(let i=0;i<n;i++) for(const [offset,r] of [[-.5,inside],[-.27,inside],[-.20,outside],[.16,outside],[.27,inside]]) {
      pts.push(polar(r,(i+offset)*Math.PI*2/n).map(v=>v.toFixed(2)).join(' '));
    }
    return 'M'+pts.join(' L')+' Z';
  }
  function wheel(radius,body,extra='') {
    const spokes=elements(3,i=>`<g transform="rotate(${120*i})">${path(`M-3 -6 L-5 ${-radius+7} Q0 ${-radius+10} 5 ${-radius+7} L3 -6Z`,body,ink,1)}</g>`);
    return `<g ${extra}>${circle(0,0,radius,body)}${circle(0,0,radius-5,ivory,ink,1.5)}${spokes}${circle(0,0,5,ink)}</g>`;
  }
  const layouts = {
    wide:{w:1060,h:430, top:0, belt:[36,193,363], motor:[67,311], gears:[[186,310],[296,310]], drum:[440,295,76],
      fork:[406,182], glass:[574,117], metal:[588,240], discs:[[711,216],[792,216]], press:[941,214],
      lever:[754,124], lane1:'M363 171 Q393 171 406 177 Q455 95 542 95',
      lane2:'M363 171 Q393 171 406 177 Q468 218 551 218',
      motorDrive:'M94 302 L186 301 M94 320 L186 319 M285 300 L336 202 M302 313 L354 210',
      selectDrive:'M404 187 L434 259', stampDrive:'M616 245 L641 245 L661 216 L859 216 L889 236',
      paper:[869,296,152], beltLabel:[40,121], drumLabel:[440,397], pressLabel:[941,87]},
    narrow:{w:440,h:736,top:-102,belt:[17,137,400],motor:[61,-21],gears:[[186,-24],[296,-24]],drum:[104,322,78],
      fork:[393,189],glass:[290,260],metal:[326,363],discs:[[64,486],[150,486]],press:[334,497],
      lever:[112,416],lane1:'M400 115 Q422 147 393 189 Q366 210 262 237',
      lane2:'M400 115 Q422 147 393 189 Q421 269 358 339',
      motorDrive:'M88 -31 L186 -34 M88 -13 L186 -15 M289 -16 L375 152 M303 -25 L391 143',selectDrive:'M390 193 L363 190 L214 190 L127 280',
      stampDrive:'M332 374 L332 390 L192 390 L169 443 L64 443 L64 486 L249 486 L279 519',
      paper:[258,582,159], beltLabel:[94,99], drumLabel:[104,421], pressLabel:[331,429]}
  };
  function definitions() {
    return `<defs>
      <pattern id="ls-dot" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" fill="#667063" opacity=".32"/></pattern>
      <pattern id="ls-lines" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V6" stroke="${ink}" stroke-opacity=".24" stroke-width="2"/></pattern>
      <pattern id="ls-grille" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill="${ink}"/></pattern>
      <linearGradient id="ls-glaze" x2=".85" y2="1"><stop stop-color="#c6ecce"/><stop offset=".57" stop-color="#8dd5c3"/><stop offset="1" stop-color="#5c9c9c"/></linearGradient>
    </defs>`;
  }
  function belt(layout) {
    const [x,y,end]=layout.belt, w=end-x;
    const c=wheel(11,'#9caaa8','data-spin="belt"');
    return group(x,y,
      path(`M4 26 L${w-4} 26 l-8 10 H15 Z`,'#a1b0a1')+
      rect(0,-2,w,30,ink,15)+rect(2,-5,w-4,29,'#819591',15)+
      rect(10,-1,w-20,19,'#455763',10,ink,1)+
      `<g id="line-belt-treads" stroke="${ivory}" stroke-width="1.8" opacity=".72" stroke-dasharray="2 10"><path d="M14 1H${w-14}"/></g>`+
      group(16,9,c)+group(w-16,9,c)+
      elements(5,i=>circle(44+i*(w-88)/4,9,3.8,'#7c918a',ink,1))+
      rect(26,27,22,10,ivory,2)+rect(w-49,27,22,10,ivory,2));
  }
  function motor(layout) {
    const [x,y]=layout.motor;
    return group(x,y,
      path('M-44 24 H31 L42 33 V38 H-53 V32 Z','#98a59c')+
      rect(-38,11,68,17,shadow,3)+rect(-48,-23,86,43,cobalt,15)+
      path('M-38 -22 L-32 -31 H18 L30 -20', '#8599ec')+
      elements(5,i=>path(`M${-32+i*8} -14v24`,'none',shadow,3))+
      circle(27,0,23,shadow)+wheelAssembly(27,0)+
      group(-48,-21,rect(-8,-10,18,17,acid,3)+text(1,2,'A'))+
      bolt(-38,20)+bolt(14,-23));
  }
  function wheelAssembly(x,y) {
    return group(x,y,wheel(18,'#e7d683','data-spin="motor"'));
  }
  const gearNames = ['Бочка','Мелодия'];
  function sampleGear(x,y,i) {
    const tone=i?'#d77555':'#6a9bb9', face=i?'#f5c48b':'#a8d7d9';
    const levelKeys=[-1,1].map(delta=>{
      const name=(delta>0?'Прибавить':'Убавить')+' громкость · '+gearNames[i];
      return group(delta*26,89,`<g data-delta="${delta}" ${button('gearLevel',name,i)}
        ${rect(-25,-18,50,43,'transparent',4,'none',0,'class="hit"')}
        ${rect(-19,-10,38,21,ivory,7,ink,1.6,'class="edit-edge"')}
        ${path(delta>0?'M-5 0 H5 M0 -5 V5':'M-5 0 H5','none',ink,2.3)}
      </g>`);
    }).join('');
    return group(x,y,`<g class="sample-gear" data-gear="${i}">
      ${rect(-50,50,100,59,'#cad0bd',8,ink,1.5)}
      <g ${button('gearPhase','Сдвинуть рифф · '+gearNames[i],i)}
        ${circle(0,0,59,'transparent','none',0,'class="hit"')}
        <g class="gear-drive">${path(teeth(16,51.6,58.4),tone,ink,1.8,'class="edit-edge"')}</g>
        ${circle(0,0,49,face,ink,1.7)}${circle(0,0,38,'none',ink,.8)}
        <g class="gear-score"></g>
        <g class="phase-grip">${rect(-24,29,48,16,ivory,7,ink,1.1)}
          ${path('M-7 0 H7 M-4 -3 L-7 0 L-4 3 M4 -3 L7 0 L4 3','none',ink,1.6,'transform="translate(-12 37)"')}
          ${text(9,41,'0/8','gear-phase-value')}
        </g>
      </g>
      ${path('M-6 -63 H6 L0 -46Z',acid,ink,1.8,'class="gear-reader" pointer-events="none"')}
      ${circle(0,2,25,shadow,ink,1.5)}
      <g class="gear-hub">
        ${circle(0,1,23,'#e7d9ab',ink,1.6)}
        <foreignObject x="-24" y="-24" width="48" height="48">
          <button xmlns="http://www.w3.org/1999/xhtml" type="button" class="hub-control" data-control="hub" data-action="gearLevel" data-index="${i}" aria-label="Громкость · ${gearNames[i]}">
            <span aria-hidden="true">↕</span><b>100%</b>
          </button>
        </foreignObject>
      </g>
      ${text(0,71,gearNames[i].toUpperCase(),'gear-name')}${levelKeys}
    </g>`);
  }
  function noteCrate(i) {
    return `<g ${button('note','Изменить ноту '+(i+1),i)}
      ${rect(-19,-25,39,42,'transparent',2,'none',0,'class="hit"')}
      <g class="crate-body">${path('M-13 -12 L-8 -17 H15 L11 -12Z','#f5e8c5',ink,1.4)}
      ${path('M11 -12 L15 -17 V0 L11 5Z','#8e9b99',ink,1.4)}
      ${rect(-14,-12,25,17,ivory,1,ink,1.6,'class="crate-face edit-edge"')}</g>
      ${text(-1,-1,'','ls-note')}
    </g>`;
  }
  function programmer(layout) {
    const [x,y,r]=layout.drum, a=r*.73;
    const tabs=elements(8,i=>`<g ${button('tab','Переключить язычок '+(i+1),i)}
       ${circle(0,0,25,'transparent','none',0,'class="hit"')}
       ${rect(-14,-12,28,24,ivory,6,ink,2,'class="tab-face edit-edge"')}
       ${path('M-8 -2 H2 V-6 L9 0 L2 6 V2 H-8Z',ink,'none',0,'class="tab-pointer"')}
     </g>`);
    return group(x,y,
      circle(1,5,r+3,shadow)+circle(0,0,r+2,cobalt)+circle(0,0,r-5,'#718ce4',ink,1.5)+
      circle(0,0,a+8,'none',ivory,1.2,'opacity=".8"')+
      elements(4,i=>{const pt=polar(r-3,(i+.5)*Math.PI/2);return bolt(pt[0],pt[1]);})+
      `<g id="line-play-arm">${path(`M-2 -19 L-3 ${-a+10} L0 ${-a+2} L3 ${-a+10} L2 -19Z`,acid,ink,1.6)}</g>`+
      tabs+`<g ${button('rotor','Повернуть барабан на один шаг')}
        ${circle(0,0,24,shadow)}${circle(-1,-2,22,ivory,ink,2,'class="edit-edge"')}
        ${path('M-11 2 A11 11 0 1 1 6 7','none',ink,2.8)}
        ${path('M3 11 L11 9 L8 2Z',ink,'none')}
        ${circle(-1,-2,4,cobalt,ink,1.5)}
      </g>`);
  }
  function fork(layout) {
    const [x,y]=layout.fork;
    return group(x,y,circle(0,0,11,ivory)+
      `<g id="line-switch">${path('M-6 5 L-4 -5 L24 -3 L44 0 L24 4Z',acid)}${circle(0,0,4,cobalt)}</g>`);
  }
  function receiver(x,y,isMetal) {
    const fill=isMetal?rust:aqua, word=isMetal?'МЕТАЛЛ':'СТЕКЛО';
    const body=isMetal?
      path('M-32 -12 L-20 -20 L20 -23 L34 -10 L28 3 L-23 8Z','#9aaab0')+
      path('M-32 -12 L11 -13 L33 -10 L28 3 L-23 8 Z','#647c88')+
      path('M-26 -15 L-14 -18 L21 -19 M-17 -8 L14 -12','none',ivory,2.3)+bolt(15,-5):
      path('M-32 1 Q-25 -4 -24 -16 Q-20 -35 -3 -35 Q15 -36 22 -13 Q26 -3 30 1 L27 5 H-29Z','url(#ls-glaze)')+
      path('M-18 -14 Q-16 -25 -9 -27 M-16 -9 L-17 -7','none','#eff9e1',3.5,'stroke-linecap="round"')+
      circle(-3,-37,3.8,ivory,ink,1.5)+
      path('M-29 1 H27','none','#437b7f',1.8);
    return group(x,y,
      path('M-38 12 l7 -9 h56 l9 10 v6 h-74Z',fill)+
      `<g id="line-${isMetal?'metal':'glass'}">${body}</g>`+
      rect(-34,15,68,21,ivory,3)+text(0,29,word)+
      `<g id="line-${isMetal?'metal':'glass'}-ring" fill="none" stroke="${isMetal?'#bc582d':'#368778'}" stroke-width="2.5" stroke-linecap="round">${path('M-32 -23 l-5 -4 M-19 -33 l-2 -5 M20 -28 l4 -5','none','inherit',2.4)}</g>`);
  }
  function clutchDisc(x,y,i) {
    return group(x,y,`<g ${button('disc','Повернуть диск муфты '+(i+1),i)}
      ${circle(1,3,38,ink)}
      ${circle(0,0,37,i?'#91a795':'#78a99d',ink,2,'class="edit-edge"')}
      ${circle(0,0,32,i?'#bfd0a4':'#b1d2b8',ink,1)}
      <g class="disc-slots">${elements(8,n=>group(...polar(24,n*Math.PI/4),circle(0,0,5,ivory,ink,1.5,'class="slot"')))}</g>
      ${circle(0,0,14,ivory)}${text(0,4,i?'II':'I','ls-title')}
      ${elements(4,n=>{const [a,b]=polar(32,(n+.5)*Math.PI/2);return circle(a,b,1.3,ink,'none');})}
      <g class="clutch-probe">
        ${path('M-2 -47 H2 V-35 L0 -31 L-2 -35Z',ivory,ink,1.5,'class="probe-tip"')}
        ${rect(-6,-50,12,6,'#637779',2,ink,1.5)}
      </g>
    </g>`);
  }
  function clutchLever(layout) {
    const [x,y]=layout.lever;
    return group(x,y,`<g ${button('clutch','Включить или выключить муфту')}
       ${rect(-43,-30,86,60,'transparent',3,'none',0,'class="hit"')}
       ${rect(-42,-15,84,30,ivory,6,ink,2,'class="edit-edge"')}
       ${rect(-37,-9,32,18,'#627968',9,ink,1.4)}
       ${circle(-28,0,6,ink,'none',0,'id="line-lever-handle"')}
       ${text(16,4,'МУФТА','ls-tag')}
     </g>`);
  }
  function press(layout) {
    const [x,y]=layout.press;
    return group(x,y,
      path('M-50 42 L-40 31 L42 30 L53 40 V51 H-49Z','#89957d')+
      path('M-43 31 V-48 Q-43 -60 -31 -60 H32 Q44 -60 44 -47 V-16 H29 V-42 H-23 V31Z',shadow)+
      path('M-48 28 V-51 Q-48 -64 -35 -64 H26 Q39 -64 39 -51 V-22 H24 V-47 H-29 V28Z',cobalt)+
      path('M-41 -45 V18 M-37 -46 V16','none','#a6b8f3',1.8)+
      bolt(-37,-51)+bolt(27,-51)+
      rect(0,-49,22,37,ivory,3)+rect(-5,-48,32,11,acid,2)+
      `<g id="line-press-shoe">${rect(6,-17,11,34,'#8ba2ad',1)}${path('M-5 11 L2 5 H21 L28 11 V18 H-5Z',rust)}${rect(-6,16,35,6,ink,1)}</g>`+
      path('M-22 30 L-14 23 H32 L44 30Z',ivory)+rect(-21,30,65,7,'#9caeaa',2)+
      rect(-27,-59,18,13,acid,2,ink,1.3)+text(-18,-49,'B')+
      bolt(-39,38)+bolt(40,41));
  }
  function paper(layout) {
    const [x,y,w]=layout.paper;
    return group(x,y,
      path(`M0 4 H${w} L${w-4} 35 l-6 -4 -6 4 -6 -4 -6 4 H0Z`,'#9b9b7b','none')+
      path(`M0 0 H${w} L${w-4} 31 l-6 -4 -6 4 -6 -4 -6 4 H0Z`,'#fbefc4',ink,1.5)+
      path(`M4 5 H${w-7} M4 23 H${w-8}`,'none','#bdab7b',1,'stroke-dasharray="3 5"')+
      `<g id="line-paper-marks"></g>`);
  }
  function backing(layout,narrow) {
    const base=rect(0,layout.top,layout.w,layout.h,'#eae9da',0,'none',0)+
      rect(0,layout.top,layout.w,layout.h,'url(#ls-dot)',0,'none',0);
    const guides=narrow?[179,452]:[113,342];
    return base + guides.map(y=>path(`M12 ${y} H${layout.w-12}`,'none','#889484',.85,'opacity=".3" stroke-dasharray="2 5"')).join('')+
      [[12,13],[layout.w-12,13],[12,layout.h-13],[layout.w-12,layout.h-13]].map(([x,y])=>path(`M${x-4} ${layout.top+y}h8 M${x} ${layout.top+y-4}v8`,'none','#728475',1.2)).join('');
  }
  function lane(track,color) {
    return path(track,'none',ink,15,'stroke-linecap="round"')+
      path(track,'none',color,11,'stroke-linecap="round"')+
      path(track,'none',ivory,1.5,'stroke-dasharray="3 9" opacity=".75"');
  }
  function sceneMarkup(layout,narrow) {
    const [[x1,y1],[x2,y2]]=layout.discs;
    const [paperX,paperY]=layout.paper;
    const [pressX,pressY]=layout.press;
    const paperFeed=`M${pressX+10} ${pressY+35} Q${pressX+9} ${paperY-7} ${paperX+7} ${paperY+9}`;
    return `<title>Звучащая производственная линия</title>${definitions()}${backing(layout,narrow)}
      ${path(layout.motorDrive,'none',ink,5)}${path(layout.motorDrive,'none','#9caaa7',2)}
      ${path(layout.selectDrive,'none',ink,5)}${path(layout.selectDrive,'none','#9daca6',2)}
      ${path(layout.stampDrive,'none',ink,9,'stroke-linejoin="round"')}
      ${path(layout.stampDrive,'none','#9dada7',5,'stroke-linejoin="round"')}
      ${path((narrow?'M332 374 L332 390 L192 390 L169 443 L64 443 L64 486':'M616 245 L641 245 L661 216 H711'),'none',rust,3.5,'id="line-signal" opacity="0"')}
      ${path(narrow?'M160 486 H249 L279 519':'M801 216 H859 L889 236','none',acid,4,'id="line-output" opacity="0"')}
      ${lane(layout.lane1,'#72b9aa')}${lane(layout.lane2,'#dd8966')}
      ${path(paperFeed,'none',ink,15)}${path(paperFeed,'none','#f6e8bc',12)}
      ${belt(layout)}${motor(layout)}${layout.gears.map(([x,y],i)=>sampleGear(x,y,i)).join('')}${programmer(layout)}${fork(layout)}
      ${receiver(...layout.glass,false)}${receiver(...layout.metal,true)}
      ${clutchDisc(x1,y1,0)}${clutchDisc(x2,y2,1)}${clutchLever(layout)}
      ${paper(layout)}${press(layout)}
      ${text(...layout.beltLabel,'КОРОБКИ-НОТЫ','ls-title',narrow?'middle':'start')}
      ${narrow?'':text(...layout.drumLabel,'БАРАБАН МАРШРУТА','ls-title')}
      ${text(...layout.pressLabel,'ПЕЧАТНЫЙ ПРЕСС','ls-title')}
      ${!narrow?text(layout.paper[0]+layout.paper[2]/2,layout.paper[1]+55,'ОТТИСК РИТМА','ls-tag'):''}
      <g id="line-crates">${elements(8,noteCrate)}</g>`;
  }
  function mount(el,{onAction}) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('line-scene');
    svg.setAttribute('aria-label','Музыкальная машина. Коробки меняют высоту ноты, язычки выбирают инструмент.');
    svg.setAttribute('role','group');
    svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
    el.replaceChildren(svg);
    let small, layout, refs, frame, renderedState, historyKey, pending=null;
    function setup(compact) {
      small=compact; layout=small?layouts.narrow:layouts.wide;
      svg.setAttribute('viewBox',`0 ${layout.top} ${layout.w} ${layout.h}`);
      svg.innerHTML=sceneMarkup(layout,small);
      const find=sel=>svg.querySelector(sel), all=sel=>Array.from(svg.querySelectorAll(sel));
      const arms=all('[data-action="tab"]').map(g=>({g,face:g.querySelector('.tab-face'),pointer:g.querySelector('.tab-pointer')}));
      const crates=all('[data-action="note"]').map(g=>({g,body:g.querySelector('.crate-body'),face:g.querySelector('.crate-face'),label:g.querySelector('text')}));
      const discs=all('[data-action="disc"]').map(g=>({g,ring:g.querySelector('.disc-slots'),probe:g.querySelector('.clutch-probe'),tip:g.querySelector('.probe-tip'),slots:Array.from(g.querySelectorAll('.slot'))}));
      const gears=all('.sample-gear').map(g=>({g,drive:g.querySelector('.gear-drive'),score:g.querySelector('.gear-score'),
        reader:g.querySelector('.gear-reader'),hub:g.querySelector('.gear-hub'),volume:g.querySelector('.hub-control'),
        rim:g.querySelector('[data-action="gearPhase"]'),value:g.querySelector('.hub-control b'),phase:g.querySelector('.gear-phase-value'),marks:null}));
      // Precompute distances for box delivery once per layout. getPointAtLength
      // during audio playback causes costly SVG path calculations on phones.
      const routes=[layout.lane1,layout.lane2].map(d=>{
        const sampler=document.createElementNS(svg.namespaceURI,'path');sampler.setAttribute('d',d);
        const len=sampler.getTotalLength(), points=[];
        for(let i=0;i<=40;i++){const pt=sampler.getPointAtLength(len*i/40);points.push([pt.x,pt.y]);}
        return points;
      });
      refs={arms,crates,discs,gears,routes,paper:find('#line-paper-marks'),lever:find('#line-lever-handle'),
        signal:find('#line-signal'),out:find('#line-output'),arm:find('#line-play-arm'),fork:find('#line-switch'),stamp:find('#line-press-shoe'),treads:find('#line-belt-treads'),
        beltSpins:all('[data-spin="belt"]'),motor:find('[data-spin="motor"]'),clutch:find('[data-action="clutch"]'),
        receivers:['glass','metal'].map(name=>({node:find('#line-'+name),ring:find('#line-'+name+'-ring')}))};
      renderedState=null;historyKey=null;
    }
    function updateControls(state,model) {
      state.gears.forEach(({phase,level},i)=>{
        const gear=refs.gears[i], percent=Math.round(level*100)+'%';
        gear.hub.setAttribute('transform',`translate(0 ${4-level*7})`);
        gear.value.textContent=percent;
        gear.phase.textContent=phase+'/8';
        gear.volume.setAttribute('aria-label',gearNames[i]+' · громкость '+percent+', тяните вверх или вниз');
        gear.rim.setAttribute('aria-label',gearNames[i]+' · сдвиг '+phase+'/8 такта, тяните вправо или влево');
      });
      for(let sector=0;sector<8;sector++){
        const tab=model.eventAt(state,sector).tab;
        const [x,y]=polar(layout.drum[2]*.73,sector*Math.PI/4), t=refs.arms[tab];
        const metal=state.routes[tab];
        t.g.setAttribute('transform',`translate(${x} ${y})`);
        t.g.setAttribute('aria-label',`Язычок ${tab+1} · ${metal?'металл':'стекло'}`);
        t.g.setAttribute('aria-pressed',String(metal));
        t.face.setAttribute('fill',metal?rust:aqua);
        t.pointer.setAttribute('transform',`rotate(${small?(metal?56:152):(metal?31:-31)})`);
      }
      state.notes.forEach((note,i)=>{
        const box=refs.crates[i], event=model.eventAt(state,i);
        // The box's lower face stays on the belt as its velocity changes.
        const length=event.length*1.55, height=event.gain*1.35;
        box.body.setAttribute('transform',`translate(0 ${5*(1-height)}) scale(${length} ${height})`);
        box.face.setAttribute('fill',noteColors[note%12]);
        box.label.textContent=noteName(note);box.g.setAttribute('aria-label',`Коробка ${i+1} · ${noteName(note)} · изменить ноту`);
      });
      refs.discs.forEach(({g,slots},i)=>{
        g.setAttribute('opacity',state.clutch?'1':'.68');
        slots.forEach((slot,j)=>{
          const open=model.SLOTS[i].includes(wrap(j-state.discs[i]));
          slot.setAttribute('fill',open?'#303f4b':(i?'#a1b99a':'#88b5a8'));
          slot.setAttribute('stroke',open?ivory:'#718e81');slot.setAttribute('r',open?'5.7':'2.6');
        });
      });
      refs.lever.setAttribute('cx',state.clutch?'-14':'-28');
      refs.lever.setAttribute('fill',state.clutch?acid:ivory);
      refs.clutch.setAttribute('aria-pressed',String(state.clutch));
    }
    function moveCrates(state,model,clock,playing) {
      const [start,y,end]=layout.belt;
      for(let i=0;i<8;i++){
        const until=wrap(i-clock);
        let x,cy,scale=1;
        if(playing && until<=1){
          const event=model.eventAt(state,i);
          const points=refs.routes[event.route==='metal'?1:0];
          const f=(1-until)*40,index=Math.min(39,Math.floor(f)),blend=f-index;
          x=points[index][0]+(points[index+1][0]-points[index][0])*blend;
          cy=points[index][1]+(points[index+1][1]-points[index][1])*blend;
          scale=1-.28*(1-until);
        }else{
          // Ready or paused, the full set is parked in eight accessible berths.
          const progress=playing?(8-until)/7:(7-Math.floor(wrap(i-Math.floor(clock))))/7;
          x=start+17+(end-start-30)*progress;cy=y-9;
        }
        refs.crates[i].g.setAttribute('transform',`translate(${x.toFixed(2)} ${cy.toFixed(2)}) scale(${scale.toFixed(3)})`);
      }
    }
    function driveGears(settings,marks,time,playing) {
      refs.gears.forEach((gear,i)=>{
        const {phase,level}=settings[i];
        const direction=i?-1:1;
        const onsets=marks[i];
        if(gear.marks!==onsets){
          gear.score.innerHTML=onsets.map(onset=>{
            const [x,y]=polar(43,-direction*onset*2*Math.PI);
            return circle(x,y,3.4,ink,ivory,1);
          }).join('');
          gear.marks=onsets;
        }
        // Carrier teeth are permanently meshed. The player reindexes their
        // scored collars independently; a pin meets its reader at (onset+shift).
        gear.drive.setAttribute('transform',`rotate(${direction*time*360+(i?180/16:0)})`);
        gear.score.setAttribute('transform',`rotate(${direction*(time-phase/8)*360})`);
        const elapsed=Math.min(...onsets.map(at=>((time-phase/8-at)%1+1)%1));
        gear.reader.setAttribute('fill',playing&&level>0&&elapsed<.05?rust:acid);
      });
    }
    function render(next) {
      frame=next;
      const compact=el.clientWidth<680;
      if(small!==compact)setup(compact);
      const {state,model,step=0,phase=0,playing,history=[]}=next;
      if(!state||!model)return;
      const actual=next.audibleState||state;
      const visible=playing?actual:state;
      // Live edits become visible at the same transport boundary as the sound.
      if(renderedState!==visible){updateControls(visible,model);renderedState=visible;}
      const clock=step+phase;
      driveGears(visible.gears,next.gearMarks,next.time,playing);
      moveCrates(actual,model,clock,playing||history.length>0);
      const hit=(history.length?history[history.length-1]:null);
      const sounding=!!(playing&&hit&&hit.step===step);
      const energy=sounding?Math.pow(Math.max(0,1-phase),4):0;
      const current=model.eventAt(visible,step);
      // The drive dwells long enough for the two feelers to enter their slots.
      // Both discs then advance together to the next eighth of a revolution.
      const turn=Math.min(1,Math.max(0,(phase-.27)/.7));
      const rotation=(step+turn*turn*(3-2*turn))*-45;
      refs.discs.forEach((disc,i)=>{
        disc.ring.setAttribute('transform',`rotate(${rotation})`);
        const entered=visible.clutch&&current.open[i];
        const lift=entered?8*(1-turn):0;
        disc.probe.setAttribute('transform',`translate(0 ${lift.toFixed(1)})`);
        disc.tip.setAttribute('fill',entered?acid:ivory);
      });
      refs.signal.setAttribute('opacity',(hit?.route==='metal'?energy:0).toFixed(2));
      refs.out.setAttribute('opacity',(hit?.stamp?energy:0).toFixed(2));
      const upcoming=model.eventAt(actual,wrap(step+1));
      refs.fork.setAttribute('transform',`rotate(${small?(upcoming.route==='glass'?150:73):(upcoming.route==='glass'?-35:25)})`);
      refs.arm.setAttribute('transform',`rotate(${clock*45})`);
      refs.receivers.forEach(({node,ring},i)=>{
        const v=hit?.route===(i?'metal':'glass')?energy:0;
        node.setAttribute('transform',`translate(0 ${(-2*v).toFixed(1)}) rotate(${(3*v).toFixed(1)})`);
        ring.setAttribute('opacity',v.toFixed(2));
      });
      refs.stamp.setAttribute('transform',`translate(0 ${(hit?.stamp?9*energy:0).toFixed(1)})`);
      const cycle=Number.isFinite(next.time)?next.time*8:clock;
      refs.motor.setAttribute('transform',`rotate(${cycle*120})`);
      for(const spin of refs.beltSpins)spin.setAttribute('transform',`rotate(${cycle*95})`);
      refs.treads.setAttribute('stroke-dashoffset',(-clock*12).toFixed(2));
      // Only real receiver contacts get committed to the paper.
      const tail=history.slice(-8);
      const key=tail.map(e=>e.absoluteStep+':'+Number(e.stamp)).join(',');
      if(key!==historyKey){
        const width=layout.paper[2],pitch=(width-19)/8;
        refs.paper.innerHTML=tail.map((e,i)=>{
          if(!e.stamp)return '';
          const x=9+(8-tail.length+i)*pitch;
          return group(x,15,path('M0 -8 L5 -4 V4 L0 8 L-5 4 V-4Z','#b2573b','none')+
            path('M-2 0h4 M0 -3v6','none','#f5d5a5',1));
        }).join('');
        historyKey=key;
      }
    }
    function target(e){return e.target.closest?.('[data-action]');}
    function send(node,delta=1){
      if(!node)return;
      const action={type:node.dataset.action};
      if(node.dataset.index!==undefined)action.index=Number(node.dataset.index);
      if(['rotor','disc','gearPhase','gearLevel','note'].includes(action.type))action.delta=delta;
      onAction(action);
    }
    function isHub(node){return node.dataset.control==='hub';}
    function down(e){
      const node=target(e);
      if(!node||e.button!==0||pending)return;
      pending={node,id:e.pointerId,x:e.clientX,y:e.clientY};
      // Keep identity of the moving box if the belt travels during a tap.
      if(svg.setPointerCapture)svg.setPointerCapture(e.pointerId);
    }
    function up(e){
      if(!pending||pending.id!==e.pointerId)return;
      const {node,x,y}=pending;pending=null;
      const dx=e.clientX-x,dy=e.clientY-y;
      if(isHub(node)){
        const steps=Math.round(-dy/22);
        if(Math.abs(dx)<Math.abs(dy)&&steps)send(node,steps);
        else if(Math.hypot(dx,dy)<10)send(node,e.shiftKey?-1:1);
      }else if(node.dataset.action==='gearPhase'){
        if(Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx))return;
        send(node,Math.abs(dx)<12?(e.shiftKey?-1:1):(Math.round(Math.abs(dx)/26)||1)*Math.sign(dx));
      }else if(node.dataset.action==='rotor'||node.dataset.action==='disc'){
        if(Math.abs(dy)>30 && Math.abs(dy)>Math.abs(dx)) return;
        send(node,dx < -12 || e.shiftKey?-1:1);
      }else if(Math.hypot(dx,dy)<20)send(node,Number(node.dataset.delta)||(e.shiftKey?-1:1));
    }
    function cancel(e){if(pending?.id===e.pointerId)pending=null;}
    function key(e){
      const node=target(e);if(!node)return;
      const sideways=['rotor','disc','gearPhase','note'].includes(node.dataset.action);
      let delta;
      if([' ','Enter'].includes(e.key))delta=Number(node.dataset.delta)||(e.shiftKey?-1:1);
      else if(sideways&&['ArrowLeft','ArrowRight'].includes(e.key))delta=e.key==='ArrowLeft'?-1:1;
      else if(isHub(node)&&['ArrowUp','ArrowDown'].includes(e.key))delta=e.key==='ArrowDown'?-1:1;
      else return;
      e.preventDefault();if(!e.repeat)send(node,delta);
    }
    function accessibleClick(e){
      const node=target(e);
      if(node&&e.detail===0)send(node,Number(node.dataset.delta)||1);
    }
    svg.addEventListener('pointerdown',down);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',cancel);
    svg.addEventListener('lostpointercapture',cancel);svg.addEventListener('keydown',key);svg.addEventListener('click',accessibleClick);
    const resize=()=>{if(frame&&small!==(el.clientWidth<680))render(frame);};
    const observer=window.ResizeObserver?new ResizeObserver(resize):null;
    if(observer)observer.observe(el);else window.addEventListener('resize',resize);
    setup(el.clientWidth<680);
    return {render,destroy(){observer?.disconnect();window.removeEventListener('resize',resize);svg.remove();}};
  }
  window.LineScene={mount};
})();
