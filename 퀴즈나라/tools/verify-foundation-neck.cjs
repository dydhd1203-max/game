'use strict';
// Independent rendered probes at the chin, collar, nape and protected hair.
// Deliberately broken collars/head masks must be detected by the same probes.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준목');
fs.mkdirSync(out,{recursive:true});let browser;const report={success:false,errors:[],productionFirebase:false};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const p=await browser.newPage({viewport:{width:1366,height:950}});
 await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */'}));
 await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 // The shared direction loader now removes the old stump before the
 // foundation mask. Obtain the actual untrimmed source for failure controls;
 // removing only the outer clip would otherwise test an already-clean head.
 const sourcePage=await browser.newPage();
 await sourcePage.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
 await sourcePage.route('**/avatar-direction.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.resolve(__dirname,'../avatar-direction.js'),'utf8').replace(/trimNeck\(paint,sex,tile,'(?:profile|back)'\);/g,'/* original neck for negative control */')}));
 await sourcePage.goto(new URL('?demo=1&session=neck-original-control',base).href);
 await sourcePage.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady);
 const sourceHeads=await sourcePage.evaluate(()=>{const result={};for(const sex of ['m','f'])for(const sk of [0,1,2,3,4]){const svg=new DOMParser().parseFromString(QPAvatar.render({sex,sk,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0'},280,3),'image/svg+xml').documentElement;result[sex+'|'+svg.querySelector('.qpx-head').dataset.qpxHeadSkin]=Object.fromEntries(['profile','back'].map(v=>[v,QPAvatarDirection.headMarkup(svg,v)]));}return result;});
 await sourcePage.close();
 report.neck=await p.evaluate(async sourceHeads=>{
  const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);
  const states=[['idle',0],['walk',0],['walk',.25],['walk',.75],['run',0],['run',.25],['run',.75],['floor-sit',0],['sit',0],['jump',0],['jump',.5],['jump',.9],['wave',0],['wave',.5],['wave',.9]];
  let samples=0,continuity=0,collar=0,oldRim=0,protectedPixels=0,jawJunction=0,worst=0;const controls={};
  const alphaRim={m:{profile:[[14,28.35],[16,28.7],[17.9,28.4]],back:[[13.2,28.1],[16,28.6],[18.1,28.1]]},f:{profile:[[13.4,28.0],[15.6,28.7],[17.85,28.3]]}};
  const protectedPoints={m:{front:[[13,27.55],[16,27.4],[19,27.55]],profile:[[13.2,26.3],[13.7,26.1],[17.5,26.2]],back:[[14,26.3],[16,26.2],[17.3,26.3]]},f:{front:[[13,28],[19,28],[16,27.4]],profile:[[13,26.9],[13.5,27],[14,27],[14.5,26.6],[15,26.4]],back:[[13,28],[16,28.8],[19,28]]}};
  async function raster(svg,mode,bad=''){
   const clone=svg.cloneNode(true),pose=api.inspect(svg),y=22+pose.drop*1.593;
   clone.setAttribute('viewBox','9 '+y+' 14 12');clone.setAttribute('width','280');clone.setAttribute('height','240');
   for(const e of clone.querySelectorAll('[data-foundation-part]'))if(e.dataset.foundationPart!=='torso'||mode==='head')e.remove();
   for(const e of clone.querySelectorAll('[data-foundation-bones],.qpx-contact-shadow'))e.style.display='none';
   for(const e of clone.querySelectorAll('[data-foundation-head-view]'))if(e.style.display==='none')e.remove();
   if(mode==='body'){
    clone.querySelector('[data-foundation-head]').remove();clone.querySelector('[data-outfit-part="shirt-torso"]').remove();
   }
   if(bad==='original')for(const e of clone.querySelectorAll('[data-foundation-head-view]')){e.removeAttribute('clip-path');const source=sourceHeads[svg.dataset.qpxSex+'|'+svg.dataset.foundationSkin]?.[e.dataset.foundationHeadView];if(source)e.innerHTML=source;}
   if(bad==='short-neck'){const clip=document.createElementNS('http://www.w3.org/2000/svg','clipPath');clip.id='negative-short-neck';clip.innerHTML='<path d="M13 24H19V29.5H13Z"/>';clone.querySelector('defs').append(clip);for(const e of clone.querySelector('[data-foundation-part="torso"]').children)if(!e.matches('[data-outfit-part]'))e.setAttribute('clip-path','url(#negative-short-neck)');}
   if(bad==='rectangle')clone.querySelector('[id$="-head-only-profile"] path').setAttribute('d','M-8 -8H40V48H-8ZM12.5 26.6H18.7V31H12.5Z');
   const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'})),img=new Image();img.src=url;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=280;canvas.height=240;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);URL.revokeObjectURL(url);
   return{ctx,y};
  }
  function pixel(r,svg,group,point){const q=new DOMPoint(...point).matrixTransform(svg.getCTM().inverse().multiply(group.getCTM()));return[...r.ctx.getImageData(Math.floor((q.x-9)*20),Math.floor((q.y-r.y)*20),1,1).data];}
  const diff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),check=(v,message,detail)=>{if(!v)throw Error(message+' '+JSON.stringify(detail));};
  for(const sex of ['m','f'])for(const sk of [0,1,2,3,4]){
   host.innerHTML=api.render({sex,sk},280);const svg=host.firstElementChild;
   for(const direction of ['front','right','left','back'])for(const[action,phase]of states){
    api.apply(svg,{direction,action:action==='wave'?'idle':action,gesture:action==='wave'?'wave':'',gestureProgress:phase,phase,time:0});
    const rig=api.prepare(svg),pose=api.inspect(svg),view=pose.profile?'profile':pose.back?'back':'front',detail={sex,sk,direction,action,phase};
    const full=await raster(svg,'full'),body=await raster(svg,'body'),head=await raster(svg,'head'),original=await raster(svg,'head','original');
    if(view==='profile'){for(const q of sex==='f'?[[16.2,26.05],[16.6,26.2],[16.7,26.4]]:[[15.5,26.4],[16,26.6],[16.5,26.75]]){const a=pixel(full,svg,rig.head,q);check(a[3]>240,'Gap directly below jaw',{...detail,q,a});jawJunction++;}}
    // Three continuous columns from the underside of the head to the collar.
    for(const x of [15.7,16,16.3])for(let y=27.75;y<=29.8;y+=.2){const a=pixel(full,svg,rig.parts.torso,[x,y]);check(a[3]>245,'Chin/collar gap',{...detail,x,y,a});continuity++;}
    // Independently traced inside the new shallow profile collar: source
    // (631,116), (720,128), (807,139), before crop/scale. Old points now
    // lie on the cream collar itself and must not be classified as skin.
    const probes=view==='front'?[[15.6,29.62],[16,29.62],[16.4,29.62]]:view==='profile'?[[15.28,28.986],[16.038,29.084],[16.777,29.17]]:sex==='m'?[[15.4,28.3],[16,28.3],[16.6,28.3]]:[];
    for(const q of probes){const a=pixel(full,svg,rig.parts.torso,q),b=pixel(body,svg,rig.parts.torso,q),error=diff(a,b);check(b[3]>245&&error<=20,'Collar must expose the same neck skin',{...detail,q,a,b,error});collar++;worst=Math.max(worst,error);}
    for(const q of alphaRim[sex][view]||[]){const a=pixel(head,svg,rig.head,q);check(a[3]<12,'Old painted neck rim survives',{...detail,q,a});oldRim++;}
    for(const q of protectedPoints[sex][view]){const a=pixel(head,svg,rig.head,q),b=pixel(original,svg,rig.head,q);check(b[3]>200&&diff(a,b)<=2,'Face/hair clipped outside neck',{...detail,q,a,b});protectedPixels++;}
    if(sex==='m'&&sk===1&&direction==='front'&&action==='idle'){
     const bad=await raster(svg,'full','short-neck'),q=[16,29.62],a=pixel(bad,svg,rig.parts.torso,q);check(a[3]<200,'Old short-neck negative control not detected',a);controls.shortNeckAlpha=a[3];
    }
    if(sex==='m'&&sk===1&&direction==='right'&&action==='idle'){
     const a=pixel(original,svg,rig.head,[16,28.7]);check(a[3]>100,'Old rim negative control not detected',a);controls.oldRimAlpha=a[3];
    }
    if(sex==='f'&&sk===1&&direction==='right'&&action==='idle'){
     const bad=await raster(svg,'head','rectangle'),q=[14,27],a=pixel(bad,svg,rig.head,q),b=pixel(original,svg,rig.head,q);check(diff(a,b)>100,'Rectangular hair-cut negative control not detected',{a,b});controls.rectangularHairLoss=diff(a,b);
    }
    samples++;
   }api.destroy(svg);
  }
  host.remove();return{samples,jawJunctionPixels:jawJunction,continuousNeckPixels:continuity,collarSkinPixels:collar,removedOldRimPixels:oldRim,protectedFaceHairPixels:protectedPixels,worstCollarDifference:worst,negativeControls:controls};
 },sourceHeads);
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser?.close();});
