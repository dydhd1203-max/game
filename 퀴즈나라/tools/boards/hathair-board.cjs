const ROOT=process.argv[2],OUT=process.argv[3];
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:2400}});
  await L.install(page,{});
  const rows=[['twin:1',''],['twin:1','cap:3'],['twin:4','cap:3'],['pony:1',''],['pony:1','cap:3'],['pony:6','cap:3']];
  const cells=rows.flatMap(([hair,hat])=>['front','right','back','left'].map(view=>({av:{sex:'f',sk:0,hair,expression:'bright:0',hat},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:380})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:4,cellW:300,cellH:330,labelW:0});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
