// Actual source job art checks. No browser, DOM, or input devices.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(start,body=false){let b=0,p=0,a=0,q='',c='',esc=false,opened=false;
  for(let i=start;i<source.length;i++){const v=source[i],n=source[i+1];
    if(c==='line'){if(v==='\n')c='';continue;}if(c==='block'){if(v==='*'&&n==='/'){c='';i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(v==='\\'){esc=true;continue;}if(v===q)q='';continue;}
    if(v==='/'&&n==='/'){c='line';i++;continue;}if(v==='/'&&n==='*'){c='block';i++;continue;}
    if(v==='"'||v==="'"||v==='`'){q=v;continue;}
    if(v==='{'){b++;opened=true;}if(v==='}')b--;if(v==='(')p++;if(v===')')p--;if(v==='[')a++;if(v===']')a--;
    if(!b&&!p&&!a&&((body&&opened)||(!body&&v===';')))return i+1;
  }throw Error('Unterminated source at '+start);}
function fn(n){const a=source.indexOf('function '+n+'(');if(a<0)throw Error(n);return source.slice(a,end(a,true));}
function decl(n){const m=new RegExp('^const\\s+'+n+'\\s*=','m').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));}
const start=source.indexOf('const STUD ='),stop=source.indexOf('const eyeMat =',start);
if(start<0||stop<start)throw Error('Human geometry anchors missing');
const context=vm.createContext({THREE});
new vm.Script([fn('roundBox'),fn('roundCyl'),source.slice(start,stop),fn('wingSpine'),fn('wingGeo'),decl('WING_GEO'),decl('JOB_WING'),decl('JOB_LOOK'),
  'globalThis.A={WING_GEO,JOB_WING,JOB_LOOK,wingSpine,r6body};'].join('\n')).runInContext(context);
const A=context.A,checks=[],check=(name,ok,detail)=>{checks.push(!!ok);console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const counts=A.JOB_LOOK.map(j=>j.map(rows=>rows.length));
check('All three roles retain two distinct compact outfit stages',counts.every(c=>c[0]>=8&&c[0]<=13&&c[1]>c[0]&&c[1]<=18),counts);
check('Job outfits contain no orbiting, floating, or additive glow clutter',A.JOB_LOOK.flat(2).every(r=>r[8]===0&&r[9]===0));
let badBody=0,backPlanks=0,faceCovers=0;
for(const rows of A.JOB_LOOK.flat())for(const row of rows){
  if(row[7]){if(row[1]-row[4]/2<1.26&&row[0]>1)faceCovers++;continue;}
  const q=A.r6body(...row.slice(0,6));
  if(Math.abs(q[2])+q[3]/2>.43||q[1]-q[4]/2<.60||q[1]+q[4]/2>1.30)badBody++;
  if(q[0]<-.08&&q[3]>.35&&q[4]>.35)backPlanks++;
}
check('Role accessories stay close to torso and leave face and back clear',!badBody&&!backPlanks&&!faceCovers,{badBody,backPlanks,faceCovers});
check('Chosen hats can replace every job headpiece without hiding role gear',A.JOB_LOOK.flat().every(rows=>rows.some(r=>r[7])&&rows.filter(r=>!r[7]).length>=6));
for(let kind=0;kind<2;kind++){
  const g=A.WING_GEO[kind],triangles=(g.index?.count||g.attributes.position.count)/3;g.computeBoundingBox();
  check('Wing '+kind+' has finite indexed feather surfaces within the triangle budget',!!g.index&&triangles<=1200&&['position','normal','color'].every(k=>[...g.attributes[k].array].every(Number.isFinite)),{triangles});
  check('Wing '+kind+' stays thin behind the shoulder and avoids a jagged long lower fringe',g.boundingBox.min.z>=-.060&&g.boundingBox.max.z<=.060&&g.boundingBox.min.y>-.22&&g.boundingBox.max.x<1.85,{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(),C=A.wingSpine(kind?1.12:1.20);let hits=0;
  for(let i=1;i<40;i++){const [x,y]=C(i/40);ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));if(ray.intersectObject(mesh,false).length)hits++;}
  check('Wing '+kind+' keeps one continuous shoulder-to-tip silhouette',hits===39,{hits});
}
check('Wing evolution adds detail with a modest size change and no duplicate glow shell',A.JOB_WING.every(j=>j[0].k===0&&j[1].k===1&&j[0].s<=.4&&j[1].s<=.5&&j[1].s/j[0].s<=1.4&&j.every(w=>w.g===0)));
check('Each advanced role has its own pastel wing color',new Set(A.JOB_WING.map(j=>j[1].c)).size===3);
console.log(checks.filter(Boolean).length+'/'+checks.length+' job art checks passed. WebGL rendering is checked separately.');
process.exitCode=checks.every(Boolean)?0:1;
