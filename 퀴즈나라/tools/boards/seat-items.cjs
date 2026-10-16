const ROOT=process.argv[2],OUT=process.argv[3],SEX=process.argv[4];
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
const data=require(require('node:path').resolve(__dirname,'..','..','assets','seated','layers.json'));
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const ids=Object.keys(data[SEX].side.layers).filter(k=>k!=='base');
  const ci={m:{tee:5,hood:5,shirt:10,vest:9,cardi:3,jacket:11,knit:10,shorts:9,jeans:5,track:9,cargo:11},f:{tee:3,hood:7,shirt:10,vest:7,cardi:7,sailor:5,jacket:11,knit:10,tank:7,shorts:5,jeans:5,skirt:7,pleat:5,track:9,legging:9,tutu:7,cargo:11,jean_skirt:5,star_skirt:6}};
  const cells=[];
  for(const id of ids){const [slot,shape]=id.split(':');const av={sex:SEX,sk:0,hair:SEX==='m'?'crop:1':'short:1',expression:'bright:0'};av[slot]=shape+':'+(ci[SEX][shape]??1);
    for(const d of ['front','right','back'])cells.push({av,state:{action:'floor-sit',direction:d,time:0,reducedMotion:true},size:200});}
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:12,cellW:130,cellH:200,labelW:0});
  await L.capture(page,g,OUT);console.log(ids.join(' '));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
