/* Lived-in streets assembled from measured original art. Positions are feet
   in the unscaled village scene; the scene scales geography, never house art. */
(() => {
  'use strict';
  const SCALE = 1.5;
  const homes = {
    bakery: [[0,0,512,490],[250,470]], blueHome: [[512,0,512,490],[274,477]],
    herbHome: [[1024,0,512,498],[246,480]], watermill: [[0,490,518,502],[259,470]],
    farmHome: [[518,492,506,504],[248,480]], postOffice: [[1024,496,512,510],[253,482]]
  };
  const life = {
    fountain: [[16,140,354,347],[177,326]], market: [[390,90,372,398],[188,363]],
    bench: [[784,155,372,338],[185,303]], garden: [[1154,135,382,354],[185,325]],
    fence: [[12,632,383,308],[191,282]], cart: [[406,594,439,340],[211,309]],
    lantern: [[856,528,277,439],[106,403]], beehive: [[1195,610,310,352],[157,326]]
  };
  function sprite(kind, width, house) {
    const [source, anchor] = (house ? homes : life)[kind], s = width / source[2];
    return { width, heightPixels: source[3] * s, anchorX: anchor[0] * s, anchorY: anchor[1] * s,
      markup: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="' + source.join(' ') + '" overflow="hidden" aria-hidden="true"><image href="./assets/' + (house ? 'forest-village-homes.png' : 'forest-village-life.png') + '" width="1536" height="1024"/></svg>' };
  }
  function decorate({ id }) {
    const objects = [], solids = [];
    function place(name, kind, x, y, height, width, house, footprint) {
      objects.push({ id: 'village-' + name, kind, x, y, height, depth: y, ...sprite(kind, width, house) });
      if (footprint) {
        if (footprint.radius) solids.push({ id: 'village-' + name, x, y: y + (footprint.dy || 0) / SCALE, height, radius: footprint.radius / SCALE });
        else solids.push({ id: 'village-' + name, x: x + footprint.x / SCALE, y: y + footprint.y / SCALE, height, w: footprint.w / SCALE, h: footprint.h / SCALE });
      }
    }
    // Each resident's home has its own roof, silhouette and surrounding story.
    // Streets, stairs, bridge landings and student spawn slots remain open.
    place('bakery', 'bakery', 713, 905, 0, 254, true, {x:-83,y:-53,w:166,h:48});
    place('blue-home', 'blueHome', 451, 1145, 0, 257, true, {x:-85,y:-59,w:173,h:55});
    place('herb-home', 'herbHome', 755, 365, 72, 252, true, {x:-92,y:-64,w:192,h:59});
    place('watermill', 'watermill', 1142, 1146, 0, 270, true, {x:-92,y:-61,w:185,h:57});
    place('farm-home', 'farmHome', 1278, 676, 72, 251, true, {x:-88,y:-57,w:174,h:52});
    place('post-office', 'postOffice', 920, 295, 72, 242, true, {x:-87,y:-54,w:179,h:49});
    place('plaza-fountain', 'fountain', 919, 960, 0, 190, false, {radius:60,dy:-8});
    place('produce-market', 'market', 1065, 840, 0, 158, false, {x:-48,y:-37,w:104,h:31});
    place('plaza-bench', 'bench', 750, 1048, 0, 134, false, {x:-47,y:-20,w:94,h:17});
    place('riverside-bench', 'bench', 1480, 1134, 0, 112, false, {x:-39,y:-18,w:80,h:15});
    place('farm-garden', 'garden', 1416, 683, 72, 169, false, {x:-55,y:-48,w:112,h:42});
    place('home-garden', 'garden', 573, 1174, 0, 138, false, {x:-46,y:-39,w:95,h:34});
    place('herb-fence', 'fence', 708, 439, 72, 101, false, {x:-34,y:-10,w:66,h:8});
    place('farm-fence', 'fence', 1315, 720, 72, 113, false, {x:-39,y:-11,w:78,h:8});
    place('home-fence', 'fence', 392, 1221, 0, 105, false, {x:-36,y:-10,w:73,h:8});
    place('bakery-cart', 'cart', 650, 945, 0, 118, false, {x:-33,y:-24,w:64,h:21});
    place('farm-cart', 'cart', 1262, 746, 0, 114, false, {x:-32,y:-24,w:63,h:21});
    place('lavender-beehive', 'beehive', 840, 370, 72, 110, false, {radius:25,dy:-6});
    [[672,923,0],[792,862,0],[1080,1008,0],[1190,1126,0],[818,429,72],[1266,640,72],[821,1066,0]].forEach((p,i) =>
      place('lantern-' + i, 'lantern', ...p, 55, false, {radius:6,dy:-3}));
    objects.push({id:'village-reading-grove',kind:'reading-grove',x:790,y:627,height:72,depth:627,
      width:325,heightPixels:243,anchorX:155,anchorY:230.5,
      markup:'<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="150 0 1300 972" overflow="hidden" aria-hidden="true"><image href="./assets/forest-village-grove.png" width="1536" height="1024"/></svg>'});
    // Individual stump bases are solid; the spaces between them are open.
    // Sitting belongs to the future classroom behavior.
    solids.push({id:'village-reading-table',x:790,y:609,height:72,radius:37});
    [[722,598],[773,627],[847,627]].forEach((p,i)=>solids.push({id:'village-reading-stool-'+i,x:p[0],y:p[1],height:72,radius:11}));
    // Short front walks meet a shared street; no second disconnected plaza.
    let ground = '';
    const trails = [
      ['M713 912V949Q713 988 777 988H805',0],
      ['M1065 844V895',0],
      ['M451 1150V1120Q451 1090 510 1090',0],
      ['M1142 1151V1200',0],
      ['M755 298V387Q755 420 803 420H970',0],
      ['M920 229V420',0],
      ['M1278 609V540Q1278 510 1325 488',0]
    ];
    for (const [d] of trails) ground += '<path d="' + d + '" fill="none" stroke="url(#' + id + '-path)" stroke-width="20" stroke-linecap="round"/>';
    // Resident NPCs are separate from the student presence list. They reuse
    // the same dressed illustration and greeting rig as the shop's staff.
    const npcs = [{id:'gardener',name:'꽃잎 정원사',x:1080,y:953,height:0,
      avatar:{sex:'f',sk:0,ec:2,eyes:'big',expression:'soft:0',hair:'twin:3',top:'overall:4',bottom:'shorts:4',shoes:'sneaker:1',hat:'',glass:'',ear:'',neck:'',back:'',pet:'',effect:''},
      lines:['안녕! 나는 햇살숲의 꽃과 채소를 돌보는 꽃잎이야.','옷 가게는 분수 왼쪽, 나무집 교실은 돌계단 위에 있어. 친구와 같이 둘러봐!'],
      choices:[{label:'마을을 더 둘러볼게요',action:'close'}]}];
    solids.push({id:'village-gardener-space',x:1080,y:953,height:0,radius:10/SCALE});
    const portals = [{id:'gardener',label:'꽃잎과 이야기',x:1080,y:979,height:0,radius:48,action:'talk',npc:'gardener',labelOffsetX:100,labelOffsetY:-38,description:'정원사에게 마을을 소개받아요.'}];
    return { ground, objects, solids, npcs, portals,
      discoveries:[{id:'reading-grove',label:'나이테 책 쉼터',x:788,y:653,height:72,radius:34,text:'나무 책상 위에 숲 그림책이 놓여 있어요. 어떤 이야기가 담겨 있을까요?'}],
      sourceAssets:['assets/forest-village-homes.png','assets/forest-village-life.png','assets/forest-village-grove.png'] };
  }
  window.QPVillageNeighborhood = Object.freeze({ decorate, homes, life, sprite });
})();
