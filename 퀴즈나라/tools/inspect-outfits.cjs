const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1500,height:1050}});
  await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated art inspection */',contentType:'text/javascript'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/?demo=1&session=outfits-'+Date.now());
  await page.waitForFunction(()=>window.QPAvatar?.atlas.ready===true&&window.QPClothes?.atlas.ready===true);
  for(const catKey of ['top','bottom']){
    const count=await page.evaluate(catKey=>{
      const cat=QPGame.getCatalog().CATS.find(c=>c.k===catKey),entries=Object.entries(cat.src);
      const shades=[7,5,4,3,6,2,9,5,7,4,3,5,7,2];
      document.body.style.background='#f5eefb';
      document.body.innerHTML='<main style="width:1460px;margin:22px auto;color:#58466e"><h1 style="font-size:26px;margin:0 0 18px">퀴즈나라 · '+cat.n+' 디테일</h1><section style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px">'+entries.map(([shape,value],i)=>{
        const a=Object.assign(QPGame.newAvatar(i%2?'m':'f'),{sk:i%5,hair:i%2?'part:0':'bob:1',expression:'bright:0',top:'tee:5',bottom:'jeans:5',shoes:'sneaker:8',pet:'',bg:'',frame:'',hat:'',glass:'',ear:'',neck:'',face:'',back:''});
        a[catKey]=shape+':'+shades[i];
        return '<article style="min-width:0;background:#fffaf5;border:1px solid #ded2ed;border-radius:20px;height:440px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center">'+QPAvatar.render(a,300,3).replace('style="display:block;','style="max-width:100%;display:block;')+'<p style="font-size:16px;font-weight:800;text-align:center">'+value[0]+'</p></article>';
      }).join('')+'</section></main>';
      return entries.length;
    },catKey);
    await page.screenshot({path:path.resolve(__dirname,'../검증/'+(catKey==='top'?'상의-디테일.png':'하의-디테일.png'))});
    console.log(catKey+': '+count+' outfits inspected');
  }
  console.log(JSON.stringify({errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
