// One hat on 6 hair styles per sex x front/right/back: node hats-one.cjs ROOT OUT.png HATS(comma)
const ROOT=process.argv[2],OUT=process.argv[3],HATS=process.argv[4].split(',');
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const hairs=[['m','short'],['m','spiky'],['m','slick'],['f','bob'],['f','twin'],['f','long']];
  const cells=[];
  for(const hat of HATS)for(const [sex,h] of hairs)for(const d of ['front','right','back'])cells.push({av:{sex,sk:0,hair:h+':1',expression:'bright:0',hat},state:{action:'idle',direction:d,time:0,reducedMotion:true},size:220});
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:18,cellW:120,cellH:150,top:-6,labelW:0});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
