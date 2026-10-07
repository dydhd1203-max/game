const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증'));fs.mkdirSync(out,{recursive:true});const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',shopOnly=process.argv.includes('--shop-only'),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext();
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated layout review */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?demo=1&session=layout-'+Date.now());
  await page.waitForFunction(()=>QPAvatar?.atlas.ready===true&&QPClothes?.atlas.ready===true);await page.evaluate(()=>document.fonts.ready);
  const choose=async mode=>{
    const toolbar=page.locator('.qp-demo-toolbar');
    if((await toolbar.getAttribute('class')).includes('collapsed'))await toolbar.locator('[data-hide]').click();
    const previous=await page.evaluate(()=>JSON.parse(localStorage.getItem(QPDemo.storageKey))?.quiz?.room?.meta?.session||null);
    await toolbar.locator('[data-mode="'+mode+'"]').click();
    await page.waitForFunction(({mode,previous})=>{const r=JSON.parse(localStorage.getItem(QPDemo.storageKey))?.quiz?.room;return r?.meta?.mode===mode&&r.meta.phase==='ask'&&r.meta.session!==previous&&Object.keys(r.p||{}).length===4;},{mode,previous});
  };
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
    if(shopOnly){checks.push({viewport,groups:7,genderChoices:2,horizontalOverflow:false});continue;}
    await choose('quiz');await page.waitForSelector('#ansIn');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Quiz horizontal overflow');
    await page.locator('#ansIn').scrollIntoViewIfNeeded();assert(await page.locator('#ansIn').isEnabled());
    await page.locator('#ansIn').fill('입력 확인');assert.equal(await page.locator('#ansIn').inputValue(),'입력 확인');
    await page.locator('#ansIn').press('Enter');
    await page.waitForFunction(()=>document.querySelector('.qp-feedback')?.textContent.includes('다시'));
    assert(await page.locator('#ansIn').isEnabled(),'Wrong answer submitted by Enter must allow retry');
    const submitBox=await page.locator('#ansOk').boundingBox();
    assert(submitBox.x>=0&&submitBox.x+submitBox.width<=viewport.width+1&&submitBox.y>=0&&submitBox.y+submitBox.height<=viewport.height+1,'Answer submit button must fit in the viewport');
    await choose('quiz');await page.waitForSelector('#ansIn');
    const image=await page.locator('.studio').evaluate(e=>getComputedStyle(e).backgroundImage);
    assert(image.includes('quiz-studio.webp'),'Approved studio artwork is missing');
    const portrait=await page.locator('.qp-profile-portrait').evaluate(e=>{
      const panel=e.getBoundingClientRect(),bg=e.querySelector('.qp-profile-backdrop').getBoundingClientRect(),avatar=e.querySelector('.qp-profile-avatar').getBoundingClientRect(),card=e.parentElement;
      return {backgroundFits:Math.abs(bg.left-panel.left)<1&&Math.abs(bg.top-panel.top)<1&&Math.abs(bg.width-panel.width)<1&&Math.abs(bg.height-panel.height)<1,
        centered:Math.abs(avatar.left+avatar.width/2-panel.left-panel.width/2)<1,
        clipped:getComputedStyle(e).overflow==='hidden'&&getComputedStyle(card).overflow==='hidden',
        noPortraitScrollbar:card.scrollHeight<=card.clientHeight+1&&card.scrollWidth<=card.clientWidth+1,
        noDuplicateBackground:!e.querySelector('.qp-profile-avatar .qpx-backdrop')};
    });
    assert(Object.values(portrait).every(Boolean),'Portrait scenery must fill and stay inside its panel, with one centered avatar: '+JSON.stringify(portrait));
    await page.screenshot({path:path.join(out,'무대-'+viewport.width+'.png')});
    checks.push({viewport,groups:7,genderChoices:2,questionInput:true,enterSubmitRetry:true,submitButtonVisible:true,horizontalOverflow:false,approvedBackground:true,portrait});
  }
  if(shopOnly){assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'화면검증.json'),JSON.stringify({scope:'shop only',checks,errors},null,2));console.log(JSON.stringify({scope:'shop only',checks,errors}));await browser.close();return;}
  await page.setViewportSize({width:1366,height:768});await choose('quiz');
  await page.evaluate(async()=>{
    const room=(await QPDemo.db.ref('quiz/room').once()).val(),base=Object.values(room.p),extra={},feed={};
    for(let i=0;i<20;i++)extra['layout_friend_'+i]={name:'친구 '+(i+5),av:base[i%base.length].av,sc:0,ok:0,online:true};
    for(let i=0;i<7;i++)feed['layout_feed_'+i]={qi:room.meta.qi,t:Date.now()+i,name:'친구 '+(i+5),v:'한 번 더 생각할게요',ok:false};
    await QPDemo.db.ref('quiz/room/p').update(extra);await QPDemo.db.ref('quiz/room/feed').update(feed);
  });
  await page.waitForFunction(()=>document.querySelectorAll('.qp-quiz-avatars .qp-player').length===24&&document.querySelectorAll('.qp-feed-line').length===7);
  const formBounds=await page.locator('.tvbody').evaluate(e=>{
    const body=e.getBoundingClientRect();return ['ansIn','ansOk'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,inside:r.left>=body.left-1&&r.right<=body.right+1&&r.top>=body.top-1&&r.bottom<=body.bottom+1,bottom:r.bottom,bodyBottom:body.bottom};});
  });
  assert(formBounds.every(r=>r.inside),'24 students and seven feed rows must keep the answer input and submit inside tvbody: '+JSON.stringify(formBounds));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const rosterScroll=await page.locator('.qp-quiz-avatars').evaluate(e=>{window.qaRosterNode=e;e.scrollTop=e.scrollHeight-e.clientHeight;return e.scrollTop;});
  assert(rosterScroll>0,'24-player gathering must offer a scrollable roster');
  await page.evaluate(()=>QPDemo.db.ref('quiz/room/p/layout_friend_19/sc').set(25));
  await page.waitForFunction(()=>document.querySelector('.qp-quiz-avatars')!==window.qaRosterNode);
  assert(Math.abs(await page.locator('.qp-quiz-avatars').evaluate(e=>e.scrollTop)-rosterScroll)<=1,'Roster scroll position must survive a score update and actual DOM rebuild');
  await page.screenshot({path:path.join(out,'무대-1366-24명.png')});
  checks.push({viewport:{width:1366,height:768},classroomPlayers:24,answerFeedRows:7,inputAndSubmitInsideMonitor:true,rosterScrollPreserved:true,horizontalOverflow:false});
  const fonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.family.includes('NanumSquareRound')).map(f=>({family:f.family,weight:f.weight,status:f.status})));
  assert(['400','700','800'].every(weight=>fonts.some(f=>f.weight===weight&&f.status==='loaded')),'All three real Korean font weights must load');assert(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('NanumSquareRound')));
  await page.setViewportSize({width:1440,height:900});await choose('quiz');
  const decor=()=>page.locator('.studio').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>{const t=a.effect.target;return t&&t.tagName!=='svg'&&!t.ownerSVGElement&&a.animationName&&!a.animationName.startsWith('qpx-')}).map(a=>({name:a.animationName,time:a.currentTime,duration:a.effect.getTiming().duration,iterations:a.effect.getTiming().iterations})));
  const before=await decor();assert(before.length>=2,'Stage must have animated decorative stars and screen light');
  await page.waitForTimeout(450);const after=await decor();
  assert(after.some(a=>before.some(b=>a.name===b.name&&a.time>b.time+200)),'Stage decoration must actually progress');
  await page.screenshot({path:path.join(out,'완성-퀴즈무대.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
  const reduced=await decor();assert(reduced.length<after.length,'Reduced motion should stop stage decorative movement');
  const scenePage=await context.newPage();scenePage.on('pageerror',e=>errors.push(e.message));
  await scenePage.goto('http://127.0.0.1:4173/?demo=1&scene=quiz&session=scene-layout-'+Date.now());
  await scenePage.waitForFunction(()=>{const r=window.QPDemo&&JSON.parse(localStorage.getItem(QPDemo.storageKey))?.quiz?.room;return r?.meta?.mode==='quiz'&&r.meta.phase==='ask'&&Object.keys(r.p||{}).length===4;});
  assert(await scenePage.locator('#ansIn').isVisible());assert(await scenePage.locator('#ansIn').isEnabled());
  checks.push({autoScene:'quiz',playerCount:4,questionInput:true});await scenePage.close();
  assert.deepEqual(errors,[]);const report={checks,fonts,decorativeMotion:after,reducedMotion:reduced,errors};
  fs.writeFileSync(path.join(out,'화면검증.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
