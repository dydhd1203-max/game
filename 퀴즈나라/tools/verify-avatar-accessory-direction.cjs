/* Actual SVG paint/state checks and full-size/native-size side accessory sheets.
 * The sheets must also be viewed: counts and hashes do not judge the artwork. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=path.resolve(process.env.QUIZ_ACCESSORY_QA_OUT||path.join(__dirname,'../검증/아바타-장신구-측면'));
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 try {
  const page=await browser.newPage({viewport:{width:1380,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated accessory illustration check */',contentType:'text/javascript'}));
  await page.goto(new URL('?demo=1&session=accessory-'+Date.now(),base).href);
  await page.waitForFunction(()=>window.QPAvatarAccessoryDirection&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady);
  const report=await page.evaluate(async()=>{
   QPGame.go('home');
   const style=document.createElement('style');style.textContent='body{height:auto!important;overflow:visible!important;display:block!important;background:#f5ead6!important;color:#4f4438!important}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}.acc-gallery{padding:18px;display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.acc-card{min-height:318px;background:#fffaf1;border:1px solid #d4c1a3;border-radius:12px;padding:10px;text-align:center}.acc-images{display:flex;justify-content:center;align-items:flex-end;gap:12px;margin:10px 0}.acc-card b{display:block;font:700 14px sans-serif}.acc-caption{font:12px sans-serif;margin-top:6px}';document.head.append(style);
   const host=document.createElement('main');document.body.replaceChildren(host);
   const clean={...QPGame.getMe().av,sex:'m',hair:'messy:1',sk:0,expression:'bright:0',top:'hood:4',bottom:'shorts:5',shoes:'sneaker:8',hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',effect:'',bg:'',frame:''};
   const make=(av,size=240)=>{const wrapper=document.createElement('div');wrapper.innerHTML=QPAvatar.render({...clean,...av},size,3);host.append(wrapper);return wrapper.firstElementChild;};
   async function hash(svg){const copy=svg.cloneNode(true),style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='*{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';copy.insertBefore(style,copy.firstChild);const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(copy));await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let value=2166136261;for(const byte of pixels)value=Math.imul(value^byte,16777619)>>>0;return value;}
   const coverage=[],restores=[],motions=[];
   for(const [category,shapes]of Object.entries(QPAvatarAccessoryDirection.catalog)){
    const actual=Object.keys(CAT[category].src);if(actual.length!==shapes.length||actual.some(shape=>!shapes.includes(shape)))throw Error('Missing catalog shapes '+category);
    for(const shape of shapes){
     const palette=PAL[CAT[category].pal],colors=palette.map((_,index)=>QPAvatarAccessoryDirection.render(category,shape+':'+index,'palette-'+category+'-'+shape+'-'+index));
     if(colors.some(paint=>!paint||!paint.includes(palette[colors.indexOf(paint)]?.[0]||'impossible')))throw Error('Missing item color '+category+'/'+shape);
     coverage.push({category,shape,colors:colors.length});
     for(const sex of['m','f']){
      const svg=make({sex,hair:sex==='m'?'messy:1':'bob:1',[category]:shape+':0',top:sex==='m'?'hood:4':'tank:7',bottom:sex==='m'?'shorts:5':'pleat:7'});
      QPAvatarPose.prepare(svg);QPAvatarPose.reset(svg);const before=await hash(svg);
      for(const direction of['right','left']){
       QPAvatarPose.apply(svg,{action:'walk',phase:.23,direction,facing:direction});
       if(svg.dataset.qpxAccessoryView!=='profile')throw Error('Accessory side not applied '+category+'/'+shape+'/'+direction);
       const own=[...svg.querySelectorAll('[data-qpx-accessory-category="'+category+'"]')].find(el=>el.closest('[data-qpx-accessory-profile]'));
       if(!own||own.dataset.qpxAccessoryShape!==shape||!own.querySelector('path,ellipse,rect'))throw Error('Missing side illustration '+category+'/'+shape);
       QPAvatarPose.apply(svg,{action:'idle',direction,facing:direction});if(svg.dataset.qpxAccessoryView!=='profile')throw Error('Stopped direction lost accessory');
       QPAvatarPose.apply(svg,{action:'floor-sit',direction,facing:direction});if(svg.dataset.qpxAccessoryView!=='profile')throw Error('Seated direction lost accessory');
       QPAvatarPose.apply(svg,{action:'idle',direction,facing:direction,gesture:'wave',gestureProgress:.35});if(svg.dataset.qpxAccessoryView!=='front')throw Error('Wave did not restore front');
       QPAvatarPose.apply(svg,{action:'idle',direction,facing:direction});if(svg.dataset.qpxAccessoryView!=='profile')throw Error('After wave side not restored');
      }
      QPAvatarPose.apply(svg,{action:'sit',seatMode:'desk',direction:'back',facing:'right'});
      QPAvatarPose.reset(svg);const after=await hash(svg);if(before!==after)throw Error('Original front changed '+category+'/'+shape+'/'+sex+' '+before+'/'+after);
      restores.push({category,shape,sex,before,after});QPAvatarPose.destroy(svg);if(svg.querySelector('[data-qpx-accessory-profile]'))throw Error('Accessory cleanup failed');svg.parentElement.remove();
     }
    }
   }
   // A complete outfit reuses all six accessory layers throughout the motion.
   const svg=make({hat:'crown:2',glass:'heart:5',ear:'long_e:1',face:'mask:6',neck:'gem:4',back:'fairy:4'}),rig=QPAvatarPose.prepare(svg);
   QPAvatarPose.apply(svg,{action:'walk',phase:.2,direction:'right',facing:'right'});const nodes=[...svg.querySelectorAll('[data-qpx-accessory-profile]')],count=svg.querySelectorAll('*').length;
   let allocations=0;const original=document.createElementNS;document.createElementNS=function(...args){allocations++;return original.apply(this,args);};
   try{for(let i=0;i<240;i++){const direction=i%48<24?'right':'left';QPAvatarPose.apply(svg,{action:i%17?'walk':'floor-sit',phase:i/40,direction,facing:direction});}}finally{document.createElementNS=original;}
   if(allocations||count!==svg.querySelectorAll('*').length||nodes.some(n=>!svg.contains(n)))throw Error('Accessory artwork was recreated during motion');
   const head=svg.querySelector('.qpx-head');head.querySelectorAll('[data-qpx-accessory-profile="head"]').forEach(n=>n.remove());
   QPAvatarPose.apply(svg,{action:'idle',direction:'left',facing:'left'});if(!head.contains(nodes.find(n=>n.dataset.qpxAccessoryProfile==='head')))throw Error('Late head artwork did not reattach same accessory nodes');
   motions.push({stableArtwork:true,lateHeadReattachment:true});QPAvatarPose.destroy(svg);svg.parentElement.remove();
   return {coverage,restores,motions,totalShapes:coverage.length,totalColorVariants:coverage.reduce((sum,c)=>sum+c.colors,0)};
  });
  for(const category of['hat','glass','face','ear','neck','back'])for(const direction of['right','left']){
   await page.evaluate(({category,direction})=>{
    const host=document.querySelector('main');host.className='acc-gallery';host.replaceChildren();
    const base={...QPGame.getMe().av,sk:0,expression:'bright:0',top:'hood:4',bottom:'shorts:5',shoes:'sneaker:8',hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',effect:'',bg:'',frame:''};
    for(const [index,shape]of QPAvatarAccessoryDirection.catalog[category].entries()){
     const sex=index%2?'f':'m',av={...base,sex,hair:sex==='m'?'messy:1':'bob:1',[category]:shape+':'+(category==='face'?1:category==='glass'?9:category==='back'?6:category==='hat'?10:0)};
     const card=document.createElement('section');card.className='acc-card';card.innerHTML='<b>'+CAT[category].src[shape][0]+' · '+shape+'</b><div class="acc-images">'+QPAvatar.render(av,224,3)+QPAvatar.render(av,76,3)+'</div><div class="acc-caption">'+sex+' · '+direction+' · 224 / 76</div>';host.append(card);for(const svg of card.querySelectorAll('svg.qp-illustrated-avatar'))QPAvatarPose.apply(svg,{action:'idle',direction,facing:direction});
    }
   },{category,direction});
   await page.screenshot({path:path.join(out,category+'-'+direction+'.png'),fullPage:true});
  }
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(report.totalShapes,71);
  fs.writeFileSync(path.join(out,'결과.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({ok:true,shapes:report.totalShapes,variants:report.totalColorVariants,frontPaintRestores:report.restores.length,out}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
