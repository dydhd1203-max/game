/* The signed-in sex, canonical hair shelves and native thumbnails agree. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증'));
const expected={m:['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'],f:['bob','long','twin','pony','curly','bun','hime','braid']};
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  const checks=[],errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated gender QA */',contentType:'text/javascript'}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?demo=1&user=머리검증&session=gender-fixed-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready);
    const seed=await page.evaluate(async()=>{const m=QPGame.getMe(),u=JSON.parse(JSON.stringify(m));delete u.k;u.av={...u.av,sex:'f',hair:'long:8',ec:5,sk:4};Object.assign(u.owned,{'hair:long:8':1,'hair:long:2':1,'hair:part:6':1,'hair:messy:4':1});await QPDemo.db.ref('quiz/users/'+m.k).set(u);QPGame.enterUser(m.k,u);return u;});
    await page.locator('#tbShop').click();
    for(const sex of ['m','f']){
      await page.locator('#btnGender').click();await page.locator('#avatarSexChoices [data-sex="'+sex+'"]').click();
      await page.locator('#shTabs [data-c="hair"]').click();await page.locator('#shopAll').click();
      const rows=await page.locator('#shGrid [data-id]').evaluateAll(ns=>ns.map(n=>({id:n.dataset.id,sex:n.querySelector('image[data-qpx-sex]')?.getAttribute('data-qpx-sex')})));
      assert.deepEqual(rows.map(r=>r.id.split(':')[1]),expected[sex]);assert(rows.every(r=>r.id.endsWith(':1')&&r.sex===sex));assert.equal(await page.locator('#shPal').count(),0);
      await page.locator('#shGrid [data-id="hair:'+(sex==='m'?'part':'long')+':1"]').click();await page.locator('#btnWear').click();
      const current=await page.evaluate(()=>QPGame.getMe());assert.equal(current.av.sex,sex);assert.equal(current.av.ec,0);assert.equal(current.av.sk,4);assert.equal(current.gold,seed.gold);assert.deepEqual(current.owned,seed.owned);
      await page.locator('#shopOwned').click();const ownedRows=await page.locator('#shGrid [data-id]').evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.equal(new Set(ownedRows.map(id=>id.split(':')[1])).size,ownedRows.length);assert(ownedRows.every(id=>id.endsWith(':1')));
      await page.screenshot({path:path.join(out,sex==='m'?'남자-전용상점.png':'여자-전용옷장.png')});
      checks.push(sex+' hair: native gender previews, one brown colour per shape, old-colour ownership equips free, skin and balance unchanged');
    }
    const explicit=await page.evaluate(()=>['m','f'].map(sex=>{const n=document.createElement('div');n.innerHTML=QPAvatar.thumb('expression','soft',0,96,sex);const i=n.querySelector('image[data-qpx-sex]');return{sex:i.dataset.qpxSex,source:i.getAttribute('href')};}));assert.deepEqual(explicit.map(x=>x.sex),['m','f']);assert.notEqual(explicit[0].source,explicit[1].source);
    const alias=await page.evaluate(()=>{const read=shape=>{const n=document.createElement('div');n.innerHTML=QPAvatar.thumb('hair',shape,1,96,'f');return n.querySelector('image[data-qpx-sex]:not([data-qpx-tail])').getAttribute('href');};return{wave:read('wave'),long:read('long')};});assert.equal(alias.wave,alias.long);
    const fresh=await page.evaluate(()=>Array.from({length:40},()=>[QPGame.newAvatar('m'),QPGame.newAvatar('f')]));assert(fresh.every(([m,f])=>m.hair==='short:1'&&f.hair==='bob:1'&&m.ec===0&&f.ec===0&&m.sk===0&&f.sk===0));
    checks.push('Explicit thumbnail gender and legacy hairstyle alias remain valid; new avatars start with designed hair/eye colours and explicit initial skin');assert.deepEqual(errors,[]);
    const summary={checks,expected,errors};fs.writeFileSync(path.join(out,'아바타-성별검증.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
