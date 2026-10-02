/* Complete side and rear shoe paintings. Original front art stays in QPShoes. */
(function () {
  'use strict';
  const names = ['sneaker','loafer','boots','sandal','hitop','ballet','rain','slipper','wing_shoes'];
  const cache = new Map();
  const hints = {
    sneaker: {width:3.85,mouth:27,ankle:44.12}, loafer:{width:3.7,mouth:52,ankle:44.06},
    boots:{width:3.75,mouth:8,ankle:43.8}, sandal:{width:3.75,mouth:12,ankle:43.82},
    hitop:{width:3.85,mouth:20,ankle:43.73}, ballet:{width:3.7,mouth:19,ankle:43.98},
    rain:{width:3.7,mouth:7,ankle:43.68}, slipper:{width:3.95,mouth:26,ankle:44.04},
    wing_shoes:{width:4.2,mouth:18,ankle:44.03}
  };
  const stats = {renders:0,cacheHits:0};
  const shapeName = value => value === 'dress' ? 'loafer' : String(value || '');
  function colorName(value) {
    const hex=String(value||'').toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) return '#'+[...hex.slice(1)].map(v=>v+v).join('');
    return '#58a6ee';
  }
  function blend(hex,to,amount) {
    const a=hex.slice(1).match(/../g).map(v=>parseInt(v,16)),b=to.slice(1).match(/../g).map(v=>parseInt(v,16));
    return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*amount).toString(16).padStart(2,'0')).join('');
  }
  const path=(d,fill,extra='')=>'<path d="'+d+'" fill="'+fill+'" '+extra+'/>'+(/-upper\)$/.test(fill)?'<path d="'+d+'" fill="'+fill.replace('-upper)','-light)')+'"/><path d="'+d+'" fill="'+fill.replace('-upper)','-curve)')+'"/>':'');
  const line=(d,stroke,width=1.5,extra='')=>path(d,'none','stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round" '+extra);
  const ellipse=(x,y,rx,ry,fill,extra='')=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'" '+extra+'/>';
  function materialName(shape) {
    return shape==='rain'?'rubber':['loafer','ballet','wing_shoes'].includes(shape)?'leather':['boots','slipper'].includes(shape)?'soft':shape==='sandal'?'straps':'cloth';
  }
  function wearDefs(id,shape,color) {
    const material=materialName(shape),gloss=material==='rubber'?.42:material==='leather'?.3:material==='soft'?.13:.19;
    return '<linearGradient id="'+id+'-lining" x1="0" y1="0" x2=".12" y2="1"><stop stop-color="#61432f"/><stop offset=".4" stop-color="#957052"/><stop offset="1" stop-color="#d6b593"/></linearGradient>'+
      '<linearGradient id="'+id+'-lip" x1="0" y1="0" x2=".1" y2="1"><stop stop-color="#fffbee"/><stop offset=".55" stop-color="#f0d2b1"/><stop offset="1" stop-color="#b78962"/></linearGradient>'+
      '<radialGradient id="'+id+'-curve" cx=".39" cy=".29" r=".7"><stop stop-color="#fffdf6" stop-opacity="'+gloss+'"/><stop offset=".44" stop-color="#ffffff" stop-opacity="'+(gloss*.17)+'"/><stop offset=".73" stop-color="'+blend(color,'#182b3d',.58)+'" stop-opacity=".03"/><stop offset="1" stop-color="'+blend(color,'#182b3d',.58)+'" stop-opacity=".19"/></radialGradient>';
  }
  function opening(cx,cy,rx,ry,id,edge='#ad805a') {
    // The lower crescent is the collar in front of the ankle, rather than a
    // flat oval pasted over it. Its top edge catches light; the interior falls
    // into the shoe. Both parts use the unchanged, source-derived ankle fit.
    return ellipse(cx,cy,rx,ry,'url(#'+id+'-lining)','stroke="'+edge+'" stroke-width="1.15"')+
      path('M'+(cx-rx)+' '+cy+'Q'+cx+' '+(cy+ry*2.05)+' '+(cx+rx)+' '+cy+'Q'+cx+' '+(cy+ry*.63)+' '+(cx-rx)+' '+cy+'Z','url(#'+id+'-lip)','stroke="'+edge+'" stroke-width=".65"')+
      line('M'+(cx-rx*.81)+' '+(cy+ry*.57)+'Q'+cx+' '+(cy+ry*1.31)+' '+(cx+rx*.81)+' '+(cy+ry*.57),'#fff9e9',.9);
  }
  function flower(x,y,s) {
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      path('M0 3C-10 1-14 9-8 14C-3 18 2 11 2 7C5 17 15 19 18 12C21 5 11 3 7 4C16-3 11-13 4-11C-2-10 0-3 1 1C-5-8-15-4-12 3C-10 9-3 7 0 3Z','#fff9e9','stroke="#b88355" stroke-width="1.4"')+
      ellipse(3,5,5,5,'#ffd34b','stroke="#b78129" stroke-width="1.6"')+
      path('M-3 15Q-14 17-14 25Q-3 27 0 17Z','#91bb4e','stroke="#55824b" stroke-width="1.1"')+'</g>';
  }
  function bow(x,y,s) {
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      path('M0 0C-7-10-23-10-22 0C-21 9-7 8 0 2M0 0C8-9 20-9 20-1C21 8 8 8 0 2','#fff1d8','stroke="#b98455" stroke-width="2" stroke-linejoin="round"')+
      line('M-2 1L-14 0M3 1L13 0','#d6b08b',1.8)+
      path('M-3 3L-10 18L-2 15L1 5L7 16L12 18L4 3Z','#fff1d8','stroke="#b98455" stroke-width="1.4"')+
      ellipse(1,1,4.5,5,'#ffe9c7','stroke="#c79661" stroke-width="1.5"')+'</g>';
  }
  function drawing(shape,color,side) {
    const id='qpsprofile-'+shape+'-'+side+'-'+color.slice(1), ink=blend(color,'#654635',.76);
    const base='url(#'+id+'-upper)',sole='url(#'+id+'-sole)',gold='url(#'+id+'-gold)',cream='url(#'+id+'-cream)';
    const pale=blend(color,'#ffffff',.66),dark=blend(color,'#12223b',.58),near=side==='right';
    const outline='stroke="'+ink+'" stroke-width="1.85" stroke-linejoin="round"';
    let art='<defs><linearGradient id="'+id+'-upper" x1="0" y1="0" x2=".2" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="'+pale+'"/><stop offset=".37" stop-color="'+color+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient>'+
      '<radialGradient id="'+id+'-light" cx=".28" cy=".24" r=".7"><stop stop-color="#fffbed" stop-opacity=".48"/><stop offset=".28" stop-color="#ffffff" stop-opacity=".13"/><stop offset=".7" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'+
      '<linearGradient id="'+id+'-sole" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff7e5"/><stop offset=".45" stop-color="#ffe9c9"/><stop offset="1" stop-color="#dbac7f"/></linearGradient>'+
      '<linearGradient id="'+id+'-gold" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#fff29b"/><stop offset=".5" stop-color="#ffca39"/><stop offset="1" stop-color="#d28726"/></linearGradient>'+
      '<linearGradient id="'+id+'-cream" x1="0" y1="0" x2=".4" y2="1"><stop stop-color="#fffdf1"/><stop offset="1" stop-color="#f2d1aa"/></linearGradient>'+wearDefs(id,shape,color)+'</defs>';
    const lowSole='M19 78Q13 78 14 86Q15 92 24 93L97 95Q111 95 113 87Q115 81 109 78Q87 80 60 78Z';
    const thickSole='M19 76L107 76Q116 78 114 86Q112 92 103 94L86 96L36 95Q17 95 14 88Q12 80 19 76Z';
    // Each outer boundary contains one entire heel, instep, toe and sole.
    if (shape==='sneaker'||shape==='hitop') {
      const tall=shape==='hitop';
      art+=path(thickSole,sole,'stroke="#a77952" stroke-width="2"');
      art+=path(tall?'M18 79C12 72 14 35 17 16Q20 5 35 6Q45 5 48 12L54 47Q63 52 76 55L99 62Q111 66 112 78Q86 87 18 79Z':'M18 80C12 74 13 58 16 41Q17 26 27 23Q37 18 44 24L50 43Q58 50 73 56L99 62Q111 68 112 79Q90 86 18 80Z',base,outline);
      art+=path('M78 57Q103 60 110 72L112 80Q95 85 79 82Q80 68 74 59Z',cream,'stroke="#a9815b" stroke-width="1.5"');
      art+=line('M17 80Q66 86 110 80','#fffaf0',3.2)+line('M16 89Q61 96 106 88','#c9986c',1.3);
      art+=path(tall?'M20 11Q33 4 48 10L46 21Q30 16 20 22Z':'M18 32Q19 23 31 22Q40 21 44 26L41 32Q29 28 20 38Z','#ecd0ad','stroke="#c39369" stroke-width="1.3"');
      art+=opening(32,tall?13:28,10,3.8,id);
      art+=line('M46 '+(tall?'24':'32')+'L66 55',pale,1.6);
      const y0=tall?32:41;
      for(let i=0;i<3;i++){const x=49+i*6,y=y0+i*7;art+=ellipse(x-2,y,2.2,2.2,gold)+ellipse(x+11,y+4,2.2,2.2,gold)+line('M'+(x-2)+' '+y+'L'+(x+11)+' '+(y+4),'#fff0d6',3);}
      art+=bow(49,tall?27:35,.53);
      if(tall)art+=path('M17 22Q32 17 49 25L50 33Q31 27 18 33Z',pale,'stroke="'+ink+'" stroke-width="1.2"')+ellipse(44,29,2.5,2.5,gold)+line('M22 36L21 66',pale,2.1);
      art+=ellipse(100,70,8,2.7,'#fffdf4','opacity=".5"')+line('M24 41Q23 53 24 62',pale,2.6);
      if(near)art+=flower(37,57,.62);else art+=line('M25 48Q31 54 35 68',pale,1.6);
      art+=line('M67 65Q71 72 70 79','#d1dded',1.05,'stroke-dasharray="2 3"');
    } else if(shape==='loafer') {
      art+=path(lowSole,sole,'stroke="#966c48" stroke-width="2"');
      art+=path('M18 81Q12 76 16 65Q18 52 31 49Q43 44 50 53L65 62Q89 56 104 67Q115 71 113 81Q80 92 18 81Z',base,outline);
      art+=ellipse(33,53,12.5,4.2,'#d6b89b','stroke="#a57a58" stroke-width="1.2"')+opening(33,53,8.7,2.5,id);
      art+=line('M48 57Q77 72 108 72',pale,1.2,'stroke-dasharray="2.5 3"');
      art+=path('M45 59L80 66L79 71L42 65Z',gold,'stroke="#b67d29" stroke-width="1.8"');
      art+=path('M52 56L64 59L62 70L50 67Z','#ffd66d','stroke="#ab7229" stroke-width="1.8"')+path('M54 59L61 61L60 67L53 65Z',base);
      art+=path('M20 83Q27 87 34 86L33 93Q23 95 18 91L17 86Z','#b6845c','stroke="#926540" stroke-width="1.3"');
      art+=line('M81 73Q96 68 104 75',pale,2.2);
    } else if(shape==='boots'||shape==='rain') {
      art+=path(thickSole,sole,'stroke="#9e714b" stroke-width="2"');
      art+=path('M17 75L19 10Q36 4 53 11L53 51Q59 62 77 60Q105 60 112 76L112 80Q73 91 16 80Z',base,outline);
      art+=ellipse(36,12,17,6,'#e0bb91','stroke="#a17750" stroke-width="1.4"')+opening(36,12,12.5,3.5,id);
      art+=line('M23 24L23 59Q21 69 34 77',pale,2.4)+line('M50 22L47 64Q51 72 58 78',dark,1.2);
      art+=line('M17 89L22 89L23 95M36 92L37 96M52 94L53 97M70 94L70 97M88 92L89 95M103 88L104 93','#b2855e',2);
      if(shape==='boots') {
        art+=path('M15 13Q15 5 24 5Q29 0 37 4Q44 0 52 6Q60 6 59 15L56 29Q38 33 16 24Z',cream,'stroke="#b88962" stroke-width="2"');
        for(const [x,y]of [[20,11],[27,9],[35,10],[43,10],[51,13],[21,21],[29,22],[38,24],[47,24],[54,22]])art+=ellipse(x,y,3.5,3,'#fff9e8');
        art+=path('M43 27L52 29L52 51L41 50Z',cream,'stroke="#b78251" stroke-width="1.4"')+ellipse(47,33,4,4,gold,'stroke="#b47925" stroke-width="1.2"')+ellipse(47,44,4,4,gold,'stroke="#b47925" stroke-width="1.2"')+opening(36,9.5,11.8,3.4,id);
      }else{
        art+=path('M17 10Q33 2 54 10L54 23Q36 30 17 21Z',cream,'stroke="#bc8e61" stroke-width="1.7"');
        art+=line('M20 17Q38 24 51 17','#fff8e8',2.2)+opening(36,9.5,12.1,3.5,id);
        if(near)art+=flower(35,48,.72);else art+=line('M31 38L37 61',pale,2);
      }
      art+=ellipse(88,68,12,3.2,pale,'opacity=".65"');
    } else if(shape==='sandal') {
      art+=path(lowSole,sole,'stroke="#ac7f56" stroke-width="2"');
      art+=path('M18 76L21 55Q23 29 38 27Q48 31 50 52L70 58Q95 59 108 72L111 79Q73 86 19 79Z',base,outline);
      art+=path('M18 29Q31 20 49 28L52 39Q35 41 18 35Z',cream,'stroke="#b78651" stroke-width="1.7"')+ellipse(42,34,5.3,5.3,gold,'stroke="#b68131" stroke-width="1.5"');
      art+=path('M34 37L46 38L62 75L53 78Z',cream,'stroke="#c39461" stroke-width="1.5"')+path('M57 60L66 57L88 76L81 82Z',cream,'stroke="#c39461" stroke-width="1.5"')+path('M77 57L83 61L67 81L59 79Z',cream,'stroke="#c39461" stroke-width="1.5"');
      art+=flower(67,65,.52)+line('M19 88Q62 93 106 85','#fff5df',1.6)+line('M20 35Q35 41 49 35','#8c654a',1.2,'opacity=".38"')+line('M23 37Q35 42 46 37','#fffaf0',.9);
    } else if(shape==='ballet') {
      art+=path('M16 80Q16 72 19 69Q22 40 38 35L49 62Q65 74 83 65Q108 65 113 81Q113 92 95 94L32 93Q16 89 16 80Z',base,outline);
      art+=path('M23 66Q24 44 38 35L49 61Q59 70 66 73Q46 79 26 76Z',cream,'stroke="#c28b57" stroke-width="1.4"');
      art+=opening(37,47,7.5,12,id)+line('M29 46L45 62M29 61L43 46','#fff1d5',3);
      art+=line('M19 86Q64 97 107 88',dark,2.2)+line('M20 69Q42 79 77 72',pale,1.8);
      art+=flower(84,71,.58)+ellipse(86,74,3.7,3.7,gold)+line('M71 65Q81 62 88 66',pale,2);
    } else if(shape==='slipper') {
      art+=path('M12 76Q12 57 37 50L63 47Q91 42 110 65Q117 82 108 92Q79 100.6 27 94Q12 91 12 76Z',cream,'stroke="#ad7c55" stroke-width="2"');
      art+=path('M19 77Q17 60 38 56Q47 47 63 48Q93 46 108 68L107 84Q74 93 29 87Q20 84 19 77Z',base,outline);
      art+=path('M16 51Q13 26 31 23Q48 22 55 46L47 59Q29 61 16 51Z',cream,'stroke="#b58a62" stroke-width="1.9"')+opening(32,42,11,10,id);
      art+=path('M67 52Q58 25 65 13Q72 5 82 13Q89 28 78 56Z',cream,'stroke="#b78967" stroke-width="1.6"')+path('M70 44Q66 23 70 18Q78 18 78 26L73 46Z','#f4b0a0');
      art+=path('M83 57Q91 26 101 23Q113 21 113 33Q112 47 96 63Z',cream,'stroke="#b78967" stroke-width="1.6"')+path('M94 51Q100 30 105 29Q109 33 103 43Z','#f4b0a0');
      art+=ellipse(91,72,15,12,cream)+ellipse(96,68,3,3.6,'#684431')+ellipse(102,76,2.4,1.6,'#e99584')+line('M101 78Q98 83 94 80','#9a5f43',1.2);
      art+=bow(76,51,.42)+ellipse(78,55,4.5,4.5,gold,'stroke="#b18132" stroke-width="1.1"');
      for(const [x,y]of[[18,87],[27,91],[37,92],[48,94],[59,94],[70,94],[81,94],[93,92],[104,88]])art+=ellipse(x,y,3.2,2.5,'#fff7e5');
    } else if(shape==='wing_shoes') {
      art+=path(lowSole,sole,'stroke="#a4774e" stroke-width="2"');
      art+=path('M18 78L20 30Q32 15 47 22L55 53Q61 60 78 62Q105 60 113 79Q108 90 21 82Z',base,outline);
      art+=ellipse(35,29,12,5.4,cream,'stroke="#b98a5c" stroke-width="1.3"')+opening(35,29,8,3.3,id);
      art+=path('M40 44L70 63L99 56L102 63L74 75L34 52Z',cream,'stroke="#be8a58" stroke-width="1.5"')+path('M47 39L58 43L47 81L36 77Z',base,outline);
      art+=path('M29 70Q6 56 6 33Q15 34 22 48Q7 34 9 18Q23 19 33 40Q19 22 24 8Q36 22 39 47L37 71Z',cream,'stroke="#c49962" stroke-width="1.9"');
      art+=line('M13 36Q25 44 29 63M24 29Q31 44 34 57','#d7b07f',1.5);
      art+=path('M66 47L71 56L81 57L74 64L76 74L66 69L57 74L59 64L52 57L62 55Z',gold,'stroke="#b78327" stroke-width="1.7"')+line('M66 49L66 66L74 64','#fff5ae',1.3);
      art+=ellipse(89,60,5.2,5.2,gold,'stroke="#b4832a" stroke-width="1.5"');
      if(!near)art+=line('M41 59L48 54',pale,1.4);
    }
    if(!['slipper','ballet'].includes(shape))art+=line('M18 81Q38 88 69 87Q96 86 110 81',blend(color,'#59412e',.57),1.5,'opacity=".36"');
    if(shape==='loafer'||shape==='rain')art+=path('M78 68Q94 64 105 73Q90 70 79 75Z','#fffdf3','opacity="'+(shape==='rain'?.24:.16)+'"');
    return art;
  }
  function placement(shape,side) {
    shape=shapeName(shape);side=side==='right'?'right':'left';const hint=hints[shape];if(!hint)return null;
    const original=window.QPShoes?.inspect?.(shape)?.feet?.[side];
    const ankleY=Number.isFinite(original?.ankle?.[1])?original.ankle[1]:hint.ankle;
    const width=hint.width,height=(46.05-ankleY)/((98-hint.mouth)/100),ankleX=side==='left'?13.85:18.15;
    const x=ankleX-width*32/120,y=46.05-height*.98;
    return {target:[x,y,width,height],ankle:[ankleX,ankleY],ground:[ankleX,46.05],toeDirection:'right',artworkFloor:98,mouth:[32,hint.mouth],shape,side};
  }
  function renderFoot(shape,color,side) {
    shape=shapeName(shape);color=colorName(color);side=side==='right'?'right':'left';const fit=placement(shape,side);if(!fit)return '';
    const key=[shape,color,side,fit.ankle[1].toFixed(5)].join('/');if(cache.has(key)){stats.cacheHits++;return cache.get(key);}
    const [x,y,w,h]=fit.target;
    const markup='<g class="qps-foot qps-profile-foot" data-qps-profile-foot="true" data-qps-contact-rim="true" data-qps-material="'+materialName(shape)+'" data-qps-foot-side="'+side+'" data-qps-shape="'+shape+'" data-qps-foot-color="'+color+'" data-qps-ankle="'+fit.ankle.join(',')+'" data-qps-ground="46.05" data-qps-toe-direction="right"><svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="0 0 120 100" preserveAspectRatio="none" overflow="visible">'+drawing(shape,color,side)+'</svg></g>';
    stats.renders++;cache.set(key,markup);return markup;
  }
  const backHints = {
    sneaker:{width:3.5,mouth:25},loafer:{width:3.3,mouth:40},boots:{width:3.45,mouth:10},
    sandal:{width:3.4,mouth:20},hitop:{width:3.5,mouth:14},ballet:{width:3.3,mouth:27},
    rain:{width:3.4,mouth:9},slipper:{width:3.5,mouth:28},wing_shoes:{width:3.6,mouth:25}
  };
  function backDrawing(shape,color,side) {
    const id='qpsback-'+shape+'-'+side+'-'+color.slice(1),ink=blend(color,'#654635',.76);
    const base='url(#'+id+'-upper)',sole='url(#'+id+'-sole)',cream='url(#'+id+'-cream)',gold='url(#'+id+'-gold)';
    const pale=blend(color,'#ffffff',.66),dark=blend(color,'#12223b',.58);
    const outline='stroke="'+ink+'" stroke-width="1.85" stroke-linejoin="round"';
    let art='<defs><linearGradient id="'+id+'-upper" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="'+pale+'"/><stop offset=".43" stop-color="'+color+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient>'+
      '<radialGradient id="'+id+'-light" cx=".3" cy=".2" r=".7"><stop stop-color="#fffbed" stop-opacity=".45"/><stop offset=".3" stop-color="#ffffff" stop-opacity=".12"/><stop offset=".75" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'+
      '<linearGradient id="'+id+'-sole" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff9e9"/><stop offset=".5" stop-color="#ffe8c9"/><stop offset="1" stop-color="#d6a576"/></linearGradient>'+
      '<linearGradient id="'+id+'-cream" x1="0" y1="0" x2=".45" y2="1"><stop stop-color="#fffdf1"/><stop offset="1" stop-color="#f2d1aa"/></linearGradient>'+
      '<linearGradient id="'+id+'-gold" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#fff29b"/><stop offset=".5" stop-color="#ffca39"/><stop offset="1" stop-color="#d28726"/></linearGradient>'+wearDefs(id,shape,color)+'</defs>';
    const heelSole='M22 80Q17 88 23 93Q49 99 77 93Q83 88 79 80Z';
    const trim=(y,tall=false)=>path('M'+(tall?'25':'27')+' '+y+'Q50 '+(y-12)+' '+(tall?'75':'73')+' '+y+'L'+(tall?'73':'71')+' '+(y+10)+'Q50 '+(y+17)+' '+(tall?'27':'29')+' '+(y+10)+'Z',cream,'stroke="#bb8d64" stroke-width="1.5"');
    if(shape==='sneaker'||shape==='hitop') {
      const tall=shape==='hitop';
      art+=path(heelSole,sole,'stroke="#a87953" stroke-width="2"');
      art+=path(tall?'M23 81Q22 66 25 20Q26 6 48 6Q71 5 75 20Q80 66 78 83Q53 91 23 83Z':'M24 81Q20 65 25 39Q27 23 46 21Q67 21 73 36Q82 64 78 82Q53 92 24 82Z',base,outline);
      art+=trim(tall?17:29,tall);
      art+=opening(50,tall?15:27,tall?19:17,4.5,id);
      art+=path('M43 '+(tall?'28':'42')+'Q50 '+(tall?'31':'45')+' 57 '+(tall?'28':'42')+'L61 79Q50 84 39 79Z',base,'stroke="'+ink+'" stroke-width="1.1"');
      art+=line('M46 '+(tall?'33':'47')+'L43 76M54 '+(tall?'33':'47')+'L57 76',pale,1.1,'stroke-dasharray="2 3"');
      art+=path('M28 70Q50 79 73 70L75 79Q50 87 26 79Z',cream,'stroke="#b48a66" stroke-width="1.2"');
      art+=line('M26 88Q50 93 75 87','#fff8e8',2)+line('M29 52Q26 61 28 67',pale,2.5);
      if(tall)art+=path('M43 11Q50 8 57 11L56 29L44 29Z',base,'stroke="'+ink+'" stroke-width="1.2"')+line('M47 13L47 24',pale,1.4);
    } else if(shape==='loafer') {
      art+=path(heelSole,sole,'stroke="#a0714b" stroke-width="1.8"');
      art+=path('M23 81Q22 63 29 50Q38 39 51 40Q65 41 72 51Q81 66 78 84Q49 91 23 84Z',base,outline);
      art+=ellipse(50,45,19,6,cream,'stroke="#ad8057" stroke-width="1.4"')+opening(50,45,13,3.5,id);
      art+=path('M24 82Q50 89 78 82L77 94Q51 99 25 94Z','#bd8a61','stroke="#865c3b" stroke-width="1.5"');
      art+=line('M49 53L49 80',dark,1.1)+line('M35 66Q33 72 35 77',pale,2.1)+line('M26 88Q50 94 75 88','#e3b78e',1.6);
    } else if(shape==='boots'||shape==='rain') {
      art+=path(heelSole,sole,'stroke="#a1714d" stroke-width="2"');
      art+=path('M23 82Q22 66 25 18Q26 7 49 7Q71 6 75 17Q80 66 78 84Q52 94 23 84Z',base,outline);
      art+=line('M50 27L50 78',dark,1.4)+line('M45 29L45 77',pale,1.1,'stroke-dasharray="2 3"')+line('M30 36Q27 57 30 71',pale,2.6);
      if(shape==='boots') {
        art+=path('M24 10Q25 3 35 5Q42 0 50 4Q58 0 65 5Q77 4 77 14L75 29Q52 38 24 29Z',cream,'stroke="#b5865e" stroke-width="1.8"');
        for(const [x,y]of[[29,13],[37,10],[47,11],[57,10],[67,13],[31,24],[40,27],[51,28],[62,27],[71,23]])art+=ellipse(x,y,3.7,3.2,'#fff9e9');
        art+=opening(50,11,18.5,3.8,id);
      }else{
        art+=trim(14,true)+opening(50,12,19,4,id)+line('M28 24Q49 30 73 24','#fff7e6',2);
      }
      art+=path('M27 72Q51 83 74 73L75 80Q51 88 26 80Z',base,'stroke="'+ink+'" stroke-width="1.2"');
      for(const x of[29,39,50,61,72])art+=line('M'+x+' 92L'+x+' 97','#ae8057',1.6);
    } else if(shape==='sandal') {
      art+=path(heelSole,sole,'stroke="#a77850" stroke-width="1.8"');
      art+=path('M25 77Q50 69 76 78L75 88Q50 94 26 87Z',base,outline);
      art+=path('M26 27L36 24L39 77L30 80Z',cream,'stroke="#b7895b" stroke-width="1.5"')+path('M64 24L74 27L70 80L61 77Z',cream,'stroke="#b7895b" stroke-width="1.5"');
      art+=path('M25 25Q50 15 75 25L74 35Q50 27 26 35Z',cream,'stroke="#b7895b" stroke-width="1.5"');
      art+=path('M31 60Q50 69 69 60L69 68Q50 76 31 68Z',cream,'stroke="#b7895b" stroke-width="1.5"');
      art+=ellipse(side==='left'?29:71,29,3.7,4.7,gold,'stroke="#ae7d2b" stroke-width="1.2"')+line('M27 87Q50 91 74 86','#fff8e7',1.8);
    } else if(shape==='ballet') {
      art+=path('M25 85Q20 76 27 59Q34 48 49 49Q65 48 72 60Q80 76 75 88Q51 99 26 89Z',base,outline);
      art+=path('M34 26L42 24L66 62L61 68Z',cream,'stroke="#bd8c5d" stroke-width="1.3"')+path('M60 24L67 28L39 69L33 63Z',cream,'stroke="#bd8c5d" stroke-width="1.3"');
      art+=path('M29 61Q51 70 71 61L72 67Q51 75 28 67Z',pale,'stroke="'+ink+'" stroke-width="1.1"');
      art+=line('M50 74L50 88',dark,1)+line('M30 87Q50 93 73 86',pale,1.8);
    } else if(shape==='slipper') {
      // The rabbit's ears are viewed from behind; no face or front bow repeats.
      art+=path('M25 47Q19 21 27 10Q35 4 40 15L43 49Z',cream,'stroke="#ba8c68" stroke-width="1.6"')+path('M58 49Q61 14 68 10Q77 6 81 17L74 49Z',cream,'stroke="#ba8c68" stroke-width="1.6"');
      art+=path('M19 80Q17 58 28 45Q49 30 71 45Q83 58 81 82Q79 95 64 96L34 95Q20 92 19 80Z',cream,'stroke="#b5855d" stroke-width="1.9"');
      art+=path('M26 80Q22 61 30 50Q48 39 68 50Q78 62 75 83Q50 93 26 83Z',base,outline);
      art+=ellipse(50,35,23,9,cream,'stroke="#c0946e" stroke-width="1.5"')+opening(50,34,16,5.5,id);
      art+=line('M51 49L51 78',dark,1.1)+line('M32 61Q30 70 33 75',pale,2.3);
      for(const [x,y]of[[24,85],[32,90],[41,92],[51,92],[61,91],[70,88],[78,84]])art+=ellipse(x,y,3.6,2.7,'#fff8e9');
    } else if(shape==='wing_shoes') {
      art+=path(heelSole,sole,'stroke="#a97c53" stroke-width="1.9"');
      art+=path('M27 82Q21 68 28 43Q30 27 48 24Q66 23 72 42Q79 68 74 84Q50 92 27 84Z',base,outline);
      art+=trim(31)+opening(50,28,16,4,id);
      art+=path(side==='left'?'M30 73Q10 64 8 42Q18 43 23 55Q10 38 15 23Q26 32 31 47Q22 23 28 10Q40 27 39 52L37 75Z':'M70 73Q90 64 92 42Q82 43 77 55Q90 38 85 23Q74 32 69 47Q78 23 72 10Q60 27 61 52L63 75Z',cream,'stroke="#c49a61" stroke-width="1.7"');
      art+=line(side==='left'?'M18 44Q26 56 30 64M28 32Q34 45 34 62':'M82 44Q74 56 70 64M72 32Q66 45 66 62','#d5b07d',1.4);
      art+=path('M44 40L56 40L58 78Q51 84 42 78Z',base,'stroke="'+ink+'" stroke-width="1.2"')+line('M47 46L46 75',pale,1.1,'stroke-dasharray="2 3"');
      art+=line('M28 88Q50 94 73 87','#fff8e8',1.8);
    }
    if(!['slipper','ballet'].includes(shape))art+=line('M26 83Q50 91 76 82',blend(color,'#59412e',.55),1.7,'opacity=".33"');
    return art;
  }
  function backPlacement(shape,side) {
    shape=shapeName(shape);side=side==='right'?'right':'left';const hint=backHints[shape];if(!hint)return null;
    const original=window.QPShoes?.inspect?.(shape)?.feet?.[side];
    const ankleY=Number.isFinite(original?.ankle?.[1])?original.ankle[1]:hints[shape].ankle;
    const width=hint.width,height=(46.05-ankleY)/((98-hint.mouth)/100),ankleX=side==='left'?13.85:18.15;
    return {target:[ankleX-width*.5,46.05-height*.98,width,height],ankle:[ankleX,ankleY],ground:[ankleX,46.05],toeDirection:'back',artworkFloor:98,mouth:[50,hint.mouth],shape,side};
  }
  function renderBackFoot(shape,color,side) {
    shape=shapeName(shape);color=colorName(color);side=side==='right'?'right':'left';const fit=backPlacement(shape,side);if(!fit)return '';
    const key=['back',shape,color,side,fit.ankle[1].toFixed(5)].join('/');if(cache.has(key)){stats.cacheHits++;return cache.get(key);}
    const [x,y,w,h]=fit.target;
    const markup='<g class="qps-foot qps-back-foot" data-qps-back-foot="true" data-qps-contact-rim="true" data-qps-material="'+materialName(shape)+'" data-qps-foot-side="'+side+'" data-qps-shape="'+shape+'" data-qps-foot-color="'+color+'" data-qps-ankle="'+fit.ankle.join(',')+'" data-qps-ground="46.05" data-qps-toe-direction="back"><svg x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible">'+backDrawing(shape,color,side)+'</svg></g>';
    stats.renders++;cache.set(key,markup);return markup;
  }
  window.QPProfileShoes={renderFoot,renderBackFoot,inspect:placement,inspectBack:backPlacement,names:names.slice(),atlas:{ready:true,count:names.length,style:'illustrated-side-shoe',backReady:true,backCount:names.length},stats,clearCache(){cache.clear();},cacheSize:()=>cache.size};
  window.dispatchEvent(new CustomEvent('qp-profile-shoes-ready'));
}());
