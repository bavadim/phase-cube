/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Route flat belts around station footprints. A crossing has a real raised deck. */
window.IsoBelts = (() => {
  const deck = .27;
  const v = (x,z) => new THREE.Vector3(x,deck,z);
  const unique = values => Array.from(new Set(values.map(x=>Math.round(x*1000)/1000))).sort((a,b)=>a-b);
  function intersects(a,b,box) {
    return Math.min(a.x,b.x) < box.right-.002 && Math.max(a.x,b.x) > box.left+.002 &&
      Math.min(a.z,b.z) < box.bottom-.002 && Math.max(a.z,b.z) > box.top+.002;
  }
  function segments(points) { return points.slice(1).map((b,i)=>[points[i],b]); }
  function crossing(a,b,c,d) {
    if ((a.x===b.x)===(c.x===d.x)) return null;
    const vertical=a.x===b.x?[a,b]:[c,d], horizontal=a.x===b.x?[c,d]:[a,b];
    const {x}=vertical[0], {z}=horizontal[0];
    if (x <= Math.min(horizontal[0].x,horizontal[1].x)+.01 || x >= Math.max(horizontal[0].x,horizontal[1].x)-.01 ||
        z <= Math.min(vertical[0].z,vertical[1].z)+.01 || z >= Math.max(vertical[0].z,vertical[1].z)-.01) return null;
    return v(x,z);
  }
  function simplify(points) {
    const kept=[];
    for (const p of points) {
      if(kept.length&&p.distanceToSquared(kept[kept.length-1]) < .00002)continue;
      if(kept.length>1){
        const a=kept[kept.length-2],b=kept[kept.length-1];
        if(Math.abs((b.x-a.x)*(p.z-b.z)-(b.z-a.z)*(p.x-b.x))<.0001 &&
           ((b.x-a.x)*(p.x-b.x)+(b.z-a.z)*(p.z-b.z))>0)kept.pop();
      }
      kept.push(p);
    }
    return kept;
  }
  function plan(start,end,port,boxes,older) {
    const side=port==='side'||port==='copy';
    const gap=end.x-start.x;
    const neck=!side&&gap>0?Math.min(.54,gap*.43):.54;
    const a=v(start.x+(side?0:neck),start.z+(side?.56:0)), b=v(end.x-neck,end.z);
    const xs=unique([a.x,b.x,(a.x+b.x)/2,...boxes.flatMap(o=>[o.left-.22,o.right+.22])]);
    const zs=unique([a.z,b.z,(a.z+b.z)/2,...boxes.flatMap(o=>[o.top-.22,o.bottom+.22])]);
    const cells=xs.flatMap(x=>zs.map(z=>v(x,z))), nz=zs.length;
    const nearest=(arr,val)=>arr.reduce((best,x,i)=>Math.abs(x-val)<Math.abs(arr[best]-val)?i:best,0);
    const index=p=>nearest(xs,p.x)*nz+nearest(zs,p.z), from=index(a), to=index(b);
    const edges=older.flatMap(p=>segments(p));
    const queue=[{i:from,dir:-1,score:0,prev:null}], best=new Map();
    let final;
    while(queue.length){
      queue.sort((p,q)=>q.score-p.score);
      const cur=queue.pop(),u=cells[cur.i];
      if(cur.i===to){final=cur;break;}
      if(cur.score>best.get(cur.i*2+cur.dir))continue;
      const neighbors=[];
      if(cur.i>=nz)neighbors.push([cur.i-nz,0]);
      if(cur.i+nz<cells.length)neighbors.push([cur.i+nz,0]);
      if(cur.i%nz>0)neighbors.push([cur.i-1,1]);
      if(cur.i%nz<nz-1)neighbors.push([cur.i+1,1]);
      for(const [j,dir] of neighbors){
        const w=cells[j];
        // A belt cannot double back through its own socket. Turn at the
        // end of the neck, or keep travelling in the inlet/outlet direction.
        if(cur.i===from && (side?w.z<u.z-.001:w.x<u.x-.001))continue;
        if(j===to && u.x>w.x+.001)continue;
        if(boxes.some(o=>intersects(u,w,o)))continue;
        let cost=u.distanceTo(w)+(cur.dir>=0&&cur.dir!==dir?.34:0);
        for(const [c,d] of edges){
          if(crossing(u,w,c,d)){cost+=.4;continue;}
          const axis=dir===0?'z':'x', len=dir===0?'x':'z';
          if(Math.abs(c[axis]-d[axis])<.01 && Math.abs(c[axis]-u[axis])<.38){
            const overlap=Math.min(Math.max(c[len],d[len]),Math.max(u[len],w[len]))-
              Math.max(Math.min(c[len],d[len]),Math.min(u[len],w[len]));
            cost+=Math.max(0,overlap)*4;
          }
        }
        const score=cur.score+cost, key=j*2+dir;
        if(score>=(best.get(key)??Infinity)-.0001)continue;
        best.set(key,score);queue.push({i:j,dir,score,prev:cur});
      }
    }
    const path=[];
    for(let p=final;p;p=p.prev)path.unshift(cells[p.i]);
    if(!final)path.push(a,v(a.x,b.z),b);
    const points=simplify([v(start.x,start.z),...path,v(end.x,end.z)]);
    const crossings=[];
    for(const [x,y] of segments(points))for(const [c,d] of edges){const p=crossing(x,y,c,d);if(p)crossings.push(p);}
    return {points,crossings};
  }
  function curveFor({points,crossings}) {
    const path=new THREE.CurvePath();let previous=points[0];
    for(let i=1;i<points.length-1;i++){
      const here=points[i],next=points[i+1],r=Math.min(.37,here.distanceTo(previous)*.42,here.distanceTo(next)*.42);
      const entry=here.clone().addScaledVector(previous.clone().sub(here).normalize(),r);
      const exit=here.clone().addScaledVector(next.clone().sub(here).normalize(),r);
      path.add(new THREE.LineCurve3(previous,entry));path.add(new THREE.QuadraticBezierCurve3(entry,here,exit));previous=exit;
    }
    path.add(new THREE.LineCurve3(previous,points[points.length-1]));
    if(!crossings.length)return path;
    const samples=path.getSpacedPoints(Math.max(16,Math.ceil(path.getLength()*7)));
    for(const p of samples){
      const d=Math.min(...crossings.map(c=>p.distanceTo(c)));
      if(d<1.15)p.y+=.58*.5*(1+Math.cos(d/1.15*Math.PI));
    }
    return new THREE.CatmullRomCurve3(samples);
  }
  function build(group,plan,materials) {
    const path=curveFor(plan),length=path.getLength(),n=Math.max(8,Math.ceil(length*6));
    const centers=path.getSpacedPoints(n),normals=centers.map((p,i)=>{
      const delta=centers[Math.min(i+1,n)].clone().sub(centers[Math.max(i-1,0)]);
      return new THREE.Vector3(delta.z,0,-delta.x).normalize();
    });
    function ribbon(left,right,h,mat) {
      const vertices=[],indices=[];
      for(let i=0;i<=n;i++){
        for(const offset of [left,right]){
          const p=centers[i].clone().addScaledVector(normals[i],offset); vertices.push(p.x,p.y+h,p.z);
        }
        if(i){const a=2*i;indices.push(a-2,a,a-1,a-1,a,a+1);}
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);group.add(mesh);
    }
    ribbon(-.182,.182,0,materials.belt);
    for(const rail of [-.184,.184])ribbon(rail-.024,rail+.024,.023,materials.rail);
    const count=Math.max(1,Math.floor(length/.37)), ties=new THREE.InstancedMesh(new THREE.BoxGeometry(.28,.018,.026),materials.tread,count);
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const t=(i+.5)/count;
      dummy.position.copy(path.getPointAt(t));dummy.position.y+=.009;
      const dir=path.getTangentAt(t);dummy.rotation.y=Math.atan2(dir.x,dir.z);
      dummy.updateMatrix();ties.setMatrixAt(i,dummy.matrix);
    }
    group.add(ties);
    for(const c of plan.crossings){
      const pier=new THREE.Mesh(new THREE.BoxGeometry(.075,.53,.54),materials.rail);
      pier.position.set(c.x+.42,.26,c.z);group.add(pier);
    }
    return path;
  }
  return {plan,build};
})();
