/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Both renderers expose their real couplers as buttons. A hose is committed
// only at a compatible intake; moving a connected plug never drops its state.
window.IsoHoseGesture = {
  mount(host,actions) {
    const svgNS='http://www.w3.org/2000/svg';
    const guide=document.createElementNS(svgNS,'svg');
    guide.setAttribute('aria-hidden','true');
    guide.classList.add('iso-hose-guide');
    const draw=(name,cls)=>{
      const node=document.createElementNS(svgNS,name);
      node.setAttribute('class',cls);guide.append(node);return node;
    };
    const rim=draw('path','outline'), bore=draw('path','bore'), plug=draw('circle','plug');
    plug.setAttribute('r','7');host.append(guide);
    const events=new AbortController(),capture={capture:true,signal:events.signal};
    let finger=null,target=null;
    const port=e=>e?.closest?.('button[data-hose-port]:not(:disabled)');
    const byKey=k=>host.querySelector('button[data-hose-port="'+k+'"]');
    function clear(){
      target?.removeAttribute('data-ready');target=null;guide.classList.remove('visible');
    }
    function reset(){
      const id=finger?.id;finger=null;clear();
      if(id!==undefined&&host.hasPointerCapture(id))host.releasePointerCapture(id);
    }
    function center(button){
      const b=button.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};
    }
    function receiver(x,y){
      const hit=document.elementFromPoint(x,y);
      if(!hit||!host.contains(hit))return null;
      const button=port(hit), key=button?.dataset.hosePort;
      if(key?.endsWith(':in')&&actions.canJoin(key.split(':')[0]))return button;
      const station=hit.closest('[data-station]')?.dataset.station;
      if(station&&actions.canJoin(station))return byKey(station+':in');
      return null;
    }
    function trace(x,y,from){
      const start=byKey(from);if(!start||!start.getClientRects().length){clear();return;}
      const to=receiver(x,y);
      if(target!==to){target?.removeAttribute('data-ready');target=to;target?.setAttribute('data-ready','true');}
      const board=host.getBoundingClientRect(),a=center(start),b=to?center(to):{x,y};
      const ax=a.x-board.left,ay=a.y-board.top,bx=b.x-board.left,by=b.y-board.top;
      const reach=Math.min(90,Math.max(22,Math.hypot(ax-bx,ay-by)*.32));
      const path='M'+ax+' '+ay+' C'+ax+' '+(ay+reach)+' '+bx+' '+(by-reach)+' '+bx+' '+by;
      rim.setAttribute('d',path);bore.setAttribute('d',path);plug.setAttribute('cx',bx);plug.setAttribute('cy',by);
      guide.classList.add('visible');guide.classList.toggle('snapped',!!to);
    }
    function down(e){
      const picked=port(e.target);
      if(!picked||finger||!e.isPrimary||e.button!==0)return;
      const key=picked.dataset.hosePort,source=actions.key();
      if(key.endsWith(':in')&&!source)return;
      e.preventDefault();e.stopPropagation();
      finger={id:e.pointerId,x:e.clientX,y:e.clientY,key,moved:false};
      host.setPointerCapture(e.pointerId);
      if(!key.endsWith(':in')&&source!==key)actions.begin(key);
      clear();
    }
    function move(e){
      if(!finger){
        const selected=actions.key();
        if(selected&&e.pointerType==='mouse')trace(e.clientX,e.clientY,selected);
        return;
      }
      if(finger.id!==e.pointerId)return;
      e.stopPropagation();
      if(Math.hypot(e.clientX-finger.x,e.clientY-finger.y)>=7)finger.moved=true;
      if(finger.moved&&actions.key())trace(e.clientX,e.clientY,actions.key());
    }
    function up(e){
      if(!finger||finger.id!==e.pointerId)return;
      e.preventDefault();e.stopPropagation();
      const prior=finger,from=actions.key(),taken=from&&receiver(e.clientX,e.clientY);
      reset();
      if(!from||(!prior.moved&&!prior.key.endsWith(':in')))return;
      if(taken)actions.finish(taken.dataset.hosePort.split(':')[0]);
      else if(prior.moved)actions.cancel();
    }
    function cancelled(e){
      if(finger?.id===e.pointerId){reset();actions.cancel();}
    }
    host.addEventListener('pointerdown',down,capture);
    host.addEventListener('pointermove',move,capture);
    host.addEventListener('pointerup',up,capture);
    host.addEventListener('pointercancel',cancelled,capture);
    host.addEventListener('lostpointercapture',e=>{if(e.target===host)cancelled(e);},capture);
    host.addEventListener('pointerleave',()=>{if(!finger)clear();},capture);
    host.addEventListener('click',e=>{
      const picked=port(e.target);if(!picked)return;
      e.preventDefault();e.stopPropagation();
      if(e.detail!==0||e.pointerType)return; // pointer-up already handled this press
      const key=picked.dataset.hosePort;
      if(key.endsWith(':in')){if(actions.key())actions.finish(key.split(':')[0]);}
      else actions.begin(key);
    },capture);
    return {reset,dispose(){reset();events.abort();guide.remove();}};
  }
};
