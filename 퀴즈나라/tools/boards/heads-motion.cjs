// Hair styles in motion (demo, nothing saved): idle, walk, run, jump, nod peak, wave, desk and floor seats,
// front and right, on dark blue: node "ROOT" OUT.png [모양,모양,...] [피부 0-4] [머리색 0-11] [크기 280]
// 예: node tools/boards/heads-motion.cjs . OUT.png f:bob,f:braid,m:short,m:wolf 4 6
const ROOT=process.argv[2],OUT=process.argv[3],STYLES=(process.argv[4]||'f:bob,f:long,f:braid,m:short,m:wolf').split(','),SK=+(process.argv[5]||0),HC=+(process.argv[6]||1),SIZE=+(process.argv[7]||280);
const path=require('node:path'),L=require(path.resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H,M=require(path.resolve(__dirname,'..','foundation-matrix.cjs'));
const POSES=[['idle',d=>M.actionState('idle',d,0)],['walk',d=>M.actionState('walk',d,3)],['run',d=>M.actionState('run',d,2)],['jump',d=>M.actionState('jump',d,4)],
  ['nod',d=>({action:'idle',direction:d,gesture:'nod',gestureProgress:8/36,time:0,reducedMotion:false})],['wave',d=>({action:'idle',direction:d,gesture:'wave',gestureProgress:12/36,time:0,reducedMotion:false})],
  ['sit',d=>M.actionState('sit',d,0)],['floor',d=>M.actionState('floor-sit',d,0)]];
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3000,height:3000}});
  await L.install(page,{});
  const rows=[],cells=[];
  for(const st of STYLES){const [sex,shape]=st.split(':');for(const dir of ['front','right']){rows.push(st+' '+dir);for(const [,f] of POSES)cells.push({av:{sex,sk:SK,hair:shape+':'+HC,expression:'bright:0'},state:{...f(dir),reducedMotion:true},size:SIZE});}}
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:POSES.length,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.12),bg:'#1e2858',labelW:90,labels:rows});
  await L.capture(page,g,OUT);
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
