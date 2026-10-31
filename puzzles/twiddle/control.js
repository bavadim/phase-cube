/* SPDX-License-Identifier: AGPL-3.0-or-later */
TwiddlePuzzle.mount=function({stage,commands,model,game,canInteract,onMove,onPreview,onSelect}){
  const NS='http://www.w3.org/2000/svg';let frame=0,dead=false;
  stage.className='puzzle-stage twiddle-stage';stage.innerHTML='<svg viewBox="0 0 360 250" role="img" aria-label="Изометрическое поле: шесть плиток, левый и правый вращающиеся блоки"></svg>';
  stage.setAttribute('aria-label','Поворотные плитки: выбери левый или правый блок');
  const svg=stage.firstElementChild,project=(x,y,z=0)=>[154+(x-y)*57,28+(x+y)*31-z];
  const points=vertices=>vertices.map(p=>project(...p).join(',')).join(' ');
  const add=(tag,attrs,parent=svg)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  function draw(positions){
    svg.replaceChildren();
    add('polygon',{points:points([[0,0],[3,0],[3,2],[0,2]]),class:'twiddle-base'});
    add('polygon',{points:points([[0,2],[3,2],[3,2,-12],[0,2,-12]]),class:'twiddle-edge'});
    add('polygon',{points:points([[3,0],[3,2],[3,2,-12],[3,0,-12]]),class:'twiddle-side'});
    const pieces=positions||model.snapshot().map((id,slot)=>({id,x:slot%3+.5,y:Math.floor(slot/3)+.5,z:0}));
    pieces.sort((a,b)=>a.x+a.y-b.x-b.y).forEach(({id,x,y,z=0})=>{
      const g=add('g',{'data-piece':id,class:'twiddle-piece',style:'--piece-color:'+game.voices[id].color});
      const d=.44;
      add('polygon',{points:points([[x-d,y+d,z],[x+d,y+d,z],[x+d,y+d,z-7],[x-d,y+d,z-7]]),class:'tile-edge'},g);
      add('polygon',{points:points([[x+d,y-d,z],[x+d,y+d,z],[x+d,y+d,z-7],[x+d,y-d,z-7]]),class:'tile-side'},g);
      add('polygon',{points:points([[x-d,y-d,z],[x+d,y-d,z],[x+d,y+d,z],[x-d,y+d,z]]),class:'tile-top'},g);
      const p=project(x,y,z);add('text',{x:p[0],y:p[1]+6,'text-anchor':'middle',class:'tile-number'},g).textContent=id+1;
      g.addEventListener('click',()=>{if(canInteract()){
        // The shared middle column belongs to both blocks: tapping it switches blocks.
        model.select(x===1.5?(model.selected==='A'?'B':'A'):x<1.5?'A':'B');controls.hint(null);onSelect();
      }});
    });
    const left=model.selected==='A'?0:1;
    add('polygon',{points:points([[left+.02,.02,2],[left+1.98,.02,2],[left+1.98,1.98,2],[left+.02,1.98,2]]),class:'twiddle-selection'});
  }
  const controls=new PuzzleTurnControls(commands,{model,onMove,onPreview,onSelect});
  draw();
  return {
    update(disabled){stage.inert=disabled;stage.setAttribute('aria-disabled',String(disabled));controls.update(disabled);draw();},
    animate(move,before){
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){draw();return Promise.resolve();}
      const ring=TwiddleModel.rings[move[0]],cx=move[0]==='A'?1:2,cy=1,sign=move.endsWith("'")?-1:1,start=performance.now();
      return new Promise(resolve=>{
        const tick=now=>{if(dead){resolve();return;}const t=Math.min(1,(now-start)/300),q=t*t*(3-2*t),angle=sign*q*Math.PI/2;
          draw(before.map((id,slot)=>{let x=slot%3+.5,y=Math.floor(slot/3)+.5,z=0;if(ring.includes(slot)){const dx=x-cx,dy=y-cy;x=cx+dx*Math.cos(angle)-dy*Math.sin(angle);y=cy+dx*Math.sin(angle)+dy*Math.cos(angle);z=Math.sin(t*Math.PI)*9;}return{id,x,y,z};}));
          if(t<1)frame=requestAnimationFrame(tick);else{draw();resolve();}
        };frame=requestAnimationFrame(tick);
      });
    },
    hint(move){controls.hint(move);draw();},clearHint(){controls.hint(null);},focus:()=>controls.focus(),
    destroy(){dead=true;cancelAnimationFrame(frame);svg.replaceChildren();},
    key(event){const k=event.code?.replace('Key','');if(['A','B'].includes(k)){onMove(model.moveFor(k,event.shiftKey));return true;}return false;}
  };
};
