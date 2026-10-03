'use strict';
// Visual and raster evidence for the four original tee/hood items. The old
// broad cuff test is complementary: this test measures the exposed underarm.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const output=process.env.QUIZ_VERIFICATION_OUTPUT||'/workspace/quiz-cloud/outfit/wardrobe-connections';
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const before=process.env.QUIZ_WARDROBE_BEFORE;
const fingerprints=['avatar-pixel.js','avatar-clothes.js','avatar-cloth-mesh.js','avatar-poses.js','avatar-direction.js','assets/sd-wardrobe-wave.png'];
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',file))).digest('hex');
fs.mkdirSync(output,{recursive:true});
const report={sourceHashes:Object.fromEntries(fingerprints.map(f=>[f,digest(f)])),success:false,rows:[],before:before||null,errors:[],limits:'Legacy wave faces front by design. Requested side/back wave is recorded as front, never accepted as directional wave artwork. The shared reference outfit has separate four-direction wave tests.'};
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 for(const mode of before?['before','after']:['after']){
  const p=await browser.newPage({viewport:{width:1440,height:1100}});
  await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:''}));await p.route(/firebaseio\.com|firebasedatabase\.app|firestore.googleapis.com/,r=>r.abort());
  if(mode==='before'){for(const file of['avatar-pixel.js','avatar-clothes.js','avatar-poses.js','avatar-direction.js'])await p.route('**/'+file,r=>r.fulfill({body:fs.readFileSync(path.join(before,file)),contentType:'text/javascript'}));await p.route('**/avatar-cloth-mesh.js',r=>r.fulfill({body:''}));}
  p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(new URL('?demo=1&session=wardrobe-connection-review',base).href);
  await p.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPShoes.atlas.partsReady&&(!window.QPClothMesh||QPClothMesh.atlas.ready));
  await p.evaluate(()=>{QPGame.go('home');document.body.innerHTML='<main id="review"></main>';Object.defineProperty(performance,'now',{value:()=>2000});});
  await p.addStyleTag({content:'html,body{display:block!important;overflow:visible!important;height:auto!important;background:#fffaf0!important;margin:0!important}#review{display:grid!important;grid-template-columns:repeat(4,1fr)!important;width:1400px!important;max-width:none!important;gap:10px;padding:16px;color:#304832}#review article{display:flex;flex-direction:column;align-items:center}#review h3{font:16px sans-serif;margin:12px}.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}'});
  for(const phase of[0,.08,.12,.18,.5,.85,.92,1]){
   const rows=await p.evaluate(async({phase,mode})=>{
    const host=document.getElementById('review');host.replaceChildren();const rows=[];
    async function raster(svg,selection){
     const copy=svg.cloneNode(true);if(selection)for(const e of copy.querySelectorAll('path,rect,image,circle,ellipse,polygon,line,polyline')){if(e.closest('defs'))continue;if(!e.closest(selection))e.remove();}
     copy.setAttribute('width',640);copy.setAttribute('height',1240);const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(copy));await img.decode();const c=document.createElement('canvas');c.width=640;c.height=1240;const cx=c.getContext('2d');cx.drawImage(img,0,0);return{data:cx.getImageData(0,0,640,1240).data,view:svg.viewBox.baseVal};
    }
    for(const sex of['m','f'])for(const shape of['tee','hood']){
     const item=QPGame.getCatalog().publicItems('top',sex).find(i=>i.shape===shape),av={sex,sk:sex==='m'?1:4,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',top:shape+':'+item.ci,bottom:'shorts:5',shoes:'sneaker:8'},card=document.createElement('article');card.innerHTML='<h3>'+mode+' · '+sex+' '+shape+' · wave '+phase+'</h3>'+QPAvatar.render(av,280,3)+QPAvatar.render(av,96,3);host.append(card);
     const svgs=[...card.querySelectorAll('svg.qp-illustrated-avatar')];for(const svg of svgs)QPAvatarPose.apply(svg,{direction:'front',action:'idle',gesture:'wave',gestureProgress:phase,grounded:true});
     const svg=svgs[0],rig=QPAvatarPose.prepare(svg),matrix=svg.getCTM().inverse().multiply(rig.upper.getCTM()),pixels=await raster(svg,'[data-qpx-clothes="top"],[data-qpx-wave-sleeve],[data-qpx-continuous-cloth]'),neckPixels=await raster(svg,'.qpx-neck-surface,.qpx-skin-torso'),sample=(x,y,image=pixels)=>{const p=new DOMPoint(x,y).matrixTransform(matrix),px=Math.floor((p.x-pixels.view.x)/pixels.view.width*640),py=Math.floor((p.y-pixels.view.y)/pixels.view.height*1240);return[...image.data.slice((py*640+px)*4,(py*640+px)*4+4)];};
     const grid=[];for(let y=29;y<=34.01;y+=.25){let line='';for(let x=18.5;x<=22.51;x+=.25)line+=sample(x,y)[3]>200?'#':sample(x,y)[3]>30?'+':'.';grid.push(line);}
     const seamY=shape==='tee'?30.5:sex==='m'?30.75:31,connection=[20.1,20.3,20.5,20.7,20.9].map(x=>({x,y:seamY,rgba:sample(x,seamY)}));
     const neck=(sex==='m'?[[14.25,27.9],[17.75,27.9]]:[[14.53,28.05],[17.47,28.05]]).map(([x,y])=>({x,y,rgba:sample(x,y,neckPixels)}));
     rows.push({mode,sex,shape,phase,connection,neck,requested:'front',actual:svg.dataset.qpxView||'front',sizes:svgs.map(s=>+s.getAttribute('height')),grid});
    }return rows;
   },{phase,mode});report.rows.push(...rows);
   await p.locator('#review').screenshot({path:path.join(output,mode+'-wave-'+phase+'.png')});
  }
  if(mode==='after'){
   report.directionChecks=await p.evaluate(()=>{const rows=[],host=document.getElementById('review');host.replaceChildren();for(const sex of['m','f'])for(const shape of['tee','hood'])for(const direction of['front','right','left','back']){const item=QPGame.getCatalog().publicItems('top',sex).find(i=>i.shape===shape),card=document.createElement('article');card.innerHTML='<h3>'+sex+' '+shape+' '+direction+'</h3>'+QPAvatar.render({sex,sk:sex==='m'?1:4,hair:sex==='m'?'short:1':'bob:1',top:shape+':'+item.ci,bottom:'shorts:5',shoes:'sneaker:8'},280,3);host.append(card);const svg=card.querySelector('svg');for(const action of['idle','walk','run','jump','floor-sit']){QPAvatarPose.apply(svg,{direction,action,phase:.25,grounded:action!=='jump'});rows.push({sex,shape,direction,action,actual:svg.dataset.qpxView,valid:svg.dataset.qpxView===(direction==='left'||direction==='right'?'profile':direction)});}QPAvatarPose.apply(svg,{direction,action:'idle'});}return rows;});
   await p.locator('#review').screenshot({path:path.join(output,'after-directions.png')});
  }
  await p.close();
 }
 report.connections=report.rows.filter(r=>r.mode==='after'&&[.18,.5,.85].includes(r.phase));
 assert(report.connections.every(r=>r.connection.every(p=>p.rgba[3]>200)),'Opaque shoulder-underarm strip lost');
 report.necks=report.rows.filter(r=>r.mode==='after'&&r.phase===.5);
 assert(report.necks.every(r=>r.neck.every(p=>p.rgba[3]>200)),'Jaw attachment channel is narrower than the original head opening');
 if(before){report.negativeControls=report.rows.filter(r=>r.mode==='before'&&r.phase===.5).map(r=>({sex:r.sex,shape:r.shape,underarmRejected:r.connection.some(p=>p.rgba[3]<30),neckRejected:r.neck.some(p=>p.rgba[3]<30)}));assert(report.negativeControls.every(r=>r.underarmRejected),'Old cut-out must fail the new underarm oracle');assert(report.negativeControls.filter(r=>r.sex==='m').every(r=>r.neckRejected),'Old narrow male neck must fail');}
 for(const f of fingerprints)assert.equal(digest(f),report.sourceHashes[f],'Source changed while reviewing: '+f);
 assert(report.directionChecks.every(r=>r.valid),'Actual direction mismatch');assert.equal(report.errors.length,0);report.success=true;
}catch(e){report.error=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,rows:report.rows.length,error:report.error,output}));}})();
