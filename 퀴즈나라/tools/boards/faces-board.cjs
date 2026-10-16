// Face items on the foundation avatar (demo): node faces-board.cjs ROOT OUT.png
const ROOT=process.argv[2],OUT=process.argv[3];
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const items=[{},{face:'band:3'},{face:'bruise:3'},{face:'gonji:3'},{eyes:'cat:3'},{nose:'button:3'},{mouth:'cat:3'},{eyes:'cat:3',nose:'button:3',mouth:'cat:3',face:'gonji:3'}];
  const cols=[['m','short','front',0],['m','short','right',0],['f','bob','front',0],['f','bob','right',0],['f','hime','right',0],['f','braid','right',0],['m','slick','right',0],['m','short','front',4],['f','long','front',4]];
  const cells=items.flatMap(it=>cols.map(([sex,hair,view,sk])=>({av:{sex,sk,hair:hair+':1',expression:'bright:0',...it},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:560})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:cols.length,cellW:300,cellH:300,top:-10,labelW:0});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
