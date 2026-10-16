'use strict';
// Hat-hair kit: the game's own figures with a hair style a pulled-on hat cannot simply cut (twin tails, a
// pony tied above the rim), front/right/back on white, as the first picture of a 'hat-hair' art request.
// Every figure is drawn at 620 px with its svg box saved, so the returned art maps back to head-native units
// like tools/hair/measure-hat-frame.cjs (?demo=1, nothing saved).
//   node tools/hair/make-hat-hair-base.cjs OUTDIR f:twin f:pony ...   writes OUTDIR/base.png and base.json
//   node tools/hair/make-hat-hair-base.cjs OUTDIR --hat m:short f:bob   the hat kit's first picture: smaller figures
//        with room above each head for a tall hat (a witch's hat, a chef's hat, a halo), on a 3:2 sheet like
//        ChatGPT's landscape output (tools/hair/build-hat.py --base reads it back)
const fs=require('node:fs'),path=require('node:path');const ROOT=path.resolve(__dirname,'..','..'),OUT=process.argv[2],HAT=process.argv.includes('--hat'),LIST=process.argv.slice(3).filter(a=>a!=='--hat');fs.mkdirSync(OUT,{recursive:true});
// --hat: 420 px figures (465 px tall) in 660 x 660 cells, 175 px above each figure (about one head: a witch's hat)
const SIZE=HAT?420:620,CELL_W=660,CELL_H=HAT?660:700,TOP=HAT?175:undefined;
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:2400,height:(CELL_H+40)*Math.max(1,LIST.length)}});
  await L.install(page,{});
  const rows=LIST.map(s=>s.split(':')),views=['front','right','back'];
  const cells=rows.flatMap(([sex,hair])=>views.map(view=>({av:{sex,sk:0,hair:hair+':1',expression:'bright:0'},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:SIZE})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:3,cellW:CELL_W,cellH:CELL_H,top:TOP,labelW:0,bg:'#ffffff'});
  const boxes=await page.evaluate(n=>[...document.querySelectorAll('svg.qp-foundation-avatar')].filter(s=>s.getBoundingClientRect().width>0).slice(-n).map(s=>{const r=s.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};}),cells.length);
  await L.capture(page,g,path.join(OUT,'base.png'));
  fs.writeFileSync(path.join(OUT,'base.json'),JSON.stringify({rows:rows.map(r=>r.join(':')),views,boxes,size:SIZE,grid:{width:g.width,height:g.height}}));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
