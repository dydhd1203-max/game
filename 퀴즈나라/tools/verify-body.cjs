const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1500,height:920}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated body art preview */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?demo=1&session=body-'+Date.now());
  if(!await page.evaluate(()=>!!window.QPShoes))await page.addScriptTag({url:'http://127.0.0.1:4173/avatar-shoes.js'});
  await page.waitForFunction(()=>QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.ready);
  for(const [w,h] of [[1920,1080],[1366,768],[1280,632],[1024,632]]){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>QPGame.go('home'));const home=await page.locator('#meStage > svg').evaluate(e=>e.getBoundingClientRect().height);assert(home<=280);await page.evaluate(()=>QPGame.go('shop'));const shop=await page.locator('#pvStage > svg').evaluate(e=>e.getBoundingClientRect().height);assert(shop<=300);}
  await page.setViewportSize({width:1500,height:920});await page.evaluate(()=>QPGame.go('home'));
  const report=await page.evaluate(async()=>{
    const colors=['#ff647c','#ffa358','#ffd444','#91da3e','#4acec1','#58b3ff','#9874fa','#ff8ad4','#fff6eb','#526176','#f2dfbd','#a87352'];
    const image=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
    const decode=async(shape,color)=>{const holder=document.createElement('div');holder.innerHTML=QPShoes.render(shape,color);const img=await image(holder.querySelector('image').getAttribute('href')),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);return cx.getImageData(0,0,c.width,c.height).data;};
    const tiles=[],colorChecks=[],source=await image(QPShoes.atlas.url);
    for(const shape of QPShoes.names){
      const tile={shape,...QPShoes.inspect(shape)};tiles.push(tile);const reference=await decode(shape,colors[0]),rawCanvas=document.createElement('canvas');rawCanvas.width=tile.width;rawCanvas.height=tile.height;const rawContext=rawCanvas.getContext('2d',{willReadFrequently:true});rawContext.drawImage(source,...tile.sourceRect,0,0,tile.width,tile.height);const original=rawContext.getImageData(0,0,tile.width,tile.height).data;
      for(const color of colors){const pixels=await decode(shape,color);let alphaChanged=0,changed=0,whiteChanged=0,goldChanged=0,white=0,gold=0;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]!==reference[i+3])alphaChanged++;if(reference[i+3]<120)continue;const r=original[i],g=original[i+1],b=original[i+2],diff=pixels[i]!==r||pixels[i+1]!==g||pixels[i+2]!==b;if(pixels[i]!==reference[i]||pixels[i+1]!==reference[i+1]||pixels[i+2]!==reference[i+2])changed++;if(r>220&&g>210&&b>185&&r>=b&&Math.max(r,g,b)-Math.min(r,g,b)<45){white++;if(diff)whiteChanged++;}if(r>160&&r>g*1.13&&g>b*1.25){gold++;if(diff)goldChanged++;}}
        colorChecks.push({shape,color,alphaChanged,changed,white,whiteChanged,gold,goldChanged});
      }
    }
    const styles=[{sex:'m',sk:4,hair:'short:1',top:'hood:7',bottom:'shorts:5',shoes:'loafer:0',name:'남자 · 어두운 피부'},{sex:'m',sk:0,hair:'part:1',top:'tee:3',bottom:'shorts:5',shoes:'sneaker:8',name:'남자 · 밝은 피부'},{sex:'f',sk:0,hair:'bob:1',top:'hood:7',bottom:'skirt:7',shoes:'ballet:7',name:'여자 · 후드와 치마'},{sex:'f',sk:3,hair:'long:6',top:'tank:10',bottom:'shorts:1',shoes:'sandal:3',name:'여자 · 민소매와 샌들'}];
    const avatars=styles.map(p=>Object.assign(QPGame.newAvatar(p.sex),p,{expression:'bright:0',hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',bg:'',frame:'',effect:''}));
    document.body.innerHTML='<main style="padding:24px;color:#fff;font-family:inherit"><h1>세밀한 팔·손·다리와 9종 신발</h1><section style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px">'+avatars.map((a,i)=>'<article style="background:#125887;border:2px solid #65c3eb;border-radius:12px;padding:22px 0;display:flex;flex-direction:column;align-items:center">'+QPAvatar.render(a,360,3)+'<p style="font-size:18px">'+styles[i].name+'</p></article>').join('')+'</section><section style="display:grid;grid-template-columns:repeat(9,1fr);gap:10px;margin-top:26px">'+QPShoes.names.map(shape=>'<article style="background:#effaff;border:2px solid #63b5df;border-radius:8px;display:flex;flex-direction:column;align-items:center;padding:10px 2px;color:#194365"><svg viewBox="8 40 16 7" width="140" height="85">'+QPShoes.render(shape,'#ff8ad4')+'</svg><p>'+shape+'</p></article>').join('')+'</section></main>';
    return {atlas:QPShoes.atlas,tiles,colorChecks,unknownShape:QPShoes.render('missing','#ff8ad4'),renderedShoeImages:document.querySelectorAll('.qps-shoes image').length,handPaths:document.querySelector('.qpx-hand-left').querySelectorAll('path').length,skinColors:[...new Set([...document.querySelectorAll('.qpx-arms *')].map(e=>e.getAttribute('fill')).filter(Boolean))]};
  });
  assert.equal(report.atlas.count,9);assert.equal(report.tiles.length,9);assert.equal(report.colorChecks.length,108);assert.equal(report.unknownShape,'');
  for(const t of report.tiles){
    const [x,y,w,h]=t.sourceRect;
    assert.equal(t.width,w);assert.equal(t.height,h);
    assert(x>=0&&y>=0&&x+w<=report.atlas.width&&y+h<=report.atlas.height,t.shape+' must retain an independent original painting');
    assert(t.width>=160&&t.height>=120&&t.opaquePixels>15000,t.shape+' should have two detailed complete shoes');
    const mappedRatio=t.target[2]/(t.target[3]*1.35),nativeRatio=t.width/t.height;
    assert(Math.abs(mappedRatio/nativeRatio-1)<.025,t.shape+' must preserve the native shoe proportions on the actual full body');
  }
  for(const c of report.colorChecks){assert.equal(c.alphaChanged,0,c.shape+' recoloring must preserve transparency');assert.equal(c.whiteChanged,0,c.shape+' neutral trim must be preserved');assert.equal(c.goldChanged,0,c.shape+' metallic details must be preserved');if(c.color!=='#ff647c')assert(c.changed>2000,c.shape+' needs visible color choices');}
  assert(report.handPaths>=4);assert.equal(report.renderedShoeImages,13);assert.deepEqual(errors,[]);
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);await page.screenshot({path:path.resolve(__dirname,'../검증/몸과-신발-디테일.png')});
  fs.writeFileSync(path.resolve(__dirname,'../검증/몸과-신발-검증.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({tiles:report.tiles,colorChecks:report.colorChecks.length,fullAvatars:4,viewports:4,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
