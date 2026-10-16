// Pulled-on hats on the styles whose hair under a hat is drawn (QPHatHair: twin, pony) beside the default bob:
//   node hathair-board.cjs ROOT OUT.png [HATS]   HATS: shape:ci,... (default every pulled-on hat), rows = hats,
//   columns = bob, twin, pony x front, right, back
const ROOT=process.argv[2],OUT=process.argv[3];
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
const ALL='army:3,beanie:3,cap:3,capback:5,chef:1,cowboy:11,grad:9,pirate:1,police:5,santa:1,straw:11,witch:9';
const HATS=(process.argv[4]||ALL).split(',');
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const cells=HATS.flatMap(hat=>['bob:1','twin:1','pony:1'].flatMap(hair=>['front','right','back'].map(view=>({av:{sex:'f',sk:0,hair,expression:'bright:0',hat},state:{action:'idle',direction:view,time:0,reducedMotion:true},size:240}))));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:9,cellW:190,cellH:170,top:6,labelW:0});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
