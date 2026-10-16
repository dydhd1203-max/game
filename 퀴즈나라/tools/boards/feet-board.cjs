'use strict';
// 맨발 층 확인판(?demo=1 studio, 저장 안 함): 기본 운동화 기록을 복사해 그림을 투명하게 한 시험용 신발
// (record.feet=true, legacy=false)을 등록하고, 남녀 × 앞·옆·뒤 × 피부 5톤과 걷기 한 장면을 그린다.
// 예: node tools/boards/feet-board.cjs . 검증/맨발/판.png [크기]
const ROOT=process.argv[2],OUT=process.argv[3],SIZE=Number(process.argv[4])||280;
const path=require('node:path'),fs=require('node:fs');
const L=require(path.resolve(ROOT,'tools/foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const states=await page.evaluate(async()=>{
    const G=__fg.G,out={};
    for(const sex of ['m','f']){const g=G.get('shoes:sneaker',sex);if(!g)return 'sneaker not loaded';}
    const src=__fg.clone(G.get('shoes:sneaker','m').record);src.id='shoes:barefoottest';src.shape='barefoottest';src.legacy=false;src.feet=true;
    const images={};for(const sex of Object.keys(src.sexes)){const im=G.get('shoes:sneaker',sex).image,c=document.createElement('canvas');c.width=im.naturalWidth||im.width;c.height=im.naturalHeight||im.height;images[sex]=c;}
    return await G.register(src,images);
  });
  if(typeof states==='string'||Object.values(states).some(s=>s!=='ready'))throw new Error('register: '+JSON.stringify(states));
  const outfits=await page.evaluate(()=>Object.fromEntries(['m','f'].map(sex=>[sex,{...__fg.outfitFor(null,sex),shoes:'shoes:barefoottest'}])));
  const views=['front','right','back'];
  const cells=[];
  for(const sex of ['m','f'])for(const sk of [0,1,2,3,4])for(const view of views)cells.push({av:{sex,sk,hair:(sex==='m'?'short':'bob')+':1',expression:'bright:0',foundationGarments:outfits[sex]},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:SIZE});
  for(const sex of ['m','f'])for(const view of views)cells.push({av:{sex,sk:2,hair:(sex==='m'?'short':'bob')+':1',expression:'bright:0',foundationGarments:outfits[sex]},state:{action:'walk',direction:view,time:.18,reducedMotion:false},size:SIZE});
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:15,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.15),labelW:0});
  console.log(JSON.stringify(g.info.slice(0,2)));
  const nodes=await page.evaluate(()=>[...document.querySelectorAll('[data-outfit-part^="feet-"]')].map(e=>e.style.display!=='none'&&e.getAttribute('href')?1:0));
  fs.mkdirSync(path.dirname(OUT),{recursive:true});await L.capture(page,g,OUT);
  console.log(JSON.stringify({feetNodes:nodes.length,shown:nodes.reduce((a,b)=>a+b,0),errors:report.errors}));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
