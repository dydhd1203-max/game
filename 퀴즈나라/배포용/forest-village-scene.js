/* Keep supplied map compositions. Source extractions and the user-requested
   flower style edit have separate provenance manifests. */
(() => {
  'use strict';
  const ROOT=new URL('assets/forest-village-library/extracted/',document.currentScript.src).href;
  const ADAPTED=new URL('../adapted/',ROOT).href;
  const sizes={'village-composition':[1115,736],'garden-composition':[962,541],'flower-home':[352,295],'bakery-home':[354,289],'pink-tree':[145,128],'treehouse-composition':[946,740],'sky-composition':[956,553],'flowers-purple':[45,31],'flowers-ivory':[30,23],'flowers-gold':[32,31],'flowers-meadow':[33,24]};
  sizes['flowers-daisy']=[1484,1060];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function builder(id,zone,title,width,height,spawn){
    const parts=[],solids=[],walkAreas=[],interactables=[],views=[],routes=[],groups=[],html=[];
    const scene={id,zone,title,width,height,spawn,cameraHome:{...spawn,zoom:1},bounds:{width,height},publicEntryReady:true,seats:[],parts,solids,walkAreas,interactables,previewViews:views,reviewRoutes:routes,groups,centerLabel:'내 위치',exitLabel:'학생 메뉴'};
    function image(id,asset,x,y,scale=1,depth=0,options={}){
      const [w,h]=sizes[asset],item={id,asset,x,y,width:w*scale,height:h*scale,scale,depth,...options};parts.push(item);
      const url=(asset==='flowers-daisy'?ADAPTED:ROOT)+asset+'.png';
      html.push('<img class="sr-art fv-art '+(options.className||'')+'" data-art="'+id+'" data-source="'+asset+'" data-floor-y="'+depth+'" src="'+url+'" alt="" draggable="false" width="'+w+'" height="'+h+'" style="left:'+x+'px;top:'+y+'px;width:'+item.width+'px;height:'+item.height+'px;z-index:'+depth+';'+(options.style||'')+'">');return item;
    }
    // A foreground crop references the same source pixels and placement as
    // its background. It never erases the base silhouette at a mask edge.
    function foreground(id,asset,rect,polygon,scale,depth){
      const [sx,sy,w,h]=rect,[sw,sh]=sizes[asset],clip='fv-'+id;
      parts.push({id,asset,x:sx*scale,y:sy*scale,width:w*scale,height:h*scale,scale,depth,role:'foreground',sourceRect:rect,polygon});
      html.push('<svg class="sr-art fv-art" data-art="'+id+'" data-source="'+asset+'" data-floor-y="'+depth+'" viewBox="0 0 '+w+' '+h+'" style="left:'+sx*scale+'px;top:'+sy*scale+'px;width:'+w*scale+'px;height:'+h*scale+'px;z-index:'+depth+'" aria-hidden="true"><defs><clipPath id="'+clip+'"><polygon points="'+polygon.map(([x,y])=>(x-sx)+','+(y-sy)).join(' ')+'"/></clipPath></defs><image href="'+ROOT+asset+'.png" x="'+(-sx)+'" y="'+(-sy)+'" width="'+sw+'" height="'+sh+'" clip-path="url(#'+clip+')"/></svg>');
    }
    function solid(id,x,y,w,h){const s={id,x,y,width:w,height:h};solids.push(s);return s;}
    function poly(id,points,solid=false){(solid?solids:walkAreas).push({id,points});}
    function portal(id,label,target,x,y,extra={}){interactables.push({id,type:'portal',target,label,x,y,radius:65,approach:{x,y},hitRect:{x:x-38,y:y-36,width:76,height:72},hint:{x,y:y-30},hintLabel:label+' · F',...extra});}
    function label(text,x,y,small=false){html.push('<div class="fv-place-label'+(small?' is-small':'')+'" style="left:'+x+'px;top:'+y+'px">'+esc(text)+'</div>');}
    function end(){scene.markup=html.join('');scene.get=()=>scene;scene.render=()=>scene.markup;return scene;}
    return {scene,html,image,foreground,solid,poly,portal,label,end};
  }
  function village(){
    const X=x=>x*2,Y=y=>(y-64)*2;
    const b=builder('forest-village-source-composition','village','햇살 숲속 마을',2230,1472,{x:X(581),y:Y(337)}),{scene:s,image,solid,poly,portal}=b;
    image('native-water-path-gardens','village-composition',0,0,2,0,{role:'composition'});
    const homes=[['flower-home',235,75,157,207,[256,156,106,43]],['bakery-home',231,455,143,572,[254,532,100,35]]];
    homes.forEach(([asset,x,y,width,floor,box])=>{const scale=width*2/sizes[asset][0],id='courtyard-'+asset;image(id,asset,X(x),Y(y),scale,Y(floor),{role:'house',ground:{x:X(x+width/2),y:Y(floor)},footprint:id+'-base'});solid(id+'-base',X(box[0]),Y(box[1]),X(box[2]),X(box[3]));});
    // Small planted groups belong to courtyard/shore lawns, never the path.
    // Their low foliage sorts by its own root, not by the flower's top edge.
    [['purple',243,218,1.8,'upper-courtyard'],['daisy',270,218,.066,'upper-courtyard'],['meadow',312,224,1.8,'upper-courtyard'],
     ['ivory',355,575,2,'bakery-garden'],['purple',382,586,1.7,'bakery-garden'],
     ['ivory',469,680,1.9,'shore-meadow'],['meadow',444,682,1.8,'shore-meadow']].forEach(([kind,x,y,scale,bed],i)=>{
      const asset='flowers-'+kind,[w,h]=sizes[asset],ground={x:X(x)+(kind==='daisy'?758:w/2)*scale,y:Y(y)+(kind==='daisy'?858:h-2)*scale};
      image('village-flower-'+i,asset,X(x),Y(y),scale,Math.round(ground.y),{role:'flower',bed,ground});
    });
    const native=(id,x,y,w,h)=>solid('picnic-'+id,X(x),Y(y),X(w),X(h));
    native('pond',597,61,173,79);native('coffee',654,520,64,64);
    [[212,168],[473,139],[487,230],[532,258],[152,296],[112,396],[218,427],[499,424],[549,565],[670,483],[803,369],[861,471],[1008,281],[1060,148],[929,122],[895,97],[325,675],[697,757],[828,786],[990,734]].forEach(([x,y],i)=>s.solids.push({id:'picnic-tree-'+i,x:X(x),y:Y(y),radius:i===10?36:23}));
    [[227,276,68,18],[309,353,68,22],[693,469,70,21],[823,597,63,36],[889,534,80,22],[972,481,26,39],[727,247,69,19],[818,245,67,19],[589,276,56,40],[399,401,86,107],[378,519,88,77]].forEach((r,i)=>native('furniture-'+i,...r));
    native('fence-west',370,626,180,20);native('fence-east',628,626,220,20);
    image('native-flowering-canopy','pink-tree',X(710),Y(260),2,Y(365),{role:'canopy',ground:{x:X(790),y:Y(365)}});
    const crown=(id,rect,points,floor)=>b.foreground(id,'village-composition',[rect[0],rect[1]-64,rect[2],rect[3]],points.map(([x,y])=>[x,y-64]),2,Y(floor));
    crown('lake-oak',[177,101,73,91],[[212,101],[234,107],[248,127],[246,151],[230,168],[218,174],[221,186],[208,191],[200,184],[201,173],[181,162],[177,139],[181,118]],181);
    crown('central-grove',[429,140,137,145],[[480,140],[515,149],[533,165],[528,184],[552,185],[565,218],[559,250],[542,263],[539,279],[527,281],[522,265],[512,255],[490,255],[486,269],[473,267],[469,253],[442,247],[429,223],[434,198],[451,180],[450,157]],266);
    crown('autumn-tree',[140,345,146,123],[[209,345],[255,355],[270,377],[271,393],[285,416],[272,439],[229,450],[217,464],[198,468],[192,447],[157,439],[140,421],[148,393],[156,365]],445);
    crown('lower-grove',[490,441,109,153],[[550,441],[575,449],[594,465],[599,491],[586,512],[562,521],[554,540],[563,557],[554,577],[548,590],[534,592],[528,574],[502,568],[490,548],[495,521],[516,501],[516,476],[531,451]],577);
    poly('village-land',[[159,64],[1105,64],[1105,780],[860,780],[730,760],[635,725],[535,710],[410,690],[330,699],[260,669],[168,610],[110,515],[112,392],[117,330],[131,235],[153,166],[158,87]].map(([x,y])=>[X(x),Y(y)]));
    portal('village-school-path','학교로 가는 길','playground',X(586),Y(654),{arrival:{x:X(586),y:Y(682)},targetDoor:'playground-village-path',radius:58});
    portal('village-garden-path','비밀정원 숲길','forestgarden',X(427),Y(88),{arrival:{x:X(426),y:Y(117)},targetDoor:'garden-village-path',radius:52});
    s.cameraHome={x:X(550),y:Y(285),zoom:.96};s.centerOnPlayer=true;s.exitLabel='수업 목록';
    s.previewViews=[{id:'alley',label:'꽃집과 굽은 골목',spawn:{x:X(565),y:Y(282)}},{id:'lake',label:'물가와 작은 집',spawn:{x:X(284),y:Y(597)}},{id:'flower-courtyard',label:'꽃이 있는 집 앞',spawn:{x:X(374),y:Y(245)}},{id:'picnic',label:'벚나무 소풍 마당',spawn:{x:X(841),y:Y(390)}},{id:'school-path',label:'학교로 가는 문',spawn:{x:X(586),y:Y(682)}}];
    s.groups=[{id:'village-composition',rect:[0,0,2230,1472],purpose:'native winding paths and lake, two distinct courtyard homes, original picnic garden'}];
    s.reviewRoutes=[{id:'school',from:s.spawn,to:{x:X(586),y:Y(654)}},{id:'garden',from:s.spawn,to:{x:X(427),y:Y(88)}},...s.previewViews.slice(1,4).map(v=>({id:v.id,from:s.spawn,to:v.spawn}))];
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
    portal('garden-village-path','햇살 마을로','village',942,1002,{arrival:{x:942,y:938},targetDoor:'village-garden-path',radius:48});
    portal('grove-treehouse-door','큰 나무집','treehouse',656,326,{arrival:{x:697,y:325},targetDoor:'treehouse-village-door',radius:47});
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
    portal('treehouse-village-door','비밀정원으로','forestgarden',X(422),Y(769),{arrival:{x:X(510),y:Y(781)},targetDoor:'grove-treehouse-door'});
    portal('treehouse-sky-path','하늘섬으로','skyisland',X(677),Y(433),{arrival:{x:X(638),y:Y(437)},targetDoor:'sky-treehouse-path',radius:60});
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
    [[538,378,14],[645,281,16],[195,120,17],[499,398,10],[824,359,20],[805,244,15],[288,165,15],[107,220,15]].forEach(([x,y,r],i)=>s.solids.push({id:'sky-native-object-'+i,x:X(x),y:Y(y),radius:r*2.1}));
    portal('sky-treehouse-path','나무집으로 내려가기','treehouse',X(727),Y(474),{arrival:{x:X(727),y:Y(446)},targetDoor:'treehouse-sky-path',radius:53});
    s.cameraHome={x:X(490),y:Y(292),zoom:.95};s.centerOnPlayer=true;s.exitLabel='마을로 돌아가기';
    s.previewViews=[{id:'sky-entry',label:'하늘섬 아래 마당',spawn:s.spawn},{id:'mushrooms',label:'큰 버섯 전망대',spawn:{x:X(232),y:Y(117)}},{id:'high-lookout',label:'높은 구름 전망대',spawn:{x:X(565),y:Y(97)}}];
    s.reviewRoutes=[{id:'large-mushroom',from:s.spawn,to:{x:X(232),y:Y(117)}},{id:'high-lookout',from:s.spawn,to:{x:X(565),y:Y(97)}},{id:'return-ladder',from:s.spawn,to:{x:X(727),y:Y(474)}}];
    return b.end();
  }
  const scenes={village:village(),forestgarden:forestgarden(),treehouse:treehouse(),skyisland:skyisland()};
  window.QPForestVillageScene=Object.freeze({get:(zone='village')=>scenes[zone]||null,zones:Object.keys(scenes),assets:sizes});
})();
