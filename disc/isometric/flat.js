/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFlat = {
  mount(host,callbacks) {
    const fleet=document.createElement('div'),detail=document.createElement('div');
    fleet.className='flat-overview';detail.className='iso-flat-face';
    host.replaceChildren(fleet,detail);
    const face=IsoFace.mountFlat({overlay:detail,callbacks});
    const ns='http://www.w3.org/2000/svg';
    const icons={
      source:'<path fill="#df9753" d="m5 7 1-4h6l2 4 4 1 3 5-3 4-1 4H8l-2-4-4-2 1-6Z"/><circle fill="#fcdf97" cx="11.5" cy="12" r="5"/><path d="m11 12 2-2"/>',
      router:'<path fill="#85bdab" d="m3 8 2-3 4 1 1-3 4 1 1 3 4 1v4l-3 2-1 3-5 1-2-2-4-1v-4Z"/><circle cx="10.5" cy="10" r="2"/><path d="m14 19 4-6 4 1m-4-1 3-5"/>',
      keys:'<rect x="2" y="5" width="20" height="14" rx="1.6" fill="#fff7d8"/><path stroke-width="1.3" d="M6 6v13m4-13v13m4-13v13m4-13v13"/><path stroke-width="2.8" d="M6 6v7m4-7v7m8-7v7"/>',
      bell:'<path fill="#edb94e" d="M3 17h18l-2-3c0-6-3-9-7-9s-7 3-7 9Z"/><path d="M10 20q2 2 4 0M12 4V3"/>',
      bin:'<path fill="#c1d8c8" d="M4 6h16l-2 15H6Z"/><path stroke-width="1.2" d="M8 8l1 10m3-10v10m4-10-1 10M5 12h14"/><path d="M3 5h18"/>',
      delay:'<rect x="2" y="7" width="20" height="12" rx="2" fill="#c3adca"/><path d="M5 9v7m4-7v7m4-7v7m4-7v7"/><circle cx="15" cy="6" r="2" fill="#e5b259"/>',
      copy:'<path d="M4 7h6m3 0v7M7 12v2M3 19h18"/><path fill="#d1855f" d="M3 3h16v4H3zM4 14h5v3H4zm7 0h5v3h-5z"/>'
    };
    const svg=(tag,attrs)=>{
      const node=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
      return node;
    };
    let frame,patch=null,insert=null,lastState,lastFocus,litTick=null,wirePaths=new Map();
    function can(action){try{IsoFlow.apply(frame.editState,action);return true;}catch{return false;}}
    function choice(label,icon,pos,handler){
      const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);
      b.style.left=pos[0]+'%';b.style.top=pos[1]+'%';b.onclick=handler;
      const drawing=svg('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});drawing.innerHTML=icon;
      b.append(drawing);fleet.append(b);return b;
    }
    function jack(button,port,x){
      const node=document.createElement('i');
      node.className='flat-jack';node.dataset.port=port;node.style.left=x+'%';
      node.setAttribute('aria-hidden','true');button.append(node);return node;
    }
    function draw(){
      if(!frame)return;
      const s=frame.editState,focus=!patch&&!insert&&frame.selected;
      lastState=s;lastFocus=focus;litTick=null;
      fleet.hidden=!!focus;detail.hidden=!focus;fleet.replaceChildren();wirePaths.clear();
      if(focus)return;
      const {names,ports}=IsoWorkshopLabels;
      const lines=svg('svg',{'class':'wire-map',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':'true'});
      fleet.append(lines);
      const box=fleet.getBoundingClientRect();
      if(!box.width||!box.height)return;
      const layout=IsoScene.layout(s.links,host.clientWidth/host.clientHeight<1.18);
      const xs=Object.values(layout).map(p=>p.x),zs=Object.values(layout).map(p=>p.z);
      const loX=Math.min(...xs),loZ=Math.min(...zs),spanX=Math.max(...xs)-loX,spanZ=Math.max(...zs)-loZ;
      const sockets=new Map();
      for(const [id,p] of Object.entries(layout)){
        const pos=[15+70*(p.x-loX)/(spanX||1),12+76*(p.z-loZ)/(spanZ||1)];
        const b=choice((patch?'Соединить с деталью ':'Выбрать: ')+names[id],icons[id],pos,()=>{
          if(patch){if(callbacks.connect(patch,id))setPatch(null);}else callbacks.select(id);
        });
        b.dataset.station=id;b.disabled=!!insert||!!(patch&&!can({type:'connect',from:patch,to:id}));
        if(id!=='source')sockets.set(id+':in',jack(b,'in',50));
        const outputs=IsoFlow.PORTS[id];
        outputs.forEach((port,i)=>sockets.set(id+':'+port,jack(b,port,outputs.length===1?50:68-i*36)));
      }
      function point(key){
        const r=sockets.get(key).getBoundingClientRect();
        return [(r.left+r.width/2-box.left)*100/box.width,(r.top+r.height/2-box.top)*100/box.height];
      }
      for(const [from,to] of Object.entries(s.links)){
        const [owner,port]=from.split(':'),[ax,ay]=point(from),[bx,by]=point(to+':in');
        const bend=Math.max(3,Math.min(15,Math.abs(by-ay)*.5));
        const wire=svg('path',{d:'M '+ax+' '+ay+' C '+ax+' '+(ay+bend)+' '+bx+' '+(by-bend)+' '+bx+' '+by,
          fill:'none',stroke:port==='side'?'#b56e3d':'#40796a','stroke-linecap':'round','stroke-width':5,'vector-effect':'non-scaling-stroke'});
        lines.append(wire);wirePaths.set(from,wire);
        const action={type:'insert',node:insert,from};
        if(insert&&can(action)){
          const half=wire.getPointAtLength(wire.getTotalLength()/2);
          const b=choice('Вставить между '+names[owner]+' ('+ports[port]+') и '+names[to],'<path d="M4 12h16m-8-8v16"/>',[half.x,half.y],()=>{
            if(callbacks.act(action))setInsert(null);
          });
          b.className='wire-joint';b.style.zIndex=2;
        }
      }
    }
    const resize=new ResizeObserver(draw);
    resize.observe(host);
    function setPatch(key){patch=key;if(key&&insert)setInsert(null);callbacks.patchChanged(patch);draw();}
    function setInsert(id){insert=id;if(id&&patch)setPatch(null);callbacks.insertChanged(insert);draw();}
    function cancelMode(){if(patch)setPatch(null);if(insert)setInsert(null);}
    return {setPatch,setInsert,cancelMode,
      render(next){
        frame=next;
        const focus=!patch&&!insert&&frame.selected;
        if(lastState!==frame.editState||lastFocus!==focus)draw();
        face.render(frame,focus||null);
        const tick=frame.playing?frame.tick:null;
        if(!focus&&tick!==litTick){
          const live=new Set(tick?.edges.map(edge=>edge.from));
          for(const [from,path] of wirePaths)path.setAttribute('stroke-width',live.has(from)?8:5);
          litTick=tick;
        }
      },
      inspect:()=>({webgl:false,focus:lastFocus||null})
    };
  }
};
