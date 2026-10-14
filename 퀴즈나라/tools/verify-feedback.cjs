const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated feedback preview */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[],checks=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=feedback-'+Date.now());
    // Students now enter the village; these checks use the home (내 정보) screen.
    await page.waitForFunction(()=>window.QPGame?.getMe());await page.evaluate(()=>QPGame.go('home'));await page.waitForSelector('#meStage');
    assert.equal(await page.evaluate(()=>QPGame.getSound().ctx),null);
    await page.locator('#tbSnd').click();
    await page.waitForFunction(()=>QPGame.getSound().ctx?.state==='running');
    await page.waitForFunction(()=>QPGame.getSound().fxSequence>0);
    await page.evaluate(()=>{
      const s=QPGame.getSound();s.music(false);s.volume('fx',60);
      window.feedbackQA={calls:{}};
      for(const name of ['click','pick']){
        const original=s[name];s[name]=function(...args){feedbackQA.calls[name]=(feedbackQA.calls[name]||0)+1;return original.apply(this,args);};
      }
      const a=s.ctx.createAnalyser(),silent=s.ctx.createGain();silent.gain.value=0;
      s.fxGain.connect(a);a.connect(silent);silent.connect(s.ctx.destination);feedbackQA.analyser=a;
      feedbackQA.level=()=>{const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...data.map(v=>Math.abs(v)));};
    });
    checks.push('First real pointer interaction creates and runs Chrome AudioContext');
    await page.locator('#sndClose').click();await page.waitForTimeout(250);
    const icon=page.locator('#tbSnd'),before=await icon.boundingBox(),neighbor=await page.locator('#tbHome').boundingBox();
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();
    await page.waitForTimeout(110);
    const held=await icon.evaluate(e=>{const s=getComputedStyle(e);return{pressed:e.classList.contains('qp-pressed'),scale:parseFloat(s.scale),translate:s.translate,filter:s.filter};});
    // Round chrome top-bar icons sink 1px and darken without shrinking (quiz-hud.css).
    assert(held.pressed);assert.equal(held.translate,'0px 1px');assert.match(held.filter,/brightness\(0\.9\)/);
    assert.deepEqual(await page.locator('#tbHome').boundingBox(),neighbor,'Button press must not move its neighboring control');
    await page.mouse.up();await page.waitForFunction(()=>feedbackQA.level()>.004);
    const peak=await page.evaluate(()=>feedbackQA.level());
    await page.waitForTimeout(250);
    assert.equal(await icon.evaluate(e=>e.classList.contains('qp-pressed')),false);
    assert.deepEqual(await icon.boundingBox(),before);
    checks.push('Held mouse press visibly sinks and darkens, releases cleanly, leaves neighbors fixed, and produces a clear FX waveform');
    await page.locator('#sndClose').focus();await page.keyboard.down(' ');await page.waitForTimeout(100);
    assert(await page.locator('#sndClose').evaluate(e=>e.classList.contains('qp-pressed')));
    await page.keyboard.up(' ');await page.waitForSelector('#meStage');await page.waitForTimeout(160);
    await icon.focus();await page.keyboard.press('Enter');await page.waitForSelector('#sndClose');await page.waitForTimeout(180);
    assert.equal(await icon.evaluate(e=>e.classList.contains('qp-pressed')),false);
    checks.push('Space and Enter show the same press and do not leave controls stuck down');
    const disabled=page.locator('#sndTry');await disabled.evaluate(e=>e.disabled=true);
    const disabledBox=await disabled.boundingBox(),callCount=await page.evaluate(()=>feedbackQA.calls.click);
    await page.mouse.click(disabledBox.x+disabledBox.width/2,disabledBox.y+disabledBox.height/2);await page.waitForTimeout(160);
    assert.equal(await disabled.evaluate(e=>e.classList.contains('qp-pressed')),false);
    assert.equal(await page.evaluate(()=>feedbackQA.calls.click),callCount);
    checks.push('Disabled real controls have no press state or click sound');
    await disabled.evaluate(e=>e.disabled=false);await page.locator('#sndClose').click();
    // The old live OX zone checks were removed with the teacher-hosted live games (2026-10-14).
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks,clickPeak:peak,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
