'use strict';
// Hair styles drawn by the runtime on the reference body (stage 3 H5: the base heads, then each new style).
// Demo only, nothing saved.
//   node tools/hair/board-heads.cjs [--styles f:base,m:base] [--with f:bob,m:short] [--out 검증/머리/민머리] [--outfit body]
// writes OUT/머리판-280.png: per style (and the --with styles, today's, for comparison) front, right, back at 280 px
// on dark blue, skin tone 0 with 갈색 hair and tone 3 with 분홍 hair, idle, basic outfit;
// OUT/목큰.png: the neck at 840 px (front, right, back), 2x crops on dark blue, each beside the body alone (the head
// hidden: the body's own neck, what shows where the head ends), the size that shows the seams (the whole 840 px
// sheets too: 전체-840.png, 전체-840-몸.png, and 전체-840-감은눈.png with the eyes closed);
// and checks on --styles, 840 px on magenta, idle front/right/back:
//   holes  magenta not reaching the cell's edge inside the neck zone (head units 10.5-21.5 x 23.5-30.5), in groups
//          of 4 px or more: 0 (verify-hairstyles.cjs H, without a "today": a base head has none);
//   layers the head is drawn from the style's own atlas (data-foundation-head-layers, its file in sd-hair-data.js).
// --matrix adds, for --styles (verify-hairstyles.cjs A and B for styles it does not list, a new style built from a
// sheet): A idle front/right/left/back x skin tones 0-4 x hair colours 검정·갈색·분홍·백발 at 120 px and B walk, run,
// jump, nod, wave, happy, climb, desk and floor seats x front/right/back: the node table's count, the style's own
// layers and atlas, no data-URL painting; OUT/동작-280.png: the poses at 280 px (tone 2, 분홍) to look at.
// Exit 1 when a check fails.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..','..'),L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const STYLES=arg('--styles','f:base,m:base').split(',').filter(Boolean),WITH=arg('--with','f:bob,m:short').split(',').filter(Boolean);
const OUT=path.resolve(arg('--out',path.join(ROOT,'검증','머리','민머리')));fs.mkdirSync(OUT,{recursive:true});
const HAIR=JSON.parse(fs.readFileSync(path.join(ROOT,'assets','sd-hair-data.js'),'utf8').match(/window\.QPHairData=(\{[\s\S]*\});\s*$/)[1]);
const ZONE=[[10.5,23.5],[21.5,23.5],[21.5,30.5],[10.5,30.5]],HOLE_MIN=4,BLUE='#1e2858',VIEWS=['front','right','back'];
for(const s of [...STYLES,...WITH])if(!HAIR.styles[s])throw Error('no style '+s+' in assets/sd-hair-data.js');
function cellInfo(){
  return [...document.querySelectorAll('#fg-host .fg-cell')].map(cell=>{
    const svg=cell.querySelector('svg.qp-foundation-avatar');
    const view=[...svg.querySelectorAll('[data-foundation-head-view]')].find(v=>getComputedStyle(v).display!=='none'&&v.getBoundingClientRect().width>0)?.dataset.foundationHeadView||'front';
    const m=svg.querySelector('[data-foundation-head-paint="'+view+'"]').getScreenCTM();
    const heads=[...svg.querySelectorAll('[data-foundation-head-paint] image,[data-foundation-back-hair] image')].map(i=>i.getAttribute('href')||'');
    const atlases=[...new Set(heads.filter(h=>/sd-hair-/.test(h)))];
    return{layers:svg.dataset.foundationHeadLayers||'',atlases,ctm:[m.a,m.b,m.c,m.d,m.e+scrollX,m.f+scrollY],nodes:svg.querySelectorAll('*').length,
      cls:svg.dataset.foundationOutfit==='body'?'none|none|none':svg.dataset.foundationClass,dataUrls:heads.filter(h=>h.startsWith('data:')).length};
  });
}
const OUTFIT=arg('--outfit',null);     // 'body': no garments (whose paint is the body's, whose the garment's)
const cell=(style,direction,sk,hc,size)=>{const [sex,shape]=style.split(':');return{av:{sex,sk,hair:shape+':'+hc,expression:'bright:0',...(OUTFIT?{foundationOutfit:OUTFIT}:{})},state:{action:'idle',direction,time:0,reducedMotion:true},size};};
const apply=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function inPoly(px,py,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)c=!c;}return c;}
function crop(img,x0,y0,w,h,scale=1){
  const out={width:w*scale,height:h*scale,data:Buffer.alloc(w*h*scale*scale*4,255)};
  for(let y=0;y<h*scale;y++)for(let x=0;x<w*scale;x++){const sx=x0+Math.floor(x/scale),sy=y0+Math.floor(y/scale);if(sx<0||sy<0||sx>=img.width||sy>=img.height)continue;
    img.data.copy(out.data,(y*w*scale+x)*4,(sy*img.width+sx)*4,(sy*img.width+sx)*4+4);}
  return out;
}
function sheet(tiles,cols,gap=8){
  const w=Math.max(...tiles.map(t=>t.width)),h=Math.max(...tiles.map(t=>t.height)),rows=Math.ceil(tiles.length/cols);
  const out={width:cols*(w+gap),height:rows*(h+gap),data:Buffer.alloc(cols*(w+gap)*rows*(h+gap)*4,255)};
  tiles.forEach((t,i)=>{const ox=(i%cols)*(w+gap),oy=Math.floor(i/cols)*(h+gap);for(let y=0;y<t.height;y++)t.data.copy(out.data,((oy+y)*out.width+ox)*4,y*t.width*4,(y+1)*t.width*4);});
  return out;
}
(async()=>{
  const tree=H.fsTree(ROOT),server=await H.serve(tree),browser=await H.launch({args:H.RASTER_ARGS}),rep={errors:[]},fails=[];
  try{
    const {page}=await L.openRuntime(browser,server.base,rep,{viewport:{width:2800,height:2400}});await L.install(page,{});
    const grid=async(cells,cols,size,bg)=>{const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols,cellW:Math.round(size*.62),cellH:Math.round(size*1.12),bg,labelW:0});return{g,img:await L.capture(page,g),info:await page.evaluate(cellInfo)};};
    // 280 px board: one row per style, front/right/back x (tone 0 갈색, tone 3 분홍)
    const rows=[...STYLES,...WITH],cells=rows.flatMap(s=>VIEWS.flatMap(d=>[cell(s,d,0,1,280),cell(s,d,3,6,280)]));
    const small=await grid(cells,6,280,BLUE);fs.writeFileSync(path.join(OUT,'머리판-280.png'),H.png.encode(small.img));
    small.info.forEach((c,i)=>{const s=rows[Math.floor(i/6)],want=HAIR.styles[s].file;
      if(c.layers!==s||c.atlases.length!==1||!c.atlases[0].endsWith(want))fails.push({check:'layers',style:s,got:c.layers,atlases:c.atlases});});
    // 840 px: holes on magenta, neck crops on blue
    const big=STYLES.flatMap(s=>VIEWS.map(d=>cell(s,d,0,1,840)));
    const mag=await grid(big,3,840,'#ff00ff'),blue=await grid(big,3,840,BLUE),crops=[];
    const see=p=>mag.img.data[p*4]>200&&mag.img.data[p*4+1]<128&&mag.img.data[p*4+2]>200,holes=[];
    mag.info.forEach((c,i)=>{const [cx,cy,cw,ch]=mag.g.rects[i],W=mag.img.width,m=c.ctm,at=(x,y)=>(cy+y)*W+cx+x;
      const out=new Uint8Array(cw*ch),q=[],push=(x,y)=>{const k=y*cw+x;if(out[k]||!see(at(x,y)))return;out[k]=1;q.push(k);};
      for(let x=0;x<cw;x++){push(x,0);push(x,ch-1);}for(let y=0;y<ch;y++){push(0,y);push(cw-1,y);}
      while(q.length){const k=q.pop(),x=k%cw,y=(k-x)/cw;if(x>0)push(x-1,y);if(x<cw-1)push(x+1,y);if(y>0)push(x,y-1);if(y<ch-1)push(x,y+1);}
      const zone=ZONE.map(p=>apply(m,p)),lost=new Uint8Array(cw*ch);
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(!out[y*cw+x]&&see(at(x,y))&&inPoly(cx+x+.5,cy+y+.5,zone))lost[y*cw+x]=1;
      let px=0;const spots=[];
      for(let k0=0;k0<cw*ch;k0++){if(lost[k0]!==1)continue;const comp=[k0];lost[k0]=2;
        for(let j=0;j<comp.length;j++){const k=comp[j],x=k%cw,y=(k-x)/cw;for(const n of [x>0?k-1:-1,x<cw-1?k+1:-1,y>0?k-cw:-1,y<ch-1?k+cw:-1])if(n>=0&&lost[n]===1){lost[n]=2;comp.push(n);}}
        if(comp.length>=HOLE_MIN){px+=comp.length;spots.push([cx+comp[0]%cw,cy+Math.floor(comp[0]/cw),comp.length]);}}
      const s=STYLES[Math.floor(i/3)];holes.push({style:s,view:VIEWS[i%3],px,spots});if(px)fails.push({check:'holes',style:s,view:VIEWS[i%3],px,spots:spots.slice(0,4)});
      const xs=zone.map(p=>p[0]),ys=zone.map(p=>p[1]),x0=Math.floor(Math.min(...xs)),y0=Math.floor(Math.min(...ys))-40;
      crops.push(crop(blue.img,x0,y0,Math.ceil(Math.max(...xs))-x0,Math.ceil(Math.max(...ys))-y0,2));});
    // the eyes closed (the blink covers and strokes shown): a lash past its cover stays drawn while blinking
    {const style=await page.addStyleTag({content:'.qpx-blink-closed{opacity:1!important;animation:none!important}'});
      const shut=await grid(big,3,840,BLUE);fs.writeFileSync(path.join(OUT,'전체-840-감은눈.png'),H.png.encode(shut.img));await style.evaluate(n=>n.remove());}
    // the same crops with the head hidden (the body's own neck, what shows where the head ends)
    const bodyImg=await (async()=>{const st=await page.addStyleTag({content:'[data-foundation-head-paint],[data-foundation-back-hair],[data-foundation-head-view]{display:none!important}'});
      const im=await L.capture(page,blue.g);await st.evaluate(n=>n.remove());return im;})();
    const bodyCrops=mag.info.map(c=>{const zone=ZONE.map(p=>apply(c.ctm,p)),xs=zone.map(p=>p[0]),ys=zone.map(p=>p[1]),x0=Math.floor(Math.min(...xs)),y0=Math.floor(Math.min(...ys))-40;
      return crop(bodyImg,x0,y0,Math.ceil(Math.max(...xs))-x0,Math.ceil(Math.max(...ys))-y0,2);});
    fs.writeFileSync(path.join(OUT,'목큰.png'),H.png.encode(sheet(crops.flatMap((c,i)=>[c,bodyCrops[i]]),6)));
    fs.writeFileSync(path.join(OUT,'전체-840.png'),H.png.encode(blue.img));fs.writeFileSync(path.join(OUT,'전체-840-몸.png'),H.png.encode(bodyImg));
    console.log('holes (840 px, groups of '+HOLE_MIN+'+ px): '+holes.map(h=>h.style+' '+h.view+' '+h.px).join(', '));
    if(process.argv.includes('--matrix')){
      const M=require(ROOT+'/tools/foundation-matrix.cjs'),COLOURS=[0,1,6,11],TONES=[0,1,2,3,4];
      const POSES=[['walk',d=>M.actionState('walk',d,3)],['run',d=>M.actionState('run',d,2)],['jump',d=>M.actionState('jump',d,4)],['nod',d=>M.gestureState('nod',d,2)],
        ['wave',d=>M.gestureState('wave',d,3)],['happy',d=>M.gestureState('happy',d,3)],['climb',d=>M.actionState('climb',d,2)],['sit',d=>M.actionState('sit',d,0)],['floor',d=>M.actionState('floor-sit',d,0)]];
      const at=(style,state,sk,hc,size)=>{const [sex,shape]=style.split(':');return{av:{sex,sk,hair:shape+':'+hc,expression:'bright:0'},state:{...state,reducedMotion:true},size};};
      const probe=(list,info,label)=>{const bad=[];info.forEach((c,i)=>{const s=list[i].style,want=HAIR.styles[s].file,exp=M.expectedNodes(c.cls,s.split(':')[0]);
        if(c.nodes!==exp||c.layers!==s||c.dataUrls||c.atlases.length!==1||!c.atlases[0].endsWith(want))bad.push({style:s,state:list[i].state,nodes:c.nodes,exp,layers:c.layers,atlases:c.atlases});});
        console.log((bad.length?'FAIL ':'ok   ')+label+': '+info.length+' renders');if(bad.length)fails.push({check:label,bad:bad.slice(0,4)});};
      const idle=STYLES.flatMap(style=>TONES.flatMap(sk=>COLOURS.flatMap(hc=>M.DIRECTIONS.map(d=>({style,state:{action:'idle',direction:d,time:0},sk,hc})))));
      for(let i=0;i<idle.length;i+=240){const part=idle.slice(i,i+240),r=await grid(part.map(o=>at(o.style,o.state,o.sk,o.hc,120)),24,120,BLUE);probe(part,r.info,'A idle '+(i/240+1));}
      const poses=STYLES.flatMap(style=>POSES.flatMap(([name,f])=>['front','right','back'].map(d=>({style,name,state:f(d),sk:2,hc:6}))));
      const pr=await grid(poses.map(o=>at(o.style,o.state,o.sk,o.hc,120)),27,120,BLUE);probe(poses,pr.info,'B poses');
      const big=await grid(poses.map(o=>at(o.style,o.state,o.sk,o.hc,280)),9,280,BLUE);fs.writeFileSync(path.join(OUT,'동작-280.png'),H.png.encode(big.img));
    }
    console.log('wrote '+path.join(OUT,'머리판-280.png')+' and 목큰.png');
    if(rep.errors.length)fails.push({check:'page errors',errors:rep.errors});
  }finally{await browser.close();await server.close();}
  if(fails.length){console.error('FAIL '+JSON.stringify(fails).slice(0,1500));process.exit(1);}
  console.log('ok: '+STYLES.join(', '));
})().catch(e=>{console.error(e);process.exit(1);});
