'use strict';
// Hat pipeline: where each view's head shows skin (ears, face, nape) for every hair style, so a
// pulled-on hat hides only hair beside its rim (tools/hair/build-hat.py hide_mask), never an ear.
// Every hair style of a sex is rendered at 620 px (idle/0, ?demo=1, nothing saved) in two skin tones;
// the pixels that change with the skin tone are skin.
//   node tools/hair/measure-head-skin.cjs OUTDIR   writes OUTDIR/<sex>-<view>-sk<n>.png and skin.json
// then python3 -B tools/hair/fit-head-skin.py OUTDIR  writes tools/fixtures/head-skin-<sex>-<view>.png (+ head-skin.json)
const fs=require('node:fs'),path=require('node:path');const ROOT=path.resolve(__dirname,'..','..'),OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const HAIR={f:['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'],m:['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf']};
const TONES=[0,4];
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:4000,height:1400}});
  await L.install(page,{});
  const meta={hair:HAIR,tones:TONES,shots:[]};
  for(const sex of ['m','f'])for(const view of ['front','right','back'])for(const sk of TONES){
    const cells=HAIR[sex].map(h=>({av:{sex,sk,hair:h+':1',expression:'bright:0'},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:620}));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:6,cellW:660,cellH:680,labelW:0});
    const boxes=await page.evaluate(n=>[...document.querySelectorAll('svg.qp-foundation-avatar')].filter(s=>s.getBoundingClientRect().width>0).slice(-n).map(s=>{const r=s.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};}),cells.length);
    const file=`${sex}-${view}-sk${sk}.png`;await L.capture(page,g,path.join(OUT,file));
    meta.shots.push({sex,view,sk,file,boxes});
  }
  fs.writeFileSync(path.join(OUT,'skin.json'),JSON.stringify(meta));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
