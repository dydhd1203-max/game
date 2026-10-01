/* Independent rendered-alpha contact checks for the modular illustrated rig. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../검증'),base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:1680,height:1200}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated fitting QA */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?demo=1&session=fitting-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame&&QPGame.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.ready&&QPShoes.atlas.partsReady&&QPShoes.atlas.partsCount===18);
    const report=await page.evaluate(async()=>{
      const catalog=QPGame.getCatalog(),cats=Object.fromEntries(catalog.CATS.map(c=>[c.k,c]));
      const clean={...QPGame.getMe().av,sex:'f',sk:0,hair:'bob:1',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',expression:'bright:0',pet:'',effect:'',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''};
      const skins=catalog.PAL.skin.length,make=(top,bottom,sex='f',sk=0)=>({...clean,top:top+':7',bottom:bottom+':4',sex,sk,hair:sex==='m'?'short:1':'bob:1'});
      const pause=document.createElement('style');pause.textContent='.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';document.head.appendChild(pause);
      document.documentElement.style.overflow='visible';document.body.style.cssText='height:auto;overflow:visible;display:block;background:#fff8ec';
      const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0';document.body.replaceChildren(host);
      const NS='http://www.w3.org/2000/svg',drawable='path,ellipse,rect,image,polygon,line,polyline,circle';
      async function pixels(svg,select){
        const clone=svg.cloneNode(true),selected=select?new Set([...clone.querySelectorAll(select)]):null;
        if(select)for(const leaf of clone.querySelectorAll(drawable)){
          if(leaf.closest('defs'))continue;
          let parent=leaf,keep=false;while(parent&&parent!==clone){if(selected.has(parent)){keep=true;break;}parent=parent.parentElement;}
          if(!keep)leaf.remove();
        }
        const css=document.createElementNS(NS,'style');css.textContent='*{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}';clone.insertBefore(css,clone.firstChild);
        const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
        return{width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};
      }
      const points=(image,box)=>{
        const out=[];for(let y=Math.max(0,Math.floor(box[1]*image.height/56));y<Math.min(image.height,Math.ceil(box[3]*image.height/56));y++)for(let x=Math.max(0,Math.floor(box[0]*image.width/32));x<Math.min(image.width,Math.ceil(box[2]*image.width/32));x++)if(image.data[(y*image.width+x)*4+3]>100)out.push([x*32/image.width,y*56/image.height]);return out;
      };
      function contact(a,b,box){
        const aa=points(a,box),bb=points(b,box);let nearest=2.0001,overlap=0;
        const key=(x,y)=>Math.round(y*a.height/56)*a.width+Math.round(x*a.width/32);
        const bset=new Set(bb.map(([x,y])=>key(x,y)));
        for(const [x,y]of aa)if(bset.has(key(x,y)))overlap++;
        if(overlap)nearest=0;
        else{
          // Exact nearest pixel within two avatar units, using sorted pixel
          // rows. Larger gaps need only a lower bound to establish failure.
          const rows=new Map();for(const [x,y]of bb){const yy=Math.round(y*a.height/56);if(!rows.has(yy))rows.set(yy,[]);rows.get(yy).push(x);}
          for(const [x,y]of aa)for(let yy=Math.floor((y-nearest)*a.height/56);yy<=Math.ceil((y+nearest)*a.height/56);yy++){
            const row=rows.get(yy);if(!row)continue;const dy=yy*56/a.height-y;if(Math.abs(dy)>=nearest)continue;
            let lo=0,hi=row.length;while(lo<hi){const mid=(lo+hi)>>1;if(row[mid]<x)lo=mid+1;else hi=mid;}
            for(const at of [lo-1,lo])if(at>=0&&at<row.length)nearest=Math.min(nearest,Math.hypot(row[at]-x,dy));
          }
        }
        return{firstPixels:aa.length,secondPixels:bb.length,gap:aa.length&&bb.length?+nearest.toFixed(4):null,overlapPixels:overlap,distanceLimit:2};
      }
      function connectedFoot(image){
        const {width:w,height:h,data}=image,seen=new Uint8Array(w*h),parts=[];
        for(let p=0;p<seen.length;p++)if(!seen[p]&&data[p*4+3]>100){const queue=[p];seen[p]=1;for(let n=0;n<queue.length;n++){const q=queue[n],x=q%w,y=Math.floor(q/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;if(!seen[next]&&data[next*4+3]>100){seen[next]=1;queue.push(next);}}}parts.push(queue.length);}
        parts.sort((a,b)=>b-a);const total=parts.reduce((a,b)=>a+b,0);return{paintedPixels:total,components:parts,largestFraction:total?parts[0]/total:0};
      }
      function tagSkin(svg){
        // Identify the actual vector body parts by their painted geometry.
        for(const p of svg.querySelectorAll('.qpx-body path')){
          const b=p.getBBox();if(b.y<28&&b.x>14&&b.x+b.width<18)p.dataset.fittingSkin='neck';
          else if(b.y>37&&b.y+b.height>43)p.dataset.fittingSkin='leg';
        }
      }
      async function evaluate(av,label,state){
        host.innerHTML=QPAvatar.render(av,560,3);const svg=host.firstElementChild;tagSkin(svg);
        if(state){QPAvatarPose.apply(svg,state);tagSkin(svg);}
        const [all,top,bottom,neck,arms,legs,shoes,head]=await Promise.all([
          pixels(svg),pixels(svg,'[data-qpx-clothes="top"]'),pixels(svg,'[data-qpx-clothes="bottom"]'),pixels(svg,'.qpx-skin-torso'),pixels(svg,'.qpx-arms'),pixels(svg,'[data-fitting-skin="leg"]'),pixels(svg,'.qps-foot[data-qps-foot-side]'),pixels(svg,'.qpx-head')
        ]);
        const row={label,sex:av.sex,top:av.top,bottom:av.bottom,action:state?.action||'idle',phase:state?.phase,contacts:{
          // The squat moves the joints substantially; inspect their complete
          // rendered silhouettes rather than assuming idle screen positions.
          collar:contact(top,neck,[0,0,32,56]),
          leftSleeve:contact(top,arms,[0,0,16,56]),rightSleeve:contact(top,arms,[16,0,32,56]),
          waist:contact(top,bottom,[10,0,22,56]),
          leftAnkle:contact(legs,shoes,[0,0,16,56]),rightAnkle:contact(legs,shoes,[16,0,32,56]),
          headNeck:contact(head,neck,[13,0,19,56])
        },sourceTop:QPClothes.inspect('top',av.top.split(':')[0]),sourceBottom:QPClothes.inspect('bottom',av.bottom.split(':')[0])};
        if(av.top.startsWith('tank:')){
          const body=points(neck,[0,0,32,56]),ys=body.map(p=>p[1]),y0=Math.min(...ys),y1=y0+(Math.max(...ys)-y0)*.38;
          const [leftArm,rightArm]=await Promise.all([pixels(svg,'.qpx-arm-left'),pixels(svg,'.qpx-arm-right')]);
          row.contacts.leftShoulder=contact(neck,leftArm,[0,y0,16,y1]);
          row.contacts.rightShoulder=contact(neck,rightArm,[16,y0,32,y1]);
        }
        const footImages=await Promise.all(['left','right'].map(side=>pixels(svg,'.qps-foot[data-qps-foot-side="'+side+'"]')));
        row.feet=footImages.map((image,index)=>({side:index?'right':'left',...connectedFoot(image)}));
        const longPants=['jeans','legging','track','cargo'].includes(av.bottom.split(':')[0]);
        for(const[index,image]of footImages.entries()){
          const side=index?'right':'left',leg=await pixels(svg,'.qpx-leg-'+side);
          row.contacts[side+'NativeFootAnkle']=contact(leg,image,[0,0,32,56]);
          if(longPants){const pant=await pixels(svg,'[data-qpx-clothes="bottom"]');row.contacts[side+'TrouserAnkle']=contact(pant,image,[0,0,32,56]);}
        }
        let painted=0;for(let i=3;i<all.data.length;i+=4)if(all.data[i]>100)painted++;row.paintedPixels=painted;
        if(state)QPAvatarPose.destroy(svg);return row;
      }
      const catalogFits=[];
      for(const [index,top]of Object.keys(cats.top.src).entries())catalogFits.push(await evaluate(make(top,index%2?'jeans':'skirt',index%2?'m':'f'),top));
      for(const [index,bottom]of Object.keys(cats.bottom.src).entries())catalogFits.push(await evaluate(make('shirt',bottom,index%2?'m':'f'),bottom));
      for(const shoes of QPShoes.names)catalogFits.push(await evaluate({...make('tank','jeans','m',skins-1),shoes:shoes+':8'},'신발 '+shoes));
      const outfits=[['hood','pleat'],['shirt','jeans'],['sailor','star_skirt'],['knit','cargo'],['cardi','skirt'],['tank','shorts'],['dress','legging'],['robe','hanbok'],['overall','jeans'],['space','track'],['jacket','jean_skirt'],['vest','tutu']];
      const states=[{action:'idle'},{action:'walk',phase:.25,grounded:true},{action:'walk',phase:.75,grounded:true},{action:'jump',vy:4,grounded:false},{action:'sit',grounded:true}];
      const poseFits=[];
      for(const [index,[top,bottom]]of outfits.entries())for(const state of states)poseFits.push(await evaluate(make(top,bottom,index%2?'m':'f',index===3?skins-1:0),top+'/'+bottom,state));
      for(const top of ['tank','tee','shirt'])for(const state of states)poseFits.push(await evaluate({...make(top,'jeans','m',skins-1),hair:'messy:1',top:top+':'+(top==='tank'?7:3),bottom:'jeans:5',shoes:'sneaker:8'},'사용자 착용 '+top,state));
      for(const shoes of QPShoes.names)for(const state of states)poseFits.push(await evaluate({...make('tank','jeans','m',skins-1),shoes:shoes+':8'},'신발 '+shoes,state));
      const cards=outfits.map(([top,bottom],index)=>'<article style="background:white;border:1px solid #cfdbc6;padding:8px;display:flex;align-items:center;flex-direction:column">'+QPAvatar.render(make(top,bottom,index%2?'m':'f',index===3?skins-1:0),280,3)+'<p>'+top+' · '+bottom+'</p></article>');
      document.body.innerHTML='<main style="padding:24px;color:#3c5040"><h1>실제 의상 · 목 · 소매 · 허리 · 발목 연결</h1><section style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">'+cards.join('')+'</section></main>';
      return{catalogFits,poseFits,skins,gallery:outfits.map(([top,bottom],index)=>({label:top+' · '+bottom,av:make(top,bottom,index%2?'m':'f',index===3?skins-1:0)}))};
    });
    fs.writeFileSync(path.join(out,'SD-착용연결-검증.json'),JSON.stringify(report,null,2));
    await page.screenshot({path:path.join(out,'SD-12조합-착용연결.png'),fullPage:true});
    for(const state of [{action:'walk',phase:.25,grounded:true},{action:'walk',phase:.75,grounded:true},{action:'jump',vy:4,grounded:false},{action:'sit',grounded:true}]){
      await page.evaluate(({state,gallery})=>{
        document.body.innerHTML='<main style="padding:24px;color:#3c5040"><h1>실제 의상과 몸 연결 · '+state.action+(state.phase===undefined?'':' '+state.phase)+'</h1><section style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">'+gallery.map(({label,av})=>'<article style="background:white;border:1px solid #cfdbc6;padding:8px;display:flex;align-items:center;flex-direction:column">'+QPAvatar.render(av,280,3)+'<p>'+label+'</p></article>').join('')+'</section></main>';
        for(const svg of document.querySelectorAll('article > svg'))QPAvatarPose.apply(svg,state);
      },{state,gallery:report.gallery});
      await page.screenshot({path:path.join(out,'SD-12조합-'+state.action+(state.phase===undefined?'':'-'+state.phase)+'.png'),fullPage:true});
    }
    const failures=[];
    for(const row of [...report.catalogFits,...report.poseFits]){
      const c=row.contacts;
      for(const [part,limit]of [['collar',.8],['headNeck',.8],['waist',.8],['leftAnkle',.8],['rightAnkle',.8]]){
        if(c[part].gap===null||c[part].gap>limit)failures.push({label:row.label,action:row.action,part,...c[part]});
      }
      const shape=row.top.split(':')[0];
      if(['robe','space'].includes(shape)){
        // The robe covers its wrists; the space suit has painted gloves.
        // Their original paintings carry the silhouette instead of bare skin.
        for(const part of ['leftSleeve','rightSleeve'])assert(c[part].firstPixels>500,'Covered sleeve/glove must retain substantial original painting');
      }else for(const part of ['leftSleeve','rightSleeve'])if(c[part].gap===null||c[part].gap>.8)failures.push({label:row.label,action:row.action,part,...c[part]});
      if(shape==='tank')for(const part of ['leftShoulder','rightShoulder'])if(c[part].gap===null||c[part].gap>.35)failures.push({label:row.label,action:row.action,part,...c[part]});
      for(const foot of row.feet)if(foot.paintedPixels<150||foot.largestFraction<.985)failures.push({label:row.label,action:row.action,part:foot.side+'ShoeFragment',...foot});
      for(const side of ['left','right'])for(const suffix of ['NativeFootAnkle','TrouserAnkle']){const part=side+suffix;if(c[part]&&(c[part].gap===null||c[part].gap>.35))failures.push({label:row.label,action:row.action,part,...c[part]});}
      assert(row.paintedPixels>20000,'Actual clothed avatar must have substantial painted pixels');
    }
    console.log(JSON.stringify({catalogCases:report.catalogFits.length,poseCases:report.poseFits.length,failures,errors},null,2));
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[],'Rendered clothing and body must stay in contact in every pose');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
