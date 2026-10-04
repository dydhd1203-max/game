'use strict';
// The runtime head paintings are tested independently of torso gap filling.
// A no-trim negative uses the SAME source with only neck extraction disabled.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=process.env.QUIZ_VERIFICATION_OUTPUT||'/workspace/quiz-cloud/avatar-neck-motions';
fs.mkdirSync(out,{recursive:true});let browser;const report={success:false,realFirebase:false,errors:[],heads:[],motions:[]};
(async()=>{
 browser=await chromium.launch();
 for(const negative of [false,true]){
  const p=await browser.newPage({viewport:{width:1366,height:1000}});
  await p.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));p.on('pageerror',e=>report.errors.push(e.message));
  if(negative)await p.route('**/avatar-direction.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'avatar-direction.js'),'utf8').replace(/trimNeck\(paint,sex,tile,'(?:profile|back)'\);/g,'/* no trim: failure control */')}));
  await p.goto(new URL('?demo=1&session=neck-motion',base).href);await p.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady);
  const rows=await p.evaluate(async negative=>{
   QPGame.go('home');document.body.innerHTML='<main id="review"></main>';const host=document.getElementById('review'),rows=[];
   const rim={m:{profile:[[14,28.35],[16,28.7],[17.9,28.4]],back:[[13.2,28.1],[16,28.6],[18.1,28.1]]},f:{profile:[[13.4,28],[15.6,28.7],[17.85,28.3]]}};
   for(const sex of ['m','f'])for(const sk of [0,4])for(const view of ['profile','back']){
    host.innerHTML=QPAvatar.render({sex,sk,hair:sex==='m'?'short:1':'bob:1',top:'tee:5',bottom:'shorts:5',shoes:'sneaker:8'},280,3);const svg=host.querySelector('svg');
    const head=QPAvatarDirection.headMarkup(svg,view),im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="384" height="480" viewBox="0 0 32 40">'+head+'</svg>');await im.decode();
    const c=document.createElement('canvas');c.width=384;c.height=480;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
    const samples=(rim[sex][view]||[]).map(([x,y])=>({point:[x,y],alpha:ctx.getImageData(Math.floor(x*12),Math.floor(y*12),1,1).data[3]}));
    // All face/eye/hair pixels above the attachment must remain identical.
    const protectedPixels=ctx.getImageData(0,0,384,300).data;let hash=2166136261;for(const v of protectedPixels)hash=Math.imul(hash^v,16777619)>>>0;
    rows.push({sex,sk,view,negative,samples,protectedHash:hash});
   }return rows;
  },negative);report.heads.push(...rows);
  if(!negative){
   report.motions=await p.evaluate(()=>{
    const host=document.getElementById('review'),rows=[];document.body.style.cssText='height:auto;overflow:visible;background:#fff9ed';document.documentElement.style.cssText='height:auto;overflow:visible';host.style.cssText='display:grid;grid-template-columns:repeat(4,320px);gap:8px';
    host.replaceChildren();
    for(const sex of ['m','f'])for(const sk of [0,4])for(const [direction,action,phase] of [['right','run',.25],['right','run',.75],['back','climb',.25],['back','climb',.75]]){
     const card=document.createElement('article');card.innerHTML='<p>'+[sex,sk,direction,action,phase].join(' · ')+'</p>'+QPAvatar.render({sex,sk,hair:sex==='m'?'short:1':'bob:1',top:sex==='m'?'tee:5':'tee:3',bottom:'shorts:5',shoes:'sneaker:8'},280,3)+QPAvatar.render({sex,sk,hair:sex==='m'?'short:1':'bob:1',top:sex==='m'?'tee:5':'tee:3',bottom:'shorts:5',shoes:'sneaker:8'},120,3);host.append(card);
     for(const svg of card.querySelectorAll('svg.qp-illustrated-avatar')){
      QPAvatarPose.apply(svg,{direction,action,phase});const rig=QPAvatarPose.prepare(svg),point=(el,p)=>{const m=QPAvatarLocalTransform.relative(el,rig.body),q=new DOMPoint(...p).matrixTransform(m);return[q.x,q.y];};
      const arms=[...rig.gestureArms].map(([side,a])=>({side,visible:a.carrier.style.display!=='none',wrist:point(a.forearm,a.wrist),elbow:point(a.arm,a.elbow),shoulder:point(a.arm,a.pivot)}));
      const legs=[rig.leftLeg,rig.rightLeg].map((leg,i)=>{const x=i?18.25:13.75,shin=i?rig.rightShin:rig.leftShin,foot=i?rig.rightFoot:rig.leftFoot;return{hip:point(leg,[x,rig.waist]),knee:point(shin,[x,rig.knee]),ankle:point(foot,[x,rig.foot])};});
      rows.push({sex,sk,direction,action,phase,size:+svg.getAttribute('height'),view:svg.dataset.qpxView,arms,legs,skinPaths:rig.skinLegs.map(s=>s.outline.getAttribute('d'))});
     }
    }return rows;
   });await p.locator('#review').screenshot({path:path.join(out,'run-climb-280-120.png')});
  }await p.close();
 }
 for(const h of report.heads.filter(h=>!h.negative)){
  const bad=report.heads.find(b=>b.negative&&b.sex===h.sex&&b.sk===h.sk&&b.view===h.view);assert.equal(h.protectedHash,bad.protectedHash,'Face/hair changed outside neck');assert(h.samples.every(p=>p.alpha<12),'Old detached neck rim survives');
  if(h.samples.length)assert(bad.samples.some(p=>p.alpha>100),'No-trim failure control was not detected');
 }
 for(const row of report.motions){assert.equal(row.arms.length,2);assert(row.arms.every(a=>a.visible));assert(row.skinPaths.every(p=>p&&!/NaN|Infinity/.test(p)));for(const l of row.legs)assert([l.hip,l.knee,l.ankle].flat().every(Number.isFinite));
  if(row.action==='climb'){
   assert.equal(row.view,'back');const left=row.arms.find(a=>a.side==='left'),right=row.arms.find(a=>a.side==='right');assert(Math.abs(left.wrist[1]-right.wrist[1])>2,'Hands must alternate ladder rungs');
   const [l,r]=row.legs;assert(Math.abs(l.ankle[0]-l.hip[0])<.8&&Math.abs(r.ankle[0]-r.hip[0])<.8,'Rear knees must not splay sideways');
   assert((left.wrist[1]-right.wrist[1])*(l.ankle[1]-r.ankle[1])<0,'Opposite hand and foot must rise together');
  }
 }
 // New candidate studies and old before-images must never be runtime inputs.
 const files=require('./deployment-files.cjs');assert(files.every(f=>!/(?:avatar-reference-candidates|before-pillar|avatar-joints-2026|implementation-snapshot)/.test(f)));
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,heads:report.heads.length,motions:report.motions.length,error:report.error,out}));});
