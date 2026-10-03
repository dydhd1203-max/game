'use strict';
// Rendered aperture regression and real DOM joint/ownership checks. Run only
// against the isolated studio, never a live class or Firebase session.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||path.resolve(__dirname,'../검증/기준착장');
fs.mkdirSync(out,{recursive:true});let browser;const report={success:false,errors:[],productionFirebase:false};
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});const p=await browser.newPage({viewport:{width:1366,height:950}});
 await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */'}));await p.route(/firebaseio\.com|firebasedatabase\.app/,r=>{report.errors.push('Firebase access');return r.abort();});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(new URL('avatar-standard.html',base).href);await p.waitForFunction(()=>window.QPFoundationStudio,null,{timeout:60000});
 report.cuff=await p.evaluate(async()=>{
  const w=document.getElementById('runtime').contentWindow,original=await w.QPAvatarImage.load(new URL('assets/sd-foundation-basic.png',location.href).href),part=w.QPFoundationOutfit.atlas.parts.sleeve;
  const prepared=new Image();prepared.src=part.url;await prepared.decode();
  const c=document.createElement('canvas');c.width=195;c.height=269;const ctx=c.getContext('2d');ctx.drawImage(original,1180,92,195,269,0,0,195,269);const before=ctx.getImageData(0,0,195,269).data;ctx.clearRect(0,0,195,269);ctx.drawImage(prepared,0,0);const after=ctx.getImageData(0,0,195,269).data;let rim=0,lost=0;
  // Independently annotated cream fabric patches from the original. A broad
  // cream/brown color threshold also classified the lit inner cavity as rim.
  for(const[x0,y0,x1,y1]of [[1243,300,1270,310],[1280,281,1320,298],[1330,280,1345,295],[1223,312,1233,326]])for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=((y-92)*195+x-1180)*4;if(before[i+3]>=240){rim++;if(after[i+3]<before[i+3]-4)lost++;}}
  if(rim<500||lost)throw Error('Cream cuff lost: '+JSON.stringify({rim,lost}));return{opaqueCreamPixelsCompared:rim,lost};
 });
 report.directionalCuffs=await p.evaluate(async()=>{
  const w=document.getElementById('runtime').contentWindow,atlas=w.QPFoundationOutfit.atlas,original=await w.QPAvatarImage.load(new URL('assets/sd-foundation-sleeves.png',location.href).href);
  const patches={sleeveFrontLeft:[343,384,373,398],sleeveFrontRight:[1080,385,1100,401],sleeveBackLeft:[333,911,365,925],sleeveBackRight:[1080,911,1100,928],sleeveRaisedFront:[670,170,690,190],sleeveRaisedBack:[1390,165,1410,182],sleeveRaisedProfile:[2020,158,2040,175]},results={};
  const raisedOriginal=await w.QPAvatarImage.load(new URL('assets/sd-foundation-sleeves-raised.png',location.href).href);
  for(const[key,patch]of Object.entries(patches)){
   const part=atlas.parts[key],img=new Image();img.src=part.url;await img.decode();
   const c=document.createElement('canvas');c.width=part.width;c.height=part.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(key.startsWith('sleeveRaised')?raisedOriginal:original,...part.rect,0,0,c.width,c.height);const before=ctx.getImageData(0,0,c.width,c.height).data;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0);const after=ctx.getImageData(0,0,c.width,c.height).data;let rim=0,lost=0;
   for(let y=patch[1];y<patch[3];y++)for(let x=patch[0];x<patch[2];x++){const i=((y-part.rect[1])*c.width+x-part.rect[0])*4;if(before[i+3]>240){rim++;if(after[i+3]<before[i+3]-4)lost++;}}
   if(rim<200||lost)throw Error(key+' cream cuff lost '+JSON.stringify({rim,lost}));results[key]={rim,lost};
  }
  if(new Set(['sleeve',...Object.keys(patches)].map(k=>atlas.parts[k].url)).size!==8)throw Error('Front, back, profile and raised poses need independently painted sleeves');
  return results;
 });
 report.joints=await p.evaluate(()=>{
  const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);const check=(v,m)=>{if(!v)throw Error(m);};let samples=0,anchors=0;
  const point=(group,p)=>new DOMPoint(...p).matrixTransform(group.getCTM()),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  for(const sex of ['m','f'])for(const sk of [0,1,2,3,4])for(const size of [280,96]){
   host.innerHTML=api.render({sex,sk},size)+api.render({sex,sk,foundationOutfit:'body'},size);const[dressed,bare]=host.children;
   for(const direction of ['front','left','right','back'])for(const action of ['idle','walk','run','floor-sit','sit','jump','wave'])for(let frame=0;frame<12;frame++){
    const state={direction,action:action==='wave'?'idle':action,gesture:action==='wave'?'wave':'',gestureProgress:frame/11,phase:frame/12,time:0};api.apply(dressed,state);api.apply(bare,state);
    check(JSON.stringify(api.inspect(dressed))===JSON.stringify(api.inspect(bare)),'clothing changed the fixed body pose');
    check(dressed.querySelectorAll('[data-outfit-part]').length===8,'torso + hip + two sleeves + two cuffs + two shoes, each once');
    check(bare.querySelectorAll('[data-outfit-part]').length===0,'body comparison must be unclothed');
    const rig=api.prepare(dressed),pose=api.inspect(dressed);for(let arm=0;arm<2;arm++){const expected=pose.profile?'sleeve':'sleeve'+(pose.back?'Back':'Front')+(arm?'Right':'Left');check(dressed.querySelector('[data-outfit-part="sleeve-'+arm+'"]').dataset.outfitSource===expected,'wrong deltoid/cuff painting for '+direction);}check(rig.pelvis.contour.style.display==='none'&&rig.underlay.style.display==='none','covered pelvis leaked in front of pants');
    for(let i=0;i<2;i++){
     for(const[name,joint]of[['arm',pose.arms[i].shoulder],['leg',pose.legs[i].root],['foot',pose.legs[i].ankle]]){
      const owner=dressed.querySelector('[data-outfit-owner="'+name+'-'+i+'"]');check(distance(point(owner,[0,0]),point(rig.body,joint))<.002,'garment disconnected from '+name);anchors++;
     }
     check(rig.legs[i].foot.style.display==='none','bare foot remains visible under sneaker');
    }
    samples++;
   }api.destroy(dressed);api.destroy(bare);
  }host.remove();return{samples,anchors,unchangedBody:true,uniqueParts:8};
 });
 report.apertures=await p.evaluate(async()=>{
  const api=QPFoundationStudio.api,host=document.createElement('div');document.body.append(host);let samples=0,worst=0;const readings=[];
  async function raster(svg,arm,skinOnly=false,blocked=false,kind='arm'){
   const clone=svg.cloneNode(true);clone.setAttribute('width','640');clone.setAttribute('height','1240');
   for(const e of clone.querySelectorAll('[data-foundation-part]'))if(e.dataset.foundationPart!==(arm?'near-':'far-')+kind)e.style.display='none';
   for(const e of clone.querySelectorAll('[data-foundation-head],[data-foundation-bones],.qpx-contact-shadow'))e.style.display='none';
   const sleeve=clone.querySelector('[data-outfit-owner="'+(kind==='arm'?'arm':'foot')+'-'+arm+'"]');if(skinOnly)sleeve.style.display='none';
   if(blocked){const oval=document.createElementNS('http://www.w3.org/2000/svg','ellipse');for(const[k,v]of Object.entries({cx:.1,cy:svg.dataset.qpxView==='profile'?2.17:2.85,rx:.65,ry:.18,fill:'#446099'}))oval.setAttribute(k,v);sleeve.append(oval);}
   const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=640;c.height=1240;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);URL.revokeObjectURL(url);return ctx;
  }
  const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  let shoeSamples=0;
  for(const sk of [1,4]){
   host.innerHTML=api.render({sex:sk===1?'m':'f',sk},280);const svg=host.firstElementChild;
   for(const direction of ['front','right','back','left'])for(const[action,wavePhase]of [...['idle','walk','run','floor-sit','jump','wave'].map(a=>[a,.5]),...[.1,.2,.35,.65,.8,.9].map(t=>['wave',t])]){
    api.apply(svg,{direction,action:action==='wave'?'idle':action,phase:.2,time:0,gesture:action==='wave'?'wave':'',gestureProgress:wavePhase});
    for(let arm=0;arm<2;arm++){
     const g=svg.querySelector('[data-outfit-owner="arm-'+arm+'"]'),matrix=svg.getCTM().inverse().multiply(g.getCTM()),expectedAlpha=255*Number(api.prepare(svg).arms[arm].parent.style.opacity||1);
     const dressed=await raster(svg,arm),skin=await raster(svg,arm,true);
     for(const localX of [-.3,.1,.5]){
      const point=new DOMPoint(localX,api.inspect(svg).profile?2.17:2.85).matrixTransform(matrix),x=Math.floor(point.x*20),y=Math.floor(point.y*20),a=[...dressed.getImageData(x,y,1,1).data],b=[...skin.getImageData(x,y,1,1).data],error=delta(a,b);
      if(b[3]<expectedAlpha-4||error>18)throw Error('Sleeve aperture must reveal skin: '+JSON.stringify({sk,direction,action,arm,localX,x,y,a,b,error}));
      worst=Math.max(worst,error);samples++;
      if(localX===.1&&direction==='front'&&action==='idle'&&arm===0){const bad=await raster(svg,arm,false,true),failure=delta([...bad.getImageData(x,y,1,1).data],b);if(failure<40)throw Error('Opaque-opening negative control did not fail');readings.push({sk,correctError:error,blockedError:failure});}
     }
     if(!(action==='floor-sit'&&direction==='back')){
      const g=svg.querySelector('[data-outfit-owner="foot-'+arm+'"]'),point=new DOMPoint(0,0).matrixTransform(svg.getCTM().inverse().multiply(g.getCTM())),x=Math.floor(point.x*20),y=Math.floor(point.y*20);
      const dressed=await raster(svg,arm,false,false,'leg'),skin=await raster(svg,arm,true,false,'leg'),a=[...dressed.getImageData(x,y,1,1).data],b=[...skin.getImageData(x,y,1,1).data];
      if(b[3]<250||delta(a,b)>18)throw Error('Shoe opening disconnected from ankle: '+JSON.stringify({sk,direction,action,arm,a,b}));shoeSamples++;
     }
    }
   }api.destroy(svg);
  }host.remove();return{renderedArmSamples:samples,worstChannelDifference:worst,shoeOpeningSamples:shoeSamples,opaqueOpeningNegativeControls:readings};
 });
 await p.locator('#outfit').uncheck();assert.equal(await p.locator('.studio [data-outfit-part]').count(),0);await p.locator('#outfit').check();assert.equal(await p.locator('.studio [data-outfit-part]').count(),32);
 await p.evaluate(()=>QPFoundationStudio.setState({action:'idle',direction:'front',phase:0}));await p.screenshot({path:path.join(out,'studio-front.png')});
 await p.evaluate(()=>QPFoundationStudio.setState({action:'floor-sit',direction:'front',phase:0}));await p.screenshot({path:path.join(out,'studio-crossleg.png')});
 assert.deepEqual(report.errors,[]);report.success=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(async error=>{report.failure=error.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.error(error);await browser?.close();process.exitCode=1;});
