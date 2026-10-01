const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1500,height:840}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated art preview */',contentType:'text/javascript'}));
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/?demo=1&session=art-'+Date.now());
  await page.waitForFunction(()=>window.QPAvatar?.atlas.ready===true&&window.QPClothes?.atlas.ready===true);
  const art=await page.evaluate(async()=>{
    const parts=[
      {hair:'bob:1',expression:'bright:0',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',sk:0},
      {hair:'part:0',expression:'happy:0',top:'sailor:5',bottom:'shorts:5',shoes:'sneaker:9',sk:1},
      {hair:'long:6',expression:'sparkle:0',top:'knit:4',bottom:'pleat:6',shoes:'boots:0',sk:2},
      {hair:'twin:3',expression:'wink:0',top:'jacket:5',bottom:'jeans:5',shoes:'hitop:8',sk:3},
      {hair:'bun:9',expression:'cat:0',top:'hanbok:7',bottom:'hanbok:6',shoes:'ballet:8',sk:4},
      {hair:'braid:1',expression:'freckle:0',top:'tee:3',bottom:'track:5',shoes:'sneaker:8',sk:0}
    ];
    const names=['단발 · 후드와 치마','가르마 · 세일러와 반바지','긴 머리 · 니트와 주름치마','양갈래 · 재킷과 청바지','만두 머리 · 한복','땋은 머리 · 티셔츠와 바지'];
    const avatars=parts.map((p,i)=>Object.assign(QPGame.newAvatar(i===1||i===3?'m':'f'),p,{hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',bg:'',frame:''}));
    document.body.style.background='#f5eefb';
    document.body.innerHTML='<main style="width:1460px;margin:24px auto;font-family:inherit;color:#58466e"><h1 style="font-size:28px;margin:0 0 10px">퀴즈나라 · 도트 아바타</h1><p style="font-size:17px;margin:0 0 28px">얼굴 · 머리 · 상의 · 하의를 따로 골라 입어요</p><div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px">'+avatars.map((a,i)=>'<article style="min-width:0;background:#fffaf5;border:1px solid #ded2ed;border-radius:24px;min-height:650px;padding:20px 8px;display:flex;align-items:center;flex-direction:column;justify-content:center">'+QPAvatar.render(a,400,3).replace('style="display:block;','style="max-width:100%;display:block;')+'<p style="font-size:17px;font-weight:800;margin-top:30px;text-align:center">'+names[i]+'</p></article>').join('')+'</div></main>';
    const img=document.createElement('img');img.src=document.querySelector('[data-qpx-hair-color]').getAttribute('href');await img.decode();
    return {sheet:[img.naturalWidth,img.naturalHeight],avatars:document.querySelectorAll('.qp-pixel-avatar').length,sexes:[...new Set([...document.querySelectorAll('[data-qpx-sex]')].map(e=>e.dataset.qpxSex))].sort(),frames:document.querySelectorAll('svg')[0].getAttribute('viewBox')};
  });
  assert.deepEqual(art.sheet,[256,256],'Each head must retain native detail without sampling a neighbouring atlas cell');
  assert.equal(art.avatars,6);assert.deepEqual(art.sexes,['f','m']);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.resolve(__dirname,'../검증/아바타-디테일.png')});
  console.log(JSON.stringify(art,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
