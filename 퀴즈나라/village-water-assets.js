/* Original user pond artwork only. Paths crop the existing JPEG and describe
 * its water boundary; the retired canal/brook/attached waterfall are not drawn.
 * Coordinates are raw village-scene coordinates before WORLD_SCALE=1.5. */
(function () {
  'use strict';
  const SOURCE='assets/water-library/originals/water-0e50bcc49b81bd14.jpg';
  const HASH='0e50bcc49b81bd1431849ea7943e72fbc9e4019724f1a65fa2c75ad8133124fb';
  const RECT=Object.freeze([0,331,476,323]);
  const POND=Object.freeze({x:1210,y:868,width:330,height:225});
  const TEXTURE=Object.freeze([240,508,120,23]);
  const SHORE="M29 346L31 341L40 340L41 335L49 336L53 334L57 339L66 338L68 343L73 345L71 350L74 352L70 357L63 358L61 363L57 369L58 374L68 371L74 374L80 370L88 372L97 376L110 376L117 367L121 366L127 369L133 367L137 373L146 371L154 375L164 374L173 377L183 377L193 382L202 383L204 376L211 374L226 378L234 381L235 389L232 397L225 400L226 407L232 413L236 416L240 414L257 416L266 411L268 405L283 404L296 400L311 392L319 395L327 404L338 411L343 416L342 424L348 423L350 418L358 420L365 416L372 420L373 425L379 425L385 430L394 426L401 433L408 434L408 440L420 441L432 445L445 445L450 449L451 454L448 457L455 463L458 464L457 471L464 477L468 476L472 481L468 487L471 491L470 505L466 508L468 516L463 523L461 534L455 542L446 550L442 554L435 559L427 561L421 568L412 570L405 575L397 575L391 580L382 581L375 585L365 585L358 583L350 584L342 587L335 589L326 587L319 591L310 594L301 594L292 597L282 596L274 594L266 596L259 593L251 591L244 593L235 589L226 588L220 587L214 584L206 587L197 586L188 584L181 582L174 581L168 584L159 581L150 579L143 579L136 576L129 575L123 576L115 573L106 574L99 572L93 575L85 572L78 571L72 568L66 563L60 565L52 565L46 565L39 568L32 568L29 563L28 558L31 555L38 551L44 548L44 545L40 541L37 536L37 527L33 526L32 521L27 516L24 509L21 506L17 493L14 491L13 486L10 489L6 486L1 487L0 484L0 385L4 384L4 381L8 380L7 375L13 373L18 375L21 368L26 369L27 365L33 365L34 361L29 359L31 356L29 352Z";
  const WATER="M41 522C67 510 95 503 126 493C152 486 178 486 201 480C228 474 252 465 275 455L299 442L319 437L340 427L361 428L371 436L378 439L394 439L412 441L435 445L447 451L443 459L452 463L453 472L461 478L465 487L461 495L467 502L459 511L457 520L443 524L432 531L419 534L414 542L399 545L382 550L366 550L349 557L339 556L326 564L312 564L299 559L283 556L265 557L249 551L236 553L223 550L208 553L192 550L178 552L164 555L148 557L130 560L116 565L103 563L88 562L74 558L62 551L50 543L41 537Z M303 461L320 459L331 451L353 450L365 445L384 445L393 451L389 459L391 467L381 476L361 480L339 480L323 475L310 475Z";
  const UPPER_POOL=[[14,394],[32,386],[59,382],[70,378],[96,381],[116,387],[138,382],[167,376],[190,376],[215,386],[227,393],[226,410],[211,419],[185,425],[158,419],[149,414],[119,421],[104,412],[62,417],[40,404],[18,405]];
  const id=prefix=>String(prefix||'village-water').replace(/[^a-zA-Z0-9_-]/g,'-');
  const image=()=>'<image href="./'+SOURCE+'" width="735" height="1273"/>';
  function originalPattern(key){
    const width=120,height=46,tile='<svg x="-.6" y="-.6" width="121.2" height="47.2" viewBox="'+TEXTURE.join(' ')+'" preserveAspectRatio="none" overflow="hidden">'+image()+'</svg>';
    return '<pattern id="'+key+'" patternUnits="userSpaceOnUse" width="240" height="92">'+tile+
      '<g transform="translate(240 0) scale(-1 1)">'+tile+'</g><g transform="translate(0 92) scale(1 -1)">'+tile+'</g><g transform="translate(240 92) scale(-1 -1)">'+tile+'</g></pattern>';
  }
  function defs(prefix){
    const p=id(prefix);
    return originalPattern(p+'-original-water')+
      '<clipPath id="'+p+'-pond-shore" clipPathUnits="userSpaceOnUse"><path d="'+SHORE+'"/></clipPath>'+
      '<clipPath id="'+p+'-pond-water" clipPathUnits="userSpaceOnUse"><path d="'+WATER+'" clip-rule="evenodd"/></clipPath>';
  }
  function ground(prefix){
    const p=id(prefix);
    return '<g data-water-art="user-original-pond"><svg data-water-piece="original-pond" x="'+POND.x+'" y="'+POND.y+'" width="'+POND.width+'" height="'+POND.height+'" viewBox="'+RECT.join(' ')+'" preserveAspectRatio="none" overflow="hidden"><g clip-path="url(#'+p+'-pond-shore)">'+image()+'</g><g clip-path="url(#'+p+'-pond-water)"><rect class="vt-water-current vt-water-current-slow" x="0" y="330" width="476" height="350" fill="url(#'+p+'-original-water)"/></g></svg></g>';
  }
  function surfaceContour(){
    const result=[[41,522]],curve=(a,b,c,d)=>{for(let i=1;i<=8;i++){const t=i/8,u=1-t;result.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}};
    curve([41,522],[67,510],[95,503],[126,493]);curve([126,493],[152,486],[178,486],[201,480]);curve([201,480],[228,474],[252,465],[275,455]);
    const edge=WATER.split('L299 ')[1].split('Z')[0].match(/[-+]?\d*\.?\d+/g).map(Number);result.push([299,edge.shift()]);for(let i=0;i<edge.length;i+=2)result.push([edge[i],edge[i+1]]);return result;
  }
  const HOLE=[[303,461],[320,459],[331,451],[353,450],[365,445],[384,445],[393,451],[389,459],[391,467],[381,476],[361,480],[339,480],[323,475],[310,475]];
  const mapped=points=>Object.freeze(points.map(([x,y])=>Object.freeze([POND.x+(x-RECT[0])*POND.width/RECT[2],POND.y+(y-RECT[1])*POND.height/RECT[3]])));
  const waterPolygons=Object.freeze([mapped(surfaceContour()),mapped(UPPER_POOL)]),rockIslands=Object.freeze([mapped(HOLE)]);
  function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  function distance(x,y,points){let best=Infinity;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy,t=denom?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/denom)):0;best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return best;}
  function containsPond(x,y,radius=0){
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    radius=Math.max(0,Number.isFinite(radius)?radius:0);
    const water=waterPolygons.some(poly=>inside(x,y,poly)||distance(x,y,poly)<=radius);
    if(!water)return false;
    return !rockIslands.some(poly=>inside(x,y,poly)&&distance(x,y,poly)>radius);
  }
  // Compatibility for callers from older scenes; the stream has been retired.
  const containsCanal=()=>false,containsBrook=()=>false;
  const retiredFeatures=Object.freeze(['canal','brook','canal-head','attached-waterfall','composite-banks']);
  const geometry=Object.freeze({coordinateSpace:'village-scene raw before WORLD_SCALE',pond:POND,waterPolygons,rockIslands,containsPond,canalPolygons:Object.freeze([]),brookPolygons:Object.freeze([]),retiredFeatures});
  window.QPVillageWaterAssets=Object.freeze({defs,ground,geometry,containsPond,containsCanal,containsBrook,sourceAssets:Object.freeze([SOURCE]),
    sources:Object.freeze([{file:SOURCE,sha256:HASH,dimensions:Object.freeze([735,1273]),pondRect:RECT,pond:POND,waterTextureRect:TEXTURE,shoreMask:SHORE,waterMask:WATER,waterMaskRule:'evenodd',animatedRegions:Object.freeze(['original pond water surface only']),notes:'Original pond with shallow stone rim; no composite river, banks or attached waterfall.'}])});
})();
