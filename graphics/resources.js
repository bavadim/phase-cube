/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Only Three.js GPU objects live here. Music/session resources have their own owners. */
window.PuzzleGraphics = (() => {
  // The same material language for all instruments. Semantic part colours stay in game.voices.
  const theme = Object.freeze({ink:0x101b2e, accent:0xffc477, hover:0x65e1d9, paper:0xe7eee9, light:0xd9eaff,
    shell:0x27344e, rim:0x63748d, dark:0x09121e, cyan:0x65e1d9});
  class Resources {
    constructor(){ this.items=new Set(); this.labels=new Map();this.shapes=new Map(); }
    own(value){ this.items.add(value); return value; }
    // Seeded powder-coat grain: one small texture per mounted view, no download or live noise.
    surface(){
      if(this.grain)return this.grain;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=137;
      for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=240+(seed%16);pixels.data.set([c,c,c,255],i);}
      ctx.putImageData(pixels,0,0);
      this.grain=this.own(new THREE.CanvasTexture(canvas));this.grain.colorSpace=THREE.SRGBColorSpace;
      this.grain.wrapS=this.grain.wrapT=THREE.RepeatWrapping;this.grain.anisotropy=4;return this.grain;
    }
    // Native ExtrudeGeometry gives real chamfers and exact nominal bounds, including the bevel.
    bevelBox(width,height,depth,bevel=.04){
      const b=Math.min(bevel,width/4,height/4,depth/4),key=[width,height,depth,b].join(':');
      if(this.shapes.has(key))return this.shapes.get(key);
      const x=width/2-b,y=height/2-b,shape=new THREE.Shape();
      shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
      const geo=this.own(new THREE.ExtrudeGeometry(shape,{depth:depth-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:1}));
      geo.translate(0,0,-depth/2+b);this.shapes.set(key,geo);return geo;
    }
    label(color,number){
      const key=color+':'+number;
      if(this.labels.has(key))return this.labels.get(key);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(3,3,250,250,26);ctx.fill();
      const sheen=ctx.createLinearGradient(0,0,0,256);sheen.addColorStop(0,'#ffffff35');sheen.addColorStop(.45,'#ffffff00');sheen.addColorStop(1,'#07132225');ctx.fillStyle=sheen;ctx.fill();
      ctx.strokeStyle='#0b1829';ctx.lineWidth=7;ctx.stroke();
      ctx.strokeStyle='#ffffff65';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(29,14);ctx.lineTo(227,14);ctx.stroke();
      ctx.fillStyle='#132337';ctx.font='650 114px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,128,132);
      for(const x of [22,234])for(const y of [22,234]){ctx.fillStyle='#13233745';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
      const texture=this.own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=4;this.labels.set(key,texture);return texture;
    }
    material(color,extra={}){ return this.own(new THREE.MeshStandardMaterial({color,map:this.surface(),roughness:.52,metalness:.16,...extra})); }
    stroke(points,{color=theme.accent,radius=.016,closed=false}={}){
      const vertices=points.map(p=>new THREE.Vector3(...p));if(closed)vertices.push(vertices[0]);
      const curve=new THREE.CurvePath();
      for(let i=1;i<vertices.length;i++)curve.add(new THREE.LineCurve3(vertices[i-1],vertices[i]));
      return new THREE.Mesh(this.own(new THREE.TubeGeometry(curve,Math.max(4,vertices.length*3),radius,5,false)),this.own(new THREE.MeshBasicMaterial({color})));
    }
    turnArrow(inverse){
      const group=new THREE.Group(),points=[];
      for(let i=0;i<=36;i++){const a=.3+(inverse?1:-1)*i/36*Math.PI*1.55;points.push([Math.cos(a)*.79,Math.sin(a)*.79,.025]);}
      group.add(this.stroke(points,{radius:.022}));
      const cone=new THREE.Mesh(this.own(new THREE.ConeGeometry(.065,.17,8)),this.own(new THREE.MeshBasicMaterial({color:theme.accent})));
      const end=new THREE.Vector3(...points.at(-1)),direction=end.clone().sub(new THREE.Vector3(...points.at(-2))).normalize();
      cone.position.copy(end);cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(cone);return group;
    }
    dispose(){ for(const item of this.items)item.dispose();this.items.clear();this.labels.clear();this.shapes.clear();this.grain=null; }
  }
  return {Resources,theme};
})();
