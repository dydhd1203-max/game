const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

(async()=>{
  const out=path.resolve(__dirname,'../검증');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const checks=[],errors=[];
  for(const config of [
    {width:1366,height:768,dpr:1},{width:1280,height:632,dpr:1},
    {width:1366,height:768,dpr:1.25},{width:1366,height:768,dpr:2}
  ]){
    const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated motion review */',contentType:'text/javascript'}));
    let releaseHeads;
    if(config.dpr===1&&config.width===1366){
      const held=new Promise(resolve=>releaseHeads=resolve);
      await context.route('**/assets/pixel-heads*.png',async r=>{await held;await r.continue();});
    }
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=stability-'+Date.now(),{waitUntil:'domcontentloaded'});
    if(config.dpr===1&&config.width===1366){
      await page.waitForSelector('#meStage > svg',{state:'attached'});
      assert.equal(await page.locator('#meStage > svg').evaluate(s=>getComputedStyle(s).visibility),'hidden','Unprocessed faces and primitive clothing must not appear while artwork is loading');
      releaseHeads();
    }
    await page.waitForFunction(()=>window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPPets?.atlas.ready&&!document.documentElement.classList.contains('qp-avatar-loading'));
    await page.locator('.qp-demo-toolbar [data-mode="quiz"]').click();
    await page.waitForSelector('.qp-profile-avatar > svg');
    await page.evaluate(()=>document.fonts.ready);
    // Correct/wrong reactions are deliberate short gestures, separate from idle breathing.
    await page.addStyleTag({content:'.qp-player > .qp-pixel-avatar{animation:none!important}'});
    await page.waitForTimeout(100);
    const selectors=['.qp-profile-avatar > svg','.qp-quiz-avatars .qp-player > svg'];
    const sample=async phase=>page.evaluate(({selectors,phase})=>{
      for(const a of document.getAnimations()){
        a.pause();a.currentTime=['qpx-body','qpx-hands','qpx-pet'].includes(a.animationName)?a.effect.getTiming().duration*phase:0;
      }
      const vec=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
      return selectors.map(selector=>{
        const svg=document.querySelector(selector),root=svg.getScreenCTM(),inverse=root.inverse(),point=node=>{
          const m=node.getScreenCTM();return [m.e*devicePixelRatio,m.f*devicePixelRatio];
        };
        return {selector,head:vec(inverse.multiply(svg.querySelector('.qpx-head').getScreenCTM())),
          hair:vec(inverse.multiply(svg.querySelector('.qpx-hair').getScreenCTM())),
          idle:vec(inverse.multiply(svg.querySelector('.qpx-idle').getScreenCTM())),
          body:point(svg.querySelector('.qpx-body')),left:point(svg.querySelector('.qpx-hand-left')),right:point(svg.querySelector('.qpx-hand-right')),
          pet:point(svg.querySelector('.qpx-pet')),motionPixel:svg.style.getPropertyValue('--qpx-motion-pixel'),
          petPixel:svg.style.getPropertyValue('--qpx-pet-pixel')};
      });
    },{selectors,phase});
    const poses=[];
    for(const phase of [.1,.5,.85]){poses.push(await sample(phase));await page.waitForTimeout(20);}
    const close=(a,b)=>Math.abs(a-b)<.00005;
    for(let i=0;i<selectors.length;i++){
      const [rest,breath,returning]=poses.map(p=>p[i]);
      for(const pose of [rest,breath,returning])for(const name of ['head','hair','idle']){
        assert(pose[name].every((n,j)=>close(n,[1,0,0,1,0,0][j])),name+' must keep its raster grid fixed: '+JSON.stringify(pose));
      }
      assert(rest.motionPixel&&rest.petPixel,'Screen pixel dimensions must be fitted before painting');
      assert(close(rest.body[0],breath.body[0])&&close(rest.body[1]-breath.body[1],1),'Breathing must change exactly one device pixel');
      assert(close(rest.pet[0],breath.pet[0])&&close(rest.pet[1]-breath.pet[1],1),'Pet pose must change exactly one device pixel');
      for(const part of ['left','right'])assert(rest[part].every((n,j)=>close(n,breath[part][j])),'Hands must stay on their grid as the torso breathes');
      for(const part of ['body','pet'])assert(rest[part].every((n,j)=>close(n,returning[part][j])),'Pose must return to its original grid');
    }
    // A raster comparison catches visual shimmer that transform checks alone would miss.
    const clips=await page.evaluate(selectors=>selectors.map(selector=>{
      const s=document.querySelector(selector),m=s.getScreenCTM(),point=(x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}),a=point(0,3),b=point(23.5,26.5);
      return {x:Math.floor(a.x),y:Math.floor(a.y),width:Math.ceil(b.x)-Math.floor(a.x),height:Math.ceil(b.y)-Math.floor(a.y)};
    }),selectors);
    const hashes=[];
    for(const phase of [.1,.5]){
      await sample(phase);await page.waitForTimeout(20);
      hashes.push(await Promise.all(clips.map(async clip=>crypto.createHash('sha256').update(await page.screenshot({clip})).digest('hex'))));
    }
    assert.deepEqual(hashes[0],hashes[1],'Faces and hair must render identical pixels between breathing poses');
    if(config.dpr===1)await page.screenshot({path:path.join(out,'모션안정-'+config.width+'.png')});
    const live=await page.evaluate(()=>{
      const s=document.querySelector('.qp-profile-avatar > svg');
      for(const a of s.getAnimations({subtree:true}))a.play();
      window.qaBreath=s.getAnimations({subtree:true}).find(a=>a.animationName==='qpx-body');
      window.qaAngel=s.getAnimations({subtree:true}).find(a=>a.animationName?.includes('wing'));
      return {body:window.qaBreath?.currentTime,angel:window.qaAngel?.currentTime,
        blink:s.getAnimations({subtree:true}).some(a=>a.animationName==='qpx-blink-closed')};
    });
    await page.waitForTimeout(160);
    const moving=await page.evaluate(()=>({body:window.qaBreath.currentTime,angel:window.qaAngel?.currentTime}));
    assert(moving.body>live.body+80&&live.blink,'Breathing and natural blink must remain active');
    assert(moving.angel>live.angel+80,'Angel wings must remain animated');
    await page.setViewportSize({width:config.width-80,height:config.height-30});await page.waitForTimeout(80);
    const resizedRest=await sample(.1),resizedBreath=await sample(.5);
    for(let i=0;i<selectors.length;i++)assert(close(resizedRest[i].body[1]-resizedBreath[i].body[1],1),'Resize must retain a one-device-pixel pose');
    if(config.dpr===1&&config.width===1366){
      const cdp=await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:config.width-80,height:config.height-30,deviceScaleFactor:2,mobile:false});
      await page.waitForTimeout(400);
      const monitorRest=await sample(.1),monitorBreath=await sample(.5);
      for(let i=0;i<selectors.length;i++)assert(close(monitorRest[i].body[1]-monitorBreath[i].body[1],1),'A different monitor density without a window resize must retain one device pixel: '+JSON.stringify({rest:monitorRest[i],breath:monitorBreath[i],density:await page.evaluate(()=>({dpr:devicePixelRatio,one:matchMedia('(resolution: 1dppx)').matches,two:matchMedia('(resolution: 2dppx)').matches}))}));
      await cdp.detach();
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);
    assert.equal(await page.locator('.qp-profile-avatar > svg').evaluate(s=>s.getAnimations({subtree:true}).filter(a=>['qpx-body','qpx-hands','qpx-pet'].includes(a.animationName)).length),0);
    checks.push({viewport:config,profileAndStage:true,headPixelsStable:true,breathingDevicePixels:1,handsStable:true,petDevicePixels:1,blinkAndAngelActive:true,resize:true,reducedMotion:true});
    await context.close();
  }
  assert.deepEqual(errors,[]);await browser.close();
  fs.writeFileSync(path.join(out,'아바타-안정성검증.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
