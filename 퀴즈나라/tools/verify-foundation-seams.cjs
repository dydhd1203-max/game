'use strict';
// Regression for the user's detached shoulder screenshot. Test the rendered
// garment alone: body skin underneath must not make a missing seam pass.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준봉제선');
fs.mkdirSync(out,{recursive:true});let browser;const report={success:false,errors:[],productionFirebase:false};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});const p=await browser.newPage({viewport:{width:1366,height:950}});
 await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */'}));await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 report.seams=await p.evaluate(async()=>{
  const api=QPFoundationStudio.api,w=document.getElementById('runtime').contentWindow,atlas=w.QPFoundationOutfit.atlas,host=document.createElement('div');document.body.append(host);
  let samples=0,attachmentPixels=0,clothPixels=0;const controls=[];
  async function raster(svg,mode='sleeve',bad=false){
   const clone=svg.cloneNode(true);for(const e of clone.querySelectorAll('[data-foundation-head],.qpx-contact-shadow,[data-foundation-bones],[data-foundation-skin-paint]'))e.remove();
   for(const e of clone.querySelectorAll('path'))if(!e.closest('defs'))e.remove();
   for(const e of clone.querySelectorAll('[data-outfit-part]'))if(e.dataset.outfitPart!=='sleeve-1'&&!(mode==='cloth'&&e.dataset.outfitPart==='shirt-torso'))e.remove();
   if(bad){const image=clone.querySelector('[data-outfit-part="sleeve-1"]'),profile=api.inspect(svg).profile;image.setAttribute('href',atlas.parts[image.dataset.outfitSource].url);for(const[k,v]of Object.entries({x:profile?-1.43:-1.3,y:profile?-.42:-.7,width:profile?2.7:3.1,height:profile?2.98:3.4,transform:profile?'':'matrix(1 0 -.32 1 0 0)'}))image.setAttribute(k,v);}
   clone.setAttribute('width',640);clone.setAttribute('height',1240);const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'})),img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=640;c.height=1240;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);URL.revokeObjectURL(url);return ctx;
  }
  function pixel(ctx,svg,group,point){const p=new DOMPoint(...point).matrixTransform(svg.getCTM().inverse().multiply(group.getCTM()));return [...ctx.getImageData(Math.floor(p.x*20),Math.floor(p.y*20),1,1).data];}
  const check=(v,message,data)=>{if(!v)throw Error(message+' '+JSON.stringify(data));};
  for(const sex of ['m','f'])for(const sk of [1,4]){
   host.innerHTML=api.render({sex,sk},280);const svg=host.firstElementChild;
   for(const direction of ['front','right','left','back'])for(const phase of [0,.1,.2,.35,.5,.65,.8,.9,1]){
    api.apply(svg,{direction,gesture:'wave',gestureProgress:phase,phase:0,time:0});const rig=api.prepare(svg),pose=api.inspect(svg),shoulder=pose.arms[1].shoulder,detail={sex,sk,direction,phase},cloth=await raster(svg,'cloth'),sleeve=await raster(svg);
    // A small independently annotated patch at the actual sewn attachment,
    // behind the moving cuff, must remain on the torso side of the shoulder.
    for(const[x,y]of[[-.6,.4],[-.4,.6]]){
     const point=[shoulder[0]+x,shoulder[1]+y],a=pixel(sleeve,svg,rig.body,point);check(a[3]>=150,'Sleeve attachment left the torso seam',{...detail,x,y,a});attachmentPixels++;
    }
    // Fabric cross-sections through shoulder/upper arm: no skin-colored fill
    // can conceal a break in the green cloth between root and moving cuff.
    const group=svg.querySelector('[data-outfit-owner="arm-1"]');
    for(const y of [.6,1,1.4])for(const x of [-.25,0,.25]){const a=pixel(cloth,svg,group,[x,y]);check(a[3]>220,'Hole across shoulder/armpit fabric',{...detail,x,y,a});clothPixels++;}
    if(phase===.5&&sex==='m'&&sk===1){const bad=await raster(svg,'sleeve',true),a=pixel(bad,svg,rig.body,[shoulder[0]-.6,shoulder[1]+.4]);check(a[3]<100,'Rigid-cutout negative control was not detected',{...detail,a});controls.push({direction,detachedAttachmentAlpha:a[3]});}
    check(svg.querySelectorAll('[data-outfit-part="sleeve-1"]').length===1,'Old sleeve left behind',detail);samples++;
   }api.destroy(svg);
  }
  // Original sleeveless torso trim is a separate source defect. The corrected
  // torso has green cloth at these side seams, while the old cream stripe fails.
  const original=await w.QPAvatarImage.load(new URL('assets/sd-foundation-basic.png',location.href).href),correct=new Image();correct.src=atlas.parts.shirtFront.url;await correct.decode();
  const c=document.createElement('canvas');c.width=301;c.height=347;const ctx=c.getContext('2d',{willReadFrequently:true});
  function cream(){const d=ctx.getImageData(0,0,301,347).data;let count=0;for(let y=65;y<148;y++)for(let x=15;x<45;x++){const i=(y*301+x)*4,r=d[i],g=d[i+1],b=d[i+2];if(d[i+3]>160&&r>130&&r>g*1.13&&g>b*1.07)count++;}return count;}
  ctx.drawImage(original,61,55,301,347,0,0,301,347);const oldCream=cream();ctx.clearRect(0,0,301,347);ctx.drawImage(correct,0,0,301,347);const currentCream=cream();check(oldCream>=50&&currentCream<10,'Obsolete sleeveless piping control',{oldCream,currentCream});host.remove();
  return{samples,attachmentPixels,continuousClothPixels:clothPixels,rigidRotationNegativeControls:controls,oldArmholeTrim:{originalCreamPixels:oldCream,currentCreamPixels:currentCream},scope:'Rendered connections and source boundaries; artistic contour/folds still require manual review.'};
 });
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser?.close();});
