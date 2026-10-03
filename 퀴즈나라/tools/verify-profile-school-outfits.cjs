'use strict';
// Cross-component wearable checks use the real school controller and C keys.
// Catalogue-by-catalogue artwork/contact checks live in the avatar tools.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const output=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/측면-학교착장-2026-10-02');
const checks=[],errors=[],missing=[],screenshots=[];
const startedAt=new Date().toISOString();let browser,page,phase='startup';
fs.mkdirSync(output,{recursive:true});
for(const name of ['검증결과.json','실패결과.json'])fs.rmSync(path.join(output,name),{force:true});
async function shot(page,name){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const filename=name+'.png';await page.screenshot({path:path.join(output,filename)});screenshots.push(filename);
  // The actor container is a ground anchor; measure the actual artwork box.
  const actor=await page.locator('.sr-actor.is-me .sr-avatar>svg').boundingBox();
  if(actor){const size=page.viewportSize(),x=Math.max(0,actor.x-35),y=Math.max(0,actor.y-30);
    const clip={x,y,width:Math.min(size.width,actor.x+actor.width+35)-x,height:Math.min(size.height,actor.y+actor.height+35)-y};
    const close=name+'-실제크기.png';await page.screenshot({path:path.join(output,close),clip});screenshots.push(close);}
}
async function walkingShot(page,name,key){
  // Preserve the actual painted walking frame while releasing the key.
  // Capturing two screenshots with movement held can reach a tree boundary
  // on a busy runner and leave the next C check outside the sitting clearance.
  await page.evaluate(()=>QPGame.getPlayground().setPaused(true));
  try{await page.keyboard.up(key);await shot(page,name);}
  finally{await page.evaluate(()=>QPGame.getPlayground().setPaused(false));}
}
async function visual(page){return page.evaluate(()=>{
  const svg=document.querySelector('.sr-actor.is-me .sr-avatar>svg'),world=QPGame.getPlayground();
  return {state:world.getState(),nominalSize:Number(svg.getAttribute('height'))*56/Number(svg.getAttribute('viewBox').split(/\s+/)[3]),view:svg.dataset.qpxView,facing:svg.dataset.qpxViewFacing,
    pose:svg.dataset.qpxPose,eyes:Number(svg.dataset.qpxProfileEyeCount),
    profileImage:!!svg.querySelector('[data-qpx-profile-head="front"]>image'),
    accessoryAPI:typeof window.QPAvatarAccessoryDirection?.apply==='function',
    accessoryView:svg.dataset.qpxAccessoryView,
    backGarments:[...svg.querySelectorAll('[data-qpx-back-clothes="true"]')].map(el=>({
      category:el.dataset.qpxClothes,shape:el.dataset.clothShape,
      painted:el.querySelectorAll('path,ellipse,rect,circle').length,
      visible:getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'})),
    accessories:[...svg.querySelectorAll('[data-qpx-accessory-category]')].filter(el=>el.dataset.qpxAccessoryShape).map(el=>({
      category:el.dataset.qpxAccessoryCategory,shape:el.dataset.qpxAccessoryShape,
      painted:el.querySelectorAll('path,ellipse,rect,circle').length,
      visible:getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el.closest('[data-qpx-accessory-profile]')).display!=='none'}))};
});}
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.route('**/www.gstatic.com/firebasejs/**',route=>route.fulfill({body:'/* isolated school wardrobe QA */',contentType:'text/javascript'}));
  page=await context.newPage();page.setDefaultTimeout(18000);
  page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('response',response=>{if(response.status()>=400)missing.push(response.url());});
  const url=new URL(base);url.searchParams.set('demo','1');url.searchParams.set('session','school-profile-'+Date.now()+'-'+process.pid);url.searchParams.set('user','측면착장검수');
  await page.goto(url.href);await page.waitForFunction(()=>QPGame.getCampus()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady);
  const cases=await page.evaluate(()=>{
    const catalog=QPGame.getCatalog(),first=category=>Object.keys(catalog.CATS.find(c=>c.k===category).src)[0];
    const item=(category,shape,index=0)=>category+':'+shape+':'+index;
    const find=(category,preferred)=>preferred.find(shape=>catalog.ITEMS[item(category,shape)])||first(category);
    const hat1=find('hat',['cap']),hat2=find('hat',['flower','ribbon','beret']),hat3=find('hat',['headphone','cat','bow']);
    const base={...QPGame.getMe().av,expression:'bright:0',pet:'',effect:'',face:'',bg:'',frame:''};
    return [
      {id:'m-hood',av:{...base,sex:'m',hair:'messy:1',sk:4,top:'hood:5',bottom:'jeans:5',shoes:'boots:8',hat:hat1+':3',glass:'round:0',ear:'ring:0',neck:'cross_n:0',back:find('back',['bag','cape'])+':5'}},
      {id:'f-hanbok',av:{...base,sex:'f',hair:'bob:1',sk:0,...catalog.OUTFIT_PARTS.hanbok.f,outfit:'hanbok:7',shoes:'ballet:8',hat:hat2+':7',glass:'half:0',ear:'star_e:0',neck:'gem:0',back:find('back',['fairy','wings','bag'])+':5'}},
      {id:'f-overall',av:{...base,sex:'f',hair:'pony:1',sk:2,...catalog.OUTFIT_PARTS.overall.f,outfit:'overall:5',shoes:'wing_shoes:8',hat:hat3+':5',glass:find('glass',['sun','sport','round'])+':0',ear:'heart_e:0',neck:'choker:0',back:find('back',['bag','cape'])+':7'}}
    ];
  });
  for(const entry of cases)for(const direction of ['right','left']){
    phase=entry.id+'/'+direction;
    await page.evaluate(av=>{Object.assign(QPGame.getMe().av,av);QPGame.go('playground',{x:2789,y:796});},entry.av);
    await page.waitForFunction(()=>QPGame.getPlayground()&&document.querySelector('.sr-actor.is-me .sr-avatar>svg'));
    await page.locator('.school-room-world').focus();
    const before=await page.evaluate(()=>QPGame.getPlayground().getState());
    const key=direction==='right'?'ArrowRight':'ArrowLeft';
    await page.keyboard.down(key);await page.waitForFunction(({x,d})=>{const s=QPGame.getPlayground().getState();return s.moving&&s.direction===d&&Math.abs(s.x-x)>25;},{x:before.x,d:direction});
    await page.waitForFunction(()=>document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxView==='profile');
    await walkingShot(page,entry.id+'-'+direction+'-걷기',key);
    await page.keyboard.up(key);await page.waitForFunction(()=>!QPGame.getPlayground().getState().moving);
    const standing=await visual(page);assert(Math.abs(standing.nominalSize-96)<.01,'School outfits must use the current 96px size');assert.equal(standing.view,'profile');assert.equal(standing.facing,direction);assert.equal(standing.eyes,1);assert.equal(standing.profileImage,true);assert.equal(standing.accessoryAPI,true);assert.equal(standing.accessoryView,'profile');
    for(const category of ['hat','glass','ear','neck','back']){const accessory=standing.accessories.find(a=>a.category===category);assert(accessory&&accessory.painted>0&&accessory.visible,'The selected '+category+' must use visible, drawn profile artwork');}
    await shot(page,entry.id+'-'+direction+'-서기');
    await page.keyboard.press('KeyC');await page.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor'&&document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose==='floor-sit');
    const sitting=await visual(page);assert.equal(sitting.view,'profile');assert.equal(sitting.facing,direction);assert.equal(sitting.state.seatId,null);
    assert(Math.hypot(sitting.state.x-standing.state.x,sitting.state.y-standing.state.y)<.1,'C must preserve the walking position');
    await shot(page,entry.id+'-'+direction+'-앉기');
    await page.keyboard.press('KeyC');await page.waitForFunction(()=>QPGame.getPlayground().getState().pose==='idle'&&document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxPose==='idle');
    const returned=await visual(page);assert.equal(returned.view,'profile');assert.equal(returned.facing,direction);
    await page.keyboard.press('KeyF');
    assert.equal(await page.evaluate(()=>document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxGesture||''),'','F away from a door must preserve the resting outfit without greeting');
    await page.locator('[data-gesture="wave"]').click();await page.waitForFunction(()=>document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxGesture==='wave');
    assert.equal((await visual(page)).view,'front','The established greeting intentionally faces friends');
    await page.waitForFunction(()=>!document.querySelector('.sr-actor.is-me .sr-avatar>svg')?.dataset.qpxGesture);
    assert.equal((await visual(page)).view,'profile','The original side outfit must return after greeting');
    const at=await page.evaluate(()=>QPGame.getPlayground().getState());
    await page.keyboard.down('ArrowUp');await page.waitForFunction(y=>{const s=QPGame.getPlayground().getState();return s.moving&&s.direction==='back'&&s.y<y-20;},at.y);
    await walkingShot(page,entry.id+'-'+direction+'-뒤걷기','ArrowUp');
    await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>!QPGame.getPlayground().getState().moving);
    const backStanding=await visual(page);assert.equal(backStanding.view,'back');
    const rearCategories=entry.av.bottom?['top','bottom']:['top'];
    for(const category of rearCategories)assert(backStanding.backGarments.some(a=>a.category===category&&a.painted>0&&a.visible),'A visible rear '+category+' painting is required');
    if(!entry.av.bottom)assert(!backStanding.backGarments.some(a=>a.category==='bottom'&&a.visible),'A short-leg one-piece must not add a second pair of trousers');
    await shot(page,entry.id+'-'+direction+'-뒤서기');
    await page.keyboard.press('KeyC');await page.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor');
    const backSitting=await visual(page);assert.equal(backSitting.view,'back');assert.equal(backSitting.state.seatId,null);
    for(const category of rearCategories)assert(backSitting.backGarments.some(a=>a.category===category&&a.painted>0&&a.visible),'C must preserve the actual rear '+category+' painting');
    if(!entry.av.bottom)assert(!backSitting.backGarments.some(a=>a.category==='bottom'&&a.visible),'C must preserve the complete one-piece without duplicate trousers');
    await shot(page,entry.id+'-'+direction+'-뒤앉기');
    await page.keyboard.press('KeyC');await page.waitForFunction(()=>QPGame.getPlayground().getState().pose==='idle');
    const backAt=await page.evaluate(()=>QPGame.getPlayground().getState());
    await page.keyboard.down(key);await page.waitForFunction(({x,d})=>{const s=QPGame.getPlayground().getState();return s.moving&&s.direction===d&&Math.abs(s.x-x)>20;},{x:backAt.x,d:direction});
    await page.keyboard.up(key);await page.waitForFunction(()=>!QPGame.getPlayground().getState().moving);
    const afterBack=await visual(page);assert.equal(afterBack.view,'profile');assert.equal(afterBack.facing,direction);assert(afterBack.backGarments.every(a=>!a.visible),'Rear clothing must disappear when facing sideways');
    checks.push({id:entry.id,direction,avatar:entry.av,standing,sitting,returned,backStanding,backSitting,afterBack});console.log('PASS '+phase);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  const report={startedAt,completedAt:new Date().toISOString(),target:base,passed:checks.length,checks,errors,missing,screenshots,realFirebaseTested:false};
  fs.writeFileSync(path.join(output,'검증결과.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,errors,missing,output},null,2));
  await browser.close();
})().catch(async error=>{let current;try{current={...await visual(page),notice:await page.locator('.sr-notice').innerText()};}catch(e){current={captureError:e.message};}fs.writeFileSync(path.join(output,'실패결과.json'),JSON.stringify({startedAt,failedAt:new Date().toISOString(),phase,error:error.stack,current,checks,errors,missing},null,2)+'\n');console.error('FAILED '+phase+'\n'+error.stack);await browser?.close();process.exitCode=1;});
