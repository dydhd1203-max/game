// Face items on the foundation avatar (demo): node faces-board.cjs ROOT OUT.png [슬롯:모양:색,...] [크기]
// 예: node tools/boards/faces-board.cjs . 검증/얼굴/판.png face:mask:10,face:tear:8 280
const ROOT=process.argv[2],OUT=process.argv[3],PICK=process.argv[4],SIZE=Number(process.argv[5])||560;
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const items=PICK?[{},...PICK.split(',').map(id=>{const [slot,...v]=id.split(':');return {[slot]:v.join(':')};})]:[{},{face:'band:3'},{face:'bruise:3'},{face:'gonji:3'},{eyes:'cat:3'},{nose:'button:3'},{mouth:'cat:3'},{eyes:'cat:3',nose:'button:3',mouth:'cat:3',face:'gonji:3'}];
  const cols=[['m','short','front',0],['m','short','right',0],['f','bob','front',0],['f','bob','right',0],['f','hime','right',0],['f','braid','right',0],['m','slick','right',0],['m','short','front',4],['f','long','front',4]];
  const cells=items.flatMap(it=>cols.map(([sex,hair,view,sk])=>({av:{sex,sk,hair:hair+':1',expression:'bright:0',...it},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:SIZE})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:cols.length,cellW:Math.round(SIZE*300/560),cellH:Math.round(SIZE*300/560),top:-10,labelW:0});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
