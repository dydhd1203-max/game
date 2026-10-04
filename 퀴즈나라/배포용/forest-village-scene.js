/* Keep supplied map compositions. Source extractions and the user-requested
   asset style edits have separate provenance manifests. */
(() => {
  'use strict';
  const ROOT=new URL('assets/forest-village-library/extracted/',document.currentScript.src).href;
  const ADAPTED=new URL('../adapted/',ROOT).href;
  const sizes={'village-composition':[1115,736],'garden-composition':[962,541],'flower-home':[314,223],'bakery-home':[286,219],'pink-tree':[181,153],'treehouse-composition':[946,740],'sky-composition':[956,553],'flowers-purple':[45,31],'flowers-ivory':[30,23],'flowers-gold':[32,31],'flowers-meadow':[33,24]};
  sizes['flowers-daisy']=[1484,1060];
  Object.assign(sizes,{'plaza-composition':[1115,736],'flowers-bluebell':[100,91],'flowers-poppy':[104,77],'flowers-buttercup':[94,67],'garden-well':[150,153],'plaza-tree':[612,642],'plaza-brook':[260,504]});
  const adapted=new Set(['flowers-daisy','flower-home','bakery-home','flowers-bluebell','flowers-poppy','flowers-buttercup','garden-well','plaza-tree','plaza-brook']);
  const sources={
    'flower-home':{file:'courtyard-houses.png',rect:[64,20,999,708],size:[2126,740]},
    'bakery-home':{file:'courtyard-houses.png',rect:[1138,14,934,716],size:[2126,740]},
    'forest-oak':{file:'forest-nature.png',rect:[0,20,555,558],size:[1536,1024]},
    'forest-pine':{file:'forest-nature.png',rect:[568,0,448,579],size:[1536,1024]},
    'forest-birch':{file:'forest-nature.png',rect:[1025,20,511,559],size:[1536,1024]},
    'forest-rock':{file:'forest-nature.png',rect:[0,590,540,414],size:[1536,1024]},
    'forest-leaves':{file:'forest-nature.png',rect:[545,582,474,430],size:[1536,1024]},
    'forest-berries':{file:'forest-nature.png',rect:[1020,580,516,433],size:[1536,1024]}
  };
  for(const [id,source]of Object.entries(sources))if(id.startsWith('forest-'))sizes[id]=source.rect.slice(2);
  const assetURL=asset=>asset==='plaza-tree'?ADAPTED+'sources/plaza-tree.png':(adapted.has(asset)?ADAPTED:ROOT)+asset+'.png';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function builder(id,zone,title,width,height,spawn){
    const parts=[],solids=[],walkAreas=[],interactables=[],views=[],routes=[],groups=[],html=[];
    const scene={id,zone,title,width,height,spawn,cameraHome:{...spawn,zoom:1},bounds:{width,height},publicEntryReady:true,seats:[],parts,solids,walkAreas,interactables,previewViews:views,reviewRoutes:routes,groups,centerLabel:'내 위치',exitLabel:'학생 메뉴'};
    function image(id,asset,x,y,scale=1,depth=0,options={}){
      const [w,h]=sizes[asset],item={id,asset,x,y,width:w*scale,height:h*scale,scale,depth,...options};parts.push(item);
      const url=assetURL(asset);
      if(sources[asset]){const a=sources[asset],[sx,sy,sw,sh]=a.rect;html.push('<svg class="sr-art fv-art" data-art="'+id+'" data-source="'+asset+'" data-floor-y="'+depth+'" viewBox="'+[sx,sy,sw,sh].join(' ')+'" preserveAspectRatio="none" style="left:'+x+'px;top:'+y+'px;width:'+item.width+'px;height:'+item.height+'px;z-index:'+depth+';overflow:hidden" aria-hidden="true"><image href="'+ADAPTED+'sources/'+a.file+'" width="'+a.size[0]+'" height="'+a.size[1]+'"/></svg>');return item;}
      html.push('<img class="sr-art fv-art '+(options.className||'')+'" data-art="'+id+'" data-source="'+asset+'" data-floor-y="'+depth+'" src="'+url+'" alt="" draggable="false" width="'+w+'" height="'+h+'" style="left:'+x+'px;top:'+y+'px;width:'+item.width+'px;height:'+item.height+'px;z-index:'+depth+';'+(options.style||'')+'">');return item;
    }
    // A foreground crop references the same source pixels and placement as
    // its background. It never erases the base silhouette at a mask edge.
    function foreground(id,asset,rect,polygon,scale,depth){
      depth=Math.round(depth); // CSS z-index accepts integers, including on 2.1× maps.
      const [sx,sy,w,h]=rect,[sw,sh]=sizes[asset],clip='fv-'+id;
      parts.push({id,asset,x:sx*scale,y:sy*scale,width:w*scale,height:h*scale,scale,depth,role:'foreground',sourceRect:rect,polygon});
      html.push('<svg class="sr-art fv-art" data-art="'+id+'" data-source="'+asset+'" data-floor-y="'+depth+'" viewBox="0 0 '+w+' '+h+'" style="left:'+sx*scale+'px;top:'+sy*scale+'px;width:'+w*scale+'px;height:'+h*scale+'px;z-index:'+depth+'" aria-hidden="true"><defs><clipPath id="'+clip+'"><polygon points="'+polygon.map(([x,y])=>(x-sx)+','+(y-sy)).join(' ')+'"/></clipPath></defs><image href="'+assetURL(asset)+'" x="'+(-sx)+'" y="'+(-sy)+'" width="'+sw+'" height="'+sh+'" clip-path="url(#'+clip+')"/></svg>');
    }
    function solid(id,x,y,w,h){const s={id,x,y,width:w,height:h};solids.push(s);return s;}
    function poly(id,points,solid=false){(solid?solids:walkAreas).push({id,points});}
    function portal(id,label,target,x,y,extra={}){interactables.push({id,type:'portal',target,label,x,y,radius:65,approach:{x,y},hitRect:{x:x-38,y:y-36,width:76,height:72},hint:{x,y:y-30},...extra});}
    function label(text,x,y,small=false){html.push('<div class="fv-place-label'+(small?' is-small':'')+'" style="left:'+x+'px;top:'+y+'px">'+esc(text)+'</div>');}
    function end(){scene.markup=html.join('');scene.get=()=>scene;scene.render=()=>scene.markup;return scene;}
    return {scene,html,image,foreground,solid,poly,portal,label,end};
  }
  function village(){
    const X=x=>x*3,Y=y=>(y-64)*3;
    const b=builder('forest-village-source-composition','village','햇살 숲속 마을',3345,2208,{x:2530,y:1485}),{scene:s,image,solid,poly,portal}=b;
    image('native-water-path-gardens','plaza-composition',0,0,3,0,{role:'composition'});
    const homes=[['flower-home',235,96,157,207,[256,156,106,43]],['bakery-home',231,462,143,572,[254,532,100,35]]];
    homes.forEach(([asset,x,y,width,floor,box],i)=>{const factor=1.5,scale=width*3/sizes[asset][0]*factor,id='courtyard-'+asset,oldGround={x:X(x+width/2),y:Y(floor)},ground={x:oldGround.x-65,y:oldGround.y+(i?95:115)},at=(px,py)=>({x:ground.x+(px-oldGround.x)*factor,y:ground.y+(py-oldGround.y)*factor}),pos=at(X(x),Y(y)),base=at(X(box[0]),Y(box[1]));image(id,asset,pos.x,pos.y,scale,Math.round(ground.y),{role:'house',ground,footprint:id+'-base'});solid(id+'-base',base.x,base.y,X(box[2])*factor,X(box[3])*factor);});
    // Small planted groups belong to courtyard/shore lawns, never the path.
    // Their low foliage sorts by its own root, not by the flower's top edge.
    [['purple',243,218,1.8,'upper-courtyard'],['daisy',270,218,.066,'upper-courtyard'],['meadow',312,224,1.8,'upper-courtyard'],
     ['ivory',355,575,2,'bakery-garden'],['purple',382,586,1.7,'bakery-garden'],
     ['ivory',469,680,1.9,'shore-meadow'],['meadow',444,682,1.8,'shore-meadow']].forEach(([kind,x,y,scale,bed],i)=>{
      const asset='flowers-'+kind,[w,h]=sizes[asset],ground={x:X(x)+(kind==='daisy'?758:w/2)*scale,y:Y(y)+(kind==='daisy'?858:h-2)*scale};
      image('village-flower-'+i,asset,X(x),Y(y),scale,Math.round(ground.y),{role:'flower',bed,ground});
    });
    const native=(id,x,y,w,h)=>solid('picnic-'+id,X(x),Y(y),X(w),X(h));

    [[212,168],[473,139],[487,230],[532,258],[152,296],[112,396],[218,427],[499,424],[549,565],[1008,281],[1060,148],[929,122],[895,97],[325,675],[697,757],[828,786],[990,734]].forEach(([x,y],i)=>s.solids.push({id:'picnic-tree-'+i,x:X(x),y:Y(y),radius:34.5}));
    [[227,276,68,18],[309,353,68,22],[823,597,63,36],[889,534,80,22],[972,481,26,39],[399,401,86,107],[378,519,88,77]].forEach((r,i)=>native('furniture-'+i,...r));
    native('fence-west',370,626,180,20);native('fence-east',628,626,220,20);
    const tree={x:1724,y:0,scale:2.12},treePoint=({x,y,height=0})=>({x:tree.x+(x-2150)*tree.scale,y:tree.y+(y-480)*tree.scale,height:height*tree.scale});
    s.greatTree={...tree,sourceSize:[1225,1284],review:{lower:treePoint({x:2430,y:878,height:212}),upper:treePoint({x:2595,y:762,height:310}),edge:treePoint({x:2500,y:820,height:310})}};
    image('central-great-tree','plaza-tree',tree.x,tree.y,tree.scale,1390,{role:'landmark',ground:treePoint({x:2525,y:1084})});
    image('central-brook','plaza-brook',1710,210,1,0,{role:'brook',ground:{x:1840,y:699}});
    image('plaza-stone-well','garden-well',1880,1290,1.05,1444,{role:'well',ground:{x:1959,y:1444}});
    solid('plaza-well-base',1904,1420,110,25);
    native('coffee-kiosk',654,557,61,29);
    // Root foot only; the canopy remains passable/occluding at ground level.
    s.solids.push({id:'great-tree-root-left',points:[[2330,982],[2507,982],[2507,1060],[2468,1125],[2332,1088],[2250,1080]]},
      {id:'great-tree-root-right',points:[[2554,982],[2630,982],[2670,1094],[2583,1130],[2554,1100]]},
      {id:'ladder-ground-stop',x:2507,y:965,width:47,height:102});
    s.elevatedDepth=4000;
    s.levels=[
      {id:'lower-deck',height:212,allowSit:false,walkAreas:[{points:[[2400,866],[2536,866],[2536,890],[2400,890]]}],solids:[]},
      {id:'upper-deck',height:310,walkAreas:[{points:[[2508,732],[2660,732],[2675,765],[2668,785],[2508,785]]}],solids:[]}
    ];
    s.climbs=[
      {id:'great-tree-ladder',label:'나무 데크로 오르기',downLabel:'광장으로 내려가기',radius:31,speed:76,points:[{x:2530,y:1090,height:0},{x:2530,y:888,height:212}]},
      {id:'great-tree-stairs',motion:'walk',label:'나무 위 방으로 오르기',downLabel:'아래 데크로 내려가기',radius:19,speed:65,points:[{x:2515,y:869,height:212},{x:2515,y:830,height:255},{x:2522,y:780,height:310}]}
    ];
    for(const c of s.solids.filter(c=>c.id.startsWith('great-tree-root')||c.id==='ladder-ground-stop')){if(c.points)c.points=c.points.map(([x,y])=>{const p=treePoint({x,y});return[p.x,p.y];});else{Object.assign(c,treePoint(c));c.width*=tree.scale;c.height=102*tree.scale;}}
    for(const level of s.levels){level.height*=tree.scale;for(const area of level.walkAreas)area.points=area.points.map(([x,y])=>{const p=treePoint({x,y});return[p.x,p.y];});}
    for(const climb of s.climbs){climb.points=climb.points.map(treePoint);climb.radius*=1.4;climb.speed*=1.5;}
    // Foreground copies use exactly the landmark pixels and world registration.
    const treeOverlay=(id,points,depth)=>{const clip='fv-'+id;s.parts.push({id,asset:'plaza-tree',role:'level-foreground',sourceRect:[0,0,612,642],x:tree.x,y:tree.y,scale:tree.scale,depth,polygon:points});b.html.push('<svg class="fv-art" data-art="'+id+'" viewBox="0 0 612 642" style="left:'+tree.x+'px;top:'+tree.y+'px;width:'+612*tree.scale+'px;height:'+642*tree.scale+'px;z-index:'+depth+'" aria-hidden="true"><defs><clipPath id="'+clip+'"><polygon points="'+points.map(p=>p.join(',')).join(' ')+'"/></clipPath></defs><image href="'+assetURL('plaza-tree')+'" width="612" height="642" preserveAspectRatio="none" clip-path="url(#'+clip+')"/></svg>');};
    treeOverlay('lower-deck-railing',[[237,355],[340,352],[344,382],[356,386],[355,407],[333,410],[329,396],[245,392],[236,377]],Math.round(treePoint({x:2500,y:886}).y)+4000);
    // The right upper room is reachable; the left balcony is ornamental until
    // a visible, unobstructed connecting walkway is supplied.
    const waterMasks=[[[77,41],[117,45],[127,62],[119,91],[135,105],[163,118],[169,145],[153,165],[123,181],[107,182],[87,180],[99,169],[143,148],[146,131],[121,122],[104,109],[85,93]],[[82,235],[111,243],[134,259],[165,270],[183,292],[179,310],[153,323],[120,329],[84,349],[57,368],[62,383],[103,393],[158,383],[186,365],[203,360],[210,379],[220,403],[216,422],[199,442],[164,456],[119,451],[80,438],[67,424],[57,410],[45,399],[37,380],[44,364],[70,347],[107,318],[146,302],[149,288],[123,276],[95,272],[79,254]]];
    b.html.push('<svg class="fv-art fv-brook-flow" data-art="brook-water-motion" viewBox="0 0 260 504" style="left:1710px;top:210px;width:260px;height:504px;z-index:1" aria-hidden="true"><defs><clipPath id="fv-brook-water">'+waterMasks.map(p=>'<polygon points="'+p.map(p=>p.join(',')).join(' ')+'"/>').join('')+'</clipPath></defs><g clip-path="url(#fv-brook-water)">'+[0,1,2].map(i=>'<image class="fv-flow-texture" href="'+assetURL('plaza-brook')+'" width="260" height="504" style="animation-delay:-'+i+'s"/>').join('')+'</g></svg>');
    const waterSolid=(id,points)=>s.solids.push({id,points:points.map(([x,y])=>[1710+x,210+y])});
    waterSolid('brook-upper-water',[[69,20],[126,24],[164,57],[151,100],[186,123],[193,149],[175,178],[153,194],[145,202],[74,185],[84,166],[127,144],[120,127],[65,115],[49,94],[47,56]]);
    waterSolid('brook-lower-water',[[65,227],[145,243],[178,253],[201,278],[205,309],[184,333],[176,342],[211,341],[238,381],[242,418],[219,453],[181,477],[114,479],[62,455],[43,426],[18,408],[17,368],[50,335],[92,312],[139,297],[125,286],[87,284],[64,267]]);
    s.effects=[{id:'brook-water-motion',x:1710,y:210,width:260,height:504}];
    s.brookReview={bridge:[{x:1766,y:411},{x:1868,y:439}],water:[{x:1824,y:289},{x:1836,y:632}],still:[{x:1791,y:413},{x:1933,y:630}]};
    // Each border has a distinct mix; entrances, ladder foot and meeting lawn stay open.
    const newBeds=[['bluebell',2020,1250,.65,'tree-west'],['buttercup',2700,1360,.63,'tree-east'],['poppy',2960,1290,.62,'tree-east'],
      ['bluebell',1925,870,.58,'well-garden'],['buttercup',2093,962,.6,'well-garden'],
      ['poppy',882,488,.62,'home-front'],['bluebell',1051,450,.62,'home-front'],
      ['buttercup',738,1587,.72,'bakery-corner'],['poppy',1088,1580,.68,'bakery-corner'],
      ['bluebell',1680,613,.56,'brook-bank'],['buttercup',1895,703,.6,'brook-bank'],
      // A planted corner gives the surviving garden stool a purpose. Taller
      // bluebells sit behind low cream/gold flowers, leaving its front clear.
      ['bluebell',2280,116,.8,'stool-garden'],['buttercup',2245,183,.68,'stool-garden'],
      ['poppy',2467,200,.64,'stool-garden'],
      // The spring has a small asymmetric meadow, not a repeated flower ring.
      ['bluebell',1698,192,.66,'spring-meadow'],['buttercup',1768,191,.62,'spring-meadow']];
    newBeds.forEach(([kind,x,y,scale,bed],i)=>{const asset='flowers-'+kind,[w,h]=sizes[asset],ground={x:x+w*scale/2,y:y+(h-4)*scale};image('plaza-bed-'+i,asset,x,y,scale,Math.round(ground.y),{role:'flower',bed,ground});});
    [['ivory',2315,211,1.8,'stool-garden'],['meadow',1690,284,1.8,'spring-meadow']].forEach(([kind,x,y,scale,bed],i)=>{
      const asset='flowers-'+kind,[w,h]=sizes[asset],ground={x:x+w*scale/2,y:y+(h-2)*scale};
      image('north-meadow-'+i,asset,x,y,scale,Math.round(ground.y),{role:'flower',bed,ground});
    });
    native('northern-stool',798,128,20,12);
    // Tall woodland, middle shrubs and low leaves form asymmetric groves.
    // Each root has its own depth/footprint; the canopy never blocks a road.
    const nature=[
      ['birch',1720,270,.46,'spring-grove',18],['rock',1685,315,.17,'spring-grove',19],['leaves',1770,315,.13,'spring-grove',0],
      ['pine',3100,1240,.57,'east-woodland',25],['berries',3170,1370,.21,'east-woodland',16],['leaves',3140,1320,.16,'east-woodland',0],
      ['oak',3090,1750,.50,'east-meadow',26],['rock',3030,1800,.20,'east-meadow',23],['leaves',3150,1790,.14,'east-meadow',0],
      ['birch',2280,1940,.46,'south-grove',18],['berries',2190,1970,.20,'south-grove',16],['leaves',2330,1975,.16,'south-grove',0],
      ['oak',1110,1790,.48,'lakeside-grove',25],['rock',1040,1830,.17,'lakeside-grove',20],['leaves',1160,1830,.14,'lakeside-grove',0],
      ['birch',545,1400,.44,'shore-shelter',18],['berries',610,1425,.19,'shore-shelter',15],['leaves',500,1435,.15,'shore-shelter',0],
      ['rock',2170,1390,.22,'great-tree-roots',25],['leaves',2250,1375,.16,'great-tree-roots',0],['berries',2820,1385,.20,'great-tree-roots',16],['leaves',2900,1395,.16,'great-tree-roots',0],
      ['berries',1000,545,.18,'house-border',14],['leaves',620,525,.14,'house-border',0],
      ['rock',1195,1690,.18,'bakery-border',20],['leaves',1090,1640,.16,'bakery-border',0]
    ];
    nature.forEach(([kind,gx,gy,scale,bed,radius],i)=>{const asset='forest-'+kind,[w,h]=sizes[asset],ground={x:gx,y:gy},id='woodland-'+i;image(id,asset,gx-w*scale/2,gy-h*scale,scale,Math.round(gy),{role:'nature',bed,ground,footprint:radius?id+'-root':null});if(radius)s.solids.push({id:id+'-root',x:gx,y:gy-7,radius});});
    const crown=(id,rect,points,floor)=>b.foreground(id,'village-composition',[rect[0],rect[1]-64,rect[2],rect[3]],points.map(([x,y])=>[x,y-64]),3,Y(floor));
    crown('lake-oak',[177,101,73,91],[[212,101],[234,107],[248,127],[246,151],[230,168],[218,174],[221,186],[208,191],[200,184],[201,173],[181,162],[177,139],[181,118]],181);
    crown('central-grove',[429,140,137,145],[[480,140],[515,149],[533,165],[528,184],[552,185],[565,218],[559,250],[542,263],[539,279],[527,281],[522,265],[512,255],[490,255],[486,269],[473,267],[469,253],[442,247],[429,223],[434,198],[451,180],[450,157]],266);
    crown('autumn-tree',[140,345,146,123],[[209,345],[255,355],[270,377],[271,393],[285,416],[272,439],[229,450],[217,464],[198,468],[192,447],[157,439],[140,421],[148,393],[156,365]],445);
    crown('lower-grove',[490,441,109,153],[[550,441],[575,449],[594,465],[599,491],[586,512],[562,521],[554,540],[563,557],[554,577],[548,590],[534,592],[528,574],[502,568],[490,548],[495,521],[516,501],[516,476],[531,451]],577);
    poly('village-land',[[159,64],[1105,64],[1105,780],[860,780],[730,760],[635,725],[535,710],[410,690],[330,699],[260,669],[168,610],[110,515],[112,392],[117,330],[131,235],[153,166],[158,87]].map(([x,y])=>[X(x),Y(y)]));
    portal('village-school-path','학교로 가는 길','playground',X(586),Y(654),{arrival:{x:X(586),y:Y(682)},targetDoor:'playground-village-path',radius:58});
    portal('village-garden-path','비밀정원 숲길','forestgarden',X(427),Y(88),{arrival:{x:X(426),y:Y(117)},targetDoor:'garden-village-path',radius:52});
    s.cameraHome={x:s.spawn.x,y:s.spawn.y,zoom:.76};s.cameraAnchorY=.81;s.centerOnPlayer=true;s.exitLabel='수업 목록';
    s.previewViews=[{id:'alley',label:'꽃집과 굽은 골목',spawn:{x:X(565),y:Y(282)}},{id:'lake',label:'물가와 작은 집',spawn:{x:X(284),y:Y(597)}},{id:'flower-courtyard',label:'꽃이 있는 집 앞',spawn:{x:X(374),y:Y(245)}},{id:'picnic',label:'신비로운 큰 나무 광장',spawn:{...s.spawn}},{id:'school-path',label:'학교로 가는 문',spawn:{x:X(586),y:Y(682)}}];
    s.groups=[{id:'village-composition',rect:[0,0,3345,2208],purpose:'native winding paths and lake, two distinct courtyard homes, original picnic garden'}];
    s.reviewRoutes=[{id:'school',from:s.spawn,to:{x:X(586),y:Y(654)}},{id:'garden',from:s.spawn,to:{x:X(427),y:Y(88)}},...s.previewViews.slice(1,4).map(v=>({id:v.id,from:s.spawn,to:v.spawn}))];
    s.reviewRoutes.push({id:'spring-garden',from:{x:1868,y:439},to:{x:2415,y:275}});
    return b.end();
  }
  function forestgarden(){
    const b=builder('forest-garden-source','forestgarden','비밀정원',1924,1082,{x:942,y:938}),{scene:s,image,solid,poly,portal}=b;
    image('native-secret-grove','garden-composition',0,0,2,0,{role:'composition'});
    // The secret garden's sunny border mixes gold with small meadow flowers.
    [['gold',302,468,2.2],['gold',333,479,1.9],['meadow',321,449,2],['ivory',356,465,1.8],
     ['gold',777,367,2],['meadow',808,377,1.9]].forEach(([kind,x,y,scale],i)=>{
      const asset='flowers-'+kind,[w,h]=sizes[asset],ground={x:x*2+w*scale/2,y:y*2+(h-2)*scale};
      image('grove-flower-'+i,asset,x*2,y*2,scale,Math.round(ground.y),{role:'flower',bed:i<4?'entry-flower-bed':'hammock-meadow',ground});
    });
    poly('grove-clearing',[[140,83],[1730,83],[1740,950],[1550,1000],[1030,1000],[1030,1060],[866,1060],[866,1000],[270,1000],[170,890],[205,770],[135,630]]);
    [[295,185],[345,185],[392,185],[538,185],[585,185],[633,185],[294,232],[346,232],[394,232],[439,232],[488,232],[538,232],[583,232],[633,232],[294,280],[345,280],[394,280],[443,280],[490,280],[538,280],[584,280],[635,280],[295,328],[345,328],[394,328],[443,328],[490,328],[538,328],[585,328],[634,328]].forEach(([x,y],i)=>solid('native-stump-'+i,(x-13)*2,(y-8)*2,52,36));
    solid('native-treehouse',590,144,100,145);solid('native-board',810,90,247,155);solid('native-vegetables',1400,132,193,146);
    [[66,118],[27,147],[99,229],[27,275],[134,322],[48,351],[82,391],[48,434],[108,495],[64,530],[868,74],[944,136],[892,216],[938,249],[908,341],[855,404],[891,438],[944,442],[839,525],[912,544],[670,66],[586,133]].forEach(([x,y],i)=>s.solids.push({id:'grove-tree-'+i,x:x*2,y:y*2,radius:22}));
    [[141,190,58,23],[162,337,77,27],[136,369,69,30],[202,402,72,27],[153,435,85,23],[710,398,72,27],[653,434,85,25],[698,466,73,22]].forEach(([x,y,w,h],i)=>solid('grove-furniture-'+i,x*2,y*2,w*2,h*2));
    solid('grove-meeting-stump',852,306,154,77);
    solid('grove-west-fence',476,1006,331,40);solid('grove-east-fence',1057,1006,438,40);
    portal('garden-village-path','햇살 마을로','village',942,1002,{exitAngle:180,arrival:{x:942,y:938},targetDoor:'village-garden-path',radius:48});
    portal('grove-treehouse-door','큰 나무집','treehouse',656,326,{exitAngle:-90,arrival:{x:697,y:325},targetDoor:'treehouse-village-door',radius:47});
    // Same source registration: the original painting remains intact below.
    // Tree crowns occlude a visitor behind the trunk, then release in front.
    b.foreground('garden-treehouse-canopy','garden-composition',[246,15,145,133],[[262,25],[280,23],[287,17],[311,15],[333,19],[349,26],[370,39],[381,55],[390,80],[378,98],[351,103],[348,126],[337,144],[310,146],[288,134],[287,109],[277,104],[257,102],[246,88],[249,66],[252,43]],2,288);
    b.foreground('garden-swing-tree','garden-composition',[529,34,123,111],[[548,46],[565,36],[584,34],[605,39],[615,51],[636,57],[649,77],[651,95],[638,108],[602,111],[599,133],[605,141],[581,144],[567,136],[575,112],[551,111],[535,99],[529,80],[535,60]],2,281);
    b.foreground('garden-west-pine','garden-composition',[93,248,67,84],[[127,248],[134,262],[140,275],[148,287],[155,301],[159,309],[149,318],[133,322],[133,330],[122,332],[119,324],[103,319],[93,310],[102,291],[111,277],[120,261]],2,652);
    b.foreground('garden-east-oak','garden-composition',[845,131,74,87],[[868,131],[892,131],[911,146],[918,166],[913,182],[896,196],[887,198],[889,213],[873,217],[870,209],[873,194],[856,191],[845,172],[849,150]],2,430);
    image('relocated-cherry-tree','pink-tree',500,700,1.5,891,{role:'canopy',ground:{x:662,y:884}});
    s.solids.push({id:'relocated-cherry-root',x:662,y:881,radius:19});
    s.cameraHome={x:955,y:628,zoom:1};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'garden-entry',label:'숲의 모임 마당',spawn:s.spawn},{id:'treehouse-gate',label:'큰 나무집으로 가는 계단',spawn:{x:697,y:325}}];
    s.reviewRoutes=[{id:'treehouse',from:s.spawn,to:{x:656,y:326}},{id:'village-return',from:s.spawn,to:{x:942,y:1002}}];
    return b.end();
  }
  function treehouse(){
    const X=x=>x*1.8,Y=y=>(y-64)*1.8;
    const b=builder('forest-treehouse-source','treehouse','달빛 나무집',1703,1332,{x:X(510),y:Y(781)}),{scene:s,html,image,poly,portal}=b;
    html.push('<div class="fv-night-ground"></div>');image('great-treehouse-original','treehouse-composition',0,0,1.8,0);
    const area=(id,p)=>poly(id,p.map(([x,y])=>[X(x),Y(y)]));
    area('tree-root-entry',[[351,741],[594,741],[639,800],[342,800]]);
    area('native-trunk-ladder',[[554,604],[581,604],[585,801],[554,801]]);
    area('lower-deck',[[394,554],[583,554],[583,611],[394,611]]);
    area('deck-stairs',[[530,448],[569,448],[569,567],[530,567]]);
    area('upper-deck',[[223,390],[434,390],[434,381],[519,381],[520,367],[739,367],[752,450],[614,505],[578,485],[569,457],[296,460],[223,426]]);
    area('left-reading-room',[[248,298],[430,298],[430,397],[248,397]]);
    portal('treehouse-village-door','비밀정원으로','forestgarden',X(422),Y(769),{exitAngle:-90,arrival:{x:X(510),y:Y(781)},targetDoor:'grove-treehouse-door'});
    portal('treehouse-sky-path','하늘섬으로','skyisland',X(677),Y(433),{exitAngle:90,arrival:{x:X(638),y:Y(437)},targetDoor:'sky-treehouse-path',radius:60});
    s.cameraHome={x:X(488),y:Y(529),zoom:.95};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'root',label:'큰 나무집 밑동',spawn:s.spawn},{id:'deck',label:'달빛 데크',spawn:{x:X(486),y:Y(425)}},{id:'room',label:'나무 위 방',spawn:{x:X(344),y:Y(350)}}];
    s.reviewRoutes=[{id:'ladder-and-stairs',from:s.spawn,to:{x:X(677),y:Y(433)}},{id:'reading-room',from:s.spawn,to:{x:X(344),y:Y(350)}}];
    return b.end();
  }
  function skyisland(){
    const X=x=>x*2.1,Y=y=>y*2.1;
    const b=builder('forest-sky-source','skyisland','구름 위 버섯섬',2008,1162,{x:X(695),y:Y(396)}),{scene:s,html,image,poly,portal}=b;
    html.push('<div class="fv-sky-ground"></div>');image('sky-island-original','sky-composition',0,0,2.1,0);
    const area=(id,p)=>poly(id,p.map(([x,y])=>[X(x),Y(y)]));
    area('main-island',[[448,265],[500,243],[579,215],[623,229],[673,248],[769,255],[839,260],[855,285],[898,331],[887,386],[842,423],[755,440],[671,431],[560,444],[464,423],[425,404],[431,339],[421,290]]);
    area('lower-west-island',[[211,354],[265,348],[312,354],[342,337],[389,351],[424,377],[420,416],[380,442],[302,448],[224,430],[202,397]]);
    area('lower-west-connection',[[401,373],[446,373],[446,409],[401,409]]);
    area('middle-ladder',[[332,281],[351,281],[351,374],[332,374]]);
    area('upper-west-island',[[92,176],[129,153],[168,173],[198,182],[223,164],[268,153],[297,142],[333,163],[383,178],[414,216],[392,261],[342,283],[263,284],[178,276],[108,254],[90,219]]);
    area('mushroom-ladder',[[204,140],[222,140],[222,203],[204,203]]);
    area('mushroom-lookout',[[131,99],[161,83],[206,84],[239,95],[254,122],[239,146],[185,153],[136,137],[121,119]]);
    area('east-ladder',[[574,122],[591,122],[591,225],[574,225]]);
    area('east-lookout',[[516,83],[547,73],[585,80],[613,99],[608,116],[575,126],[534,116],[512,102]]);
    area('return-ladder',[[715,415],[738,415],[738,501],[715,501]]);
    [[538,378,14],[645,281,16],[195,120,17],[499,398,10],[835,374,10],[803,209,10],[851,261,10],[291,149,7],[99,213,9],[130,238,8],[212,403,10],[160,89,11],[128,95,10]].forEach(([x,y,r],i)=>s.solids.push({id:'sky-native-object-'+i,x:X(x),y:Y(y),radius:r*2.1}));
    // Supplied gift boxes occupy their ground faces, not their entire roofs.
    [[453,218,65,24],[422,250,46,23],[471,264,40,19],[630,202,51,18],[703,202,65,25],[676,230,39,18]].forEach(([x,y,w,h],i)=>s.solids.push({id:'sky-gift-base-'+i,x:X(x),y:Y(y),width:X(w),height:Y(h)}));
    b.foreground('sky-west-tree','sky-composition',[69,140,64,81],[[99,140],[111,146],[116,163],[127,175],[133,188],[126,200],[111,208],[110,219],[97,221],[91,215],[92,206],[77,203],[69,191],[72,178],[84,167],[85,151]],2.1,Y(218));
    b.foreground('sky-east-tree','sky-composition',[821,186,62,82],[[850,186],[862,192],[866,209],[878,222],[883,239],[875,251],[861,256],[861,265],[849,268],[843,262],[843,255],[829,250],[821,240],[825,221],[834,215],[836,197]],2.1,Y(265));
    b.foreground('sky-lower-tree','sky-composition',[813,322,47,60],[[835,322],[844,328],[846,340],[856,349],[860,359],[853,370],[844,374],[842,380],[832,382],[827,378],[828,371],[818,368],[813,359],[817,347],[825,339],[826,329]],2.1,Y(379));
    portal('sky-treehouse-path','나무집으로 내려가기','treehouse',X(727),Y(474),{arrival:{x:X(727),y:Y(446)},targetDoor:'treehouse-sky-path',radius:53});
    s.cameraHome={x:X(490),y:Y(292),zoom:.95};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'sky-entry',label:'하늘섬 아래 마당',spawn:s.spawn},{id:'mushrooms',label:'큰 버섯 전망대',spawn:{x:X(232),y:Y(117)}},{id:'high-lookout',label:'높은 구름 전망대',spawn:{x:X(565),y:Y(97)}}];
    s.reviewRoutes=[{id:'large-mushroom',from:s.spawn,to:{x:X(232),y:Y(117)}},{id:'high-lookout',from:s.spawn,to:{x:X(565),y:Y(97)}},{id:'return-ladder',from:s.spawn,to:{x:X(727),y:Y(474)}}];
    return b.end();
  }
  const scenes={village:village(),forestgarden:forestgarden(),treehouse:treehouse(),skyisland:skyisland()};
  window.QPForestVillageScene=Object.freeze({get:(zone='village')=>scenes[zone]||null,zones:Object.keys(scenes),assets:sizes});
})();
