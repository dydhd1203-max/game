const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated effect purchase */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=effect-'+Date.now());
    await page.waitForFunction(()=>window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPEffects?.atlas.ready&&window.QPGame?.getMe());
    await page.evaluate(async()=>{
      const u=JSON.parse(JSON.stringify(QPGame.getMe())),key=u.k;delete u.k;u.gold=1200;delete u.owned['effect:angel:0'];u.av.effect='';u.av.pet='cat:8';
      await QPDemo.db.ref('quiz/users/'+key).set(u);QPGame.enterUser(key,u);QPGame.go('shop');
    });
    await page.locator('#shTabs [data-c="effect"]').click();
    await page.locator('#shGrid [data-id="effect:angel:0"]').click();
    assert.equal(await page.locator('#shInfo .qp-effect').count(),1);
    await page.locator('#btnBuy').click();
    await page.waitForFunction(()=>QPGame.getMe().av.effect==='angel:0'&&QPGame.getMe().owned['effect:angel:0']);
    assert.equal(await page.evaluate(()=>QPGame.getMe().gold),680);
    assert.equal(await page.evaluate(()=>QPGame.getMe().av.pet),'cat:8');
    const before=await page.locator('#shInfo .qp-effect-wing-left').evaluate(e=>getComputedStyle(e).transform);
    await page.waitForTimeout(120);
    assert.notEqual(await page.locator('#shInfo .qp-effect-wing-left').evaluate(e=>getComputedStyle(e).transform),before);
    await page.screenshot({path:path.resolve(__dirname,'../검증/천사-상점.png')});
    await page.locator('#shGrid [data-none]').click();await page.locator('#btnWear').click();
    assert.equal(await page.evaluate(()=>QPGame.getMe().av.effect),'');
    assert.equal(await page.evaluate(()=>QPGame.getMe().av.pet),'cat:8');
    await page.locator('#shGrid [data-id="effect:angel:0"]').click();await page.locator('#btnWear').click();
    assert.equal(await page.evaluate(()=>QPGame.getMe().gold),680);
    assert.equal(await page.evaluate(()=>QPGame.getMe().av.effect),'angel:0');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({purchaseGold:520,independentFromPet:true,animatedShopThumb:true,removeAndReequipWithoutCharge:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
