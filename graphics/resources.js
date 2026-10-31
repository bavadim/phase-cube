/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Only Three.js GPU objects live here. Music/session resources have their own owners. */
window.PuzzleGraphics = (() => {
  const theme = Object.freeze({ink:0x263e33, accent:0xb46f32, hover:0x73976a, paper:0xfcfaf2, light:0xfff9e9});
  class Resources {
    constructor(){ this.items=new Set(); this.labels=new Map(); }
    own(value){ this.items.add(value); return value; }
    label(color,number){
      const key=color+':'+number;
      if(this.labels.has(key))return this.labels.get(key);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(2,2,252,252,20);ctx.fill();
      ctx.strokeStyle='#263e33';ctx.lineWidth=6;ctx.stroke();
      ctx.fillStyle='#20382d';ctx.font='650 114px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,128,132);
      const texture=this.own(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=4;this.labels.set(key,texture);return texture;
    }
    material(color,extra={}){ return this.own(new THREE.MeshStandardMaterial({color,roughness:.87,metalness:0,...extra})); }
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
    dispose(){ for(const item of this.items)item.dispose();this.items.clear();this.labels.clear(); }
  }
  return {Resources,theme};
})();
