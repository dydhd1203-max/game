'use strict';
// Exercise the source-pixel flood separately, then compare the actual loader
// with/without its call. No real Firebase account or original PNG is written.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(root,'검증/후드-개구부'));
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const source=fs.readFileSync(path.join(root,'avatar-clothes.js'),'utf8');
const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/sd-hood.png'))).digest('hex');
const originalHash=hash();fs.mkdirSync(out,{recursive:true});
const flood=vm.runInNewContext('('+source.slice(source.indexOf('  function openHoodSleeves('),source.indexOf('  function extract('))+')');
const w=200,h=120,sx=163,sy=640,at=(x,y)=>((y-sy)*w+x-sx)*4;
function blue(d,x,y){d.set([30,40,100,255],at(x,y));}
{
  const d=new Uint8ClampedArray(w*h*4);blue(d,213,682);blue(d,214,683);
  d.set([240,222,181,255],at(214,682));blue(d,215,682);
  flood(d,w,h,sx,sy);
  assert.equal(d[at(213,682)+3],0,'Crop offset maps the original seed');
  assert.equal(d[at(214,683)+3],255,'A diagonal alone must not connect');
  assert.deepEqual([...d.slice(at(214,682),at(214,682)+4)],[240,222,181,255],'Cream rim is preserved');
  assert.equal(d[at(215,682)+3],255,'Disconnected blue stays opaque');
  const line=new Uint8ClampedArray(w*h*4);for(let x=183;x<=213;x++)blue(line,x,682);
  flood(line,w,h,sx,sy);assert.equal(line[at(183,682)+3],255,'Flood stops at its source-space bounds');assert.equal(line[at(184,682)+3],0);
}
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  const context=await browser.newContext({viewport:{width:1550,height:1000}});
  await context.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated demo */',contentType:'text/javascript'}));
  for(const host of ['**/*firebaseio.com/**','**/*firebasedatabase.app/**','**/firestore.googleapis.com/**'])await context.route(host,r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let before=true;
  const call='openHoodSleeves(pixels.data,sw,sh,sx,sy);';assert(source.includes(call));
  await page.route('**/avatar-clothes.js',r=>r.fulfill({body:before?source.replace(call,'void 0;'):source,contentType:'text/javascript'}));
  async function load(){await page.goto(new URL('?demo=1&session=hood-aperture-'+Date.now(),base).href);await page.waitForFunction(()=>QPClothes.atlas.ready&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady);}
  async function sprite(){return page.evaluate(()=>{const e=document.createElement('div');e.innerHTML='<svg>'+QPClothes.render('top','hood','#ff86ad','f')+'</svg>';return{url:e.querySelector('image').getAttribute('href'),info:QPClothes.inspect('top','hood','f')};});}
  await load();const baseline=await sprite();before=false;await load();const final=await sprite();
  assert.deepEqual(final.info.sourceRect,[163,114,1210,803]);assert.deepEqual(final.info.sourceRect,baseline.info.sourceRect);
  const result=await page.evaluate(async({baseline,final})=>{
    async function pixels(url){const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return{data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width};}
    const [old,now,original]=await Promise.all([pixels(baseline.url),pixels(final.url),pixels('assets/sd-hood.png')]);
    const regions=[[184,647,316,747],[1223,647,1357,747]],removed=[0,0],blueLeft=[0,0];let outside=0,rimLoss=0,rimCompared=0;
    for(let y=0;y<final.info.height;y++)for(let x=0;x<final.info.width;x++){
      const X=x+163,Y=y+114,i=(y*now.width+x)*4,j=(Y*original.width+X)*4;
      const region=regions.findIndex(([a,b,c,d])=>X>=a&&X<=c&&Y>=b&&Y<=d);
      if(old.data[i+3]!==now.data[i+3]){if(region<0)outside++;else removed[region]++;}
      if(region<0)continue;
      const r=original.data[j],g=original.data[j+1],b=original.data[j+2],a=original.data[j+3];
      const blue=a>8&&b>40&&b>r*1.25&&b>g*1.25;
      if(blue&&now.data[i+3]>8)blueLeft[region]++;
      if(!blue&&old.data[i+3]>248){rimCompared++;if(now.data[i+3]!==old.data[i+3])rimLoss++;}
    }
    const seeds=[[213,682],[247,704],[280,725],[1313,682],[1279,704],[1246,725]].map(([x,y])=>now.data[((y-114)*now.width+x-163)*4+3]);
    return{removed,blueLeft,outside,rimLoss,rimCompared,seeds};
  },{baseline,final});
  assert(result.removed.every(n=>n>2500),'Both opaque oval interiors must open completely');
  assert.deepEqual(result.blueLeft,[0,0]);assert.equal(result.outside,0);assert.equal(result.rimLoss,0);assert(result.rimCompared>1000);assert(result.seeds.every(a=>a===0));
  await page.evaluate(()=>{
    const av={...QPGame.getMe().av,sex:'f',hair:'bob:1',top:'hood:7',bottom:'shorts:5',shoes:'sneaker:8',outfit:'',hat:'',glass:'',ear:'',neck:'',face:'',back:'',pet:'',effect:''};QPGame.go('login');
    document.head.insertAdjacentHTML('beforeend','<style>html,body{height:auto!important;overflow:visible!important;background:#fff9ef;display:block!important}article{display:flex;align-items:center;flex-direction:column;padding:12px;border:1px solid #ccbda9}.qp-illustrated-avatar *{animation:none!important}</style>');
    document.body.innerHTML='<main style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px"></main>';
    for(const sk of [0,4])for(const [id,pose]of [['front',null],['walk',{action:'walk',phase:.25,direction:'front'}],['wave',{action:'idle',direction:'front',gesture:'wave',gestureProgress:.43}],['sit',{action:'floor-sit',seatMode:'floor',direction:'front'}],['side',{action:'walk',direction:'right',phase:.25}],['back',{action:'floor-sit',seatMode:'floor',direction:'back'}]]){
      const card=document.createElement('article');card.innerHTML='<b>후드 · '+sk+' · '+id+'</b>'+QPAvatar.render({...av,sk},336,3)+QPAvatar.render({...av,sk},96,3);document.querySelector('main').append(card);
      if(pose)card.querySelectorAll('svg.qp-illustrated-avatar').forEach(s=>QPAvatarPose.apply(s,{grounded:true,now:2000,...pose}));
    }
  });
  await page.screenshot({path:path.join(out,'hood-light-dark-motion.png'),fullPage:true});
  assert.equal(hash(),originalHash);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({success:true,originalHash,sourceRect:final.info.sourceRect,...result,errors},null,2));
  console.log(JSON.stringify({success:true,...result,out}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
