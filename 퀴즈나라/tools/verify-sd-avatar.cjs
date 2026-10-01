/* Browser integration and raster checks for the illustrated SD wardrobe. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../검증');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated SD wardrobe QA */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?demo=1&user=하늘&session=sd-art-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame&&window.QPDemo&&QPGame.getMe());
    await page.waitForFunction(()=>[QPAvatar.atlas,QPClothes.atlas,QPShoes.atlas,QPPets.atlas,QPEffects.atlas].every(a=>a.ready||a.error||a.normalizationError));
    const health=await page.evaluate(()=>({head:QPAvatar.atlas,clothes:QPClothes.atlas,shoes:QPShoes.atlas,pets:QPPets.atlas,angel:QPEffects.atlas}));
    for(const [name,a] of Object.entries(health))assert(a.ready&&!a.error&&!a.normalizationError,name+': '+JSON.stringify(a));
    assert(health.head.hairUrl.includes('sd-heads-female.png')&&health.head.maleUrl.includes('sd-heads-male.png'),'Actual avatar must use newly drawn illustrated heads');
    assert(health.clothes.categories.top.url.includes('sd-tops.png')&&health.clothes.categories.bottom.url.includes('sd-bottoms.png'),'Actual wardrobe must use the new illustrated outfits');
    assert(health.shoes.url.includes('sd-shoes.png'),'Actual avatar must use newly drawn illustrated shoes');
    const smooth=async selector=>{
      const bad=await page.locator(selector).evaluateAll(nodes=>nodes.flatMap(root=>[root,...root.querySelectorAll('svg,image')].filter(e=>['pixelated','crisp-edges'].includes(getComputedStyle(e).imageRendering.toLowerCase())||getComputedStyle(e).shapeRendering.toLowerCase()==='crispedges').map(e=>({tag:e.tagName,style:getComputedStyle(e).imageRendering,shape:getComputedStyle(e).shapeRendering}))));
      assert.deepEqual(bad,[],'Illustrated artwork must render smoothly at the real display size');
    };
    await page.waitForSelector('#meStage > svg');assert.equal(await page.locator('#meStage > svg.wood-avatar').count(),1,'Illustrated home avatar must retain stump placement class');await smooth('#meStage > svg');
    await page.screenshot({path:path.join(out,'SD-실제-로비.png')});
    await page.evaluate(()=>QPGame.go('shop'));await page.waitForSelector('#pvStage > svg');await smooth('#pvStage > svg');
    const shop=[];
    for(const [sex,hairs] of [['f',8],['m',4]]){
      if(await page.evaluate(()=>QPGame.getMe().av.sex)!==sex){await page.locator('#btnGender').click();await page.locator('#avatarSexChoices [data-sex="'+sex+'"]').click();}
      for(const [cat,count] of [['hair',hairs],['top',14],['bottom',11],['shoes',9],['expression',8]]){
        await page.locator('#shTabs [data-c="'+cat+'"]').click();const products=page.locator('#shGrid [data-id]');assert.equal(await products.count(),count,sex+'/'+cat+' catalog');
        await smooth('#shGrid [data-id] > .thumb > svg');
        const items=await products.evaluateAll(async nodes=>{
          const results=[];
          for(const n of nodes){
            const image=n.querySelector('image:not([data-qpx-tail="true"])');
            if(!image){results.push({id:n.dataset.id,painted:false});continue;}
            const img=new Image();img.src=image.getAttribute('href');await img.decode();
            const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
            const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let opaque=0,partial=0;
            for(let i=3;i<pixels.length;i+=4){if(pixels[i]>80)opaque++;if(pixels[i]>0&&pixels[i]<255)partial++;}
            results.push({id:n.dataset.id,painted:true,width:canvas.width,height:canvas.height,opaque,partial});
          }return results;
        });
        for(const item of items){assert(item.painted,'Missing original product painting: '+item.id);assert(item.opaque>1500,'Empty/incomplete painted product: '+JSON.stringify(item));assert(item.partial>20,'Smooth antialiased artwork edge missing: '+JSON.stringify(item));}
        await products.first().click();await smooth('#pvStage > svg');shop.push({sex,category:cat,count,allProductsPainted:true});
      }
    }
    await page.locator('#shTabs [data-c="top"]').click();await page.screenshot({path:path.join(out,'SD-실제-남자옷가게.png')});
    const raster=await page.evaluate(async()=>{
      const catalog=QPGame.getCatalog(),cats=Object.fromEntries(catalog.CATS.map(c=>[c.k,c]));
      const sample={...QPGame.getMe().av,sex:'f',sk:0,hair:'bob:1',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',expression:'bright:0',pet:'',effect:'',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''};
      const fnv=(data,alpha=false)=>{let h=2166136261;for(let i=alpha?3:0;i<data.length;i+=alpha?4:1)h=Math.imul(h^data[i],16777619)>>>0;return h;};
      const decode=async source=>{const img=new Image();img.src=source;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);return{width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};};
      const mainSource=markup=>{const box=document.createElement('div');box.innerHTML=markup;return (box.querySelector('image[data-qpx-hair-color]:not([data-qpx-tail="true"])')||box.querySelector('image:not([data-qpx-tail="true"])'))?.getAttribute('href');};
      const stat=s=>{let opaque=0,partial=0,leftEdgeOpaque=0,rightEdgeOpaque=0;for(let i=3;i<s.data.length;i+=4){if(s.data[i]>80){opaque++;const x=(i-3)/4%s.width;if(x===0)leftEdgeOpaque++;if(x===s.width-1)rightEdgeOpaque++;}if(s.data[i]>0&&s.data[i]<255)partial++;}return {width:s.width,height:s.height,opaque,partial,leftEdgeOpaque,rightEdgeOpaque,alphaHash:fnv(s.data,true),pixelHash:fnv(s.data)};};
      const hair={f:['bob','long','twin','pony','curly','bun','hime','braid'],m:['short','part','messy','spiky']};
      const dye=[];
      for(const sex of ['f','m'])for(const shape of hair[sex]){
        const colors=catalog.PAL[cats.hair.pal],rows=[];
        for(let color=0;color<colors.length;color++)rows.push({color,...stat(await decode(mainSource(QPAvatar.thumb('hair',shape,color,80,sex))))});
        dye.push({sex,category:'hair',shape,colors:rows});
      }
      for(const category of ['top','bottom','shoes'])for(const shape of Object.keys(cats[category].src)){
        const colors=catalog.PAL[cats[category].pal],rows=[];
        for(let color=0;color<colors.length;color++)rows.push({color,...stat(await decode(mainSource(QPAvatar.thumb(category,shape,color,80,'f'))))});
        dye.push({category,shape,colors:rows});
      }
      const anchors=QPAvatar.atlas.eyeAnchors||{},hairOrder=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'];
      function eyesMask(source,sex,shape){
        const tile=hairOrder.indexOf(shape),sexAnchors=anchors[sex],point=sexAnchors?.[tile]||[11.5,20.5,23.7];
        const [left,right,cy]=point,mask=[],edgeMask=[];
        const type=(r,g,b)=>(r<90&&g<90&&b<100)?1:(r>245&&g>245&&b>245)?2:0;
        for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
          const xx=x*32/source.width,yy=y*40/source.height;
          if(Math.abs(yy-cy)>1.7||Math.min(Math.abs(xx-left),Math.abs(xx-right))>1.85)continue;
          const i=(y*source.width+x)*4,r=source.data[i],g=source.data[i+1],b=source.data[i+2];
          const t=type(r,g,b);if(source.data[i+3]>220&&t){
            // Smooth scaling mixes eye-border pixels with the surrounding
            // skin. Require exact preservation in measured feature interiors.
            let interior=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
              const j=((y+dy)*source.width+x+dx)*4;if(type(source.data[j],source.data[j+1],source.data[j+2])!==t)interior=false;
            }
            (interior?mask:edgeMask).push(i);
          }
        }return {point,mask,edgeMask};
      }
      const details=[];
      for(const [sex,shape] of Object.entries(hair).flatMap(([sex,shapes])=>shapes.map(shape=>[sex,shape]))){
        const av={...sample,sex,hair:shape+':1'},reference=await decode(mainSource(QPAvatar.render(av,280,3))),mask=eyesMask(reference,sex,shape);
        const compare=other=>mask.mask.reduce((count,i)=>count+([0,1,2,3].some(j=>other.data[i+j]!==reference.data[i+j])?1:0),0);
        const changedExamples=other=>mask.mask.filter(i=>[0,1,2,3].some(j=>other.data[i+j]!==reference.data[i+j])).slice(0,5).map(i=>({point:[i/4%reference.width*32/reference.width,Math.floor(i/4/reference.width)*40/reference.height],before:[...reference.data.slice(i,i+4)],after:[...other.data.slice(i,i+4)]}));
        const maxDelta=other=>mask.mask.reduce((max,i)=>Math.max(max,...[0,1,2,3].map(j=>Math.abs(other.data[i+j]-reference.data[i+j]))),0);
        const border=other=>({borderFeaturePixels:mask.edgeMask.length,changedBorderFeaturePixels:mask.edgeMask.filter(i=>[0,1,2,3].some(j=>other.data[i+j]!==reference.data[i+j])).length,maxBorderChannelDelta:mask.edgeMask.reduce((max,i)=>Math.max(max,...[0,1,2,3].map(j=>Math.abs(other.data[i+j]-reference.data[i+j]))),0)});
        for(let ci=0;ci<catalog.PAL[cats.hair.pal].length;ci++){
          const image=await decode(mainSource(QPAvatar.render({...av,hair:shape+':'+ci},280,3)));
          details.push({sex,shape,kind:'hair dye',value:ci,referenceFeaturePixels:mask.mask.length,changedFeaturePixels:compare(image),maxFeatureChannelDelta:maxDelta(image),changedExamples:changedExamples(image),...border(image),eyeAnchors:mask.point});
        }
        for(let sk=0;sk<catalog.PAL.skin.length;sk++){
          const image=await decode(mainSource(QPAvatar.render({...av,sk},280,3)));
          details.push({sex,shape,kind:'skin tone',value:sk,referenceFeaturePixels:mask.mask.length,changedFeaturePixels:compare(image),maxFeatureChannelDelta:maxDelta(image),changedExamples:changedExamples(image),...border(image),head:stat(image),eyeAnchors:mask.point});
        }
      }
      async function full(av,height,pose='open'){
        const holder=document.createElement('div');holder.innerHTML=QPAvatar.render(av,height,3);const svg=holder.firstElementChild;
        const css=document.createElementNS('http://www.w3.org/2000/svg','style');css.textContent='*{animation:none!important;image-rendering:auto;shape-rendering:geometricPrecision}.qpx-blink-half{opacity:'+(pose==='half'?1:0)+'!important}.qpx-blink-closed{opacity:'+(pose==='closed'?1:0)+'!important}';svg.insertBefore(css,svg.firstChild);
        return decode('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)));
      }
      const alignment=[];
      for(const sex of ['f','m'])for(const height of [80,280]){
        const image=await full({...sample,sex,hair:sex==='m'?'short:1':'bob:1'},height),missingRows=[];
        for(let y=Math.ceil(image.height*24.5/56);y<=Math.floor(image.height*36/56);y++){
          let painted=0;for(let x=Math.floor(image.width*14/32);x<=Math.ceil(image.width*18/32);x++)if(image.data[(y*image.width+x)*4+3]>40)painted++;
          if(!painted)missingRows.push(y);
        }
        alignment.push({sex,height,width:image.width,centerFaceNeckBodyMissingRows:missingRows,...stat(image)});
      }
      const blinkPixels=[];
      for(const [sex,shape] of Object.entries(hair).flatMap(([sex,shapes])=>shapes.map(shape=>[sex,shape])))for(const sk of [0,catalog.PAL.skin.length-1]){
        const av={...sample,sex,sk,hair:shape+':1'},open=await full(av,280),closed=await full(av,280,'closed'),half=await full(av,280,'half');
        const summary=[];
        for(const side of ['left','right']){
          const whites=[],darks=[],iris=[],x0=side==='left'?8:17,x1=side==='left'?15:24;
          for(let y=Math.floor(open.height*18.5/56);y<Math.ceil(open.height*27/56);y++)for(let x=Math.floor(open.width*x0/32);x<Math.ceil(open.width*x1/32);x++){
            const i=(y*open.width+x)*4,r=open.data[i],g=open.data[i+1],b=open.data[i+2];
            if(open.data[i+3]<220)continue;
            if(r<150&&g>r+13&&b>r+13)iris.push(i);
            if(r>230&&g>230&&b>230&&Math.max(r,g,b)-Math.min(r,g,b)<25)whites.push(i);
          }
          const center=iris.reduce((p,i)=>{const at=i/4;return[p[0]+at%open.width,p[1]+Math.floor(at/open.width)];},[0,0]).map(v=>v/Math.max(1,iris.length));
          for(let y=Math.max(0,Math.floor(center[1]-open.height*2.2/56));y<Math.min(open.height,Math.ceil(center[1]+open.height*2.2/56));y++)for(let x=Math.max(0,Math.floor(center[0]-open.width*2.6/32));x<Math.min(open.width,Math.ceil(center[0]+open.width*2.6/32));x++){
            const i=(y*open.width+x)*4;if(open.data[i+3]>220&&open.data[i]<90&&open.data[i+1]<90&&open.data[i+2]<100)darks.push(i);
          }
          const fraction=(pixels,other,predicate)=>pixels.length?pixels.filter(i=>predicate(other.data[i],other.data[i+1],other.data[i+2])).length/pixels.length:0;
          // The new closed curve lies below the original pupil's glint. Thick
          // dark arcs remaining above it are the original open-eye lashes.
          const upperDark=darks.filter(i=>Math.floor(i/4/open.width)<center[1]-open.height*.65/56);
          summary.push({side,independentIrisCenter:center.map((n,i)=>n*(i?56/open.height:32/open.width)),irisFeaturePixels:iris.length,whiteFeaturePixels:whites.length,darkFeaturePixels:darks.length,upperDarkPixels:upperDark.length,closedWhiteRemaining:fraction(whites,closed,(r,g,b)=>r>230&&g>230&&b>230&&Math.max(r,g,b)-Math.min(r,g,b)<25),closedDarkRemaining:fraction(darks,closed,(r,g,b)=>r<90&&g<90&&b<100),closedUpperDarkRemaining:fraction(upperDark,closed,(r,g,b)=>r<90&&g<90&&b<100),halfChangedPixels:[...whites,...darks].filter(i=>[0,1,2].some(j=>half.data[i+j]!==open.data[i+j])).length});
        }
        let changed=0,outsideFace=0;
        for(let i=0;i<open.data.length;i+=4)if([0,1,2,3].some(j=>open.data[i+j]!==closed.data[i+j])){changed++;const at=i/4,x=(at%open.width)*32/open.width,y=Math.floor(at/open.width)*56/open.height;if(x<7.5||x>24.5||y<18||y>28)outsideFace++;}
        blinkPixels.push({sex,shape,skin:sk,eyes:summary,changedPixels:changed,changedOutsideFace:outsideFace,openPixelHash:fnv(open.data),halfPixelHash:fnv(half.data),closedPixelHash:fnv(closed.data)});
      }
      const expression=[];
      for(const shape of Object.keys(QPAvatar.expressions))expression.push({shape,...stat(await full({...sample,expression:shape+':0'},280))});
      return{dye,details,alignment,blinkPixels,expression,skins:catalog.PAL.skin.length,headPixels:QPAvatar.atlas.headPixels};
    });
    fs.writeFileSync(path.join(out,'SD-래스터-검증.json'),JSON.stringify(raster,null,2));
    for(const sex of ['f','m'])for(const skin of [0,raster.skins-1]){
      const shapes=raster.dye.filter(d=>d.category==='hair'&&d.sex===sex).map(d=>d.shape);
      await page.evaluate(({sex,skin,shapes})=>{
        const av={...QPGame.getMe().av,sex,sk:skin,top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',expression:'bright:0',pet:'',effect:'',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''};
        document.documentElement.style.overflow='visible';document.body.style.cssText='height:auto;min-height:100vh;overflow:visible;display:block;background:#fff8ec';
        document.body.innerHTML='<main style="padding:24px;color:#31565c"><h1>'+sex+' · 피부 '+skin+' · 모든 헤어의 실제 눈 깜박임</h1><section style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'+shapes.flatMap(shape=>['open','half','closed'].map(pose=>'<article data-pose="'+pose+'" style="display:flex;flex-direction:column;align-items:center;padding:8px;border:1px solid #c4dfd8;border-radius:16px;background:white">'+QPAvatar.render({...av,hair:shape+':1'},280,3)+'<p>'+shape+' · '+pose+'</p></article>')).join('')+'</section></main>';
      },{sex,skin,shapes});
      await page.waitForTimeout(100);
      await page.evaluate(()=>{for(const card of document.querySelectorAll('[data-pose]'))for(const animation of card.getAnimations({subtree:true})){animation.pause();animation.currentTime=animation.animationName.startsWith('qpx-blink-')?animation.effect.getTiming().duration*({open:.5,half:.968,closed:.978}[card.dataset.pose]):0;}});
      await page.screenshot({path:path.join(out,'SD-'+sex+'-피부'+skin+'-모든헤어-눈깜박임.png'),fullPage:true});
    }
    for(const row of raster.dye){
      assert.equal(row.colors.length,12,row.category+'/'+row.shape+' must retain 12 colors');
      assert.equal(new Set(row.colors.map(c=>c.alphaHash)).size,1,row.category+'/'+row.shape+' recoloring changed original transparency');
      assert.equal(new Set(row.colors.map(c=>c.pixelHash)).size,12,row.category+'/'+row.shape+' must visibly change across all 12 colors');
      for(const color of row.colors){assert(color.opaque>1500&&color.partial>20,'Native illustrated painting incomplete: '+JSON.stringify({shape:row.shape,...color}));}
      if(row.category==='hair')for(const color of row.colors)assert.equal(color.leftEdgeOpaque+color.rightEdgeOpaque,0,'Normalized hairstyle must retain its complete silhouette inside the canvas: '+JSON.stringify({shape:row.shape,...color}));
    }
    for(const [sex,count] of [['f',8],['m',4]]){
      const styles=raster.dye.filter(d=>d.category==='hair'&&d.sex===sex);
      assert.equal(new Set(styles.map(d=>d.colors[1].pixelHash)).size,count,'Each '+sex+' hairstyle must retain distinct painted artwork');
    }
    for(const d of raster.details){
      assert(d.referenceFeaturePixels>40,'Eye/glint sampling needs real face detail: '+JSON.stringify(d));
      assert.equal(d.changedFeaturePixels,0,'Hair and skin dye must preserve every measured pupil/glint core pixel: '+JSON.stringify(d));
    }
    for(const style of raster.dye.filter(d=>d.category==='hair')){
      const skins=raster.details.filter(d=>d.sex===style.sex&&d.shape===style.shape&&d.kind==='skin tone');
      assert.equal(new Set(skins.map(d=>d.head.pixelHash)).size,raster.skins,'Every skin tone must change the actual painted face');
      assert.equal(new Set(skins.map(d=>d.head.alphaHash)).size,1,'Skin dye must preserve the original smooth silhouette');
    }
    for(const a of raster.alignment)assert.deepEqual(a.centerFaceNeckBodyMissingRows,[],JSON.stringify(a));
    for(const b of raster.blinkPixels){
      assert.equal(new Set([b.openPixelHash,b.halfPixelHash,b.closedPixelHash]).size,3,'Blink must change actual visible pixels');
      assert(b.changedOutsideFace/Math.max(1,b.changedPixels)<.025,'Blink must not paint skin patches over forehead hair: '+JSON.stringify(b));
      for(const eye of b.eyes){assert(eye.irisFeaturePixels>15&&eye.whiteFeaturePixels>5&&eye.darkFeaturePixels>15,'Independent face-region scan must find drawn eyes: '+JSON.stringify({sex:b.sex,...eye}));assert(eye.closedWhiteRemaining<.12&&eye.closedDarkRemaining<.65&&eye.closedUpperDarkRemaining<.2,'Closed eyelids must cover the actual pupils, glints and upper lash arcs: '+JSON.stringify({sex:b.sex,...eye}));assert(eye.halfChangedPixels>5,'Half blink must affect the actual eye region');}
    }
    assert.equal(raster.expression.length,8);assert.equal(new Set(raster.expression.map(e=>e.pixelHash)).size,8,'Eight expressions must have visually different rendered pixels');
    await page.evaluate(()=>{
      const base={...QPGame.getMe().av,sex:'f',sk:0,hair:'bob:1',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',expression:'bright:0',pet:'cat:8',effect:'angel:0',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''};
      document.documentElement.style.overflow='visible';document.body.style.cssText='height:auto;min-height:100vh;display:block;overflow:visible;background:#fff8ec';
      document.body.innerHTML='<main style="padding:24px;background:#fff8ec;color:#31565c;min-height:100vh;overflow:visible"><h1>일러스트 SD · 실제 표시 크기와 눈 깜박임</h1><section style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px">'+['f','m'].flatMap(sex=>['open','half','closed'].map(pose=>'<article data-pose="'+pose+'" style="display:flex;flex-direction:column;align-items:center;border:2px solid #c4dfd8;border-radius:18px;background:white;padding:12px 0">'+QPAvatar.render({...base,sex,hair:sex==='m'?'part:1':'bob:1',sk:sex==='m'?4:0},280,3)+'<p>'+sex+' · '+pose+'</p></article>')).join('')+'</section><section style="display:flex;gap:36px;justify-content:center;margin-top:24px">'+[80,280].flatMap(height=>['f','m'].map(sex=>'<article style="display:flex;flex-direction:column;align-items:center">'+QPAvatar.render({...base,sex,hair:sex==='m'?'short:1':'long:6'},height,3)+'<p>'+height+'px · '+sex+'</p></article>')).join('')+'</section></main>';
    });
    await page.waitForTimeout(100);
    const blink=await page.evaluate(()=>[...document.querySelectorAll('[data-pose]')].map(card=>{
      const phase={open:.5,half:.968,closed:.978}[card.dataset.pose];
      for(const a of card.getAnimations({subtree:true})){a.pause();a.currentTime=a.animationName.startsWith('qpx-blink-')?a.effect.getTiming().duration*phase:0;}
      return{pose:card.dataset.pose,half:+getComputedStyle(card.querySelector('.qpx-blink-half')).opacity,closed:+getComputedStyle(card.querySelector('.qpx-blink-closed')).opacity,pet:!!card.querySelector('.qpp-companion'),angel:!!card.querySelector('.qp-effect'),wingPaintings:card.querySelectorAll('[data-qp-effect-part]').length};
    }));
    for(const b of blink){assert.equal(b.half,b.pose==='half'?1:0);assert.equal(b.closed,b.pose==='closed'?1:0);assert(b.pet&&b.angel&&b.wingPaintings===3,'Pet and full three-part angel must coexist');}
    await page.screenshot({path:path.join(out,'SD-남녀-크기와눈깜박임.png'),fullPage:true});
    const motion=await page.evaluate(async()=>{
      const body=document.querySelector('[data-pose="open"] .qpx-body');const motions=body.getAnimations();
      for(const a of motions)a.play();const first=motions.map(a=>a.currentTime);await new Promise(r=>setTimeout(r,100));
      return motions.map((a,i)=>({name:a.animationName,first:first[i],after:a.currentTime,easing:getComputedStyle(body).animationTimingFunction,iterations:a.effect.getTiming().iterations}));
    });
    assert(motion.some(m=>m.after>m.first+50&&m.iterations===Infinity),'Continuous breathing animation must remain active');
    for(const m of motion)assert(!m.easing.includes('steps'),'Illustrated motion should move smoothly');
    assert.deepEqual(errors,[]);
    const summary={health,shop,colorCases:raster.dye.reduce((n,r)=>n+r.colors.length,0),hairShapes:12,outfitShapes:34,skins:raster.skins,protectedEyeChecks:raster.details.length,alignment:raster.alignment,blinkPixels:raster.blinkPixels,expression:raster.expression,blink,motion,errors};
    fs.writeFileSync(path.join(out,'SD-아바타-검증.json'),JSON.stringify({summary,raster},null,2));console.log(JSON.stringify(summary,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
