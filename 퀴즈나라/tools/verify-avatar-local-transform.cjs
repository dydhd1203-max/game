'use strict';
// Independent native SVG matrix oracle. Includes cached-transform invalidation,
// CSS/nested-viewport fallbacks and actual dressed rigs; not an art-quality pass.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/관절좌표');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true});
 try{
 const page=await browser.newPage();await page.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:''}));
 const url=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');url.searchParams.set('demo','1');url.searchParams.set('session','matrix-'+Date.now());await page.goto(url.href);
 await page.waitForFunction(()=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothMesh.atlas.ready);
 const result=await page.evaluate(()=>{
  QPGame.go('school');performance.now=()=>4100;
  const style=document.createElement('style');style.textContent='*{animation:none!important;transition:none!important}';document.head.append(style);
  const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0';document.body.append(host);
  const keys=['a','b','c','d','e','f'],rows=[],base=QPGame.getMe().av,catalog=QPGame.getCatalog();
  const error=(a,b)=>Math.max(...keys.map(k=>Math.abs(a[k]-b[k])));
  const measure=(from,to)=>error(QPAvatarLocalTransform.relative(from,to),to.getCTM().inverse().multiply(from.getCTM()));
  host.innerHTML='<svg width="320" height="560" viewBox="0 0 32 56"><g id="a" transform="translate(3 4) rotate(12) scale(-1 1.35)"><g id="b" transform="translate(4 2)"/></g><g id="c" transform="rotate(-9 16 28)"/><svg id="nested" x="2" y="3" width="9" height="13" viewBox="0 0 32 56"><g id="inside" transform="scale(2)"/></svg></svg>';
  const a=host.querySelector('#a'),b=host.querySelector('#b'),c=host.querySelector('#c');
  const synthetic=[measure(b,c),measure(a,b),measure(b,b)];
  b.setAttribute('transform','rotate(38 1 2) translate(3 -7)');synthetic.push(measure(b,c));
  b.style.transform='translate(2px,3px)';synthetic.push(measure(b,c));
  synthetic.push(measure(host.querySelector('#inside'),c));
  const broken=QPAvatarLocalTransform.relative(a,c);broken.e+=1;
  const rejectsWrongMatrix=error(broken,c.getCTM().inverse().multiply(a.getCTM()))>.9;
  for(const sex of ['m','f'])for(const shape of ['tee','hood'])for(const direction of ['front','right','left','back'])for(const action of ['idle','walk','run','floor-sit','wave']){
   const item=catalog.publicItems('top',sex).find(x=>x.shape===shape);
   host.innerHTML=QPAvatar.render({...base,sex,sk:sex==='m'?0:4,hair:sex==='m'?'short:1':'bob:1',top:shape+':'+item.ci,bottom:sex==='m'?'jeans:5':'shorts:5',outfit:'',bg:'',frame:'',pet:'',effect:''},280,3);
   const svg=host.firstElementChild;let maximum=0;
   for(const phase of [.2,.5,.8]){
    const state={action:action==='wave'?'idle':action,gesture:action==='wave'?'wave':'',gestureProgress:phase,phase,direction,facing:direction==='left'?'left':'right',grounded:true,seatMode:action==='floor-sit'?'floor':undefined};
    for(let i=0;i<2;i++)QPAvatarPose.apply(svg,state);
    const rig=QPAvatarPose.prepare(svg);
    for(const node of [rig.upper,rig.left,rig.right,rig.leftShin,rig.rightShin,rig.headPose,...[...rig.gestureArms.values()].flatMap(a=>[a.carrier,a.arm,a.forearm])])maximum=Math.max(maximum,measure(node,rig.idle));
   }
   rows.push({sex,shape,direction,action,maximum});QPAvatarPose.destroy(svg);
  }
  return {synthetic,rejectsWrongMatrix,rows};
 });
 fs.writeFileSync(path.join(out,'matrices.json'),JSON.stringify(result,null,2));
 assert(result.rejectsWrongMatrix);assert(result.synthetic.every(e=>e<.0002));assert.equal(result.rows.length,80);assert(result.rows.every(r=>r.maximum<.0002));
 console.log('PASS 80 dressed combinations × 3 phases, six independent transform cases and a 1-unit negative control.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
