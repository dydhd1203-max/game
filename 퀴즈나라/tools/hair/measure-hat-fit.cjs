'use strict';
// Hat fit per hair style: the default hair (m short, f bob) rendered without a hat in two hair colours
// (idle/0, ?demo=1, nothing saved); the pixels that change are its hair. fit-hat-hair.py compares that
// hair's width under each pulled-on hat's rim with a style whose hair under a hat is drawn (QPHatHair).
//   node tools/hair/measure-hat-fit.cjs OUTDIR   writes OUTDIR/<sex>-<view>-c<n>.png and fit.json
const fs=require('node:fs'),path=require('node:path');const ROOT=path.resolve(__dirname,'..','..'),OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const DEFAULT={m:'short',f:'bob'},COLOURS=[1,8];
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:2200,height:1000}});
  await L.install(page,{});
  const meta={default:DEFAULT,colours:COLOURS,shots:[]};
  for(const sex of ['m','f'])for(const c of COLOURS){
    const views=['front','right','back'];
    const cells=views.map(view=>({av:{sex,sk:0,hair:DEFAULT[sex]+':'+c,expression:'bright:0'},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:620}));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:3,cellW:660,cellH:860,labelW:0});
    const boxes=await page.evaluate(n=>[...document.querySelectorAll('svg.qp-foundation-avatar')].filter(s=>s.getBoundingClientRect().width>0).slice(-n).map(s=>{const r=s.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};}),cells.length);
    const file=`${sex}-c${c}.png`;await L.capture(page,g,path.join(OUT,file));
    meta.shots.push({sex,colour:c,views,file,boxes});
  }
  fs.writeFileSync(path.join(OUT,'fit.json'),JSON.stringify(meta));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
