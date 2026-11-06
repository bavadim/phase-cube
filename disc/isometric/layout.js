/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.IsoLayout=factory();
})(globalThis,function(){
  'use strict';
  const COLUMNS=3, COLUMN_WIDTH=3, ROW_DEPTH=3.55;
  const groups=Object.freeze({inputs:['source'],devices:['copy','delay','router'],outputs:['bell','keys','bin']});
  function freeze(layout){
    return Object.freeze({inputs:Object.freeze(layout.inputs),
      devices:Object.freeze(layout.devices.map(Object.freeze)),outputs:Object.freeze(layout.outputs)});
  }
  function initial(){return freeze({inputs:[null,'source',null],devices:[['copy','delay','router']],outputs:['bell','keys','bin']});}
  function zoneOf(id){return Object.keys(groups).find(zone=>groups[zone].includes(id));}
  function validRows(rows,zone){
    return Array.isArray(rows)&&rows.length>0&&rows.length<=groups[zone].length&&rows.every(row=>
      Array.isArray(row)&&row.length===COLUMNS&&Array.from(row).every(id=>id===null||groups[zone].includes(id)));
  }
  function restore(raw){
    if(raw===undefined)return initial();
    for(const zone of Object.keys(groups)){
      const rows=zone==='devices'?raw?.[zone]:[raw?.[zone]];
      if(!validRows(rows,zone))throw new Error('Повреждена расстановка деталей.');
      const items=rows.flat().filter(id=>id!==null);
      if(items.length!==groups[zone].length||new Set(items).size!==items.length||groups[zone].some(id=>!items.includes(id)))
        throw new Error('Каждая деталь должна стоять в своём ряду ровно один раз.');
    }
    return freeze({inputs:[...raw.inputs],devices:raw.devices.filter(row=>row.some(Boolean)).map(row=>[...row]),outputs:[...raw.outputs]});
  }
  function positions(layout){
    const result={};
    for(const zone of Object.keys(groups)){
      const rows=zone==='devices'?layout.devices:[layout[zone]];
      rows.forEach((row,index)=>row.forEach((id,col)=>{
        if(id===null)return;
        const rank=zone==='inputs'?0:zone==='outputs'?layout.devices.length+1:index+1;
        result[id]={x:(col-1)*COLUMN_WIDTH,z:rank*ROW_DEPTH,row:index,col};
      }));
    }
    return result;
  }
  function targets(layout,id){
    const zone=zoneOf(id);
    if(!zone)return [];
    const count=zone==='devices'?layout.devices.length:1,result=[];
    for(let row=0;row<count;row++)for(let col=0;col<COLUMNS;col++){
      const rank=zone==='inputs'?0:zone==='outputs'?layout.devices.length+1:row+1;
      result.push({row,col,insert:false,x:(col-1)*COLUMN_WIDTH,z:rank*ROW_DEPTH});
    }
    if(zone==='devices')for(let row=0;row<=count;row++)for(let col=0;col<COLUMNS;col++){
      result.push({row,col,insert:true,x:(col-1)*COLUMN_WIDTH,z:(row+.5)*ROW_DEPTH});
    }
    return result;
  }
  function move(layout,{id,row,col,insert=false}){
    const zone=zoneOf(id);
    if(!zone||!targets(layout,id).some(t=>t.row===row&&t.col===col&&t.insert===insert))
      throw new Error('Выберите место в ряду этой детали.');
    const next={inputs:[...layout.inputs],devices:layout.devices.map(r=>[...r]),outputs:[...layout.outputs]};
    const rows=zone==='devices'?next.devices:[next[zone]];
    const fromRow=rows.findIndex(r=>r.includes(id)),fromCol=rows[fromRow].indexOf(id);
    if(insert){
      rows[fromRow][fromCol]=null;
      const added=Array(COLUMNS).fill(null);added[col]=id;rows.splice(row,0,added);
    }else{
      rows[fromRow][fromCol]=rows[row][col];rows[row][col]=id;
    }
    next.devices=next.devices.filter(r=>r.some(Boolean));
    const valid=restore(next);
    return JSON.stringify(valid)===JSON.stringify(layout)?layout:valid;
  }
  function zones(layout){
    const output=(layout.devices.length+1)*ROW_DEPTH;
    return [
      {id:'inputs',minZ:-1.6,maxZ:ROW_DEPTH*.45,centerZ:0},
      {id:'devices',minZ:ROW_DEPTH*.45,maxZ:output-ROW_DEPTH*.45,centerZ:output/2},
      {id:'outputs',minZ:output-ROW_DEPTH*.45,maxZ:output+1.6,centerZ:output}
    ];
  }
  return Object.freeze({COLUMNS,COLUMN_WIDTH,ROW_DEPTH,initial,restore,zoneOf,positions,targets,move,zones});
});
