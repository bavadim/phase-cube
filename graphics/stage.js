/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A persistent Three renderer, raycaster and resize/input boundary. No game rules or audio clock. */
window.PuzzleStage = class {
  constructor(element,{log=()=>{},onIssue=()=>{},onRestore=()=>{}}={}){
    this.element=element;this.active=null;this.disabled=true;this.contextLost=false;this.timelines=new Map();this.dirty=true;
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.canvas=this.renderer.domElement;this.canvas.setAttribute('aria-hidden','true');element.append(this.canvas);
    this.targets=document.createElement('div');this.targets.className='sr-only';element.append(this.targets);
    this.ray=new THREE.Raycaster();
    this.pointer=new PuzzlePointer(this.canvas,{
      enabled:()=>!!this.active&&!this.disabled&&!this.contextLost,log,
      pick:(x,y)=>this.pick(x,y),select:(hit,event)=>this.active?.onSelect(hit,event),
      hover:(hit,event)=>{
        if(hit&&event?.pointerType)this.stopTween('camera');
        this.active?.onHover?.(hit,event);this.dirty=true;this.canvas.style.cursor=hit?.draggable?'grab':hit?'pointer':this.active?.view.drag?'grab':'default';
      },
      drag:(x,y)=>{this.stopTween('camera');this.active?.view.drag?.(x,y);this.dirty=true;},
      beginDrag:(hit,p)=>{
        if(!hit?.draggable||!this.active?.view.beginDrag)return false;
        this.active.onSelect({...hit,selectOnly:true});
        const started=this.active.view.beginDrag(hit,this.unproject(p.x,p.y));this.dirty=true;return started;
      },
      moveDrag:p=>{this.active?.view.dragTo?.(this.unproject(p.x,p.y));this.dirty=true;},
      endDrag:cancelled=>{
        const move=this.active?.view.endDrag?.(cancelled);this.dirty=true;
        if(move&&!cancelled&&!this.disabled)this.active?.onMove(move);
      }
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);
    this.events=new AbortController();
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;element.dataset.context='lost';log('graphics.lost');onIssue('Изображение восстанавливается. После восстановления нажмите «Продолжить».');},{signal:this.events.signal});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;delete element.dataset.context;log('graphics.restored');this.resize();onRestore();},{signal:this.events.signal});
    this.resize();
  }
  mount(createView,context){
    this.unmount();
    const resources=new PuzzleGraphics.Resources(),scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(PuzzleGraphics.theme.light,0x829478,2.3));
    const light=new THREE.DirectionalLight(0xfff5df,2.5);light.position.set(-3,6,5);scene.add(light);
    try{
      const view=createView({...context,scene,resources,tween:(...args)=>this.tween(...args)});
      this.active={scene,resources,view,onSelect:context.onSelect,onHover:context.onHover,onMove:context.onMove};
      this.element.dataset.puzzle=context.module.id;this.element.setAttribute('aria-label',context.module.title);
      this.targets.replaceChildren(...context.model.choices().map(choice=>{
        const button=document.createElement('button');button.textContent=choice.label;button.type='button';
        button.onclick=()=>{if(!this.disabled)context.onSelect({key:choice.key,selectOnly:true});};return button;
      }));
      this.resize();return view;
    }catch(error){resources.dispose();scene.clear();throw error;}
  }
  resize(){
    const width=Math.max(1,this.element.clientWidth),height=Math.max(1,this.element.clientHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(width,height,false);
    const view=this.active?.view;
    if(view){view.resize?.(width/height,width,height);view.camera.updateProjectionMatrix();}
    this.dirty=true;
  }
  pick(x,y){
    const active=this.active;if(!active||this.disabled)return null;
    const rect=this.canvas.getBoundingClientRect();
    active.scene.updateMatrixWorld(true);active.view.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),active.view.camera);
    const hit=this.ray.intersectObjects(active.view.pickTargets(),false)[0];
    if(!hit)return null;
    const {actionCenter,...target}=active.view.hit(hit);
    return actionCenter?{...target,inverted:x<this.project(actionCenter).x}:target;
  }
  project(point){
    this.active.scene.updateMatrixWorld(true);this.active.view.camera.updateMatrixWorld();
    const p=point.clone().project(this.active.view.camera),rect=this.canvas.getBoundingClientRect();
    return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
  }
  unproject(x,y){
    const rect=this.canvas.getBoundingClientRect();this.active.view.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.active.view.camera);
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());
  }
  // Also used by browser QA: these are projections of the actual Three objects, not a second hit map.
  locations(){return (this.active?.view.locations()||[]).map(({point,region,...target})=>({...target,...this.project(point),region:region?.map(p=>this.project(p))}));}
  update(disabled){
    this.disabled=disabled;this.element.setAttribute('aria-disabled',String(disabled));
    this.targets.inert=disabled;if(disabled)this.pointer.cancel();
    this.active?.view.sync();this.dirty=true;
  }
  feedback(value){this.active?.view.feedback(value);this.dirty=true;}
  tween(key,duration,step){
    this.stopTween(key);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||duration===0){step(1);this.dirty=true;return Promise.resolve(true);}
    return new Promise(resolve=>this.timelines.set(key,{start:performance.now(),duration,step,resolve}));
  }
  stopTween(key){const old=this.timelines.get(key);if(old){this.timelines.delete(key);old.resolve(false);}}
  frame(now){
    for(const [key,t]of this.timelines){
      const progress=Math.min(1,(now-t.start)/t.duration);t.step(progress*progress*(3-2*progress));this.dirty=true;
      if(progress===1){this.timelines.delete(key);t.resolve(true);}
    }
    if(this.active&&this.dirty&&!this.contextLost){this.renderer.render(this.active.scene,this.active.view.camera);this.dirty=false;}
  }
  unmount(){
    this.pointer.cancel();for(const key of this.timelines.keys())this.stopTween(key);
    if(this.active){this.active.view.dispose?.();this.active.resources.dispose();this.active.scene.clear();this.active=null;}
    this.targets.replaceChildren();this.renderer.renderLists.dispose();this.canvas.style.cursor='default';this.dirty=true;
  }
  info(){return {canvasCount:this.element.querySelectorAll('canvas').length,geometries:this.renderer.info.memory.geometries,
        textures:this.renderer.info.memory.textures,tweens:this.timelines.size,puzzle:this.element.dataset.puzzle,contextLost:this.contextLost,disabled:this.disabled,
        pointer:this.pointer.gesture?{id:this.pointer.gesture.id,moved:this.pointer.gesture.moved}:null};}
  destroy(){this.unmount();this.pointer.destroy();this.events.abort();this.resizeObserver.disconnect();this.renderer.dispose();this.element.replaceChildren();}
};
