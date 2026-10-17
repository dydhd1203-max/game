'use strict';
// Hair conversion H2, step 0: what today's renderer decides for every pixel of the 72 head
// paintings (24 styles x front/profile/back), read from the running page, so the new head
// layers start from exactly what students see (3단계-계획.txt 'hair' 1: aliases follow
// today's renderer). avatar-pixel.js and avatar-direction.js are not changed on disk: the
// local server serves copies that only add a read-only window.__qpxProbe / __qpdProbe.
//   node tools/hair/export-old-heads.cjs OUTDIR      (about 1 minute)
// writes per head OUTDIR/<sex>-<shape>-<view>-src.png (the source as the runtime reads it:
// front the 384 px grid, profile/back the 3 px padded crop), -cls.png (R class: 0 empty,
// 1 hair (dyed), 2 skin (tinted), 3 fixed (eyes, mouth, ink kept as painted); G mask bits,
// see BITS), -old.png (the runtime's own painting at OLD_HAIR/OLD_SKIN, the frame the
// foundation draws), blink covers in source colours (front -eye-<left|right><full|half>.png on
// the 384 grid, profile -patchSrc.png on the crop), plus OUTDIR/old-heads.json (geometry, eye boxes, neck cuts, frames).
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..','..'),OUT=path.resolve(process.argv[2]||path.join(ROOT,'검증','머리','옛머리'));
const L=require(ROOT+'/tools/foundation-garment-lib.cjs'),H=L.H;
const BITS={front:{faceMask:1,skinFringe:2,nearFace:4,featureMask:8,stray:16,eyeBox:32,iris:64},profile:{faceMask:1,earMask:2,nearFace:4,inEye:8,neckSkin:16,iris:32},back:{}};
fs.mkdirSync(OUT,{recursive:true});
const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'qp-heads-'));
function probe(file,marker,expose){
  const src=fs.readFileSync(path.join(ROOT,file),'utf8');if(src.split(marker).length!==2)throw Error(file+': marker not found once: '+marker);
  const out=path.join(tmp,path.basename(file));fs.writeFileSync(out,src.replace(marker,expose+marker));return out;
}
const overlay={
  'avatar-pixel.js':probe('avatar-pixel.js','window.QPAvatar={','window.__qpxProbe={sourceHeads,strayHair,skinZoneAt,HEAD_HINTS,HEAD_GRID,HEAD_HEIGHT,HEAD_MARGIN,normalizedHead};'),
  'avatar-direction.js':probe('avatar-direction.js','window.QPAvatarDirection=Object.freeze(','window.__qpdProbe={frames,backFrames,neckCuts,sheets,backSheets,DIR_MARGIN,SIZE,HEIGHT,hair,painting,backPainting,preparePatch};'),
};
function page_export(){
  const P=window.__qpxProbe,D=window.__qpdProbe,hairCol=PAL.hair[1][0],skinCol=PAL.skin[0][0];
  const hairColour=(r,g,b)=>r>g*1.025&&g>b*.98&&r-g<117&&g-b<83&&r>24;
  const png=(w,h,fill)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);fill(im.data);x.putImageData(im,0,0);return c.toDataURL('image/png');};
  const copy=(w,h,src)=>png(w,h,d=>d.set(src));
  const out={hairColour:hairCol,skinColour:skinCol,heads:[]};
  for(const sex of['f','m'])for(let tile=0;tile<12;tile++){
    const shape=D.hair[sex][tile];
    // front: avatar-pixel.js normalizedHead
    {const o=P.sourceHeads.get(sex)[tile],G=P.HEAD_GRID,src=o.data,strays=P.strayHair(o);
      const cls=png(G,G,d=>{for(let p=0;p<G*G;p++){const i=p*4,r=src[i],g=src[i+1],b=src[i+2],a=src[i+3],x=p%G,y=(p-x)/G;let c=0;
        if(a){const zone=P.skinZoneAt(o,p,r,g,b),hl=strays[p];c=zone&&!hl?2:(hl||!o.featureMask[p])&&hairColour(r,g,b)?1:3;}
        const eye=o.eyes.some(e=>x>e.left&&x<e.right&&y>e.top&&y<e.bottom),iris=a&&o.eyes.some(e=>x>e.left+1&&x<e.right-1&&y>e.top+(e.bottom-e.top)*.27&&y<e.bottom-1)&&(g>r+7||b>r+9)&&r<184&&g<190&&b<190;
        d[i]=c;d[i+1]=(o.faceMask[p]?1:0)|(o.skinFringe[p]?2:0)|(o.nearFace[p]?4:0)|(o.featureMask[p]?8:0)|(strays[p]?16:0)|(eye?32:0)|(iris?64:0);d[i+3]=255;}});
      const patches={};for(const [k,pt] of Object.entries(o.eyePatches))patches[k]=png(G,G,d=>{for(let y=0;y<pt.h;y++)for(let x=0;x<pt.w;x++){const i=((pt.y+y)*G+pt.x+x)*4,j=(y*pt.w+x)*4;for(let c=0;c<4;c++)d[i+c]=pt.data[j+c];}});
      out.heads.push({sex,tile,shape,view:'front',patches,w:G,h:G,src:copy(G,G,src),cls,old:P.normalizedHead(tile,hairCol,skinCol,'bright',sex),geometry:o.geometry,
        eyes:o.eyes.map(e=>({x:e.x,y:e.y,left:e.left,right:e.right,top:e.top,bottom:e.bottom,aperture:e.aperture})),face:{left:o.face.left,top:o.face.top,right:o.face.right,bottom:o.face.bottom,cx:o.face.cx,cy:o.face.cy},
        hint:P.HEAD_HINTS[sex][tile],frame:{x:-P.HEAD_MARGIN.x,y:-P.HEAD_MARGIN.top,w:32+2*P.HEAD_MARGIN.x,h:40+P.HEAD_MARGIN.top,px:12}});}
    // profile: avatar-direction.js painting
    {const f=D.frames.get(sex)[tile],w=f.w,h=f.h,src=f.data,eye=f.eye,m=f.geometry;
      const cls=png(w,h,d=>{for(let p=0;p<w*h;p++){const i=p*4,r=src[i],g=src[i+1],b=src[i+2],a=src[i+3],x=p%w,y=(p-x)/w;
        const inEye=x>eye.left-8&&x<eye.right+8&&y>eye.top-12&&y<eye.bottom+8,wx=m.x+x*m.scale,wy=m.y+y*m.scale;
        const neckSkin=wx>13.5&&wx<18.5&&wy>25.3&&wy<29&&r>150&&g>90&&b>80&&g/r>.70&&b/g>.80;let c=0;
        if(a)c=neckSkin||f.faceMask[p]||f.earMask?.[p]||f.nearFace[p]&&r>140&&g>80&&b>90&&r>g+15&&g<b*1.08?2:!inEye&&hairColour(r,g,b)?1:3;
        const iris=a&&inEye&&(g>r+7||b>r+9)&&r<184&&g<190&&b<190;
        d[i]=c;d[i+1]=(f.faceMask[p]?1:0)|(f.earMask?.[p]?2:0)|(f.nearFace[p]?4:0)|(inEye?8:0)|(neckSkin?16:0)|(iris?32:0);d[i+3]=255;}});
      const srcPatch=D.preparePatch(f,src).toDataURL('image/png');
      const art=D.painting(sex,tile,hairCol,skinCol,'bright');
      out.heads.push({sex,tile,shape,view:'profile',w,h,src:copy(w,h,src),cls,old:art.open,patch:art.patch,patchSrc:srcPatch,geometry:m,eye:{...eye},eyeUnits:art.eye,eyeWidth:art.width,neck:f.neck,
        neckCut:D.neckCuts[sex]?.[tile]?.profile||null,frame:{x:-D.DIR_MARGIN.x,y:-D.DIR_MARGIN.top,w:32+2*D.DIR_MARGIN.x,h:40+D.DIR_MARGIN.top,px:12}});}
    // back: avatar-direction.js backPainting
    {const f=D.backFrames.get(sex)[tile],w=f.w,h=f.h,src=f.data;
      const cls=png(w,h,d=>{for(let p=0;p<w*h;p++){const i=p*4,r=src[i],g=src[i+1],b=src[i+2],a=src[i+3];let c=0;
        if(a)c=r>185&&g>113&&b>95&&g/r>.54&&b/g>.67?2:r>g*1.025&&g>b*.98&&r>24?1:3;d[i]=c;d[i+3]=255;}});
      out.heads.push({sex,tile,shape,view:'back',w,h,src:copy(w,h,src),cls,old:D.backPainting(sex,tile,hairCol,skinCol),geometry:f.geometry,anchor:f.anchor,
        neckCut:D.neckCuts[sex]?.[tile]?.back||null,frame:{x:-D.DIR_MARGIN.x,y:-D.DIR_MARGIN.top,w:32+2*D.DIR_MARGIN.x,h:40+D.DIR_MARGIN.top,px:12}});}
  }
  return out;
}
(async()=>{
  const server=await H.serve(H.fsTree(ROOT,overlay));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  try{
    const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:800,height:600}});
    await page.waitForFunction(()=>window.__qpxProbe&&window.__qpdProbe&&window.QPAvatarDirection.atlas.ready&&window.QPAvatarDirection.atlas.backReady,null,{timeout:120000});
    const res=await page.evaluate(page_export);
    const meta={about:'today\'s head decisions (avatar-pixel.js, avatar-direction.js), tools/hair/export-old-heads.cjs; not committed',classes:{0:'empty',1:'hair',2:'skin',3:'fixed'},bits:BITS,hairColour:res.hairColour,skinColour:res.skinColour,heads:[]};
    const dec=u=>Buffer.from(u.split(',')[1],'base64');
    for(const h of res.heads){const base=`${h.sex}-${h.shape}-${h.view}`;
      for(const k of['src','cls','old','patch','patchSrc'])if(h[k]){fs.writeFileSync(path.join(OUT,`${base}-${k}.png`),dec(h[k]));delete h[k];}
      if(h.patches){for(const [k,u] of Object.entries(h.patches))fs.writeFileSync(path.join(OUT,`${base}-eye-${k}.png`),dec(u));h.patches=Object.keys(h.patches);}
      meta.heads.push({...h,base});}
    fs.writeFileSync(path.join(OUT,'old-heads.json'),JSON.stringify(meta,null,1));
    console.log('wrote',meta.heads.length,'heads to',OUT);
    if(report.errors.length){console.error(report.errors.join('\n'));process.exitCode=1;}
  }finally{await browser.close();await server.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
