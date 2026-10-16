'use strict';
// Hat pipeline: the six default heads (m short:1 / f bob:1 x front/right/back, idle/0) rendered at 620 px
// on a flat page, with each svg box so a screenshot pixel maps to viewBox units (?demo=1, nothing saved).
//   node tools/hair/measure-hat-frame.cjs OUTDIR      writes OUTDIR/heads.png and heads.json
// then python3 -B tools/hair/fit-hat-frame.py OUTDIR  fits the template heads and writes tools/fixtures/hat-frame.json
const fs=require('node:fs'),path=require('node:path');const ROOT=path.resolve(__dirname,'..','..'),OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:2400,height:1400}});
  await L.install(page,{});
  const keys=['m-front','m-right','m-back','f-front','f-right','f-back'];
  const cells=keys.map(k=>{const [sex,view]=k.split('-');return {av:{sex,sk:0,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0'},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:620};});
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:3,cellW:660,cellH:680,labelW:0,labels:['m','f']});
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('svg.qp-foundation-avatar')].filter(s=>s.getBoundingClientRect().width>0).slice(-6).map(s=>{const r=s.getBoundingClientRect(),vb=s.getAttribute('viewBox').split(/[ ,]+/).map(Number);s.style.overflow='visible';return {x:r.left,y:r.top,w:r.width,h:r.height,vb};}));
  await L.capture(page,g,OUT+'/heads.png');
  fs.writeFileSync(OUT+'/heads.json',JSON.stringify({keys,boxes,grid:g}));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
