/* Verify native artwork without changing browser or canvas security settings. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(root,'검증'));
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const modules=['avatar-image.js','avatar-clothes.js','avatar-effects.js','avatar-pets.js','avatar-shoes.js','avatar-pixel.js','avatar-poses.js','avatar-direction.js'];

async function ready(frame){
  await frame.waitForFunction(()=>window.QPAvatar&&window.QPClothes&&window.QPPets&&window.QPShoes&&window.QPEffects&&window.QPAvatarPose&&window.QPAvatarDirection);
  await frame.waitForFunction(()=>[QPAvatar.atlas,QPClothes.atlas,QPPets.atlas,QPShoes.atlas,QPEffects.atlas,QPAvatarDirection.atlas].every(a=>a.ready||a.error||a.normalizationError)&&(QPShoes.atlas.partsReady||QPShoes.atlas.error)&&(QPAvatarDirection.atlas.backReady||QPAvatarDirection.atlas.backError));
  const state=await frame.evaluate(()=>({
    ...Object.fromEntries([['head',QPAvatar],['clothes',QPClothes],['pets',QPPets],['shoes',QPShoes],['angel',QPEffects],['profile',QPAvatarDirection]].map(([name,api])=>[name,{ready:api.atlas.ready,error:api.atlas.error||api.atlas.normalizationError||null}])),
    back:{ready:QPAvatarDirection.atlas.backReady,error:QPAvatarDirection.atlas.backError||null}
  }));
  for(const [name,value] of Object.entries(state))assert(value.ready&&!value.error,name+': '+JSON.stringify(value));
  assert.equal(await frame.evaluate(()=>QPShoes.atlas.partsCount),18,'All eighteen independent feet must load in hosted and opaque-origin modes');
  const male=await frame.evaluate(()=>({ready:QPClothes.atlas.male?.ready,count:QPClothes.atlas.male?.count,shirt:QPClothes.inspect('top','shirt','m'),female:QPClothes.inspect('top','shirt','f')}));
  assert(male.ready&&male.count===10,'The separate male wardrobe must load all ten native cells');
  assert.equal(male.shirt.sourceUrl,'assets/sd-clothes-male.png');
  assert.equal(male.female.sourceUrl,'assets/sd-tops.png');
  state.maleWardrobe=male;
  return state;
}
async function rasterReport(frame,selector){
  return frame.evaluate(async selector=>{
    const elements=[...document.querySelectorAll(selector+' image')],result=[];
    for(const node of elements){
      const src=node.getAttribute('href');
      if(!src?.startsWith('data:image/png;base64,'))continue;
      const img=new Image();img.src=src;await img.decode();
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
      const data=cx.getImageData(0,0,c.width,c.height).data;let opaque=0,hash=2166136261;
      for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619)>>>0;if(i%4===3&&data[i]>80)opaque++;}
      result.push({width:c.width,height:c.height,opaque,pixelHash:hash,optionalTail:node.getAttribute('data-qpx-tail')==='true'});
    }
    return result;
  },selector);
}
async function renderCards(frame,avatars){
  await frame.evaluate(avatars=>{
    const examples=[['hair','bob',1,'f'],['hair','long',6,'f'],['hair','short',1,'m'],['hair','part',1,'m'],['top','hood',7,'f'],['bottom','skirt',7,'f'],['shoes','sneaker',8,'f'],['pet','cat',8,'f']];
    const poses=[{avatar:0,direction:'back',mode:'desk'},{avatar:1,direction:'back',mode:'floor'},{avatar:0,direction:'left',mode:'floor'},{avatar:1,direction:'right',mode:'desk'}];
    document.querySelector('#avatarQa').innerHTML='<section id="qaFull" style="display:flex;gap:40px;justify-content:center">'+avatars.map(a=>'<article>'+QPAvatar.render(a,300,3)+'</article>').join('')+'</section><section id="qaThumbs" style="display:flex;gap:26px;justify-content:center;margin-top:30px">'+examples.map(([cat,shape,color,sex])=>'<article>'+QPAvatar.thumb(cat,shape,color,88,sex)+'</article>').join('')+'</section><section id="qaPoses" style="display:flex;gap:20px;justify-content:center;margin-top:30px">'+poses.map(p=>'<article data-direction="'+p.direction+'" data-seat-mode="'+p.mode+'">'+QPAvatar.render(avatars[p.avatar],200,3)+'</article>').join('')+'</section>';
    for(const [i,p] of poses.entries()){
      const svg=document.querySelectorAll('#qaPoses .qp-pixel-avatar')[i];
      QPAvatarPose.apply(svg,{action:p.mode==='floor'?'floor-sit':'sit',seatMode:p.mode,direction:p.direction,facing:p.direction==='left'?'left':'right',grounded:true,phase:0});
    }
  },avatars);
  const full=await rasterReport(frame,'#qaFull'),thumbs=await rasterReport(frame,'#qaThumbs'),poses=await rasterReport(frame,'#qaPoses'),back=await rasterReport(frame,'#qaPoses [data-qpx-back-head]');
  assert(full.length>=14,'Two full avatars must retain head, clothes, shoes, pet and angel paintings');
  assert(thumbs.length>=8,'Hair, clothing, shoes and pet thumbnails must retain PNG paintings');
  for(const sprite of [...full,...thumbs])if(!sprite.optionalTail)assert(sprite.opaque>500,'Nonempty original sprite: '+JSON.stringify(sprite));
  assert.equal(await frame.locator('#qaFull .qpp-companion').count(),2);
  assert.equal(await frame.locator('#qaFull .qp-effect').count(),2);
  assert.equal(await frame.locator('#qaFull .qpx-blink-closed').count(),2);
  assert.equal(await frame.locator('#qaFull .qp-pixel-avatar').first().evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.equal(back.length,4,'Every seated card retains a real painted back-head layer');
  for(const sprite of back)assert(sprite.opaque>500,'Back-head painting must retain visible original pixels: '+JSON.stringify(sprite));
  assert.equal(await frame.locator('#qaPoses [data-qpx-view="back"]').count(),2,'Male and female actual back views must render');
  assert.equal(await frame.locator('#qaPoses [data-qpx-view="profile"]').count(),2,'Both profile directions must render while seated');
  assert.equal(await frame.locator('#qaPoses [data-qpx-pose="floor-sit"][data-qpx-seat-mode="floor"]').count(),2,'Floor sitting must use its actual pose and seat mode');
  const poseStates=await frame.locator('#qaPoses .qp-pixel-avatar').evaluateAll(nodes=>nodes.map(svg=>({view:svg.dataset.qpxView,mode:svg.dataset.qpxSeatMode,pose:svg.dataset.qpxPose,backLoading:svg.dataset.qpxBackLoading||null,backEyes:svg.dataset.qpxBackEyeCount||null,backVisible:!![...svg.querySelectorAll('[data-qpx-back-head]')].find(n=>getComputedStyle(n).display!=='none'),sex:svg.dataset.qpxSex})));
  for(const state of poseStates.filter(s=>s.view==='back')){assert.equal(state.backLoading,'false');assert.equal(state.backEyes,'0');assert(state.backVisible,'Real back-head group must be visible');}
  return {full,thumbs,poses,back,poseStates};
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated avatar QA */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?demo=1&user=하늘&session=avatar-files-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame&&window.QPDemo);await page.evaluate(()=>QPGame.go('home'));const httpAtlases=await ready(page);
    await page.waitForSelector('#meStage');
    assert.equal(await page.locator('#meStage .qp-pixel-avatar').evaluate(e=>getComputedStyle(e).visibility),'visible');
    assert.equal(await page.evaluate(()=>!!window.QPAvatarFileData),false,'Hosted page should keep original normal PNG loading');
    assert.equal(await page.evaluate(()=>!!window.QPAvatarMaleFileData),false,'Hosted male wardrobe should keep normal PNG loading');
    await page.evaluate(()=>QPGame.go('shop'));await page.waitForSelector('#pvStage');
    const previews=[];
    for(const cat of ['hair','top','bottom','shoes','pet']){
      await page.locator('#shTabs [data-c="'+cat+'"]').click();
      const products=page.locator('#shGrid [data-id]');assert(await products.count()>0);
      const sprites=await rasterReport(page,'#shGrid');assert(sprites.length>0,cat+' shop should show real original paintings');
      for(const sprite of sprites)if(!sprite.optionalTail)assert(sprite.opaque>500,cat+' thumbnail is empty: '+JSON.stringify(sprite));
      await products.first().click();assert.equal(await page.locator('#pvStage .qp-pixel-avatar').evaluate(e=>getComputedStyle(e).visibility),'visible');
      previews.push({category:cat,products:await products.count(),paintings:sprites.length});
    }
    await page.locator('#btnGender').click();
    await page.locator('#avatarSexChoices [data-sex="m"]').click();
    await page.waitForFunction(()=>QPGame.getMe().av.sex==='m');
    await page.locator('#shTabs [data-c="hair"]').click();assert.equal(await page.locator('#shGrid [data-id]').count(),12);
    assert.equal(await page.locator('#pvStage .qp-pixel-avatar').getAttribute('data-qpx-sex'),'m');
    await page.locator('#btnGender').click();await page.locator('#avatarSexChoices [data-sex="f"]').click();
    await page.waitForFunction(()=>QPGame.getMe().av.sex==='f');assert.equal(await page.locator('#shGrid [data-id]').count(),8);
    await page.screenshot({path:path.join(out,'파일원화-HTTP-옷가게.png')});
    const globals=await page.evaluate(()=>({PAL:QPGame.getCatalog().PAL,CAT:Object.fromEntries(QPGame.getCatalog().CATS.map(c=>[c.k,c])),shade:sh.toString(),avatars:[{...QPGame.getMe().av,sex:'f',hair:'long:6',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',pet:'cat:8',effect:'angel:0',bg:'',frame:''},{...QPGame.getMe().av,sex:'m',sk:4,hair:'part:1',top:'shirt:10',bottom:'jeans:11',shoes:'dress:0',pet:'dog:10',effect:'angel:0',bg:'',frame:''}]}));
    const prefix='<base href="'+base+'"><script>const PAL='+JSON.stringify(globals.PAL)+';const CAT='+JSON.stringify(globals.CAT)+';const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));'+globals.shade+'</script>';
    const markup=prefix+modules.map(name=>'<script src="'+name+'"></script>').join('')+'<style>body{margin:0;background:#fff8e8;color:#235050;font-family:sans-serif}#avatarQa{padding:28px}h2{text-align:center}.qp-pixel-avatar{flex:none}</style><h2>원화 · 남녀 아바타와 상품</h2><main id="avatarQa"></main>';
    await page.evaluate(()=>QPGame.go('school'));
    await page.evaluate(markup=>{document.body.innerHTML='<iframe id="avatarReference" style="width:100%;height:720px;border:0"></iframe><iframe id="avatarOpaque" sandbox="allow-scripts" style="width:100%;height:720px;border:0"></iframe>';document.querySelector('#avatarReference').srcdoc=markup;document.querySelector('#avatarOpaque').srcdoc=markup;},markup);
    const reference=await (await page.$('#avatarReference')).contentFrame(),opaque=await (await page.$('#avatarOpaque')).contentFrame();
    const referenceAtlases=await ready(reference),opaqueAtlases=await ready(opaque);
    assert.equal(await opaque.evaluate(()=>window.origin),'null','Iframe must retain real opaque origin security');
    assert.equal(await opaque.evaluate(()=>!!window.QPAvatarFileData),true,'Opaque origin must use original byte bundle');
    assert.equal(await opaque.evaluate(()=>!!window.QPAvatarMaleFileData),true,'Opaque male art must use its separate byte bundle');
    assert.equal(await reference.evaluate(()=>!!window.QPAvatarFileData),false,'Normal origin must avoid additional bundle');
    assert.equal(await reference.evaluate(()=>!!window.QPAvatarMaleFileData),false,'Normal male art must avoid the extra bundle');
    const referenceRaster=await renderCards(reference,globals.avatars),opaqueRaster=await renderCards(opaque,globals.avatars);
    assert.deepEqual(opaqueRaster,referenceRaster,'Safe fallback must preserve exact native sprite pixels and transparent boundaries');
    assert.deepEqual(opaqueRaster.back,referenceRaster.back,'Opaque-origin fallback must preserve exact native painted back PNG pixels');
    await page.locator('#avatarOpaque').screenshot({path:path.join(out,'파일원화-불투명출처-아바타와상품.png')});
    assert.deepEqual(errors,[]);
    const filePage=await context.newPage();let fileStatus;filePage.on('pageerror',e=>errors.push(e.message));
    try{
      await filePage.goto(pathToFileURL(path.join(root,'index.html')).href+'?demo=1&session=avatar-direct-file-'+Date.now());
      await filePage.waitForFunction(()=>window.QPGame&&window.QPDemo);await filePage.evaluate(()=>QPGame.go('home'));const atlases=await ready(filePage);await filePage.waitForSelector('#meStage');
      assert.equal(await filePage.locator('#meStage .qp-pixel-avatar').evaluate(e=>getComputedStyle(e).visibility),'visible');
      await filePage.evaluate(()=>QPGame.go('shop'));await filePage.waitForSelector('#pvStage');
      assert((await rasterReport(filePage,'#shGrid')).length>0);fileStatus={status:'passed',atlases};
    }catch(error){
      if(!String(error.message).includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw error;
      fileStatus={status:'blocked',reason:'Cloud Chromium managed URL policy rejects file:// before the page can load; browser policy and canvas security were not changed.'};
    }finally{await filePage.close();}
    assert.deepEqual(errors,[]);
    const report={httpAtlases,previews,genders:['m','f'],referenceAtlases,opaqueAtlases,opaqueOrigin:'null',nativePixelsIdentical:true,backPaintingsNativePixelsIdentical:true,fullAvatarPaintings:opaqueRaster.full.length,thumbnailPaintings:opaqueRaster.thumbs.length,seatedAvatarPaintings:opaqueRaster.poses.length,backPaintings:opaqueRaster.back,poseStates:opaqueRaster.poseStates,fileNavigation:fileStatus,errors};
    fs.writeFileSync(path.join(out,'파일원화-검증.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
