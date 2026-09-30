const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:632}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated audio preview */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[],checks=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=audio-'+Date.now());
    await page.waitForSelector('#meStage');
    assert.equal(await page.evaluate(()=>QPGame.getSound().ctx),null);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>QPGame.getSound().ctx?.state==='running'&&!!QPGame.getSound().timer);
    checks.push('Trusted keyboard gesture unlocks a real Chrome AudioContext and starts music');

    await page.locator('#tbSnd').click();
    for(const id of ['sndFX','sndMusic','sndFXVolume','sndMusicVolume'])assert(await page.locator('#'+id).isVisible());
    const volume=async(id,v)=>page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);
    await volume('sndFXVolume',24);await volume('sndMusicVolume',68);
    assert.equal(await page.locator('#sndFXValue').textContent(),'24%');
    assert.equal(await page.locator('#sndMusicValue').textContent(),'68%');
    const musicTimer=await page.evaluate(()=>QPGame.getSound().timer);
    await page.locator('#sndFX').click();
    assert.equal(await page.locator('#sndFX').getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(()=>QPGame.getSound().timer),musicTimer);
    await page.evaluate(()=>{
      const s=QPGame.getSound();window.audioQA={};
      for(const bus of ['fx','music']){
        const analyser=s.ctx.createAnalyser(),silent=s.ctx.createGain();silent.gain.value=0;
        s[bus==='fx'?'fxGain':'musicGain'].connect(analyser);analyser.connect(silent);silent.connect(s.ctx.destination);
        audioQA[bus]=analyser;
      }
      audioQA.level=bus=>{const a=audioQA[bus],data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...data.map(v=>Math.abs(v)));};
    });
    await page.waitForFunction(()=>audioQA.level('music')>.00001);
    assert.equal(await page.evaluate(()=>QPGame.getSound().fxGain.gain.value),0);
    assert.equal(await page.evaluate(()=>QPGame.getSound().voices.fx.size),0);
    checks.push('Laptop controls adjust independent volumes; FX off keeps audible synthesized BGM and one timer');
    await page.locator('#sndFX').click();await page.locator('#sndMusic').click();
    assert.equal(await page.evaluate(()=>QPGame.getSound().timer),null);
    assert.equal(await page.evaluate(()=>QPGame.getSound().voices.music.size),0);
    await page.locator('#sndTry').click();await page.waitForFunction(()=>audioQA.level('fx')>.00001);
    checks.push('BGM off cancels its scheduled notes while FX preview still produces audio');
    const out=path.resolve(__dirname,'../검증');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'소리설정.png')});
    await page.locator('#sndClose').click();

    await page.evaluate(()=>{
      audioQA.calls={};const s=QPGame.getSound();
      for(const name of ['click','start','ok','no','buy','fanfare']){
        const original=s[name];s[name]=function(...args){audioQA.calls[name]=(audioQA.calls[name]||0)+1;return original.apply(this,args);};
      }
    });
    await page.locator('.qp-demo-toolbar [data-mode="quiz"]').click();
    await page.waitForSelector('#ansIn');
    const correct=await page.evaluate(async()=>{const r=(await QPDemo.db.ref('quiz/room').once()).val();return QPDemo.bank.demo_quiz.qs.find(q=>q.q===r.q.t).a.split('/')[0];});
    await page.locator('#ansIn').fill('틀린 답');await page.locator('#ansIn').press('Enter');
    await page.waitForFunction(()=>document.querySelector('.qp-feedback')?.textContent.includes('다시'));
    await page.locator('#ansIn').fill(correct);await page.locator('#ansIn').press('Enter');
    await page.waitForFunction(()=>audioQA.calls.ok>0);
    await page.evaluate(async()=>{const h=document.querySelector('iframe').contentWindow.QPGame.getHost();await h.reveal();await h.end();});
    await page.waitForSelector('.qp-results');
    await page.locator('#resultShop').click();await page.locator('#shTabs [data-c="expression"]').click();
    await page.locator('#shGrid [data-id="expression:happy:0"]').click();await page.locator('#btnBuy').click();
    await page.waitForFunction(()=>QPGame.getMe().owned['expression:happy:0']);
    const calls=await page.evaluate(()=>audioQA.calls);
    for(const name of ['click','start','ok','no','buy','fanfare'])assert(calls[name]>0,'Actual game action must invoke '+name);
    const celebrations=calls.fanfare;
    await page.evaluate(()=>{const s=QPGame.getSound();s.gameState({session:QPGame.getSound().gameEvents.values().next().value.split('/')[0],phase:'end'});});
    assert.equal(await page.evaluate(()=>audioQA.calls.fanfare),celebrations);
    checks.push('Actual button, game start, wrong retry, correct answer, result and purchase invoke their effects once');

    await page.locator('#tbSnd').click();await page.locator('#sndFX').click();await page.locator('#sndMusic').click();
    await volume('sndMusicVolume',18);await page.reload();await page.waitForSelector('#meStage');
    const saved=await page.evaluate(()=>{const s=QPGame.getSound();return {fx:s.on,music:s.bgm,fxVolume:s.fxVolume,musicVolume:s.musicVolume,locked:!s.ctx};});
    assert.deepEqual(saved,{fx:false,music:true,fxVolume:24,musicVolume:18,locked:true});
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>QPGame.getSound().ctx?.state==='running'&&!!QPGame.getSound().timer);
    const timer=await page.evaluate(()=>QPGame.getSound().timer);
    for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>QPGame.getSound().timer),timer);
    checks.push('Toggles and volumes survive reload; repeated input never duplicates the BGM timer');

    // Chrome supplies real AudioContext state changes; only the visibility event is simulated.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>QPGame.getSound().ctx.state==='suspended');
    assert.deepEqual(await page.evaluate(()=>{const s=QPGame.getSound();return{timer:s.timer,fx:s.voices.fx.size,music:s.voices.music.size};}),{timer:null,fx:0,music:0});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>QPGame.getSound().ctx.state==='running'&&!!QPGame.getSound().timer);
    const step=await page.evaluate(()=>{const s=QPGame.getSound();s.next=s.ctx.currentTime-3600;return s.step;});
    await page.waitForTimeout(130);
    const resumed=await page.evaluate(()=>{const s=QPGame.getSound();return {step:s.step,next:s.next,now:s.ctx.currentTime,voices:s.voices.music.size};});
    assert(resumed.step-step<=4,'A stale clock must not replay old notes in a burst');
    assert(resumed.next>=resumed.now-.05);assert(resumed.voices<=8);
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(()=>QPGame.getSound().ctx.state==='running'&&!!QPGame.getSound().timer&&!QPGame.getSound().suspending);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    checks.push('Visibility suspension clears notes; rapid return and a stale clock resume without catch-up bursts');
    const pointerPage=await context.newPage();pointerPage.on('pageerror',e=>errors.push(e.message));
    await pointerPage.goto(page.url());await pointerPage.waitForSelector('#meStage');
    assert.equal(await pointerPage.evaluate(()=>QPGame.getSound().ctx),null);
    await pointerPage.locator('#tbSnd').click();
    await pointerPage.waitForFunction(()=>QPGame.getSound().ctx.state==='running'&&!!QPGame.getSound().timer);
    checks.push('Trusted pointer gesture independently unlocks audio with saved FX-off/BGM-on settings');
    await pointerPage.close();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks,effectCalls:calls,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
