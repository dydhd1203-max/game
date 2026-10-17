'use strict';
// Hair conversion H4: where the reference body (no garments, idle) covers the head frame, per sex and
// view, so build-heads.py does not erase old neck paint where nothing would be left behind it (an
// enclosed hole between the hair and the body's neck). Read from the running page; nothing saved there.
//   node tools/hair/export-body-cover.cjs [OUTDIR]       (about 30 s; OUTDIR as export-old-heads.cjs, needs its old-heads.json)
// writes OUTDIR/body-<sex>-<front|profile|back>.png: the head frame of old-heads.json (12 px per head unit),
// alpha 255 where the body is painted (any pixel not at least half background), 0 elsewhere.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..','..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'검증','머리','옛머리'));
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const SIZE=840,VIEWS=[['front','front'],['profile','right'],['back','back']];
const frames={};for(const h of JSON.parse(fs.readFileSync(path.join(OUT,'old-heads.json'),'utf8')).heads)frames[h.view]=h.frame;
function headCtm(){return [...document.querySelectorAll('#fg-host .fg-cell')].map(cell=>{const svg=cell.querySelector('svg.qp-foundation-avatar');
  const view=[...svg.querySelectorAll('[data-foundation-head-view]')].find(v=>getComputedStyle(v).display!=='none'&&v.getBoundingClientRect().width>0)?.dataset.foundationHeadView||'front';
  const m=svg.querySelector('[data-foundation-head-paint="'+view+'"]').getScreenCTM();return[m.a,m.b,m.c,m.d,m.e+scrollX,m.f+scrollY];});}
(async()=>{
  const tree=H.fsTree(ROOT),server=await H.serve(tree),browser=await H.launch({args:H.RASTER_ARGS}),rep={errors:[]};
  try{
    const {page}=await L.openRuntime(browser,server.base,rep,{viewport:{width:2800,height:2000}});await L.install(page,{});
    const list=['f','m'].flatMap(sex=>VIEWS.map(([view,dir])=>({sex,view,dir})));
    const cells=list.map(({sex,dir})=>({av:{sex,sk:0,hair:'short:1',expression:'bright:0',foundationOutfit:'body'},state:{action:'idle',direction:dir,time:0,reducedMotion:true},size:SIZE}));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:3,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.12),bg:'#ff00ff',labelW:0});
    const ctm=await page.evaluate(headCtm);
    await page.addStyleTag({content:'[data-foundation-head-paint],[data-foundation-back-hair],[data-foundation-head-view]{display:none!important}'});
    const img=await L.capture(page,g),see=p=>img.data[p*4]>200&&img.data[p*4+1]<128&&img.data[p*4+2]>200;
    list.forEach(({sex,view},i)=>{const f=frames[view],m=ctm[i],W=f.w*f.px,Hh=f.h*f.px,[cx,cy,cw,ch]=g.rects[i],out={width:W,height:Hh,data:Buffer.alloc(W*Hh*4)};let n=0;
      for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const u=f.x+(x+.5)/f.px,v=f.y+(y+.5)/f.px,X=Math.floor(m[0]*u+m[2]*v+m[4]),Y=Math.floor(m[1]*u+m[3]*v+m[5]);
        if(X<cx||Y<cy||X>=cx+cw||Y>=cy+ch||see(Y*img.width+X))continue;const d=(y*W+x)*4;out.data[d]=out.data[d+1]=out.data[d+2]=out.data[d+3]=255;n++;}
      fs.writeFileSync(path.join(OUT,'body-'+sex+'-'+view+'.png'),H.png.encode(out));console.log('body-'+sex+'-'+view+'.png '+W+'x'+Hh+', '+n+' px covered, '+(Math.hypot(m[0],m[1])).toFixed(1)+' screen px per unit');});
    if(rep.errors.length)throw Error(rep.errors.join('\n'));
  }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
