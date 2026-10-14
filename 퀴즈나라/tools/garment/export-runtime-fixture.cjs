'use strict';
/* Export, ONCE, what today's runtime computes from the legacy basic outfit's
   art (avatar-foundation-outfit.js shirtSide / raisedSleeve / edgeTone /
   rowSpan, through QPFoundationOutfit.legacyMetadata) as the regression truth
   of the offline metadata (tools/garment/metadata.py, verify-pipeline.py
   --roundtrip, plan verification B):

     node tools/garment/export-runtime-fixture.cjs [--out tools/garment/fixtures/runtime-side-raised.json]

   Headless, ?demo=1&session=foundation-studio only (Firebase blocked), never
   moves a mouse. Written per sex:
     frames   the runtime's own frames the metadata is expressed in: the body
              collar row (specFor(sex).collar), the rig's resting shoulder and
              elbow per view (rigFor), and the sleeve rest angle per arm
              (sleeveTexture restAngle: front/back from shoulder→elbow,
              profile -atan2(...profileSwing));
     top      per view: cuff (u) per sleeve; front/back the raised-arm sides
              (shirtSide, record form top.underarm) and the raised sleeve
              drawings' alpha (raisedSleeve: rect, width, height, alpha>128 as
              a row-major bitmask, base64);
     bottom   per view: edgeTone, seat (front/back) and sideSeat with span (profile).
   The output is canonical JSON (sorted keys, numbers as the runtime made them),
   so a rerun on the same tree gives the same bytes. */
const fs=require('node:fs'),path=require('node:path');
const H=require('../verify-harness.cjs');
const ROOT=path.resolve(__dirname,'..','..');
const a=H.args(),out=path.resolve(ROOT,a.out&&a.out!==true?a.out:'tools/garment/fixtures/runtime-side-raised.json');

function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonical(v[k]);return o;}return v;}
function pretty(v,indent=0){
  const flat=JSON.stringify(v);
  if(v===null||typeof v!=='object'||(Array.isArray(v)&&!flat.includes('{')&&flat.length<=110)||flat.length<=90)return flat;
  const pad=' '.repeat(indent),inner=' '.repeat(indent+1);
  if(Array.isArray(v))return'[\n'+v.map(x=>inner+pretty(x,indent+1)).join(',\n')+'\n'+pad+']';
  return'{\n'+Object.keys(v).map(k=>inner+JSON.stringify(k)+':'+pretty(v[k],indent+1)).join(',\n')+'\n'+pad+'}';
}

(async()=>{
  const report={errors:[]};
  const server=await H.serve(H.fsTree(ROOT)),browser=await H.launch({args:H.RASTER_ARGS});
  try{
    const context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:1});await H.isolate(context,report);
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(new URL('index.html?demo=1&session=foundation-studio',server.base).href);
    await page.waitForFunction(()=>window.QPGame&&window.QPFoundationOutfit?.atlas.ready&&window.QPFoundationSkin?.atlas.ready,null,{timeout:120000});
    const data=await page.evaluate(()=>{
      const O=QPFoundationOutfit,A=QPAvatarFoundation,res={};
      const bits=canvas=>{const {width:w,height:h}=canvas,d=canvas.getContext('2d').getImageData(0,0,w,h).data,b=new Uint8Array(Math.ceil(w*h/8));
        for(let i=0;i<w*h;i++)if(d[i*4+3]>128)b[i>>3]|=128>>(i&7);let s='';for(const v of b)s+=String.fromCharCode(v);return btoa(s);};
      for(const sex of ['m','f']){
        const top=O.legacyMetadata('top:tee',sex),bottom=O.legacyMetadata('bottom:shorts',sex),rec=QPFoundationGarments.get('top:tee',sex).record;
        const frames={collar:A.specFor(sex).collar,views:{}};
        for(const [view,rv] of [['front','front'],['right','profile'],['back','back']]){const S=A.rigFor(sex,rv);
          frames.views[view]=rv==='profile'?{profileSwing:S.profileSwing,profileShoulder:S.profileShoulder,restAngle:[-Math.atan2(...S.profileSwing)]}
            :{shoulder:S.shoulder,elbow:S.elbow,restAngle:[0,1].map(i=>Math.atan2(S.elbow[i][1]-S.shoulder[i][1],S.elbow[i][0]-S.shoulder[i][0])-Math.PI/2)};}
        const t={},b={};
        for(const view of ['front','right','back']){const v=top.views[view],e={cuff:v.cuff};
          if(v.underarm){e.underarm=v.underarm;e.raised=v.raised.map((c,i)=>({rect:rec.sexes[sex].figures[view].top.sleeves[i].rect,width:c.width,height:c.height,alpha:bits(c)}));}
          t[view]=e;const w=bottom.views[view];b[view]={edgeTone:w.edgeTone,...(w.seat?{seat:w.seat}:{}),...(w.sideSeat?{sideSeat:w.sideSeat}:{})};}
        res[sex]={frames,top:t,bottom:b};}
      return res;});
    if(report.errors.length)throw Error('page errors: '+report.errors.join('; '));
    const doc=canonical({note:'Exported once from the runtime (tools/garment/export-runtime-fixture.cjs, QPFoundationOutfit.legacyMetadata on the legacy basic records top:tee and bottom:shorts). Regression truth for tools/garment/metadata.py (plan verification B). Do not edit; rerun the exporter.',
      source:{tool:'tools/garment/export-runtime-fixture.cjs',records:{'top:tee':'assets/sd-garment-top-tee.js','bottom:shorts':'assets/sd-garment-bottom-shorts.js'},
        runtime:['avatar-foundation-outfit.js','avatar-foundation.js'],sha256:Object.fromEntries(['avatar-foundation-outfit.js','avatar-foundation.js','assets/sd-garment-top-tee-m.png','assets/sd-garment-top-tee-f.png','assets/sd-garment-bottom-shorts-m.png','assets/sd-garment-bottom-shorts-f.png'].map(f=>[f,H.sha256(fs.readFileSync(path.join(ROOT,f)))]))},
      sexes:data});
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,pretty(doc)+'\n');
    console.log('wrote '+path.relative(ROOT,out)+' ('+fs.statSync(out).size+' bytes)');
  }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
