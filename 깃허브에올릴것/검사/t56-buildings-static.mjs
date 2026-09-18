// Executes actual building geometry; no browser, input devices or network.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(start){let braces=0,square=0,paren=0,q='',comment='',escape=false;
  for(let i=start;i<source.length;i++){const c=source[i],n=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(q){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===q)q='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{')braces++;if(c==='}')braces--;if(c==='[')square++;if(c===']')square--;if(c==='(')paren++;if(c===')')paren--;
    if(c===';'&&!braces&&!square&&!paren)return i+1;
  }throw Error('Unterminated source');}
function declaration(n){const m=new RegExp('^const\\s+'+n+'\\s*=','m').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));}
function fn(n){const a=source.indexOf('function '+n+'(');if(a<0)throw Error(n);let p=source.indexOf('{',a),depth=1;
  // These small scalar helpers contain no braces inside strings or comments.
  for(let i=p+1;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(a,i+1);}
}
const a=source.indexOf('const _blkCache ='),b=source.indexOf('function footprint(',a);
if(a<0||b<a)throw Error('Building geometry source anchors missing');
const ctx=vm.createContext({});
new vm.Script([declaration('T'),declaration('BUILD'),declaration('MAXLV'),fn('bs'),source.slice(a,b),'globalThis.A={BUILD,MAXLV,blocksOf,blocksOfRaw};'].join('\n')).runInContext(ctx);
const A=ctx.A,checks=[],details=[];
function check(n,p){checks.push(!!p);console.log((p?'PASS ':'FAIL ')+n);}
const types=['wwall','swall','arrow','ice','barr','pulse'];
check('All six building definitions exist',types.every(t=>A.BUILD[t]));
const failures=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3();
for(const t of types){if(!A.BUILD[t])continue;let maxParts=0;const forms=new Set();
  const branches=t==='arrow'?['','rapid','sniper']:t==='ice'?['','blizzard','frost']:[''];
  for(let lv=1;lv<=A.MAXLV;lv++)for(const branch of branches)for(let style=0;style<4;style++){
    const rows=A.blocksOf(t,lv,branch,style),size=A.BUILD[t].size,hi=Array.isArray(A.BUILD[t].hi)?A.BUILD[t].hi[lv-1]:A.BUILD[t].hi;
    const center=size===2?.5:0,bounds=new THREE.Box3();maxParts=Math.max(maxParts,rows.length);
    for(const r of rows){
      if(![10,11].includes(r.length)||!r.slice(0,10).every(Number.isFinite)||r.slice(4,7).some(n=>n<=0)||(r.length===11&&r[10]!=='gun'))failures.push([t,lv,branch,style,'invalid part']);
      if(r[10]==='gun'&&(t!=='arrow'||lv<3||!['rapid','sniper'].includes(branch)))failures.push([t,lv,branch,style,'invalid animated gun tag']);
      q.setFromEuler(new THREE.Euler(0,r[8],r[9],'YXZ'));
      matrix.compose(new THREE.Vector3(r[0],r[1]+.5,r[2]),q,new THREE.Vector3(r[4],r[5],r[6]));
      for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])bounds.expandByPoint(v.set(x,y,z).applyMatrix4(matrix));
    }
    if(bounds.min.y<-.00001||Math.abs(bounds.max.y-hi)>.00001)failures.push([t,lv,branch,style,'height',bounds.min.y,bounds.max.y,hi]);
    if(['x','z'].some(k=>bounds.min[k]<center-size/2-.06||bounds.max[k]>center+size/2+.06))failures.push([t,lv,branch,style,'footprint',bounds.min.toArray(),bounds.max.toArray()]);
    if(rows!==A.blocksOf(t,lv,branch,style))failures.push([t,lv,branch,style,'cache']);
    if(!branch&&!style)forms.add(JSON.stringify(rows));
  }
  details.push({type:t,maxParts,levelForms:forms.size});
  check(t+' keeps a visible difference at every upgrade',forms.size===A.MAXLV);
  check(t+' stays below 100 parts per building across all variants',maxParts<=100);
  const themeHashes=[0,1,2,3].map(s=>JSON.stringify(A.blocksOf(t,5,'',s)));
  check(t+' has four distinct decoration themes',new Set(themeHashes).size===4);
}
check('Every variant stays grounded, within its footprint, and exactly matches collision height',failures.length===0);
if(failures.length)console.log(JSON.stringify(failures.slice(0,20)));
for(const [t,branches] of [['arrow',['','rapid','sniper']],['ice',['','blizzard','frost']]]){
  check(t+' specialization changes geometry and does not share a stale cache entry',new Set(branches.map(b=>JSON.stringify(A.blocksOf(t,4,b,0)))).size===3);
}
check('Invalid styles and levels normalize to supported cached variants',A.blocksOf('arrow',99,'unknown',99)===A.blocksOf('arrow',7,'',3));
check('Levels 1 and 2 remain basic bows even with a premature gun branch',[1,2].every(lv=>['rapid','sniper'].every(b=>A.blocksOf('arrow',lv,b)===A.blocksOf('arrow',lv))));
for(const branch of ['rapid','sniper']){
  const rows=A.blocksOf('arrow',3,branch),guns=rows.filter(r=>r[10]==='gun'),hi=A.BUILD.arrow.hi[2];
  check(branch+' tags moving gun parts while keeping its tower and mount fixed',guns.length>=15&&rows.some(r=>!r[10]&&r[1]+.5<hi-.5));
  const muzzles=guns.filter(r=>Math.abs(r[2]-(.5+1.036))<1e-8);
  check(branch+' muzzle matches the shared +Z attack origin and height',muzzles.length===(branch==='rapid'?4:1)&&muzzles.every(r=>Math.abs(r[2]+r[6]/2-(.5+1.045))<1e-8)&&Math.abs(muzzles.reduce((sum,r)=>sum+r[1]+.5,0)/muzzles.length-(hi-.33))<1e-8);
}
check('Rapid upgrade exposes six barrels from level 5',A.blocksOf('arrow',5,'rapid').filter(r=>r[10]==='gun'&&Math.abs(r[2]-(.5+1.036))<1e-8).length===6);
check('Unknown buildings fail closed',A.blocksOf('missing',1).length===0);
console.log(JSON.stringify(details));
console.log(checks.filter(Boolean).length+'/'+checks.length+' geometry checks passed; browser rendering not tested.');
process.exitCode=checks.every(Boolean)?0:1;
