/* Village-only art registration and small, session-local playground activities.
   No inventory, currency, account, or presence schema changes. */
(() => {
  'use strict';
  const root=new URL('assets/forest-village-library/',document.currentScript.src).href;
  const art=root+'adventure/',mapSize=[1308,1202];
  const origin={x:0,y:0},scale=2208/1202,deckHeight=360;
  const point=(x,y,height=0)=>({x:origin.x+x*scale,y:origin.y+y*scale,height});
  const points=list=>list.map(([x,y])=>{const p=point(x,y);return[p.x,p.y];});

  function sign(b,id,text,x,y,size){
    const depth=Math.round(y+size*.86);
    b.html.push('<div class="fv-wood-sign fv-art" data-art="'+id+'" style="left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;z-index:'+depth+'"><img src="'+art+'wood-sign.png" alt=""><span>'+text+'</span></div>');
    b.scene.parts.push({id,role:'sign',x,y,width:size,height:size,depth});
    b.solid(id+'-feet',x+size*.24,y+size*.77,size*.56,size*.12);
  }

  function build(b){
    const {scene:s,html,image,solid,poly}=b;
    s.width=origin.x+mapSize[0]*scale;s.bounds.width=s.width;
    const rect={x:origin.x,y:origin.y,width:mapSize[0]*scale,height:mapSize[1]*scale};
    s.parts.push({id:'firefly-glade',role:'composition',asset:'firefly-glade',...rect,scale,depth:0});
    html.push('<img class="fv-art" data-art="firefly-glade" src="'+art+'firefly-glade.png" alt="" draggable="false" style="left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.width+'px;height:'+rect.height+'px;z-index:0">');
    const groundAreas=[
      ['entry',[[-30,650],[20,654],[250,768],[285,829],[244,896],[-30,784]]],
      ['mushroom-meadow',[[214,701],[335,685],[565,741],[653,820],[635,953],[482,1005],[296,933],[202,844]]],
      ['forked-trail',[[412,526],[465,514],[514,598],[665,670],[698,717],[837,649],[962,520],[1023,516],[1040,565],[889,715],[779,758],[748,903],[688,992],[573,1014],[555,958],[631,905],[652,795],[593,728],[486,678],[424,591]]],
      ['moon-clearing',[[748,785],[818,762],[913,776],[945,753],[1012,757],[1038,803],[1092,842],[1106,881],[1040,921],[915,914],[804,892],[736,927]]],
      ['reading-trail',[[681,963],[754,956],[850,994],[901,1029],[998,1042],[1070,1109],[1032,1132],[882,1136],[772,1053],[679,1040]]]
    ];
    for(const [id,p]of groundAreas)poly('adventure-'+id,points(p));
    // Root/stone footprints stay out of the sand and mushroom stepping line.
    [[335,716,28],[594,555,53],[854,800,21],[985,727,30],[1105,816,24],[908,1091,17],[970,1110,17]].forEach(([x,y,r],i)=>s.solids.push({id:'adventure-root-'+i,...point(x,y),radius:r*scale}));
    s.levels.push({id:'adventure-canopy-bridge',height:deckHeight,allowSit:true,solids:[],walkAreas:[{points:points([[349,276],[396,279],[467,281],[516,280],[620,286],[754,286],[897,278],[946,281],[1006,281],[1072,273],[1072,310],[1020,326],[952,325],[896,300],[752,310],[617,310],[518,299],[485,326],[400,326],[349,300]])}]});
    for(const [id,x,top]of [['west',438,319],['east',986,320]])s.climbs.push({id:'adventure-'+id+'-ladder',label:'구름다리로 오르기',downLabel:'모험숲으로 내려가기',radius:29,speed:140,points:[point(x,535),point(x,top,deckHeight)]});
    // Keep only the front edge of the boards/ropes above visitors on the deck.
    // The transparent air above this rail must not hide their legs or hands.
    const rail=[[344,281],[406,298],[466,298],[515,281],[617,310],[754,310],[901,281],[964,305],[1011,305],[1075,286],[1075,294],[1014,312],[966,313],[902,289],[754,318],[617,318],[515,289],[467,307],[405,306],[344,289]];
    html.push('<svg class="fv-art" data-art="adventure-front-rope" viewBox="0 0 1308 1202" style="left:'+origin.x+'px;top:'+origin.y+'px;width:'+rect.width+'px;height:'+rect.height+'px;z-index:4700" aria-hidden="true"><defs><clipPath id="fv-adventure-rope"><polygon points="'+rail.map(p=>p.join(',')).join(' ')+'"/></clipPath></defs><image href="'+art+'firefly-glade.png" width="1308" height="1202" clip-path="url(#fv-adventure-rope)"/></svg>');
    const mushroomCoords=[[292,763],[336,797],[382,828],[442,854],[501,883],[579,893]];
    const mushrooms=mushroomCoords.map(([x,y],i)=>({id:'mushroom-'+i,...point(x,y),radius:24*scale}));
    const runes=[[878,850],[983,790],[1084,862]].map(([x,y],i)=>({id:'moon-rune-'+i,...point(x,y),radius:36*scale}));
    s.adventure={rect,entry:point(90,749),mushrooms,runes,ring:point(983,855),reading:point(1024,1114),deckHeight,bridge:[point(460,313,deckHeight),point(1004,316,deckHeight)]};
    for(const m of mushrooms)html.push('<span class="fv-mushroom-light" data-play="'+m.id+'" style="left:'+(m.x-48)+'px;top:'+(m.y-23)+'px;width:96px;height:46px" aria-hidden="true"></span>');
    for(const r of runes)html.push('<span class="fv-rune-light" data-play="'+r.id+'" style="left:'+(r.x-50)+'px;top:'+(r.y-100)+'px" aria-hidden="true"></span>');
    html.push('<div class="fv-fireflies fv-art" data-art="adventure-fireflies" style="left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.width+'px;height:'+rect.height+'px;z-index:4800" aria-hidden="true">'+Array.from({length:26},(_,i)=>'<i style="left:'+(16+(i*37)%76)+'%;top:'+(12+(i*19)%79)+'%;animation-delay:-'+i*.47+'s;animation-duration:'+(4+i%4)+'s"></i>').join('')+'</div>');
    s.effects.push({id:'adventure-fireflies',...rect});
    s.previewViews.push({id:'adventure-entry',label:'반딧불 모험숲',spawn:s.adventure.entry},{id:'moon-ring',label:'달빛 돌의 정원',spawn:s.adventure.ring});
    s.reviewRoutes.push({id:'adventure-entry',from:s.spawn,to:s.adventure.entry},{id:'mushroom-trail',from:s.adventure.entry,to:mushrooms[5]},{id:'moon-garden',from:mushrooms[5],to:s.adventure.ring},{id:'reading-hollow',from:s.adventure.ring,to:s.adventure.reading});
  }

  function mount(world,scene,announce){
    let dead=false;const a=scene.adventure,actors=new Map(),found=new Set(),stepped=new Set();
    const lights=new Map(a?[...a.mushrooms,...a.runes].map(p=>[p.id,world.querySelector('[data-play="'+p.id+'"]')]):[]);
    function actorFrame(id,p,dt,self){
      if(!a)return null;
      let q=actors.get(id);if(!q){q={contact:null,elapsed:1,seen:false};actors.set(id,q);}
      const onGround=!p.height&&!['sit-floor','sit','climb'].includes(p.pose),m=onGround&&a.mushrooms.find(m=>Math.hypot(p.x-m.x,p.y-m.y)<m.radius);
      if(m&&q.contact!==m.id&&p.moving){q.elapsed=0;if(self){stepped.add(m.id);const n=lights.get(m.id);n?.classList.add('is-found');if(stepped.size===6&&!q.mushroomsDone){q.mushroomsDone=true;announce('무지개 버섯 여섯 개를 모두 밟았어요!');}}}
      q.contact=m?.id||null;q.elapsed=Math.min(1,q.elapsed+dt/.6);
      if(!onGround)q.elapsed=1;
      if(self&&onGround){
        if(!q.seen&&p.x>a.rect.x+260){q.seen=true;announce('반딧불 모험숲! 버섯을 밟아 보고, 사다리에서는 ↑↓로 올라가 봐요.');}
        for(const r of a.runes)if(!found.has(r.id)&&Math.hypot(p.x-r.x,p.y-r.y)<r.radius){found.add(r.id);lights.get(r.id)?.classList.add('is-found');world.dataset.moonStones=String(found.size);announce(found.size===3?'달빛 돌 세 개가 깨어났어요! 반딧불이 함께 춤춰요.':'달빛 돌을 찾았어요 · '+found.size+'/3');if(found.size===3)world.classList.add('fv-moon-awake');}
      }
      return q.elapsed<1?{lift:Math.sin(q.elapsed*Math.PI)*23,phase:q.elapsed,vy:(q.elapsed-.5)*480}:null;
    }
    return {actorFrame,forget:id=>actors.delete(id),destroy(){dead=true;actors.clear();lights.clear();},inspect:()=>({mushrooms:stepped.size,moonStones:found.size,actors:actors.size})};
  }
  window.QPForestAdventure=Object.freeze({build,sign,mount});
})();
