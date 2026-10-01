const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1366,height:900}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated avatar gender checks */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=gender-'+Date.now());
    await page.waitForFunction(()=>QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPGame.getMe());
    const prepared=await page.evaluate(async()=>{
      const user=JSON.parse(JSON.stringify(QPGame.getMe())),key=user.k;delete user.k;
      user.av=Object.assign(user.av,{sex:'f',hair:'long:1',sk:4,top:'shirt:10',bottom:'jeans:11',expression:'soft:0'});
      Object.assign(user.owned,{'hair:long:1':1,'hair:part:1':1,'hair:messy:1':1,'hair:spiky:1':1});
      user.gold=1200;await QPDemo.db.ref('quiz/users/'+key).set(user);QPGame.enterUser(key,user);QPGame.go('shop');
      return {key,gold:user.gold,owned:user.owned,av:user.av};
    });
    const grid=()=>page.locator('#shGrid [data-id]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.id,sex:n.querySelector('image[data-qpx-sex]')?.getAttribute('data-qpx-sex')})));
    let rows=await grid();assert.equal(rows.length,8);assert(rows.every(x=>x.sex==='f'));
    assert(rows.some(x=>x.id==='hair:long:0'));assert(!rows.some(x=>x.id.startsWith('hair:short:')));
    await page.locator('#shopOwned').click();rows=await grid();assert(rows.every(x=>x.sex==='f'));assert(rows.some(x=>x.id==='hair:long:1'));assert(!rows.some(x=>x.id==='hair:part:1'));
    checks.push('Female shop and wardrobe show only female hairstyles with female raster previews');
    await page.locator('#btnGender').click();await page.locator('#avatarSexChoices button[data-sex="m"]').click();
    let current=await page.evaluate(()=>QPGame.getMe());assert.equal(current.av.sex,'m');assert.equal(current.gold,prepared.gold);assert.deepEqual(current.owned,prepared.owned);
    for(const part of ['sk','expression','top','bottom','shoes','face','glass','ear','neck','pet','bg','frame','effect'])assert.equal(current.av[part],prepared.av[part]);
    assert(['short','part','messy','spiky'].includes(current.av.hair.split(':')[0]));
    rows=await grid();assert(rows.every(x=>x.sex==='m'));assert(!rows.some(x=>x.id==='hair:long:1'));
    await page.locator('#shopAll').click();rows=await grid();assert.equal(rows.length,4);assert(rows.every(x=>x.sex==='m'));
    await page.locator('#shGrid [data-id="hair:part:0"]').click();assert.equal(await page.locator('#shInfo image[data-qpx-sex]:not([data-qpx-tail])').getAttribute('data-qpx-sex'),'m');
    assert.equal(await page.locator('#pvStage svg[data-qpx-sex]').getAttribute('data-qpx-sex'),'m');
    await page.screenshot({path:path.resolve(__dirname,'../검증/남자-전용상점.png')});
    checks.push('Gender switch is free, keeps ownership, gold, skin, clothing and effects; male shop, selected item and fitting preview agree');
    await page.locator('#shTabs [data-c="expression"]').click();assert.equal(await page.locator('#shGrid [data-id]').count(),8);
    assert((await page.locator('#shGrid image[data-qpx-sex]:not([data-qpx-tail])').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-qpx-sex')))).every(x=>x==='m'));
    await page.locator('#shGrid [data-id="expression:soft:0"]').click();assert.equal(await page.locator('#shInfo image[data-qpx-sex]:not([data-qpx-tail])').getAttribute('data-qpx-sex'),'m');
    for(let i=0;i<16;i++){await page.locator('#btnRand').click();current=await page.evaluate(()=>QPGame.getMe());assert.equal(current.av.sex,'m');assert(['short','part','messy','spiky'].includes(current.av.hair.split(':')[0]));}
    checks.push('Male faces use the male sheet and randomized outfits stay within male owned hair');
    await page.locator('#btnGender').click();await page.locator('#avatarSexChoices button[data-sex="f"]').click();
    await page.locator('#shTabs [data-c="hair"]').click();await page.locator('#shopOwned').click();rows=await grid();assert(rows.some(x=>x.id==='hair:long:1'));assert(rows.every(x=>x.sex==='f'));
    await page.locator('#shGrid [data-id="hair:long:1"]').click();await page.locator('#btnWear').click();current=await page.evaluate(()=>QPGame.getMe());assert.equal(current.av.hair,'long:1');assert.equal(current.gold,1200);
    await page.screenshot({path:path.resolve(__dirname,'../검증/여자-전용옷장.png')});
    checks.push('Switching back restores access to female owned items and equipping them has no extra cost');
    const explicit=await page.evaluate(()=>['m','f'].map(sex=>{
      const node=document.createElement('div');node.innerHTML=QPAvatar.thumb('expression','soft',0,96,sex);
      const image=node.querySelector('image[data-qpx-sex]');return {sex:image.dataset.qpxSex,source:image.getAttribute('href')};
    }));
    assert.deepEqual(explicit.map(x=>x.sex),['m','f']);assert.notEqual(explicit[0].source,explicit[1].source);
    checks.push('Explicit thumbnail gender works independently of the signed-in profile');
    const repaired=await page.evaluate(()=>{
      const mixed={...QPGame.getMe().av,sex:'m',hair:'long:1'},normalized=QPGame.avatarForSex(mixed,'m',QPGame.getMe().owned);
      const repeated=Array.from({length:50},()=>[QPGame.newAvatar('m').hair,QPGame.newAvatar('f').hair]);
      return {mixed,normalized,repeated};
    });
    assert.equal(repaired.normalized.sex,'m');assert.notEqual(repaired.normalized.hair,'long:1');
    assert.deepEqual({...repaired.normalized,hair:repaired.mixed.hair},repaired.mixed);
    assert(repaired.repeated.every(([m,f])=>m.startsWith('short:')&&f.startsWith('bob:')));
    checks.push('Old mixed profiles normalize without changing clothes; new accounts start with matching gender hair');
    const legacy=await page.evaluate(async()=>{
      const user=JSON.parse(JSON.stringify(QPGame.getMe()));delete user.k;user.av={...user.av,sex:'m',hair:'long:1'};
      await QPDemo.db.ref('quiz/users/legacy_mixed_gender').set(user);QPGame.enterUser('legacy_mixed_gender',user);
      return {before:user,after:JSON.parse(JSON.stringify(QPGame.getMe()))};
    });
    assert.equal(legacy.after.av.sex,'m');assert(['short','part','messy','spiky'].includes(legacy.after.av.hair.split(':')[0]));
    assert.equal(legacy.after.gold,legacy.before.gold);assert.deepEqual(legacy.after.owned,legacy.before.owned);
    assert.deepEqual({...legacy.after.av,hair:legacy.before.av.hair},legacy.before.av);
    checks.push('Signing into an existing mixed profile repairs only the hairstyle');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.resolve(__dirname,'../검증/아바타-성별검증.json'),JSON.stringify({checks,errors},null,2));
    console.log(JSON.stringify({checks,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
