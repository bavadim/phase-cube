/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFlat = {
  mount(host,callbacks) {
    const fleet=document.createElement('div'),detail=document.createElement('div');
    fleet.className='flat-overview';detail.className='iso-flat-face';
    host.replaceChildren(fleet,detail);
    const face=IsoFace.mountFlat({overlay:detail,callbacks});
    const ns='http://www.w3.org/2000/svg';
    const icons={
      source:'<path fill="#b3d0be" d="M3 3h5L6 8H5zm7 0h5l-2 5h-1zm7 0h5l-2 5h-1Z"/><circle fill="#d5ba83" cx="12" cy="15" r="6.5"/><g stroke="none"><circle fill="#ec7851" cx="12" cy="10.5" r="1.5"/><circle fill="#60c5b6" cx="16.5" cy="15" r="1.5"/><circle fill="#e9af44" cx="12" cy="19.5" r="1.5"/></g>',
      router:'<path fill="#85bdab" d="m3 8 2-3 4 1 1-3 4 1 1 3 4 1v4l-3 2-1 3-5 1-2-2-4-1v-4Z"/><circle cx="10.5" cy="10" r="2"/><path d="m14 19 4-6 4 1m-4-1 3-5"/>',
      keys:'<rect x="2" y="5" width="20" height="14" rx="1.6" fill="#fff7d8"/><path stroke-width="1.3" d="M6 6v13m4-13v13m4-13v13m4-13v13"/><path stroke-width="2.8" d="M6 6v7m4-7v7m8-7v7"/>',
      bell:'<path fill="#edb94e" d="M3 17h18l-2-3c0-6-3-9-7-9s-7 3-7 9Z"/><path d="M10 20q2 2 4 0M12 4V3"/>',
      bin:'<path fill="#acc2b4" d="M3 6h18v4l-6 6v3l-6 2v-5l-6-6Z"/><path d="M4 8h16m-13 3h10m-8 3h6" stroke-width="1.1"/>',
      delay:'<path d="M3 2v3h18M3 5v15h17v3"/><g stroke-width="1.2" fill="#c8e2d3"><rect x="5" y="6" width="3.8" height="11" rx="1.5"/><rect x="11" y="6" width="3.8" height="11" rx="1.5"/><rect x="17" y="6" width="3.8" height="11" rx="1.5"/></g><path stroke="#65aa9d" d="M7 13v2m6-4v4"/>',
      copy:'<path d="M12 2v3m-7 1h14M5 18v4m14-4v4"/><g stroke-width="1.4" fill="#d2e6d7"><rect x="2" y="7" width="7" height="12" rx="2"/><rect x="15" y="7" width="7" height="12" rx="2"/></g><path stroke="#64978a" d="M5.5 6v6m13-6v6M3 14.5h5m8 0h5"/>'
    };
    const svg=(tag,attrs)=>{
      const node=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
      return node;
    };
    let frame,patch=null,lastState,lastLayout,lastFocus,hose,projection,drag=null,keyboardStation=null;
    const wirePaths=new Map();
    let released=-Infinity;
    function targets(station){
      if(!projection)return [];
      const {box,point}=projection;
      return IsoLayout.targets(frame.layout,station).map(target=>{
        const p=point(target.x,target.z);
        return {...target,x:box.left+p.x*box.width/100,y:box.top+p.y*box.height/100};
      });
    }
    function cancelDrag(){
      const old=drag;drag=null;
      if(!old)return;
      old.ghost?.remove();old.targets?.forEach(target=>target.marker?.remove());
      old.body.removeAttribute('data-moving');old.body.removeAttribute('aria-grabbed');
      host.removeAttribute('data-arranging');
      if(host.hasPointerCapture(old.id))host.releasePointerCapture(old.id);
    }
    function moveDrag(event){
      const current=drag;
      if(!current||event.pointerId!==current.id)return;
      event.preventDefault();
      if(current.patch){current.moved||=Math.hypot(event.clientX-current.x,event.clientY-current.y)>8;return;}
      if(!current.moved){
        if(Math.hypot(event.clientX-current.x,event.clientY-current.y)<8)return;
        current.moved=true;current.body.dataset.moving='true';current.body.setAttribute('aria-grabbed','true');
        host.dataset.arranging='true';
        current.targets=targets(current.station);
        const box=fleet.getBoundingClientRect();
        for(const target of current.targets){
          const marker=document.createElement('span');marker.className='flat-drop-target';
          marker.dataset.insert=String(Boolean(target.insert));
          marker.style.left=target.x-box.left+'px';marker.style.top=target.y-box.top+'px';
          fleet.append(marker);target.marker=marker;
        }
        current.ghost=current.body.cloneNode(true);
        current.ghost.removeAttribute('data-station');current.ghost.removeAttribute('data-moving');
        current.ghost.removeAttribute('aria-grabbed');current.ghost.setAttribute('aria-hidden','true');current.ghost.tabIndex=-1;
        current.ghost.className='flat-layout-ghost';fleet.append(current.ghost);
      }
      const box=fleet.getBoundingClientRect();
      const inside=event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;
      let nearest=null,distance=Infinity;
      for(const target of current.targets){
        const d=Math.hypot(event.clientX-target.x,event.clientY-target.y);
        if(d<distance){nearest=target;distance=d;}
      }
      current.target=inside&&distance<=Math.max(42,Math.min(80,box.width*.18))?nearest:null;
      current.targets.forEach(target=>target.marker.dataset.ready=String(current.target===target));
      const point=current.target||{x:event.clientX,y:event.clientY};
      current.ghost.style.left=point.x-box.left+'px';current.ghost.style.top=point.y-box.top+'px';
    }
    function startDrag(event){
      if(drag||!event.isPrimary||event.button!==0||lastFocus)return;
      const body=event.target.closest('[data-station]');
      if(!body||body.disabled)return;
      event.preventDefault();
      drag={id:event.pointerId,station:body.dataset.station,body,x:event.clientX,y:event.clientY,moved:false,patch};
      host.setPointerCapture(event.pointerId);
    }
    function finishDrag(event,cancelled=false){
      const current=drag;
      if(!current||event.pointerId!==current.id)return;
      released=performance.now();event.preventDefault();cancelDrag();
      if(cancelled)return;
      if(current.patch){
        if(!current.moved&&callbacks.connect(current.patch,current.station))setPatch(null);
      }else if(current.moved){
        if(current.target){const {row,col,insert}=current.target;callbacks.movePart({id:current.station,row,col,insert});}
      }else if(IsoFlow.EDITABLE.includes(current.station))callbacks.select(current.station);
    }
    host.addEventListener('pointerdown',startDrag);
    host.addEventListener('pointermove',moveDrag);
    host.addEventListener('pointerup',event=>finishDrag(event));
    host.addEventListener('pointercancel',event=>finishDrag(event,true));
    host.addEventListener('lostpointercapture',event=>finishDrag(event,true));
    host.addEventListener('keydown',event=>{
      const station=event.target.closest('[data-station]')?.dataset.station;
      if(!station||lastFocus||patch||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      const pos=IsoLayout.positions(frame.layout)[station],horizontal=event.key==='ArrowLeft'||event.key==='ArrowRight';
      const axis=horizontal?'x':'z',other=horizontal?'z':'x',sign=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;
      const options=IsoLayout.targets(frame.layout,station).filter(target=>(target[axis]-pos[axis])*sign>.01)
        .sort((a,b)=>Math.abs(a[axis]-pos[axis])+Math.abs(a[other]-pos[other])*2-Math.abs(b[axis]-pos[axis])-Math.abs(b[other]-pos[other])*2);
      if(!options.length)return;
      event.preventDefault();keyboardStation=station;
      const {row,col,insert}=options[0];callbacks.movePart({id:station,row,col,insert});
    });
    function can(action){try{IsoFlow.apply(frame.editState,action);return true;}catch{return false;}}
    function choice(label,icon,pos,handler){
      const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);
      b.style.left=pos[0]+'%';b.style.top=pos[1]+'%';b.onclick=handler;
      const drawing=svg('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});drawing.innerHTML=icon;
      b.append(drawing);fleet.append(b);return b;
    }
    function placeJack(key,cx,cy,label,input,available) {
      const node=document.createElement('button');
      node.type='button';node.className='flat-socket';node.dataset.hosePort=key;
      node.dataset.io=input?'in':'out';node.style.left=cx+'px';node.style.top=cy+'px';
      node.setAttribute('aria-label',label);
      node.disabled=input?(!patch||!available):Boolean(patch&&patch!==key);
      if(!input)node.setAttribute('aria-pressed',String(key===patch));
      node.classList.toggle('ready',Boolean(input&&patch&&available));
      fleet.append(node);return node;
    }
    function draw(){
      if(!frame)return;
      const s=frame.editState,focus=!patch&&frame.selected;
      lastState=s;lastLayout=frame.layout;lastFocus=focus;
      fleet.hidden=!!focus;detail.hidden=!focus;fleet.replaceChildren();wirePaths.clear();
      if(focus)return;
      const {names,ports}=IsoWorkshopLabels;
      const lines=svg('svg',{'class':'wire-map',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':'true'});
      fleet.append(lines);
      const box=fleet.getBoundingClientRect();
      if(!box.width||!box.height)return;
      const layout=IsoLayout.positions(frame.layout);
      const xs=Object.values(layout).map(p=>p.x),zs=Object.values(layout).map(p=>p.z);
      const loX=Math.min(...xs),loZ=Math.min(...zs),spanX=Math.max(...xs)-loX,spanZ=Math.max(...zs)-loZ;
      const rows=frame.layout.devices.length+2;
      const bodyHeight=Math.max(36,Math.min(80,box.width*.17/1.23,(box.height-44)/(rows-1)*.58));
      const bodyWidth=Math.max(44,bodyHeight*1.23),margin=bodyHeight/2+28;
      projection={box,point:(x,z)=>({x:15+70*(x-loX)/(spanX||1),
        y:(margin+(box.height-2*margin)*(z-loZ)/(spanZ||1))*100/box.height})};
      for(const zone of IsoLayout.zones(frame.layout)){
        const top=Math.max(1,projection.point(0,zone.minZ).y),bottom=Math.min(99,projection.point(0,zone.maxZ).y);
        lines.append(svg('rect',{x:3,y:top,width:94,height:bottom-top,rx:2,fill:zone.id==='devices'?'#c9d5bb':'#ddd7be',opacity:.24,'data-layout-zone':zone.id}));
      }
      const sockets=new Map(),bodies=[];
      for(const [id,p] of Object.entries(layout)){
        const point=projection.point(p.x,p.z),pos=[point.x,point.y];
        const b=choice((patch?'Соединить с деталью ':'Переместить или настроить: ')+names[id],icons[id],pos,event=>{
          if(event.detail||event.pointerType||performance.now()-released<350)return;
          if(patch){if(callbacks.connect(patch,id))setPatch(null);}else if(IsoFlow.EDITABLE.includes(id))callbacks.select(id);
        });
        b.dataset.station=id;b.dataset.passive=String(!IsoFlow.EDITABLE.includes(id));
        b.style.width=bodyWidth+'px';b.style.height=bodyHeight+'px';
        b.disabled=Boolean(patch&&!can({type:'connect',from:patch,to:id}));
        const r=b.getBoundingClientRect();
        const cx=r.left+r.width/2-box.left,y=r.top-box.top;
        bodies.push({left:(r.left-box.left)/50,right:(r.right-box.left)/50,top:y/50,bottom:(y+r.height)/50});
        if(id!=='source'){
          const key=id+':in',open=patch&&can({type:'connect',from:patch,to:id});
          sockets.set(key,placeJack(key,cx,y-4,'Вход: '+names[id],true,open));
        }
        const outputs=IsoFlow.PORTS[id];
        outputs.forEach((port,i)=>{
          const key=id+':'+port;
          const x=outputs.length===1?cx:cx+(i===0?1:-1)*Math.max(22,r.width*.24);
          sockets.set(key,placeJack(key,x,y+r.height+4,ports[port]+': '+names[id],false,true));
        });
      }
      function point(key){
        const r=sockets.get(key).getBoundingClientRect();
        return [(r.left+r.width/2-box.left)*100/box.width,(r.top+r.height/2-box.top)*100/box.height];
      }
      // Plan around the screen-space bodies using the same hose solver as the
      // 3D workbench. Its coordinate system is just scaled pixels on a plane.
      const previous=[];
      function cablePath(ax,ay,bx,by,from,to){
        if(!window.THREE){
          const bend=Math.max(3,Math.min(15,Math.abs(by-ay)*.5));
          return 'M '+ax+' '+ay+' C '+ax+' '+(ay+bend)+' '+bx+' '+(by-bend)+' '+bx+' '+by;
        }
        const v=(x,z)=>new THREE.Vector3(x,.2,z);
        const point3=(x,y)=>v(x*box.width/5000,y*box.height/5000);
        const otherJacks=[];
        for(const key of sockets.keys())if(key!==from&&key!==to+':in'){
          const [x,y]=point(key),p=point3(x,y);
          otherJacks.push({left:p.x-.15,right:p.x+.15,top:p.z-.06,bottom:p.z+.06});
        }
        const path=IsoBelts.plan(point3(ax,ay),point3(bx,by),new THREE.Vector3(0,0,1),
          new THREE.Vector3(0,0,-1),bodies.concat(otherJacks),previous);
        const points=path.getSpacedPoints(Math.max(14,Math.ceil(path.getLength()*7)));
        previous.push(points);
        return 'M '+points.map(p=>(p.x*5000/box.width).toFixed(2)+' '+(p.z*5000/box.height).toFixed(2)).join(' L ');
      }
      for(const [from,to] of Object.entries(s.links)){
        const [ax,ay]=point(from),[bx,by]=point(to+':in');
        const d=cablePath(ax,ay,bx,by,from,to);
        const jacket=svg('path',{d,fill:'none',stroke:'#6f9389','stroke-linecap':'round','stroke-width':11,'vector-effect':'non-scaling-stroke'});
        const wire=svg('path',{d,fill:'none',stroke:from===patch?'#a3dbc2':'#dceadc','stroke-linecap':'round','stroke-width':7,'vector-effect':'non-scaling-stroke'});
        lines.append(jacket,wire);
        const dose=document.createElement('span');dose.className='flat-hose-dose';dose.hidden=true;fleet.append(dose);
        wirePaths.set(from,{wire,dose,length:wire.getTotalLength(),box});
      }
      if(keyboardStation){fleet.querySelector('[data-station="'+keyboardStation+'"]')?.focus({preventScroll:true});keyboardStation=null;}
    }
    const resize=new ResizeObserver(()=>{cancelDrag();draw();});
    resize.observe(host);
    function setPatch(key){cancelDrag();if(!key)hose?.reset();patch=key;callbacks.patchChanged(patch);draw();}
    function cancelMode(){cancelDrag();if(patch)setPatch(null);}
    hose=IsoHoseGesture.mount(host,{
      key:()=>patch,begin:setPatch,cancel:()=>setPatch(null),
      finish:id=>{if(patch&&callbacks.connect(patch,id))setPatch(null);},
      canJoin:id=>Boolean(patch&&can({type:'connect',from:patch,to:id}))
    });
    function showFlow(tick,phase){
      for(const [key,r] of wirePaths){
        const tones=IsoFlow.tones(tick?.edges.filter(edge=>edge.from===key)||[]);
        r.dose.hidden=!tones.length;
        if(!tones.length)continue;
        const palette=tones.join(',');
        if(r.dose.dataset.tones!==palette){
          r.dose.dataset.tones=palette;r.dose.replaceChildren();
          for(const pitch of tones){
            const dye=document.createElement('i');dye.style.background=IsoPieces.noteColor(pitch);r.dose.append(dye);
          }
        }
        const distance=phase*r.length,p=r.wire.getPointAtLength(distance),a=r.wire.getPointAtLength(Math.max(0,distance-.1)),b=r.wire.getPointAtLength(Math.min(r.length,distance+.1));
        const angle=Math.atan2((b.y-a.y)*r.box.height,(b.x-a.x)*r.box.width);
        r.dose.style.left=p.x+'%';r.dose.style.top=p.y+'%';
        r.dose.style.transform='translate(-50%,-50%) rotate('+angle+'rad)';
      }
    }
    return {setPatch,cancelMode,
      render(next){
        const old=frame;frame=next;
        const focus=!patch&&frame.selected;
        if(!drag&&(lastState!==frame.editState||lastLayout!==frame.layout||lastFocus!==focus))draw();
        face.render(frame,focus||null);
        if(!focus&&(frame.playing||old?.playing))showFlow(frame.playing?frame.tick:null,(frame.time*IsoFlow.STEPS)%1);
      },
      inspect:()=>({webgl:false,focus:lastFocus||null,positions:frame?IsoLayout.positions(frame.layout):{},
        nodes:Object.fromEntries([...fleet.querySelectorAll('[data-station]')].map(element=>{const r=element.getBoundingClientRect();return[element.dataset.station,{x:r.x+r.width/2,y:r.y+r.height/2}]})),
        dropTargets:drag?.moved?drag.targets.map(({marker,...target})=>({...target,id:drag.station})):[]})
    };
  }
};
