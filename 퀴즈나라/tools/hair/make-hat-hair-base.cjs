'use strict';
// Hat-hair kit: the game's own figures with a hair style a pulled-on hat cannot simply cut (twin tails, a
// pony tied above the rim), front/right/back on white, as the first picture of a 'hat-hair' art request.
// Every figure is drawn at 620 px with its svg box saved, so the returned art maps back to head-native units
// like tools/hair/measure-hat-frame.cjs (?demo=1, nothing saved).
//   node tools/hair/make-hat-hair-base.cjs OUTDIR f:twin f:pony ...   writes OUTDIR/base.png and base.json
//   node tools/hair/make-hat-hair-base.cjs OUTDIR --hat m:short f:bob   the hat kit's first picture: smaller figures
//        with room above each head for a tall hat (a witch's hat, a chef's hat, a halo), on a 3:2 sheet like
//        ChatGPT's landscape output (tools/hair/build-hat.py --base reads it back)
//   --colour N   the hair in shop colour N instead of 1 (make-flat-hat-base.py: the pixels that change are the hair)
//   --under-hat  each style as it is drawn under a pulled-on hat (QPHatHair: twin tails, a pony close to the skull, tied
//                low), through an empty pulled-on hat: the base of a hat drawn for those styles (2026-10-16: a wide brim
//                drawn on the bob had no underside where the bob's hair hid it)
const fs=require('node:fs'),path=require('node:path');const ROOT=path.resolve(__dirname,'..','..'),OUT=process.argv[2],HAT=process.argv.includes('--hat'),UNDER=process.argv.includes('--under-hat'),CI=process.argv.includes('--colour')?process.argv[process.argv.indexOf('--colour')+1]:'1',LIST=process.argv.slice(3).filter((a,i,all)=>a!=='--hat'&&a!=='--under-hat'&&a!=='--colour'&&all[i-1]!=='--colour');fs.mkdirSync(OUT,{recursive:true});
// --hat: 420 px figures (465 px tall) in 660 x 660 cells, 175 px above each figure (about one head: a witch's hat)
const SIZE=HAT?420:620,CELL_W=660,CELL_H=HAT?660:700,TOP=HAT?175:undefined;
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:2400,height:(CELL_H+40)*Math.max(1,LIST.length)}});
  await L.install(page,{});
  // an empty pulled-on hat: nothing drawn or hidden, only the style's under-hat hair (avatar-foundation.js hatLayer)
  if(UNDER)await page.evaluate(()=>{const blank='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==',v={src:blank,rect:[0,0,1,1],hide:{src:blank,rect:[0,0,1,1]}};
    const views={front:v,right:v,back:v};window.QPHatArt=Object.freeze({...window.QPHatArt,_under:{kind:'full',views:{m:views,f:views}}});});
  const rows=LIST.map(s=>s.split(':')),views=['front','right','back'];
  const cells=rows.flatMap(([sex,hair])=>views.map(view=>({av:{sex,sk:0,hair:hair+':'+CI,expression:'bright:0',...(UNDER?{hat:'_under:1'}:{})},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:SIZE})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:3,cellW:CELL_W,cellH:CELL_H,top:TOP,labelW:0,bg:'#ffffff'});
  const boxes=await page.evaluate(n=>[...document.querySelectorAll('svg.qp-foundation-avatar')].filter(s=>s.getBoundingClientRect().width>0).slice(-n).map(s=>{const r=s.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};}),cells.length);
  const img=await L.capture(page,g);
  // one row of a hat kit is padded to 3:2 (white above and below), the shape of ChatGPT's landscape sheets
  const padTop=HAT&&rows.length===1?Math.round((g.width*2/3-g.height)/2):0,outH=g.height+2*padTop,png={width:g.width,height:outH,data:Buffer.alloc(g.width*outH*4,255)};
  for(let y=0;y<g.height;y++)img.data.copy(png.data,(y+padTop)*g.width*4,y*img.width*4,y*img.width*4+g.width*4);
  fs.writeFileSync(path.join(OUT,'base.png'),H.png.encode(png));
  boxes.forEach(b=>{b.y+=padTop;});
  fs.writeFileSync(path.join(OUT,'base.json'),JSON.stringify({rows:rows.map(r=>r.join(':')),views,boxes,size:SIZE,grid:{width:g.width,height:outH},padTop,underHat:UNDER}));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
