/* Existing wooden school-way sign; independent of retired scenes. */
(() => {
  'use strict';
  const art=new URL('assets/forest-village-library/adventure/',document.currentScript.src).href;
  function sign(b,id,text,x,y,size){
    const depth=Math.round(y+size*.86);
    b.html.push('<div class="fv-wood-sign fv-art" data-art="'+id+'" style="left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;z-index:'+depth+'"><img src="'+art+'wood-sign.png" alt=""><span>'+text+'</span></div>');
    b.scene.parts.push({id,role:'sign',x,y,width:size,height:size,depth});
    b.solid(id+'-feet',x+size*.24,y+size*.77,size*.56,size*.12);
  }

  window.QPForestSign=sign;
})();
