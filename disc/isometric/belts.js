/* SPDX-License-Identifier: AGPL-3.0-or-later */
// Socket leads are routed on the table. Lift one jacket over another at crossings.
window.IsoBelts = (() => {
  const radius=.095;
  const horizontal=(p,q)=>Math.hypot(q.x-p.x,q.z-p.z);
  const amount=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  // Test the open rectangle, so a shortest path can follow its outside edge.
  function enters(a,b,box) {
    let lo=0,hi=1;
    for(const [axis,min,max] of [['x',box.left,box.right],['z',box.top,box.bottom]]){
      const v=b[axis]-a[axis],start=a[axis],left=min+.001,right=max-.001;
      if(Math.abs(v)<.0001){if(start<left||start>right)return false;continue;}
      const t0=(left-start)/v,t1=(right-start)/v;
      lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
      if(hi<lo)return false;
    }
    return hi>lo+.0001;
  }
  function near(a,b,p){
    const dx=b.x-a.x,dz=b.z-a.z;
    const t=amount(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
  }
  function groundPath(a,b,boxes,previous){
    const pts=[a,b];
    for(const box of boxes)for(const x of [box.left,box.right])for(const z of [box.top,box.bottom]){
      const p=new THREE.Vector3(x,0,z);
      if(!boxes.some(o=>x>o.left+.001&&x<o.right-.001&&z>o.top+.001&&z<o.bottom-.001))pts.push(p);
    }
    const seen=new Set(),cost=pts.map(()=>Infinity),parent=pts.map(()=>-1);
    cost[0]=0;
    for(;;){
      let best=-1;
      for(let i=0;i<pts.length;i++)if(!seen.has(i)&&Number.isFinite(cost[i])&&(best<0||cost[i]<cost[best]))best=i;
      if(best===1)break;
      if(best<0)return null;
      seen.add(best);
      const from=pts[best];
      for(let i=1;i<pts.length;i++){
        if(seen.has(i)||boxes.some(box=>enters(from,pts[i],box)))continue;
        const dist=horizontal(from,pts[i]);
        // Short crossings are fine. Sharing a long run makes the branches hard to trace.
        let occupied=0;
        for(const samples of previous)for(const p of samples)if(near(from,pts[i],p)<.18)occupied+=.12;
        const next=cost[best]+dist+.045+occupied*.8;
        if(next<cost[i]){cost[i]=next;parent[i]=best;}
      }
    }
    const result=[];for(let i=1;i!==-1;i=parent[i])result.unshift(pts[i]);return result;
  }
  function rounded(points){
    const line=new THREE.CurvePath();
    let at=points[0];
    for(let i=1;i<points.length-1;i++){
      const here=points[i],next=points[i+1],r=Math.min(.26,horizontal(at,here)*.39,horizontal(next,here)*.39);
      if(r<.002)continue;
      const left=here.clone().lerp(at,r/horizontal(at,here)),right=here.clone().lerp(next,r/horizontal(next,here));
      line.add(new THREE.LineCurve3(at,left));line.add(new THREE.QuadraticBezierCurve3(left,here,right));at=right;
    }
    line.add(new THREE.LineCurve3(at,points[points.length-1]));return line;
  }
  function plan(start,end,outward,inward,obstacles,previous){
    const spread=Math.min(.24,horizontal(start,end)*.28);
    const margin=radius+.035;
    const boxes=obstacles.map(o=>({left:o.left-margin,right:o.right+margin,top:o.top-margin,bottom:o.bottom+margin}));
    function anchor(port,dir) {
      // Two facing jacks may be closer than two normal lengths of strain relief.
      for(const d of [spread,spread*.75,spread*.5,spread*.25,.015]){
        const p=port.clone().addScaledVector(dir,d);
        if(!boxes.some(o=>p.x>o.left&&p.x<o.right&&p.z>o.top&&p.z<o.bottom))return p;
      }
      return port.clone().addScaledVector(dir,spread);
    }
    const a=anchor(start,outward),b=anchor(end,inward);
    const ground=groundPath(a,b,boxes,previous);
    const path=rounded([start,...(ground||[a,b]),end].map(p=>new THREE.Vector3(p.x,0,p.z)));
    const length=path.getLength(),count=Math.max(16,Math.ceil(length*13));
    const samples=path.getSpacedPoints(count);
    for(let i=0;i<=count;i++){
      const p=samples[i],t=i/count,dist=t*length,remaining=length-dist;
      const taper=Math.min(1,dist/.32,remaining/.32);
      const arch=Math.sin(Math.PI*t);
      const ends=THREE.MathUtils.lerp(start.y,end.y,t);
      const resting=ends-(ends-.108)*arch;
      p.y=resting;
      // In extremely close or overlapping holes, use an above-deck jumper.
      if(!ground)p.y+=1.75*Math.min(1,dist/.56,remaining/.56);
      for(const older of previous)for(const q of older){
        const d=horizontal(p,q);
        if(d>=.35)continue;
        const lift=(1+Math.cos(Math.PI*d/.35))*.5*taper;
        p.y=Math.max(p.y,resting+(q.y+.19-resting)*lift);
      }
    }
    return new THREE.CatmullRomCurve3(samples,false,'centripetal');
  }
  function shell(color){
    return new THREE.ShaderMaterial({
      uniforms:{tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,
      vertexShader:`
        varying vec3 wallNormal;
        void main(){
          wallNormal=normalMatrix*normal;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }`,
      fragmentShader:`
        uniform vec3 tint;
        varying vec3 wallNormal;
        void main(){
          float rim=1.0-abs(normalize(wallNormal).z);
          vec3 hue=mix(vec3(.50,.79,.74),tint,smoothstep(.0,.51,rim));
          gl_FragColor=vec4(hue,.28+.68*pow(rim,.72));
          #include <colorspace_fragment>
        }`
    });
  }
  // Separate coloured laminae across the bore of a single dose. The striping is
  // perpendicular to the projected centreline, so every constituent stays
  // visible from either camera, including on the far side of a bend.
  function liquid(group,path,rings){
    const sides=16,geometry=new THREE.TubeGeometry(path,rings,radius*.84,sides,false);
    const axes=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<=rings;i++){
      const tangent=path.getTangentAt(i/rings);
      for(let j=0;j<=sides;j++)tangent.toArray(axes,(i*(sides+1)+j)*3);
    }
    geometry.setAttribute('axis',new THREE.BufferAttribute(axes,3));
    const pixels=new Uint8Array(128*4),palette=new THREE.DataTexture(pixels,128,1);
    palette.needsUpdate=true;
    const shader=new THREE.ShaderMaterial({
      uniforms:{ink:{value:palette},tones:{value:1},interval:{value:new THREE.Vector2()}},
      vertexShader:`
        attribute vec3 axis;
        varying float distanceAlong;
        varying float crossSection;
        void main(){
          vec2 d=(mat3(modelViewMatrix)*axis).xy;
          vec2 across=vec2(-d.y,d.x)/max(length(d),.001);
          crossSection=dot(normalize(normalMatrix*normal).xy,across)*.5+.5;
          distanceAlong=uv.x;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader:`
        uniform sampler2D ink;
        uniform float tones;
        uniform vec2 interval;
        varying float distanceAlong;
        varying float crossSection;
        void main(){
          if(distanceAlong<interval.x || distanceAlong>interval.y)discard;
          float stripe=floor(clamp(crossSection,0.,.99999)*tones);
          vec3 dye=texture2D(ink,vec2((stripe+.5)/128.,.5)).rgb;
          gl_FragColor=vec4(dye*(.83+.17*sin(clamp(crossSection,0.,1.)*3.14159)),1.);
          #include <colorspace_fragment>
        }`
    });
    const stream=new THREE.Mesh(geometry,shader),color=new THREE.Color();
    stream.visible=false;group.add(stream);
    let signature=null;
    return {
      mesh:stream,
      show(pitches,at,span){
        const key=pitches.join(',');
        if(key!==signature){
          signature=key;
          pitches.forEach((pitch,i)=>{
            color.set(IsoPieces.noteColor(pitch));
            pixels.set([255*color.r,255*color.g,255*color.b,255],i*4);
          });
          palette.needsUpdate=true;shader.uniforms.tones.value=pitches.length;
        }
        const head=at*(1+span);
        shader.uniforms.interval.value.set(Math.max(0,head-span),Math.min(1,head));
        stream.visible=!!pitches.length;
      },
      dispose(){shader.dispose();palette.dispose();}
    };
  }
  function build(group,path,materials){
    const length=path.getLength(),rings=Math.max(18,Math.ceil(length*14));
    const jacket=new THREE.Mesh(new THREE.TubeGeometry(path,rings,radius,14,false),materials.hose);
    group.add(jacket);
    function collar(distance,r,h,mat){
      const t=amount(distance/length,0,1),p=path.getPointAt(t),dir=path.getTangentAt(t);
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),mat);
      mesh.position.copy(p);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);group.add(mesh);
    }
    const neck=Math.min(.13,length*.20);
    for(const sign of [1,-1]){
      const at=d=>sign>0?d:length-d;
      collar(at(neck*.32),.128,neck*.64,materials.rail);
      collar(at(neck*.96),.108,neck*.74,materials.tread);
    }
    return {jacket,fluid:liquid(group,path,rings)};
  }
  return {plan,build,shell};
})();
