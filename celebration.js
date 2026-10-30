/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* All motion is CSS; JavaScript only creates and clears a finite burst. */
window.PhaseCubeCelebration=(()=>{
  function create(element){
    let timer;
    const clear=()=>{clearTimeout(timer);element.replaceChildren();element.hidden=true;};
    function play(){
      clear();
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const positions=[[25,30],[74,25],[49,43],[19,59],[81,56]];
      const colors=['#d89432','#317f59','#d57350','#6d8eb3','#ab749d'];
      positions.forEach(([x,y],burst)=>{
        const firework=document.createElement('span');firework.className='firework';
        firework.style.cssText=`left:${x}%;top:${y}%;--delay:${burst*140}ms;--spark-color:${colors[burst]}`;
        for(let i=0;i<14;i++){
          const angle=i*Math.PI*2/14,distance=48+(i%3)*15;
          const spark=document.createElement('i');spark.className='firework-spark';
          spark.style.cssText=`--dx:${Math.cos(angle)*distance}px;--dy:${Math.sin(angle)*distance}px;--angle:${angle}rad;--spark-color:${colors[(i+burst)%colors.length]}`;
          firework.append(spark);
        }
        element.append(firework);
      });
      element.hidden=false;timer=setTimeout(clear,2100);
    }
    return {play,clear};
  }
  return {create};
})();
