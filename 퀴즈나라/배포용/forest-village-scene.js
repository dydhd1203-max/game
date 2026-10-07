/* Keep supplied map compositions. Source extractions and the user-requested
   asset style edits have separate provenance manifests. */
(() => {
  'use strict';
  const ROOT=new URL('assets/forest-village-library/original-resolution/maps/',document.currentScript.src).href;
  const sizes={'village-composition':[2713,1555],'plaza-composition':[1115,736],'garden-composition':[962,541],'treehouse-composition':[946,740],'sky-composition':[956,553],'autumn-composition':[1122,752],'camp-composition':[1339,750]};
  const nativeMaps={'plaza-composition':'plaza','garden-composition':'garden','treehouse-composition':'treehouse','sky-composition':'sky','autumn-composition':'autumn','camp-composition':'camp'};
  const assetURL=asset=>asset==='village-composition'?new URL('../../central-village/village.webp',ROOT).href:ROOT+nativeMaps[asset]+'.png';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function builder(id,zone,title,width,height,spawn){
    const parts=[],solids=[],walkAreas=[],interactables=[],views=[],routes=[],groups=[],html=[];
    const scene={id,zone,title,width,height,spawn,cameraHome:{...spawn,zoom:1},bounds:{width,height},publicEntryReady:true,seats:[],parts,solids,walkAreas,interactables,previewViews:views,reviewRoutes:routes,groups,centerLabel:'내 위치',exitLabel:'학생 메뉴'};
    function image(id,asset,x,y,scale=1,depth=0,options={}){
      const [w,h]=sizes[asset],item={id,asset,x,y,width:w*scale,height:h*scale,scale,depth,...options};parts.push(item);
      const url=assetURL(asset);
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
    const {scale,sourceSize,spawn}=window.QPCentralVillage;
    const b=builder('central-village-supplied','village','숲속 중앙 마을',sourceSize[0]*scale,sourceSize[1]*scale,spawn);
    window.QPCentralVillage.build(b);return b.end();
  }
  function picnicpark(){
    const X=x=>x*3,Y=y=>(y-64)*3;
    const b=builder('forest-picnic-original-100','picnicpark','벚꽃 소풍공원',3345,2208,{x:2310,y:1330}),{scene:s,image,solid,poly,portal}=b;
    image('native-water-path-gardens','plaza-composition',0,0,3,0,{role:'composition'});
    // Restored picnic park: furniture, pond and trees are in the user's original
    // positions. No generated homes, great-tree, brook, well or planted overlays.
    const native=(id,x,y,w,h)=>solid('picnic-'+id,X(x),Y(y),X(w),X(h));
    [[212,168],[473,139],[487,230],[532,258],[152,296],[112,396],[218,445],[348,510],[325,675],[499,424],[549,565],[1008,281],[1060,148],[929,122],[895,97],[697,757],[828,786],[990,734],[792,375],[861,476],[907,444],[675,466],[641,196],[642,157],[1023,450]].forEach(([x,y],i)=>s.solids.push({id:'picnic-tree-'+i,x:X(x),y:Y(y),radius:i===21?28:24}));
    [[227,276,68,18],[309,353,68,22],[823,597,63,36],[889,534,80,22],[972,481,26,39],[399,401,86,107],[378,519,88,77],
     [267,468,76,97],[361,175,24,61],[587,276,22,61],[617,276,22,61],[633,236,15,49],[711,235,55,27],[812,235,60,27],[889,277,23,60],[693,474,70,24],[803,474,70,24],[738,170,149,13],[795,128,22,16],[654,557,61,29]
    ].forEach((r,i)=>native(i===19?'coffee-kiosk':'furniture-'+i,...r));
    native('fence-west',370,626,180,20);native('fence-east',628,626,220,20);
    poly('native-pond',[[580,64],[782,64],[800,88],[794,128],[773,154],[724,180],[679,186],[631,168],[593,129]].map(([x,y])=>[X(x),Y(y)]),true);
    poly('village-land',[[159,64],[1105,64],[1105,780],[860,780],[730,760],[635,725],[535,710],[410,690],[330,699],[260,669],[168,610],[110,515],[112,392],[117,330],[131,235],[153,166],[158,87]].map(([x,y])=>[X(x),Y(y)]));
    // The native pier is part of the original map and has a real reachable end.
    poly('native-pier',[[58,609],[133,558],[174,576],[102,639]].map(([x,y])=>[X(x),Y(y)]));
    portal('picnic-village-path','숲속 중앙 마을로','village',X(586),Y(654),{exitAngle:180,arrival:{x:X(586),y:Y(682)},targetDoor:'village-picnic-path',radius:58});
    s.cameraHome={x:s.spawn.x,y:s.spawn.y,zoom:.76};s.cameraAnchorY=.74;s.centerOnPlayer=true;s.exitLabel='수업 목록';
    s.previewViews=[{id:'picnic',label:'원본 벚나무 소풍 광장',spawn:s.spawn},{id:'lake',label:'선착장',spawn:{x:X(108),y:Y(604)}},{id:'autumn',label:'주황 나무 옆',spawn:{x:455,y:1130}},{id:'village-path',label:'중앙 마을로 돌아가는 길',spawn:{x:X(586),y:Y(682)}},{id:'east-path',label:'공원 동쪽 산책길',spawn:{x:3070,y:1455}}];
    s.groups=[{id:'original-plaza-1-to-5',rect:[0,0,3345,2208],purpose:'five registered 100% captures of one original picnic park'}];
    s.reviewRoutes=[{id:'village',from:s.spawn,to:{x:X(586),y:Y(654)}},{id:'garden',from:s.spawn,to:{x:X(427),y:Y(88)}},...s.previewViews.slice(1).map(v=>({id:v.id,from:s.spawn,to:v.spawn}))];
    s.originalReview={pond:{x:X(705),y:Y(100)},pinkTree:{x:X(792),y:Y(375)},autumn:{edge:{x:455,y:1130},front:{x:640,y:1170}},coffee:{x:X(685),y:Y(570)}};
    return b.end();
  }
  function forestgarden(){
    const b=builder('forest-garden-source','forestgarden','비밀정원',1924,1082,{x:942,y:938}),{scene:s,image,solid,poly,portal}=b;
    image('native-secret-grove','garden-composition',0,0,2,0,{role:'composition'});
    poly('grove-clearing',[[140,83],[1730,83],[1740,950],[1550,1000],[1030,1000],[1030,1060],[866,1060],[866,1000],[270,1000],[170,890],[205,770],[135,630]]);
    [[295,185],[345,185],[392,185],[538,185],[585,185],[633,185],[294,232],[346,232],[394,232],[439,232],[488,232],[538,232],[583,232],[633,232],[294,280],[345,280],[394,280],[443,280],[490,280],[538,280],[584,280],[635,280],[295,328],[345,328],[394,328],[443,328],[490,328],[538,328],[585,328],[634,328]].forEach(([x,y],i)=>solid('native-stump-'+i,(x-13)*2,(y-8)*2,52,36));
    solid('native-treehouse',590,144,100,145);solid('native-board',810,90,247,155);solid('native-vegetables',1400,132,193,146);
    [[66,118],[27,147],[99,229],[27,275],[134,322],[48,351],[82,391],[48,434],[108,495],[64,530],[868,74],[944,136],[892,216],[938,249],[908,341],[855,404],[891,438],[944,442],[839,525],[912,544],[670,66],[586,133]].forEach(([x,y],i)=>s.solids.push({id:'grove-tree-'+i,x:x*2,y:y*2,radius:22}));
    [[141,190,58,23],[162,337,77,27],[136,369,69,30],[202,402,72,27],[153,435,85,23],[710,398,72,27],[653,434,85,25],[698,466,73,22]].forEach(([x,y,w,h],i)=>solid('grove-furniture-'+i,x*2,y*2,w*2,h*2));
    solid('grove-meeting-stump',852,306,154,77);
    solid('grove-west-fence',476,1006,331,40);solid('grove-east-fence',1057,1006,438,40);
    portal('garden-village-path','숲속 중앙 마을로','village',942,1002,{exitAngle:180,arrival:{x:942,y:938},targetDoor:'village-garden-path',radius:48});
    portal('grove-treehouse-door','큰 나무집','treehouse',656,326,{exitAngle:-90,arrival:{x:697,y:325},targetDoor:'treehouse-village-door',radius:47});
    // Same source registration: the original painting remains intact below.
    // Tree crowns occlude a visitor behind the trunk, then release in front.
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
    // The painted trunk ladder is a real ladder, not a ground corridor: the
    // decks, stairs and rooms are one raised level reached by climbing it.
    const DECK=Math.round((792-598)*1.8),deck=p=>({points:p.map(([x,y])=>[X(x),Y(y)])});
    s.groundLabel='나무 밑동';s.levels=[{id:'moon-decks',label:'달빛 데크',height:DECK,walkAreas:[deck([[394,554],[583,554],[583,611],[394,611]]),deck([[530,448],[569,448],[569,567],[530,567]]),deck([[223,390],[434,390],[434,381],[519,381],[520,367],[739,367],[752,450],[614,505],[578,485],[569,457],[296,460],[223,426]]),deck([[248,298],[430,298],[430,397],[248,397]])],solids:[]}];
    s.climbs=[{id:'treehouse-trunk-ladder',label:'달빛 데크로 오르기',downLabel:'나무 밑동으로 내려가기',radius:44,speed:118,points:[{x:X(569),y:Y(792),height:0},{x:X(569),y:Y(598),height:DECK}]}];
    s.elevatedDepth=0;
    portal('treehouse-village-door','비밀정원으로','forestgarden',X(422),Y(769),{exitAngle:-90,arrival:{x:X(510),y:Y(781)},targetDoor:'grove-treehouse-door'});
    portal('treehouse-sky-path','하늘섬으로','skyisland',X(677),Y(433),{exitAngle:90,height:DECK,arrival:{x:X(638),y:Y(437),height:DECK},targetDoor:'sky-treehouse-path',radius:60});
    portal('treehouse-camp-path','별빛 캠핑장','camp',X(612),Y(780),{exitAngle:90,arrival:{x:X(548),y:Y(780)},targetDoor:'camp-treehouse-path',radius:45});
    s.cameraHome={x:X(488),y:Y(529),zoom:.95};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'root',label:'큰 나무집 밑동',spawn:s.spawn},{id:'deck',label:'달빛 데크',spawn:{x:X(486),y:Y(425),height:DECK}},{id:'room',label:'나무 위 방',spawn:{x:X(344),y:Y(350),height:DECK}}];
    s.reviewRoutes=[{id:'trunk-ladder',from:s.spawn,to:{x:X(569),y:Y(792)}},{id:'deck-stairs',from:{x:X(569),y:Y(598),height:DECK},to:{x:X(677),y:Y(433),height:DECK}},{id:'reading-room',from:{x:X(569),y:Y(598),height:DECK},to:{x:X(344),y:Y(350),height:DECK}}];
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
    // Each painted ladder climbs a cliff to its own raised place; the return
    // ladder hangs below the island to the path down to the treehouse.
    const rise=(bottom,top)=>Math.round((bottom-top)*2.1),UPPER=rise(372,278),MUSHROOM=UPPER+rise(200,143),EAST=rise(222,118),FOOT=-rise(478,428);
    const place=(id,label,height,p,objects=[])=>({id,label,height,walkAreas:[{id,points:p.map(([x,y])=>[X(x),Y(y)])}],solids:objects.map(([x,y,r],i)=>({id:id+'-object-'+i,x:X(x),y:Y(y),radius:r*2.1}))});
    s.groundLabel='섬 마당';s.levels=[
      place('upper-west-island','위쪽 섬',UPPER,[[92,176],[129,153],[168,173],[198,182],[223,164],[268,153],[297,142],[333,163],[383,178],[414,216],[392,261],[342,283],[263,284],[178,276],[108,254],[90,219]],[[291,149,7],[99,213,9],[130,238,8]]),
      place('mushroom-lookout','버섯 전망대',MUSHROOM,[[131,99],[161,83],[206,84],[239,95],[254,122],[239,146],[185,153],[136,137],[121,119]],[[195,120,17],[160,89,11],[128,95,10]]),
      place('east-lookout','구름 전망대',EAST,[[516,83],[547,73],[585,80],[613,99],[608,116],[575,126],[534,116],[512,102]]),
      {...place('return-ladder-foot','나무집으로 가는 길',FOOT,[[713,468],[741,468],[741,492],[713,492]]),allowSit:false}
    ];
    const ladder=(id,label,downLabel,x,bottom,top,from,to)=>({id,label,downLabel,radius:42,speed:112,points:[{x:X(x),y:Y(bottom),height:from},{x:X(x),y:Y(top),height:to}]});
    s.climbs=[
      ladder('sky-middle-ladder','위쪽 섬으로 오르기','아래 섬으로 내려가기',341.5,372,278,0,UPPER),
      ladder('sky-mushroom-ladder','버섯 전망대로 오르기','위쪽 섬으로 내려가기',213,200,143,UPPER,MUSHROOM),
      ladder('sky-east-ladder','구름 전망대로 오르기','큰 섬으로 내려가기',582.5,222,118,0,EAST),
      {...ladder('sky-return-ladder','나무집 길로 내려가기','큰 섬으로 올라가기',726.5,428,478,0,FOOT),speed:96}
    ];
    s.elevatedDepth=0;
    [[538,378,14],[645,281,16],[499,398,10],[835,374,10],[803,209,10],[851,261,10],[212,403,10]].forEach(([x,y,r],i)=>s.solids.push({id:'sky-native-object-'+i,x:X(x),y:Y(y),radius:r*2.1}));
    // Supplied gift boxes occupy their ground faces, not their entire roofs.
    [[453,218,65,24],[422,250,46,23],[471,264,40,19],[630,202,51,18],[703,202,65,25],[676,230,39,18]].forEach(([x,y,w,h],i)=>s.solids.push({id:'sky-gift-base-'+i,x:X(x),y:Y(y),width:X(w),height:Y(h)}));
    portal('sky-treehouse-path','나무집으로 내려가기','treehouse',X(727),Y(474),{height:FOOT,arrival:{x:X(726.5),y:Y(426)},targetDoor:'treehouse-sky-path',radius:53});
    s.cameraHome={x:X(490),y:Y(292),zoom:.95};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'sky-entry',label:'하늘섬 아래 마당',spawn:s.spawn},{id:'mushrooms',label:'큰 버섯 전망대',spawn:{x:X(232),y:Y(117),height:MUSHROOM}},{id:'high-lookout',label:'높은 구름 전망대',spawn:{x:X(565),y:Y(97),height:EAST}}];
    s.reviewRoutes=[{id:'middle-ladder',from:s.spawn,to:{x:X(341.5),y:Y(372)}},{id:'mushroom-ladder',from:{x:X(341.5),y:Y(278),height:UPPER},to:{x:X(213),y:Y(200),height:UPPER}},{id:'large-mushroom',from:{x:X(213),y:Y(143),height:MUSHROOM},to:{x:X(232),y:Y(117),height:MUSHROOM}},{id:'east-ladder',from:s.spawn,to:{x:X(582.5),y:Y(222)}},{id:'high-lookout',from:{x:X(582.5),y:Y(118),height:EAST},to:{x:X(565),y:Y(97),height:EAST}},{id:'return-ladder',from:s.spawn,to:{x:X(726.5),y:Y(428)}}];
    return b.end();
  }
  function autumnpark(){
    const K=2.2,X=x=>x*K;
    const b=builder('autumn-original-100','autumnpark','단풍 소풍공원',X(1122),X(752),{x:X(588),y:X(653)}),{scene:s,image,poly,solid,portal}=b;
    image('autumn-park-original','autumn-composition',0,0,K,0,{role:'composition'});
    poly('autumn-clearing',[[112,116],[991,116],[1080,226],[1085,559],[1017,679],[799,716],[750,745],[331,745],[218,698],[94,624],[55,511],[87,370],[61,259]].map(([x,y])=>[X(x),X(y)]));
    const box=(id,x,y,w,h)=>solid(id,X(x),X(y),X(w),X(h));
    // Footprints follow the supplied tent floors, benches and fire circles.
    [[199,145,100,60],[369,138,111,35],[550,143,93,38],[811,119,179,83],[906,254,192,64],[847,469,179,61],
     [351,385,65,22],[567,342,70,24],[697,85,66,25],[389,177,84,48],[774,185,37,37],[496,186,55,36],[805,284,48,37],
     [866,323,58,29],[164,398,47,23],[186,497,29,28],[812,507,51,36],[329,586,188,43],[165,588,164,40],[657,588,284,41]
    ].forEach((r,i)=>box('autumn-footprint-'+i,...r));
    [[336,453,23],[578,257,27],[817,384,25],[757,506,15],[430,540,17],[433,360,12],[148,339,12],[81,316,13],[714,230,18],[685,269,14],[555,75,17],[161,159,15],[335,93,15],[990,571,13],[881,435,12],[1037,374,13],[78,406,17]].forEach(([x,y,r],i)=>s.solids.push({id:'autumn-base-'+i,x:X(x),y:X(y),radius:X(r)}));
    // Tree visibility metadata lives in map-avatar-display.js; original pixels stay intact.
    portal('autumn-village-path','숲속 중앙 마을로','village',X(588),X(712),{exitAngle:180,arrival:{x:X(588),y:X(653)},targetDoor:'village-autumn-path',radius:46});
    portal('autumn-camp-path','호숫가 캠핑길','camp',X(1040),X(394),{exitAngle:90,arrival:{x:X(1000),y:X(402)},targetDoor:'camp-autumn-path',radius:46});
    s.cameraHome={...s.spawn,zoom:.85};s.centerOnPlayer=true;s.exitLabel='학생 메뉴';
    s.previewViews=[{id:'entry',label:'단풍 울타리 입구',spawn:s.spawn},{id:'picnic',label:'그네와 모닥불 쉼터',spawn:{x:X(390),y:X(312)}},{id:'lanterns',label:'전구 텐트 산책길',spawn:{x:X(675),y:X(410)}}];
    s.reviewRoutes=[...s.previewViews.slice(1).map(v=>({id:v.id,from:s.spawn,to:v.spawn})),...s.interactables.map(p=>({id:p.id,from:s.spawn,to:{x:p.x,y:p.y}}))];
    return b.end();
  }
  function camp(){
    const K=2,X=x=>x*K;
    const b=builder('camp-original-100','camp','별빛 호수 캠핑장',X(1339),X(750),{x:X(365),y:X(455)}),{scene:s,image,poly,solid,portal}=b;
    image('lakeside-camp-original','camp-composition',0,0,K,0,{role:'composition'});
    // Distant mountains/sky and water are scenery, never walkable flat ground.
    poly('camp-clearing',[[258,333],[382,277],[600,249],[917,271],[1117,345],[1176,433],[1155,486],[1100,538],[1010,542],[935,507],[827,474],[770,494],[655,499],[568,506],[486,526],[405,544],[326,565],[234,539],[224,457]].map(([x,y])=>[X(x),X(y)]));
    [[470,386,111,56],[506,312,100,43],[611,300,101,30],[725,253,137,68],[728,332,108,46],[751,398,51,26]].forEach(([x,y,w,h],i)=>solid('camp-tent-floor-'+i,X(x),X(y),X(w),X(h)));
    [[446,385,26],[491,269,23],[543,292,22],[583,265,20],[742,257,18],[794,265,20],[858,392,25],[938,350,25],[670,378,29]].forEach(([x,y,r],i)=>s.solids.push({id:'camp-tree-fire-base-'+i,x:X(x),y:X(y),radius:X(r)}));
    // The foreground tent wall is traced from native pixels; the lake
    // shore remains outside the walk mesh, with enough ground for two visitors.
    b.foreground('camp-front-tent','camp-composition',[463,329,127,119],[[526,329],[535,348],[547,357],[570,397],[589,414],[566,448],[463,425],[484,382],[507,351]],K,X(442));
    portal('camp-treehouse-path','달빛 나무집으로','treehouse',X(295),X(444),{exitAngle:-90,arrival:{x:X(365),y:X(455)},targetDoor:'treehouse-camp-path',radius:46});
    portal('camp-autumn-path','단풍 소풍공원으로','autumnpark',X(1105),X(440),{exitAngle:90,arrival:{x:X(1052),y:X(452)},targetDoor:'autumn-camp-path',radius:46});
    s.cameraHome={...s.spawn,zoom:.85};s.centerOnPlayer=true;s.exitLabel='학생 메뉴';
    s.previewViews=[{id:'entry',label:'숲 입구',spawn:s.spawn},{id:'fire',label:'모닥불 이야기 자리',spawn:{x:X(670),y:X(437)}},{id:'lake',label:'호수 전망 자리',spawn:{x:X(693),y:X(478)}},{id:'caravan',label:'캠핑카 옆길',spawn:{x:X(918),y:X(447)}}];
    s.reviewRoutes=[...s.previewViews.slice(1).map(v=>({id:v.id,from:s.spawn,to:v.spawn})),...s.interactables.map(p=>({id:p.id,from:s.spawn,to:{x:p.x,y:p.y}}))];
    return b.end();
  }
  const scenes={village:village(),forestgarden:forestgarden(),treehouse:treehouse(),skyisland:skyisland(),picnicpark:picnicpark(),autumnpark:autumnpark(),camp:camp()};
  window.QPForestVillageScene=Object.freeze({get:(zone='village')=>scenes[zone]||null,zones:Object.keys(scenes),assets:sizes});
})();
