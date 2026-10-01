'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.QUIZ_DEPLOYMENT_URL||'http://127.0.0.1:4173/배포용/';
const out=path.resolve(__dirname,'../검증');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const manifest=require('./build-deployment.cjs').verify();
  for(const entry of manifest.files){
    const response=await fetch(new URL(entry.path,base));assert.equal(response.status,200,'Missing deployed file: '+entry.path);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'Outdated served file: '+entry.path);
  }
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated complete release */',contentType:'text/javascript'}));
    const p=await context.newPage(),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));
    p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(base).origin)missing.push(r.url());});
    await p.goto(new URL('?demo=1&session=release-'+Date.now(),base).href);
    await p.waitForFunction(()=>window.QPGame?.getMe()&&[QPAvatar,QPClothes,QPShoes,QPPets,QPEffects].every(api=>api.atlas.ready)&&QPShoes.atlas.partsReady);
    await p.evaluate(()=>document.fonts.ready);
    await p.locator('.qp-demo-toolbar [data-hide]').click();
    await p.locator('#mShop').click();await p.waitForSelector('#shTabs');
    await p.locator('#btnGender').click();await p.locator('#avatarSexChoices [data-sex="m"]').click();
    assert.equal(await p.locator('#shGrid [data-id]').count(),12);
    assert.equal(await p.locator('#shTabs [data-c]').count(),15);
    const resources=await p.evaluate(()=>({head:QPAvatar.atlas.maleUrl,top:QPClothes.atlas.categories.top.url,feet:QPShoes.atlas.partsUrl,footCount:QPShoes.atlas.partsCount,
      styles:[...document.styleSheets].filter(s=>s.href).map(s=>s.href),fonts:[...document.fonts].filter(f=>f.family.includes('NanumSquareRound')).map(f=>({weight:f.weight,status:f.status}))}));
    for(const resource of [resources.head,resources.top,resources.feet,...resources.styles])assert(new URL(resource,new URL(base)).pathname.startsWith(new URL(base).pathname),'Resource escaped deployment folder: '+resource);
    assert.equal(resources.footCount,18,'Complete independent footwear must load from the release folder');
    assert(resources.styles.some(s=>s.endsWith('readability.css'))&&resources.styles.some(s=>s.endsWith('shop-village.css')));
    await p.screenshot({path:path.join(out,'배포용-남자12헤어-상점.png')});
    await p.locator('#shTabs [data-c="top"]').click();await p.locator('#shGrid [data-id="top:tank:0"]').click();
    assert.equal(await p.locator('#pvStage [data-cloth-shape="tank"]').count(),1);
    const teacher=await context.newPage();teacher.on('pageerror',e=>errors.push(e.message));
    await teacher.goto(new URL('?demo=1&role=teacher&session=release-teacher-'+Date.now(),base).href);
    await teacher.waitForSelector('#teacherQuizList');
    assert.deepEqual(await teacher.locator('.teacher-top .tabs [data-t]').evaluateAll(nodes=>nodes.map(n=>n.dataset.t)),['quizzes','classroom','kids']);
    await teacher.screenshot({path:path.join(out,'배포용-교사-내퀴즈.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    const report={files:manifest.files.length,allServedHashesMatch:true,maleHair:12,categories:15,teacherTabs:['quizzes','classroom','kids'],resources,errors,missing};
    fs.writeFileSync(path.join(out,'배포용-검증.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({files:report.files,allServedHashesMatch:true,maleHair:12,categories:15,teacherTabs:report.teacherTabs,errors,missing},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
