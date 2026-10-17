// All 24 hair styles x front/right/back, head and neck only, on dark blue (gaps show), demo, nothing saved:
//   node tools/boards/heads-board.cjs ROOT OUT.png [피부 0-4] [머리색 0-11] [크기 480]
// 예: 진한 피부·분홍 머리 `... OUT.png 4 6`. 머리 층(H2·H3) 전후 비교와 목·귀·물든 테두리 확인용.
const ROOT=process.argv[2],OUT=process.argv[3],SK=+(process.argv[4]||0),HC=+(process.argv[5]||1),SIZE=+(process.argv[6]||480);
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:4000,height:2400}});
  await L.install(page,{});
  const F=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'],M=['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'];
  const rows=[];for(const [sex,names] of [['f',F],['m',M]])for(const view of ['front','right','back'])rows.push({sex,view,names});
  const w=Math.round(SIZE*32/56),cellH=Math.round(SIZE*.62);
  const cells=rows.flatMap(r=>r.names.map(h=>({av:{sex:r.sex,sk:SK,hair:h+':'+HC,expression:'bright:0'},state:{action:'idle',direction:r.view,time:0,reducedMotion:true},size:SIZE})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:12,cellW:w,cellH,top:-Math.round(SIZE*.02),bg:'#1e2858',labelW:60,labels:rows.map(r=>r.sex+' '+r.view)});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
