/* Back-view artwork, outfit continuity and reversible direction regressions. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=path.resolve(__dirname,'../검증/아바타-앉기-뒤');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
 try{
  const page=await browser.newPage({viewport:{width:1540,height:1090}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated back artwork QA */',contentType:'text/javascript'}));
  await page.goto(new URL('?demo=1&session=back-'+Date.now(),base).href);
  await page.waitForFunction(()=>QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady);
  const report=await page.evaluate(async()=>{
   QPGame.go('school');
   document.head.insertAdjacentHTML('beforeend','<style>body{height:auto!important;overflow:visible!important;display:block!important;background:#f9f0df!important;color:#57432e}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}</style>');
   const host=document.createElement('main');document.body.replaceChildren(host);
   const clean={...QPGame.getMe().av,sex:'m',hair:'messy:1',sk:0,top:'hood:7',bottom:'jeans:5',shoes:'sneaker:8',pet:'',hat:'',glass:'',face:'',ear:'',neck:'',back:'',effect:'',bg:'',frame:''};
   const make=(av,size=224)=>{const div=document.createElement('div');div.innerHTML=QPAvatar.render({...clean,...av},size,3);host.append(div);return div.firstElementChild;};
   const paint=async svg=>{const clone=svg.cloneNode(true),style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='*{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';clone.insertBefore(style,clone.firstChild);const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;for(const v of data)hash=Math.imul(hash^v,16777619)>>>0;return hash;};
   const cases=[],sources=[];
   for(const sex of['m','f'])for(const hair of QPAvatar.atlas.styleOrder[sex]){
    const svg=make({sex,hair:hair+':1'},88);QPAvatarPose.prepare(svg);const before=await paint(svg);
    QPAvatarPose.apply(svg,{action:'sit',direction:'back',facing:'right',grounded:true});
    const original=svg.querySelector('.qpx-hair'),head=svg.querySelector('[data-qpx-back-head]'),image=head.querySelector('image[data-qpx-back-hair]');
    cases.push({sex,hair,view:svg.dataset.qpxView,facing:svg.dataset.qpxViewFacing,eyes:+svg.dataset.qpxBackEyeCount,frontVisibility:getComputedStyle(original).visibility,backDisplay:getComputedStyle(head).display,source:!!image?.getAttribute('href')});sources.push(image.getAttribute('href'));
    QPAvatarPose.reset(svg);if(before!==await paint(svg))throw Error('Back reset changed original artwork '+sex+'/'+hair);
    QPAvatarPose.apply(svg,{action:'walk',direction:'left',facing:'left',phase:.25});if(svg.dataset.qpxView!=='profile')throw Error('Back to profile failed');
    QPAvatarPose.apply(svg,{action:'sit',direction:'back',facing:'right',grounded:true});
    QPAvatarPose.apply(svg,{action:'idle',direction:'front'});if(svg.dataset.qpxView!=='front'||getComputedStyle(original).visibility!=='visible')throw Error('Back to front failed');
    QPAvatarPose.destroy(svg);svg.parentElement.remove();
   }
   const performanceSvg=make({}),count=performanceSvg.querySelectorAll('*').length;QPAvatarPose.apply(performanceSvg,{action:'sit',direction:'back'});const mounted=performanceSvg.querySelectorAll('*').length,normalized=QPAvatarDirection.atlas.backNormalizationCount;for(let i=0;i<240;i++)QPAvatarPose.apply(performanceSvg,{action:'sit',direction:'back',phase:i/60});const performance={frames:240,nodeCountChanged:performanceSvg.querySelectorAll('*').length-mounted,normalizationChanged:QPAvatarDirection.atlas.backNormalizationCount-normalized};QPAvatarPose.destroy(performanceSvg);performanceSvg.parentElement.remove();
   host.style.cssText='display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:12px';
   for(const sex of['m','f'])for(const hair of QPAvatar.atlas.styleOrder[sex]){const card=document.createElement('section');card.style.cssText='background:#fff;border-radius:12px;padding:8px;text-align:center';card.innerHTML='<b>'+sex+' · '+hair+'</b>';host.append(card);for(const size of[180,74]){const svg=make({sex,hair:hair+':1',sk:sex==='m'?4:0,top:sex==='m'?'tee:7':'hood:7'},size);card.append(svg.parentElement);QPAvatarPose.apply(svg,{action:'sit',direction:'back',facing:'right',grounded:true});}}
   return {cases,uniqueHeads:new Set(sources).size,performance};
  });
  await page.screenshot({path:path.join(out,'남녀-24헤어-뒷모습-74-180.png'),fullPage:true});
  assert.equal(report.uniqueHeads,24);assert.equal(report.cases.length,24);assert(report.cases.every(c=>c.view==='back'&&c.facing==='back'&&c.eyes===0&&c.frontVisibility==='hidden'&&c.backDisplay!=='none'&&c.source));assert.deepEqual(report.performance,{frames:240,nodeCountChanged:0,normalizationChanged:0});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'검사결과.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({heads:report.uniqueHeads,performance:report.performance,errors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
