// All 24 hair styles x front/right/back on the foundation avatar (demo, nothing saved): node heads-views.cjs ROOT OUT.png
const ROOT=process.argv[2],OUT=process.argv[3],HAT=process.argv[4]||'';
const L=require(require('node:path').resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:2200}});
  await L.install(page,{});
  const F=['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'],M=['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'];
  const rows=[];for(const [sex,names] of [['f',F],['m',M]])for(const view of ['front','right','back'])rows.push({sex,view,names});
  const cells=rows.flatMap(r=>r.names.map(h=>({av:{sex:r.sex,sk:0,hair:h+':1',expression:'bright:0',hat:HAT},state:{action:'idle',direction:r.view,time:0,reducedMotion:true},size:280})));
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:12,cellW:240,cellH:330,labelW:60,labels:rows.map(r=>r.sex+' '+r.view)});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
