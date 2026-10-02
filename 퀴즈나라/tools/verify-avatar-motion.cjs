const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium')});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated avatar review */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const target=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');target.searchParams.set('demo','1');target.searchParams.set('session','blink-'+Date.now());
  await page.goto(target.href);
  await page.waitForFunction(()=>QPAvatar?.atlas.ready===true&&QPClothes?.atlas.ready===true);
  const gender=await page.evaluate(()=>{
    // Leave the live school controller before replacing this page with a
    // static art fixture, so its animation frame cannot read removed UI.
    QPGame.go('home');
    const av=Object.assign(QPGame.newAvatar('f'),{hair:'bob:1',sk:0,expression:'bright:0',hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',bg:'',frame:''});
    const female=QPAvatar.render(av,360,3),male=QPAvatar.render({...av,sex:'m'},360,3);
    const temp=document.createElement('div');temp.innerHTML=female;const f=temp.querySelector('[data-qpx-hair-color]').getAttribute('href');
    temp.innerHTML=male;const m=temp.querySelector('[data-qpx-hair-color]').getAttribute('href');
    document.body.innerHTML='<main style="width:1380px;margin:24px auto"><h1 style="font-size:24px;margin:0 0 12px;color:#fff">남자 · 여자 / 자연스러운 눈 깜빡임</h1><section style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">'+['f','m'].flatMap(sex=>['open','half','closed'].map(pose=>'<article data-pose="'+pose+'" style="height:408px;border:2px solid #4fcfff;background:#e8f9ff;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center">'+QPAvatar.render({...av,sex},360,3)+'<p style="color:#164873;margin:0">'+(sex==='m'?'남자':'여자')+' · '+({open:'뜬 눈',half:'반쯤 감은 눈',closed:'감은 눈'}[pose])+'</p></article>')).join('')+'</section></main>';
    return {differentHeadSources:f!==m,headSources:[f.startsWith('data:image/png'),m.startsWith('data:image/png')]};
  });
  assert(gender.differentHeadSources);assert(gender.headSources.every(Boolean));
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(80);
  const poses=await page.evaluate(()=>[...document.querySelectorAll('[data-pose]')].map(card=>{
    const phase={open:.5,half:.968,closed:.978}[card.dataset.pose];
    for(const a of card.getAnimations({subtree:true})){a.pause();a.currentTime=a.animationName.startsWith('qpx-blink-')?a.effect.getTiming().duration*phase:0;}
    return {sex:card.querySelector('[data-qpx-sex]').dataset.qpxSex,pose:card.dataset.pose,half:+getComputedStyle(card.querySelector('.qpx-blink-half')).opacity,closed:+getComputedStyle(card.querySelector('.qpx-blink-closed')).opacity,transform:getComputedStyle(card.querySelector('.qpx-blink-closed')).transform};
  }));
  for(const p of poses){assert.equal(p.half,p.pose==='half'?1:0);assert.equal(p.closed,p.pose==='closed'?1:0);assert.equal(p.transform,'none');}
  assert.deepEqual(errors,[]);
  const output=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증'));fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'남녀-눈깜빡임.png')});
  fs.writeFileSync(path.join(output,'아바타-모션검증.json'),JSON.stringify({target:target.href,gender,poses,errors},null,2));
  console.log(JSON.stringify({gender,poses,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
