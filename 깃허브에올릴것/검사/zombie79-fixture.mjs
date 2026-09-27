import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export function fixture(file){
 const source=fs.readFileSync(file,'utf8'),extract=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
 const {fn,decl}=new Function('source',extract.slice(extract.indexOf('function end('),extract.indexOf('const results=[];'))+';return {fn,decl};')(source);
 const between=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+1);if(i<0||j<0)throw Error(a);return source.slice(i,j);};
 const ctx=vm.createContext({Math,console});
 vm.runInContext([
  between('const FIELD_R = 78;','/* ═══ 33차 세계 마무리'),
  between('const CHAM = 0.60;','/* ═══════════════════════ 텍스처 아틀라스'),
  'const location={search:""},PL={x:0,z:0,y:9},G={phase:"night",t:180},STRU=new Map();',
  between('const terrH = new Int16Array','function genTerrain('),fn('genTerrain'),
  between('const GATE_T = 51;','/* ═══════ 성문 그림'),
  fn('solidTop'),
  between('const N2 = WS*WS;','/* ═══════════════════════ 몹 렌더러'),
  decl('WOLF_T'),decl('BAL'),decl('CLIMB_RET'),
  'let CL_AX=0,CL_AZ=0;const CL_W=[];const climbFind=(a,id)=>a.find(q=>q.uid===id);',
  decl('climbCl'),...['climbApproach','climbPos'].map(fn),
  'genTerrain();gateLayout();castleLayout();buildFlow();',
  'globalThis.A={G,PL,STRU,GH,GY,HW,WS,CASTLE,CK,GBOX,ZGB,STAIRS,stairOf,RAMP_FLOW,CPLAN,WOLF_T,ZONE,BAL,CL_W,fRamp,fNext,fCost,gi,gX,gZ,gT,gPP,rZ,zMoveOk,zStep,flowStep,buildFlow,climbApproach,onCastleLayer,layerY,getClGoal:()=>[CL_AX,CL_AZ],route:(w,x,z)=>typeof zStairRoute79!=="undefined"&&zStairRoute79(w,x,z)?[ZNAV_X79,ZNAV_Z79]:[x,z]};'
 ].join('\n'),ctx,{timeout:10000});
 return {A:ctx.A,ctx,fn,decl,source};
}
