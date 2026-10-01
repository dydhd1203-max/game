const {chromium}=require('playwright'),path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated hairstyle review */',contentType:'text/javascript'}));
  const page=await context.newPage();await page.goto('http://127.0.0.1:4173/?demo=1&session=hair-'+Date.now());
  await page.waitForFunction(()=>QPAvatar?.atlas.ready===true&&QPClothes?.atlas.ready===true);
  await page.evaluate(()=>{
    const names=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'];
    document.body.innerHTML='<main style="width:1390px;margin:16px auto;color:#fff"><h1 style="font-size:24px;margin:0 0 12px">12종 헤어 · 남녀 얼굴 · 5가지 피부색</h1><section style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px">'+['f','m'].flatMap(sex=>names.map((hair,i)=>{
      const av=Object.assign(QPGame.newAvatar(sex),{sk:i%5,hair:hair+':'+[1,0,6,3,5,9,2,7,0,1,4,6][i],expression:'bright:0',top:'tee:5',bottom:'jeans:5',shoes:'sneaker:8',pet:'',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''});
      return '<article style="height:454px;min-width:0;background:#e5f5ff;border:2px solid #3e99c0;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center">'+QPAvatar.render(av,235,3).replace('style="display:block;','style="max-width:100%;display:block;')+'<p style="color:#175982;font-size:11px;text-align:center">'+(sex==='m'?'남자':'여자')+'<br>'+hair+'</p></article>';
    })).join('')+'</section></main>';
  });
  const coverage=await page.evaluate(async()=>{
    const checks=[];
    for(const [i,card] of [...document.querySelectorAll('article')].entries()){
      const head=card.querySelector('image[data-qpx-hair-color]:not([data-qpx-tail])'),img=new Image();img.src=head.getAttribute('href');await img.decode();
      const tile=i%12,size=img.naturalWidth/4,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,(tile%4)*size,Math.floor(tile/4)*size,size,size,0,0,size,size);
      const data=ctx.getImageData(0,0,size,size).data;let visible=0;for(let p=3;p<data.length;p+=4)if(data[p]>120)visible++;
      checks.push({sex:head.dataset.qpxSex,style:card.querySelector('p').textContent,visiblePixels:visible});
    }
    return checks;
  });
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.resolve(__dirname,'../검증/헤어-남녀전체.png')});
  fs.writeFileSync(path.resolve(__dirname,'../검증/헤어검증.json'),JSON.stringify(coverage,null,2));
  for(const head of coverage)assert(head.visiblePixels>500,'Missing avatar head: '+head.style);
  console.log(JSON.stringify({headCount:coverage.length,minimumVisiblePixels:Math.min(...coverage.map(h=>h.visiblePixels))}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
