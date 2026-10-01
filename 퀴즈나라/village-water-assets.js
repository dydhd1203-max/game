/* Original user water artwork. SVG paths only crop/clip existing JPEG pixels;
 * no generated water, wave drawing, filter, recolor or replacement raster.
 * All placement/collision coordinates are the village scene's raw 1800x1300
 * space (before its public WORLD_SCALE=1.5 and elevation projection). */
(function () {
  'use strict';
  const SOURCE='assets/water-library/originals/water-0e50bcc49b81bd14.jpg';
  const HASH='0e50bcc49b81bd1431849ea7943e72fbc9e4019724f1a65fa2c75ad8133124fb';
  const RECT=Object.freeze([0,331,476,323]);
  const POND=Object.freeze({x:1198,y:854,width:384,height:264});
  const TEXTURE=Object.freeze([240,508,120,23]);
  const BANK=Object.freeze([278,585,65,26]);
  const BANK_ROCK=Object.freeze({sourceRect:Object.freeze([303,437,90,43]),positions:Object.freeze([220,279,338,399,460,522,582,637])});
  const FALL=Object.freeze({sourceRect:Object.freeze([0,0,351,361]),x:962,y:468,width:270,height:278});
  const HEAD=Object.freeze({sourceRect:FALL.sourceRect,x:1010,y:80,width:185,height:190});
  const SHORE="M29 346L31 341L40 340L41 335L49 336L53 334L57 339L66 338L68 343L73 345L71 350L74 352L70 357L63 358L61 363L57 369L58 374L68 371L74 374L80 370L88 372L97 376L110 376L117 367L121 366L127 369L133 367L137 373L146 371L154 375L164 374L173 377L183 377L193 382L202 383L204 376L211 374L226 378L234 381L235 389L232 397L225 400L226 407L232 413L236 416L240 414L257 416L266 411L268 405L283 404L296 400L311 392L319 395L327 404L338 411L343 416L342 424L348 423L350 418L358 420L365 416L372 420L373 425L379 425L385 430L394 426L401 433L408 434L408 440L420 441L432 445L445 445L450 449L451 454L448 457L455 463L458 464L457 471L464 477L468 476L472 481L468 487L471 491L470 505L466 508L468 516L463 523L461 534L455 542L446 550L447 556L441 560L435 566L429 568L428 578L422 583L424 591L419 591L415 590L412 602L405 615L396 627L383 632L373 636L361 628L352 630L344 628L327 629L312 626L310 641L300 649L292 650L282 641L280 631L271 637L266 636L261 620L260 615L249 620L239 620L225 614L222 609L219 611L221 617L216 620L211 615L207 618L197 620L190 616L189 612L184 617L172 621L161 623L151 617L147 614L139 617L129 624L119 622L112 615L109 608L108 600L114 596L122 592L120 586L114 583L105 581L104 577L97 578L90 582L82 579L79 575L76 576L72 575L67 567L60 573L48 571L34 574L30 572L29 566L25 563L29 560L25 556L27 551L36 548L44 545L40 541L37 536L37 527L33 526L32 521L27 516L24 509L21 506L17 493L14 491L13 486L10 489L6 486L1 487L0 484L0 385L4 384L4 381L8 380L7 375L13 373L18 375L21 368L26 369L27 365L33 365L34 361L29 359L31 356L29 352Z";
  const WATER="M41 522C67 510 95 503 126 493C152 486 178 486 201 480C228 474 252 465 275 455L299 442L319 437L340 427L361 428L371 436L378 439L394 439L412 441L435 445L447 451L443 459L452 463L453 472L461 478L465 487L461 495L467 502L459 511L457 520L443 524L432 531L419 534L414 542L399 545L382 550L366 550L349 557L339 556L326 564L312 564L299 559L283 556L265 557L249 551L236 553L223 550L208 553L192 550L178 552L164 555L148 557L130 560L116 565L103 563L88 562L74 558L62 551L50 543L41 537Z M303 461L320 459L331 451L353 450L365 445L384 445L393 451L389 459L391 467L381 476L361 480L339 480L323 475L310 475Z";
  const UPPER_POOL=[[14,394],[32,386],[59,382],[70,378],[96,381],[116,387],[138,382],[167,376],[190,376],[215,386],[227,393],[226,410],[211,419],[185,425],[158,419],[149,414],[119,421],[104,412],[62,417],[40,404],[18,405]];
  const BANK_ROCK_SHORE='M303 461L320 459L331 451L353 450L365 445L384 445L393 451L389 459L391 467L381 476L361 480L339 480L323 475L310 475Z';
  const FALL_SHORE="M0 66L3 64L10 65L13 62L16 62L17 58L24 58L24 54L34 53L36 50L41 50L46 50L52 51L52 56L49 59L48 64L55 62L61 58L70 56L76 60L82 61L85 65L88 69L90 74L94 72L94 63L99 57L105 54L104 50L109 46L116 43L115 37L122 33L118 31L121 27L125 25L123 23L128 21L136 23L142 24L146 23L153 25L161 24L164 24L167 30L171 33L169 37L175 43L180 39L187 38L189 34L193 32L191 27L194 22L200 18L204 19L209 17L214 17L215 22L219 18L224 17L226 20L232 19L235 17L242 22L247 16L252 15L252 11L259 12L263 8L268 9L271 14L276 13L277 18L274 23L280 23L279 31L285 32L290 38L297 41L301 38L305 42L311 40L313 44L317 46L315 53L321 60L323 67L321 70L328 72L331 78L333 81L340 84L340 89L345 92L342 98L346 99L342 105L344 107L339 113L330 115L320 115L316 121L309 127L311 130L325 132L332 130L342 134L346 139L345 144L350 149L347 154L340 154L339 159L329 158L328 162L334 167L338 166L343 170L340 174L344 177L341 183L335 184L337 189L333 193L326 191L324 186L319 188L318 199L314 209L308 219L303 227L297 234L295 249L290 258L281 264L269 272L255 267L251 261L246 270L243 285L236 288L226 287L226 291L240 292L244 300L239 310L232 321L218 324L208 324L205 336L196 342L188 350L176 359L170 356L156 352L153 346L145 341L138 330L134 331L130 326L125 325L123 330L119 334L114 333L113 326L110 330L108 340L101 340L99 331L99 312L96 310L91 310L88 306L81 303L74 299L67 296L61 290L57 282L53 278L49 266L45 260L43 254L40 251L38 243L33 239L31 233L32 227L26 224L24 219L18 216L10 217L9 212L6 209L4 204L2 188L0 187Z";
  const CANAL='M1049 174Q1083 197 1120 181T1160 177V669H1048Z';
  const CANAL_BANKS='M1035 174Q1065 188 1104 177T1175 178V668Q1159 688 1110 670T1035 668Z';
  // Same stream corridor as the existing lowerBridge and brook physics. The
  // connector ends inside the large painted pool rather than outlining a lake.
  const BROOK='M1030 720C1030 760 1088 778 1085 808L1118 818C1120 767 1080 755 1076 720Z M1012 838C1012 803 1070 803 1100 803C1170 803 1190 827 1184 850C1178 874 1214 882 1255 896L1310 925L1294 954L1232 925C1172 919 1133 894 1101 870C1069 870 1012 873 1012 838Z';
  const BROOK_BANKS='M1023 715C1022 763 1080 781 1078 813L1125 825C1128 767 1084 746 1084 715Z M1006 838C1006 795 1065 797 1100 797C1175 797 1198 825 1190 851C1184 868 1218 878 1260 890L1320 925L1294 963L1228 932C1167 925 1127 899 1097 876C1062 876 1006 881 1006 838Z';
  const id=prefix=>String(prefix||'village-water').replace(/[^a-zA-Z0-9_-]/g,'-');
  const image=()=>'<image href="./'+SOURCE+'" width="735" height="1273"/>';
  const path=points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z';
  function croppedPattern(key,rect,width,height){
    const tile='<svg x="0" y="0" width="'+width+'" height="'+height+'" viewBox="'+rect.join(' ')+'" preserveAspectRatio="none" overflow="hidden">'+image()+'</svg>';
    // Mirrored existing pixels meet the exact same pixel edge. This avoids
    // visible rectangular seams without generating/repainting a new texture.
    return '<pattern id="'+key+'" patternUnits="userSpaceOnUse" width="'+(width*2)+'" height="'+(height*2)+'">'+tile+
      '<g transform="translate('+(width*2)+' 0) scale(-1 1)">'+tile+'</g>'+
      '<g transform="translate(0 '+(height*2)+') scale(1 -1)">'+tile+'</g>'+
      '<g transform="translate('+(width*2)+' '+(height*2)+') scale(-1 -1)">'+tile+'</g></pattern>';
  }
  function defs(prefix){
    const p=id(prefix);
    return croppedPattern(p+'-original-water',TEXTURE,120,46)+croppedPattern(p+'-original-bank',BANK,65,26)+
      '<clipPath id="'+p+'-pond-shore" clipPathUnits="userSpaceOnUse"><path d="'+SHORE+'"/></clipPath>'+
      '<clipPath id="'+p+'-bank-rock" clipPathUnits="userSpaceOnUse"><path d="'+BANK_ROCK_SHORE+'"/></clipPath>'+
      '<clipPath id="'+p+'-pond-water" clipPathUnits="userSpaceOnUse"><path d="'+WATER+'" clip-rule="evenodd"/></clipPath>'+
      '<clipPath id="'+p+'-fall-shore" clipPathUnits="userSpaceOnUse"><path d="'+FALL_SHORE+'"/></clipPath>'+
      [['canal',CANAL],['canal-banks',CANAL_BANKS],['brook',BROOK],['brook-banks',BROOK_BANKS]].map(([name,d])=>'<clipPath id="'+p+'-'+name+'" clipPathUnits="userSpaceOnUse">'+d.split('Z ').map(part=>'<path d="'+(part.endsWith('Z')?part:part+'Z')+'"/>').join('')+'</clipPath>').join('');
  }
  function ground(prefix){
    const p=id(prefix),fill=(clip,texture,x,y,w,h)=>'<g clip-path="url(#'+p+'-'+clip+')"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="url(#'+p+'-'+texture+')"/></g>';
    const bankRocks=BANK_ROCK.positions.map((y,i)=>[0,1].map(side=>{
      const x=side?1160+(i%3-1)*2:1048+(i%3-1)*2,angle=side?-90:90,scale=.48+(i%3)*.025;
      return '<g data-water-piece="original-bank-rock" transform="translate('+x+' '+(y+(side?13:0))+') rotate('+angle+') scale('+scale+')"><svg x="-45" y="-21.5" width="90" height="43" viewBox="'+BANK_ROCK.sourceRect.join(' ')+'" overflow="hidden"><g clip-path="url(#'+p+'-bank-rock)">'+image()+'</g></svg></g>';
    }).join('')).join('');
    return '<g data-water-art="user-original-jpeg">'+
      fill('canal-banks','original-bank',1033,170,145,505)+fill('canal','original-water',1047,174,114,495)+
      bankRocks+
      fill('brook-banks','original-bank',1004,715,320,250)+fill('brook','original-water',1005,720,306,241)+
      '<svg data-water-piece="original-canal-head" x="'+HEAD.x+'" y="'+HEAD.y+'" width="'+HEAD.width+'" height="'+HEAD.height+'" viewBox="'+HEAD.sourceRect.join(' ')+'" overflow="hidden"><g clip-path="url(#'+p+'-fall-shore)">'+image()+'</g></svg>'+
      '<svg data-water-piece="original-waterfall" x="'+FALL.x+'" y="'+FALL.y+'" width="'+FALL.width+'" height="'+FALL.height+'" viewBox="'+FALL.sourceRect.join(' ')+'" overflow="hidden"><g clip-path="url(#'+p+'-fall-shore)">'+image()+'</g></svg>'+
      '<svg data-water-piece="original-pond" x="'+POND.x+'" y="'+POND.y+'" width="'+POND.width+'" height="'+POND.height+'" viewBox="'+RECT.join(' ')+'" preserveAspectRatio="none" overflow="hidden"><g clip-path="url(#'+p+'-pond-shore)">'+image()+'</g></svg></g>';
  }
  // Flatten the original surface's cubic edge for the same collision geometry.
  // These are contour coordinates of the existing artwork, not rendered waves.
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
    // The pre-existing stone deck remains traversable above this water layer.
    if(x>=1080&&x<=1250&&y>=855&&y<=930)return false;
    radius=Math.max(0,Number.isFinite(radius)?radius:0);
    const water=waterPolygons.some(poly=>inside(x,y,poly)||distance(x,y,poly)<=radius);
    if(!water)return false;
    return !rockIslands.some(poly=>inside(x,y,poly)&&distance(x,y,poly)>radius);
  }
  function bezier(points,a,b,c,d){for(let i=1;i<=12;i++){const t=i/12,u=1-t;points.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}}
  const brookPoints=[[1012,838]];
  bezier(brookPoints,[1012,838],[1012,803],[1070,803],[1100,803]);
  bezier(brookPoints,[1100,803],[1170,803],[1190,827],[1184,850]);
  bezier(brookPoints,[1184,850],[1178,874],[1214,882],[1255,896]);
  brookPoints.push([1310,925],[1294,954],[1232,925]);
  bezier(brookPoints,[1232,925],[1172,919],[1133,894],[1101,870]);
  bezier(brookPoints,[1101,870],[1069,870],[1012,873],[1012,838]);
  const brookPolygon=Object.freeze(brookPoints.map(p=>Object.freeze(p)));
  const neckPoints=[[1030,720]];bezier(neckPoints,[1030,720],[1030,760],[1088,778],[1085,808]);neckPoints.push([1118,818]);bezier(neckPoints,[1118,818],[1120,767],[1080,755],[1076,720]);
  const brookPolygons=Object.freeze([brookPolygon,Object.freeze(neckPoints.map(p=>Object.freeze(p)))]);
  const canalPoints=[[1049,246]],q=(a,b,c)=>{for(let i=1;i<=12;i++){const t=i/12,u=1-t;canalPoints.push([u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]+72]);}};
  q([1049,174],[1083,197],[1120,181]);q([1120,181],[1157,165],[1160,177]);canalPoints.push([1160,741],[1048,741]);
  const canalPolygon=Object.freeze(canalPoints.map(p=>Object.freeze(p)));
  const LAKE=[[33,209],[40,194],[72,187],[106,176],[145,175],[177,171],[216,169],[232,182],[239,188],[216,204],[198,211],[179,224],[169,241],[143,252],[113,259],[76,251],[50,247],[34,230]];
  const mapUpper=(frame,points)=>Object.freeze(points.map(([x,y])=>Object.freeze([frame.x+x*frame.width/frame.sourceRect[2],frame.y+y*frame.height/frame.sourceRect[3]+72])));
  const canalPolygons=Object.freeze([canalPolygon,mapUpper(HEAD,LAKE),mapUpper(FALL,LAKE)]);
  const nearPolygon=(x,y,points,radius)=>inside(x,y,points)||distance(x,y,points)<=Math.max(0,Number.isFinite(radius)?radius:0);
  function containsBrook(x,y,radius=0){
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    if(x>=1080&&x<=1250&&y>=855&&y<=930)return false;
    return brookPolygons.some(poly=>nearPolygon(x,y,poly,radius));
  }
  function containsCanal(x,y,radius=0){
    if(!Number.isFinite(x)||!Number.isFinite(y)||y<250)return false;
    if(x>=1000&&x<=1210&&y>=450&&y<=535)return false;
    return canalPolygons.some(poly=>nearPolygon(x,y,poly,radius));
  }
  const geometry=Object.freeze({coordinateSpace:'village-scene raw before WORLD_SCALE',pond:POND,waterPolygons,rockIslands,containsPond,brookPolygon,brookPolygons,canalPolygon,canalPolygons,
    upperCanal:Object.freeze({x:1049,y:174,width:111,height:495,groundHeight:72}),preservedUpperBridge:Object.freeze({x:1000,y:450,width:210,height:85}),preservedLowerBridge:Object.freeze({x:1080,y:855,width:170,height:75}),
    preservedBrook:Object.freeze({pool:[1100,838,88,35],segments:[[1100,853,1190,902,20],[1190,902,1290,925,22]]})});
  window.QPVillageWaterAssets=Object.freeze({defs,ground,geometry,containsPond,containsBrook,containsCanal,sourceAssets:Object.freeze([SOURCE]),
    sources:Object.freeze([{file:SOURCE,sha256:HASH,dimensions:Object.freeze([735,1273]),pondRect:RECT,waterTextureRect:TEXTURE,bankTextureRect:BANK,bankRock:BANK_ROCK,bankRockShoreMask:BANK_ROCK_SHORE,fall:FALL,canalHead:HEAD,fallShoreMask:FALL_SHORE,shoreMask:SHORE,waterMask:WATER,waterMaskRule:'evenodd'}])});
})();
