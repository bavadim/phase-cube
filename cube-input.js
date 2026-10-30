/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Input/feedback adapter for this cube: native Three.js raycasts + projected SVG. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PhaseCubeInput=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const NORMALS={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
  function halfPolygon(points,x,left){
    const result=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],inside=p=>left?p[0]<=x:p[0]>=x;
      if(inside(a))result.push(a);
      if(inside(a)!==inside(b)){const t=(x-a[0])/(b[0]-a[0]);result.push([x,a[1]+(b[1]-a[1])*t]);}
    }
    return result;
  }
  const path=points=>points.length?'M'+points.map(p=>p.join(',')).join(' L')+' Z':'';
  function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;}
  class Input {
    constructor({T,stage,view,svg,root,camera,getStickers,isBusy,onMove,onPreview,onDrag}){
      Object.assign(this,{T,stage,view,svg,root,camera,getStickers,isBusy,onMove,onPreview,onDrag});
      this.ray=new T.Raycaster();this.pointer=null;this.hover=null;this.hint=null;this.buttonMove=null;this.dirty=true;this.signature='';
      const defs=el('defs',{},svg),marker=el('marker',{id:'cube-arrowhead',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:4,markerHeight:4,orient:'auto-start-reverse'},defs);
      el('path',{d:'M1 1 L9 5 L1 9 Z',fill:'currentColor'},marker);
      this.hits=el('g',{'class':'cube-hit-areas'},svg);
      this.feedback=el('g',{'class':'cube-feedback','aria-hidden':'true'},svg);
      stage.addEventListener('pointerdown',e=>{
        if(e.button!==0||this.isBusy())return;
        this.onDrag?.();this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
        stage.setPointerCapture(e.pointerId);e.preventDefault();
      });
      stage.addEventListener('pointermove',e=>{
        if(this.pointer){
          const p=this.pointer;
          if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>6)p.moved=true;
          if(p.moved){root.rotation.y+=(e.clientX-p.x)*.009;root.rotation.x+=(e.clientY-p.y)*.009;this.setHover(null);this.refresh();}
          p.x=e.clientX;p.y=e.clientY;
        }else this.setHover(this.pick(e.clientX,e.clientY));
      });
      stage.addEventListener('pointerup',e=>{
        if(!this.pointer||this.pointer.id!==e.pointerId)return;
        const p=this.pointer;this.pointer=null;
        if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
        if(p.moved||this.isBusy())return;
        const hit=this.pick(e.clientX,e.clientY);
        if(hit){svg.dataset.lastMove=hit.move;svg.dataset.lastHalf=hit.left?'left':'right';this.onMove(hit.move,hit.id);}
      });
      const cancel=()=>{this.pointer=null;this.setHover(null);};
      stage.addEventListener('pointercancel',cancel);stage.addEventListener('lostpointercapture',()=>{if(this.pointer)cancel();});
      stage.addEventListener('pointerleave',()=>{if(!this.pointer)this.setHover(null);});
    }
    refresh(){this.dirty=true;}
    previewMove(move){this.buttonMove=move;this.notify();}
    setHint(move){this.hint=move;this.notify();}
    resetPreview(){this.hover=null;this.hint=null;this.buttonMove=null;this.notify();}
    setHover(hit){
      if(this.hover?.move===hit?.move&&this.hover?.id===hit?.id)return;
      this.hover=hit;this.stage.style.cursor=hit?'pointer':'grab';this.notify();
    }
    notify(){
      const move=this.buttonMove||this.hover?.move||this.hint;
      this.onPreview(move,this.buttonMove?'button':this.hover?'tile':this.hint?'hint':null);
      this.drawFeedback();
    }
    project(world){const p=world.clone().project(this.camera);return[(p.x+1)*this.view.clientWidth/2,(1-p.y)*this.view.clientHeight/2];}
    pick(x,y){
      if(this.isBusy())return null;
      this.root.updateMatrixWorld(true);
      const rect=this.view.getBoundingClientRect();
      this.ray.setFromCamera(new this.T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.camera);
      const hit=this.ray.intersectObjects(this.getStickers())[0];if(!hit)return null;
      const center=this.project(hit.object.getWorldPosition(new this.T.Vector3())),left=x-rect.left<center[0],face=hit.object.userData.face;
      return{face,id:hit.object.userData.id,left,move:face+(left?"'":'')};
    }
    facePoint(face,x,y){
      const n=new this.T.Vector3(...NORMALS[face]),q=new this.T.Quaternion().setFromUnitVectors(new this.T.Vector3(0,0,1),n);
      return this.project(this.root.localToWorld(new this.T.Vector3(x,y,0).applyQuaternion(q).add(n.multiplyScalar(1.032))));
    }
    drawFeedback(){
      this.feedback.replaceChildren();
      delete this.svg.dataset.previewMove;this.svg.classList.remove('hint-preview');
      const move=this.buttonMove||this.hover?.move||this.hint;if(!move||this.isBusy())return;
      const face=move[0];if(!this.visibleFaces?.has(face))return;
      const quad=[[-1.015,1.015],[1.015,1.015],[1.015,-1.015],[-1.015,-1.015]].map(([x,y])=>this.facePoint(face,x,y));
      el('path',{d:path(quad),'class':'cube-face-outline'},this.feedback);
      if(this.hover&&!this.buttonMove){
        const tile=this.visibleTiles?.find(t=>t.face===face&&t.id===this.hover.id);
        if(tile)el('path',{d:path(halfPolygon(tile.points,tile.center[0],this.hover.left)),'class':'cube-half-highlight'},this.feedback);
      }
      const inverse=move.endsWith("'"),points=[];
      for(let i=0;i<=32;i++){const a=(.30+(inverse?1:-1)*i/32*Math.PI*1.55);points.push(this.facePoint(face,Math.cos(a)*.79,Math.sin(a)*.79));}
      const d='M'+points.map(p=>p.join(',')).join(' L');
      el('path',{d,'class':'cube-turn-underlay'},this.feedback);
      el('path',{d,'class':'cube-turn-arrow','marker-end':'url(#cube-arrowhead)'},this.feedback);
      this.svg.dataset.previewMove=move;this.svg.classList.toggle('hint-preview',!!this.hint&&!this.hover&&!this.buttonMove);
    }
    update(){
      this.svg.classList.toggle('is-busy',this.isBusy());
      const signature=[...this.root.quaternion.toArray(),this.view.clientWidth,this.view.clientHeight,this.isBusy()].join(',');
      if(!this.dirty&&signature===this.signature)return;
      this.signature=signature;this.dirty=false;this.root.updateMatrixWorld(true);this.hits.replaceChildren();
      this.svg.setAttribute('viewBox',`0 0 ${this.view.clientWidth} ${this.view.clientHeight}`);
      this.visibleTiles=[];this.visibleFaces=new Set();
      if(this.isBusy()){this.feedback.replaceChildren();return;}
      for(const sticker of this.getStickers()){
        const center=sticker.getWorldPosition(new this.T.Vector3()),normal=sticker.getWorldDirection(new this.T.Vector3());
        if(normal.dot(this.camera.position.clone().sub(center))<=.001)continue;
        const points=[[-.41,.41],[.41,.41],[.41,-.41],[-.41,-.41]].map(([x,y])=>this.project(sticker.localToWorld(new this.T.Vector3(x,y,0))));
        const tile={face:sticker.userData.face,id:sticker.userData.id,center:this.project(center),points};
        this.visibleTiles.push(tile);this.visibleFaces.add(tile.face);
        for(const left of [true,false]){
          const move=tile.face+(left?"'":''),shape=halfPolygon(points,tile.center[0],left);
          const target=el('path',{d:path(shape),'class':'cube-hit',role:'button',tabindex:-1,'data-face':tile.face,'data-id':tile.id,'data-half':left?'left':'right','data-move':move,'aria-label':`${tile.face}: ${left?'против часовой стрелки':'по часовой стрелке'}, ${left?'левая':'правая'} половина плитки ${tile.id+1}`},this.hits);
          const activate=()=>{if(!this.isBusy()){this.svg.dataset.lastMove=move;this.svg.dataset.lastHalf=left?'left':'right';this.onMove(move,tile.id);}};
          target.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();e.stopPropagation();activate();}});
          target.addEventListener('click',e=>{if(e.detail===0)activate();});
        }
      }
      this.drawFeedback();
    }
  }
  return{Input,halfPolygon};
});
