const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증'));fs.mkdirSync(out,{recursive:true});const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',shopOnly=process.argv.includes('--shop-only'),browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext();
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated layout review */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?demo=1&session=layout-'+Date.now());
  await page.waitForFunction(()=>QPAvatar?.atlas.ready===true&&QPClothes?.atlas.ready===true);await page.evaluate(()=>document.fonts.ready);
  for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1366,height:768},{width:1280,height:632},{width:1024,height:632}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>QPGame.go('shop'));
    await page.waitForSelector('#shTabs');assert.equal(await page.locator('#shGroups [data-group]').count(),7);assert.deepEqual(await page.locator('#shTabs [data-c]').evaluateAll(bs=>bs.map(b=>b.dataset.c)),['expression','hair']);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Shop horizontal overflow');
    await page.locator('#btnGender').scrollIntoViewIfNeeded();await page.locator('#btnGender').click();
    assert.equal(await page.locator('#avatarSexChoices .qp-pixel-avatar').count(),2);
    const box=await page.locator('#avatarSexChoices').boundingBox();assert(box.x>=0&&box.x+box.width<=viewport.width+1);
    await page.locator('#avatarSexChoices button[data-sex="f"]').click();
    await page.waitForFunction(()=>!document.querySelector('#toast .tt'));
    await page.screenshot({path:path.join(out,'상점-'+viewport.width+'.png')});
    checks.push({viewport,groups:7,genderChoices:2,horizontalOverflow:false});
  }
  // The old live quiz stage (studio, answer input, 24-player roster, ?scene=quiz) was removed with the
  // teacher-hosted live games on 2026-10-14; only the shop layout remains here. --shop-only is kept as an alias.
  const fonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.family.includes('NanumSquareRound')).map(f=>({family:f.family,weight:f.weight,status:f.status})));
  assert(['400','700','800'].every(weight=>fonts.some(f=>f.weight===weight&&f.status==='loaded')),'All three real Korean font weights must load');
  assert.deepEqual(errors,[]);const report={scope:'shop',checks,fonts,errors};
  fs.writeFileSync(path.join(out,'화면검증.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
