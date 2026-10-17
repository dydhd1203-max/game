// Run/jump (or any action) frames in a row, sexes × directions, on dark blue (demo, nothing saved):
// node tools/boards/motion-board.cjs . OUT.png [동작 run|jump|walk|climb] [피부 0-4] [크기 280] [옷 id,id,... 또는 -] [성별 m,f] [방향 front,right,back] [장면 0,1,...]
// 예: node tools/boards/motion-board.cjs . 검증/동작/run.png run 0 280
//     node tools/boards/motion-board.cjs . 검증/동작/jump-shirt.png jump 4 280 top:shirt:10
const ROOT=process.argv[2],OUT=process.argv[3],ACTION=process.argv[4]||'run',SK=+(process.argv[5]||0),SIZE=+(process.argv[6]||280),WEAR=(process.argv[7]||'').split(',').filter(w=>w&&w!=='-'),SEXES=(process.argv[8]||'m,f').split(','),DIRS=(process.argv[9]||'front,right,back').split(','),KS=process.argv[10]?process.argv[10].split(',').map(Number):[...Array(8).keys()];
const path=require('node:path'),L=require(path.resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H,M=require(path.resolve(__dirname,'..','foundation-matrix.cjs'));
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const rows=[],cells=[];
  for(const sex of SEXES)for(const dir of DIRS){rows.push(sex+' '+dir);
    // Shop items as the shop stores them: top:shirt:10 → av.top='shirt:10' (the rest is the sex's starter set).
    const worn=Object.fromEntries(WEAR.map(id=>{const [slot,...rest]=id.split(':');return[slot,rest.join(':')];}));
    for(const k of KS)cells.push({av:{sex,sk:SK,hair:(sex==='f'?'bob':'short')+':1',expression:'bright:0',...worn},state:{...M.actionState(ACTION,dir,k),reducedMotion:true},size:SIZE});}
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:KS.length,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.12),bg:'#1e2858',labelW:70,labels:rows});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
