/* Node-only geometry / animation QA. Never imports Playwright or starts a browser.
   Geometry, material definitions, transform helpers and drawSheep are extracted
   from the supplied game file and executed without DOM, GPU or network access.
   World/gameplay dependencies are minimal fixtures; this does not test WebGL,
   camera controls, pointer lock, multiplayer delivery, or GPU performance. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-avatar'));
const source=fs.readFileSync(file,'utf8');
const build=process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build');
const THREE=await import(pathToFileURL(path.join(build,'three.module.js')).href);

// A small lexical scanner preserves source strings/comments and ignores their
// braces. It extracts whole declarations, never a rewritten copy of a formula.
function scanEnd(start,stopAtBrace=false){
  let brace=0,paren=0,bracket=0,quote='',comment='',escaped=false,opened=false;
  for(let i=start;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}
    if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{'){brace++;opened=true;}else if(c==='}')brace--;
    else if(c==='(')paren++;else if(c===')')paren--;
    else if(c==='[')bracket++;else if(c===']')bracket--;
    if(stopAtBrace&&opened&&brace===0&&paren===0&&bracket===0)return i+1;
    if(!stopAtBrace&&c===';'&&brace===0&&paren===0&&bracket===0)return i+1;
  }
  throw new Error('Unterminated source at '+source.slice(start,start+80));
}
function declaration(name){
  const re=new RegExp('(?:const|let)\\s+'+name+'\\s*='),m=re.exec(source);
  if(!m)throw new Error('Missing declaration: '+name);
  return source.slice(m.index,scanEnd(m.index));
}
function fn(name){const start=source.indexOf('function '+name+'(');if(start<0)throw new Error('Missing function '+name);
  return source.slice(start,scanEnd(start,true));}
function chunk(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<0)throw new Error('Missing chunk '+a);return source.slice(start,end);}
const fixtures=`
const GFX={shadow:false,lowLambert:false},scene=new THREE.Scene(),MAXP=40,GY=0,SPD=5.2,RACE_SPD=1.4;
const raceOn=()=>false,burst=()=>{},drawAvatarShadows=()=>{},meSheep={},ENH_MAX=6;
const UPV=new THREE.Vector3(0,1,0),AX_X=new THREE.Vector3(1,0,0);
const _v=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_m=new THREE.Matrix4(),_c1=new THREE.Color();
`;
const pieces=[fixtures,declaration('RB_SPEC'),declaration('flatMat'),
  chunk('function roundBox(', 'const _rbCache'),
  chunk('const STUD =','const eyeMat ='),fn('imesh'),declaration('P_body'),declaration('P_hand'),declaration('P_gun'),
  declaration('ENH_FX'),declaration('WEAPONS'),declaration('HATS'),declaration('GLASSES'),declaration('CLOTHES'),
  ...['HAT_NAME','HAT_ICON','GLS_NAME','GLS_ICON','CLO_NAME','CLO_ICON'].map(declaration),
  chunk('const DRESS_OPTIONS =','let FLIP_ON ='),
  fn('wingSpine'),fn('wingGeo'),declaration('WING_GEO'),declaration('JOB_WING'),
  declaration('WMAT_W'),declaration('WMAT_G'),declaration('P_wing'),declaration('P_wingG'),
  declaration('JOB_LOOK'),declaration('JOB_GEO'),declaration('JOB_UNIFORM'),declaration('P_jobParts'),declaration('JOB_AURA'),
  chunk('let FLIP_ON =','const fxq ='),
  chunk('const HEAD_M =','function drawSheep('),fn('drawSheep'),
  `globalThis.API={drawSheep,smoothHead,sheepGait,sheepJoint,sheepFootPose,sheepActionPose,avatarWingPose,R6_HOOK,R6_HEAD,R6_HK,R6_ARM,R6_ASD,R6_SHU,R6_HAND_AT,
    JOB_LOOK,JOB_GEO,JOB_UNIFORM,P_jobParts,JOB_WING,WING_GEO,wingSpine,r6body,P_jobF,P_jobR,
    R6_SMILE,CYL,HATS,GLASSES,CLOTHES,meshes:{body:P_body,head:P_head,arm:P_arm,eyes:P_eye,mouth:P_mouth,nose:P_nose,
    legs:P_legs,shoes:P_shoe,deco:P_deco,gun:P_gun,gunGlow:P_gunF,handL:P_hand[0],handR:P_hand[1],
    wing0:P_wing[0],wing1:P_wing[1],wingGlow0:P_wingG[0],wingGlow1:P_wingG[1],
    ...Object.fromEntries(Object.entries(P_jobParts).map(([key,mesh])=>['job_'+key,mesh]))}};`
];
const context=vm.createContext({THREE,console});
new vm.Script(pieces.join('\n'),{filename:'extracted-avatar-from-index.js'}).runInContext(context,{timeout:10000});
const A=context.API,results=[],details={file,sha256:crypto.createHash('sha256').update(source).digest('hex'),three:THREE.REVISION};
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' — '+JSON.stringify(detail)));};
const mat=(name,i=0)=>{const m=new THREE.Matrix4();A.meshes[name].getMatrixAt(i,m);return m;};
const pos=m=>new THREE.Vector3().setFromMatrixPosition(m);
const quat=m=>{const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);return q.normalize();};
const maxDiff=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const actor=extra=>({x:0,y:0,z:0,ry:Math.PI,g:2,ph:0,mv:false,down:false,wp:0,we:0,hat:0,gls:0,clo:0,jb:-1,jt:0,...extra});
function snapshot(s,t=4){const gait=A.sheepGait(s,t);if(s.mv)gait.v=s.run?8:4;
  A.drawSheep([s],t,40,()=>0x55aaff,1);return Object.fromEntries(Object.entries(A.meshes).map(([k,m])=>[k,Array.from({length:m.count},(_,i)=>mat(k,i))]));}
const finiteSnapshot=s=>Object.values(s).flat().every(m=>m.elements.every(Number.isFinite));
const scenarios=[
  ['idle',{}],['run',{mv:true,run:true,gp:1.4}],['rise',{air:true,vy:4,take:.08}],['apex',{air:true,vy:0}],
  ['fall',{air:true,vy:-4}],['land',{land:.18}],['mine-ready',{act:'mine',actP:.28,tool:'mine'}],
  ['mine-hit',{act:'mine',actP:.64,tool:'mine'}],['work',{act:'work',actP:.36,tool:'work'}],
  ['throw',{act:'throw',actP:.45}],['aim',{wp:3}],['fire',{wp:3,kick:1}],['down',{down:true}],
  ['turn',{ry:.7}],['hat',{hat:1,gls:1}],['glide',{air:true,vy:-2,glide:true,jb:0,jt:2}]
];
const poses=new Map(scenarios.map(([name,s])=>[name,snapshot(actor(s))]));
check('Actual drawSheep matrices are finite across all poses',[...poses.values()].every(finiteSnapshot),{poses:poses.size});
// Geometry hit tests distinguish a real C-shaped hole from a drawn dark spot.
const hit=(geometry,x,y)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));const result=ray.intersectObject(mesh).length>0;mesh.material.dispose();return result;};
check('C-hand centers and inward mouths are open; outer palms remain solid',
  A.R6_HOOK.every(g=>!hit(g,0,0))&&!hit(A.R6_HOOK[0],-.43,0)&&!hit(A.R6_HOOK[1],.43,0)&&hit(A.R6_HOOK[0],.4,0)&&hit(A.R6_HOOK[1],-.4,0));
let worstGripAngle=0,worstGripGap=0;
for(const pose of poses.values())for(const [key,index] of [['handR',3],['handL',1]]){
  worstGripAngle=Math.max(worstGripAngle,quat(pose[key][0]).angleTo(quat(pose.arm[index])));
  worstGripGap=Math.max(worstGripGap,pos(pose[key][0]).distanceTo(pos(pose.arm[index])));
}
check('Hands follow wrist rotation and remain attached in every pose',worstGripAngle<1e-5&&worstGripGap<.14,{worstGripAngle,worstGripGap});
let gripOffset=0,gripWithin=true;
for(const key of ['mine-ready','mine-hit','work','aim','fire']){
  const pose=poses.get(key),grip=pos(pose.handR[0]).applyMatrix4(pose.gun[key==='aim'||key==='fire'?2:0].clone().invert());
  gripOffset=Math.max(gripOffset,Math.hypot(grip.x,grip.z));gripWithin&&=Math.abs(grip.y)<.5;
}
check('Tool shafts and gun grips intersect the real C-hand center',gripOffset<.5&&gripWithin,{maxCrossAxisOffsetInHandleWidths:gripOffset,insideHalfWidth:.5,withinHandleLength:gripWithin});
// Sample the real function around the former vy > 1 discontinuity, with the
// same time/actor state so idle sway cannot disguise or manufacture a jump.
const jump=[];for(let v=2;v>=-2;v-=.05)jump.push(snapshot(actor({air:true,vy:v})));
let jumpStep=0;for(let i=1;i<jump.length;i++)for(const key of ['handR','handL','head','legs'])
  for(let j=0;j<jump[i][key].length;j++)jumpStep=Math.max(jumpStep,pos(jump[i][key][j]).distanceTo(pos(jump[i-1][key][j])));
check('Rise / apex / fall have no abrupt limb-position switch',jumpStep<.12,{sampleVelocityStep:.05,maxPositionStep:jumpStep});
const range=key=>pos(poses.get('mine-ready')[key][0]).distanceTo(pos(poses.get('mine-hit')[key][0]));
check('Harvest windup and impact move both the hand and its tool',range('handR')>.4&&range('gun')>.4,{hand:range('handR'),tool:range('gun')});
const actionPose=kind=>snapshot(actor({act:kind,actP:.38,tool:kind==='throw'?'':kind}));
const actionKinds=['mine','work','throw'],actionSamples=actionKinds.map(actionPose);
const actionDiff=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)actionDiff.push({a:actionKinds[i],b:actionKinds[j],distance:pos(actionSamples[i].handR[0]).distanceTo(pos(actionSamples[j].handR[0]))});
check('Harvest, construction and throw use distinct arm poses',actionDiff.every(d=>d.distance>.025),actionDiff);
const fireDistance=pos(poses.get('fire').handR[0]).distanceTo(pos(poses.get('aim').handR[0]));
check('Firing recoil reaches the character wrist',fireDistance>.04,{distance:fireDistance});
// A head-local transform must be identical while body/head pitch changes.
// This catches facial parts that appear attached only when the avatar is upright.
const faceLocal=p=>{const inv=p.head[0].clone().invert();return [...p.eyes,...p.mouth,...p.deco].map(m=>inv.clone().multiply(m).elements.slice());};
const faceA=faceLocal(snapshot(actor({act:'mine',actP:0,tool:'mine',hat:1,gls:1}))),faceB=faceLocal(snapshot(actor({act:'mine',actP:.55,tool:'mine',hat:1,gls:1})));
const faceDelta=Math.max(...faceA.map((m,i)=>maxDiff(m,faceB[i])));
check('Eyes, mouth, hat and glasses remain fixed to the tilted head',faceDelta<1e-5,{headLocalMatrixDelta:faceDelta});
let finiteGeo=true;for(const m of Object.values(A.meshes))for(const v of m.geometry.attributes.position.array)if(!Number.isFinite(v))finiteGeo=false;
check('Source geometry has finite vertices',finiteGeo);
const smile=A.R6_SMILE.attributes.position;let smileMin=Infinity,smileMax=-Infinity;
for(let i=0;i<smile.count;i++){smileMin=Math.min(smileMin,smile.getZ(i));smileMax=Math.max(smileMax,smile.getZ(i));}
check('Smile has no central spike / broken surface seam',smileMin>-.9&&smileMax<.25,{smileMin,smileMax});

// Faster gathering must still reach every pose in the swing cycle. Previously
// the visible progress used the unmodified duration, cutting upgraded swings short.
const mineCtx=vm.createContext({levels:[0,0,0,0],mineProg:0});
vm.runInContext(declaration('ST_STR')+'\n'+declaration('MINE_T')+'\nconst stLv=i=>levels[i];\n'+declaration('mineTime')+'\n'+declaration('miningFraction'),mineCtx);
let miningCycle=true;
for(const level of [0,5,20]){
  mineCtx.levels[0]=mineCtx.levels[2]=level;
  for(const fraction of [0,.3,.52,1]){
    mineCtx.mineProg=vm.runInContext('mineTime()',mineCtx)*fraction;
    miningCycle&&=Math.abs(vm.runInContext('miningFraction()',mineCtx)-fraction)<1e-9;
  }
}
check('Upgraded gathering speed preserves the full visible motion cycle',miningCycle);

const jobScenarios=[];
const outfitCount=p=>p.deco.length+Object.entries(p).filter(([key])=>key.startsWith('job_')).reduce((sum,[,parts])=>sum+parts.length,0);
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
  const s=actor({jb,jt}),p=snapshot(s);jobScenarios.push([['Cowboy','Inventor','Explorer'][jb]+' '+jt,s]);
  check('Job '+jb+'/'+jt+' renders every authored costume piece and one full wing pair',finiteSnapshot(p)&&outfitCount(p)===A.JOB_LOOK[jb][jt-1].length&&p['wing'+(jt-1)].length===2&&p['wing'+(2-jt)].length===0,{costume:outfitCount(p),authored:A.JOB_LOOK[jb][jt-1].length,wings:p['wing'+(jt-1)].length});
  const plank=A.JOB_LOOK[jb][jt-1].some(h=>{if(h[7])return false;const q=[...A.r6body(...h.slice(0,6))];return q[0]<-.08&&q[3]>.4&&q[4]>.4&&q[5]>.12;});
  check('Job '+jb+'/'+jt+' has no broad rectangular back plank',!plank);
}
const jobCounts=A.JOB_LOOK.map(j=>j.map(t=>t.length));
check('Second-tier outfits visibly add job-specific pieces',jobCounts.every(j=>j[1]>=j[0]+5),jobCounts);
for(let i=0;i<2;i++){
  const spine=A.wingSpine(i?1.12:1.20),g=A.WING_GEO[i];
  const continuous=[.1,.25,.4,.55,.7,.85].every(t=>{const p=spine(t);return hit(g,...p);});
  check('Wing '+i+' has a continuous shoulder-to-tip surface',continuous);
  const triangles=(g.index?g.index.count:g.attributes.position.count)/3;
  check('Wing '+i+' stays within a bounded triangle budget',triangles<1800,{triangles});
}
const right=poses.get('mine-ready').handR[0],left=poses.get('mine-ready').handL[0],shaft=poses.get('mine-ready').gun[0];
check('Working tool is attached to anatomical right hand',pos(right).x<0&&pos(shaft).distanceTo(pos(right))<pos(shaft).distanceTo(pos(left)));
const pickHead=poses.get('mine-ready').gun[1],pickScale=new THREE.Vector3().setFromMatrixScale(pickHead);
const shaftAxis=new THREE.Vector3(0,1,0).transformDirection(shaft),bladeAxis=new THREE.Vector3(0,0,1).transformDirection(pickHead);
check('Pick head lies across handle in forward strike plane',pickScale.z>pickScale.x*3&&Math.abs(shaftAxis.dot(bladeAxis))<1e-5,{scale:pickScale.toArray(),orthogonality:shaftAxis.dot(bladeAxis)});
for(const key of ['body','head','legs']){
  const delta=maxDiff(poses.get('mine-ready')[key][0].elements,poses.get('mine-hit')[key][0].elements);
  check('Harvest transfers weight through '+key,delta>.03,{matrixDelta:delta});
  const recoil=maxDiff(poses.get('aim')[key][0].elements,poses.get('fire')[key][0].elements);
  check('Firing recoil and bracing reach '+key,recoil>.02,{matrixDelta:recoil});
}
const glideUp=new THREE.Vector3(0,1,0).transformDirection(poses.get('glide').body[0]);
check('Gliding leans full body into flight, rather than using falling pose',glideUp.z>.65&&poses.get('glide').wing1.length===2,{bodyUp:glideUp.toArray()});
const runUp=new THREE.Vector3(0,1,0).transformDirection(poses.get('run').body[0]);
const runFootGap=Math.abs(pos(poses.get('run').shoes[0]).y-pos(poses.get('run').shoes[1]).y);
// 낮은 유각은 무릎을 편 진자 보행을 위한 의도다. 전체 주기의 접지·최대 들림과
// 무릎 각도는 t57-motion-static에서 함께 검사한다.
check('Sprint leans forward while one foot clears the grounded foot',runUp.z>.16&&runFootGap>.06,{bodyUp:runUp.toArray(),footHeightGap:runFootGap});
const chosenHat=9,jobWithHat=snapshot(actor({jb:0,jt:1,hat:chosenHat,clo:4,gls:8}));
const expectedHatPieces=A.GLASSES[8].length+A.JOB_LOOK[0][0].length;
check('Job outfit replaces lobby hat and clothes while retaining face decoration',outfitCount(jobWithHat)===expectedHatPieces,{actual:outfitCount(jobWithHat),expected:expectedHatPieces});
let crowdFits=true;
for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
  const crowd=Array.from({length:40},(_,i)=>actor({x:i*2,jb,jt,hat:9,clo:4,gls:8}));
  A.drawSheep(crowd,10,40,()=>0x55aaff,1);
  crowdFits&&=Object.values(A.P_jobParts).every(mesh=>mesh.count<=mesh.count_max);
  for(const [key,mesh] of Object.entries(A.P_jobParts))crowdFits&&=mesh.count===A.JOB_LOOK[jb][jt-1].filter(row=>row[12]===key).length*40;
}
check('Every shared job geometry fits forty players wearing the same full outfit',crowdFits);
A.drawSheep([],11,40,()=>0x55aaff,1);
check('Removing all actors clears every role geometry instance and visibility',Object.values(A.P_jobParts).every(mesh=>mesh.count===0&&!mesh.visible));

// A brief noisy grounded flag cannot reverse a settled airborne pose in one frame.
const noisy=actor({air:true,vy:0});snapshot(noisy,10);noisy.air=false;const noisyPose=snapshot(noisy,10+1/60);
const stablePose=snapshot(actor({air:true,vy:0}),10+1/60);
const noiseJump=pos(noisyPose.handR[0]).distanceTo(pos(stablePose.handR[0]));
check('Ground-contact noise blends the airborne pose rather than snapping it',noiseJump<.23,{oneFrameHandDelta:noiseJump});

// CPU projection and depth rasterization of the exact source geometries.
// Lighting is deliberately a simple inspection light, not a claim to reproduce
// WebGL tonemapping, shadows or GPU cost. No window/process/UI is created.
let sharp;const require=createRequire(import.meta.url);
for(const candidate of ['sharp',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')]){
  try{sharp=require(candidate);break;}catch{}}
fs.mkdirSync(out,{recursive:true});
const panels=[['Front','idle',0],['Three-quarter','idle',.62],['Side','idle',Math.PI/2],['Jump / fall','fall',.62],
  ['Harvest windup','mine-ready',.62],['Harvest impact','mine-hit',.62],['Build hammer','work',.62],['Throw','throw',.62],
  ['Aim','aim',.62],['Fire recoil','fire',.62],['Hat + glasses','hat',.62],['Landing','land',.62]];
const S=480,cols=4,rows=3,pixels=Buffer.alloc(S*S*4),light=new THREE.Vector3(-.35,.8,.55).normalize();
function render(pose,angle,closeup=false,elevation=0,wide=false){
  const depth=new Float32Array(S*S);depth.fill(Infinity);
  for(let i=0;i<S*S;i++){pixels[i*4]=233;pixels[i*4+1]=246;pixels[i*4+2]=255;pixels[i*4+3]=255;}
  const extent=closeup?.39:wide?2.65:1.25,center=closeup?1.43:1.08;
  const camera=new THREE.OrthographicCamera(-extent,extent,extent,-extent,.1,20);
  camera.position.set(Math.sin(angle)*5*Math.cos(elevation),center+5*Math.sin(elevation),Math.cos(angle)*5*Math.cos(elevation));
  camera.lookAt(0,center,0);camera.updateMatrixWorld();
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3(),normal=new THREE.Vector3(),color=new THREE.Color();
  for(const [name,ms] of Object.entries(pose)){
    if(name.includes('Glow'))continue;const mesh=A.meshes[name],geometry=mesh.geometry,position=geometry.attributes.position,normals=geometry.attributes.normal,index=geometry.index;
    for(let instance=0;instance<ms.length;instance++){
      const matrix=ms[instance],count=index?index.count:position.count,normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
      mesh.getColorAt(instance,color);color.multiply(mesh.material.color||new THREE.Color(0xffffff));
      // Colors are read after re-drawing this pose (below), never borrowed from
      // whichever pose happened to run last in the tests.
      for(let k=0;k<count;k+=3){
        v0.fromBufferAttribute(position,index?index.getX(k):k).applyMatrix4(matrix);
        v1.fromBufferAttribute(position,index?index.getX(k+1):k+1).applyMatrix4(matrix);
        v2.fromBufferAttribute(position,index?index.getX(k+2):k+2).applyMatrix4(matrix);
        normal.crossVectors(v1.clone().sub(v0),v2.clone().sub(v0)).normalize();
        const rgbAt=[0,1,2].map(offset=>{
          const n=normals&&!mesh.material.flatShading?new THREE.Vector3().fromBufferAttribute(normals,index?index.getX(k+offset):k+offset).applyNormalMatrix(normalMatrix):normal;
          const rgb=color.clone(),colors=geometry.attributes.color,ci=index?index.getX(k+offset):k+offset;
          if(colors&&mesh.material.vertexColors)rgb.multiply(new THREE.Color().setRGB(colors.getX(ci),colors.getY(ci),colors.getZ(ci)));
          return rgb.multiplyScalar(.68+.32*Math.max(0,n.dot(light))).convertLinearToSRGB();
        });
        const pts=[v0.clone().applyMatrix4(projection),v1.clone().applyMatrix4(projection),v2.clone().applyMatrix4(projection)].map(v=>({x:(v.x*.5+.5)*S,y:(.5-v.y*.5)*S,z:v.z}));
        const [a,b,c]=pts,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<1e-6)continue;
        const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(S-1,Math.ceil(Math.max(a.x,b.x,c.x)));
        const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(S-1,Math.ceil(Math.max(a.y,b.y,c.y)));
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const px=x+.5,py=y+.5,w1=((px-a.x)*(c.y-a.y)-(py-a.y)*(c.x-a.x))/area,w2=((b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x))/area,w0=1-w1-w2;
          if(w0<-.00001||w1<-.00001||w2<-.00001)continue;const z=w0*a.z+w1*b.z+w2*c.z,p=y*S+x;
          if(z>=depth[p])continue;depth[p]=z;
          pixels[p*4]=Math.round(Math.min(1,w0*rgbAt[0].r+w1*rgbAt[1].r+w2*rgbAt[2].r)*255);
          pixels[p*4+1]=Math.round(Math.min(1,w0*rgbAt[0].g+w1*rgbAt[1].g+w2*rgbAt[2].g)*255);
          pixels[p*4+2]=Math.round(Math.min(1,w0*rgbAt[0].b+w1*rgbAt[1].b+w2*rgbAt[2].b)*255);
        }
      }
    }
  }
  return Buffer.from(pixels);
}
if(sharp){
  const composites=[];
  for(let i=0;i<panels.length;i++){
    const [label,key,angle]=panels[i],config=scenarios.find(s=>s[0]===key)[1],pose=snapshot(actor(config));
    const png=await sharp(render(pose,angle),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
    await fs.promises.writeFile(path.join(out,`53-${key}-${i}.png`),png);
    composites.push({input:png,left:(i%cols)*S,top:Math.floor(i/cols)*(S+42)+55});
    composites.push({input:Buffer.from(`<svg width="480" height="42"><text x="20" y="28" font-family="sans-serif" font-size="21" fill="#263b52">${label.replace('&','&amp;')}</text></svg>`),left:(i%cols)*S,top:Math.floor(i/cols)*(S+42)+55});
  }
  const header=Buffer.from(`<svg width="${S*cols}" height="55"><text x="20" y="34" font-family="sans-serif" font-size="22" fill="#263b52">CPU geometry inspection · actual source meshes · no browser / no WebGL lighting</text></svg>`);
  composites.push({input:header,left:0,top:0});
  await sharp({create:{width:S*cols,height:(S+42)*rows+55,channels:4,background:'#e9f6ff'}}).composite(composites).png().toFile(path.join(out,'53-avatar-contact-sheet.png'));
  const faces=[];
  for(const [i,angle] of [0,.62,Math.PI/2].entries()){
    const png=await sharp(render(snapshot(actor({})),angle,true),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
    await fs.promises.writeFile(path.join(out,`53-face-${['front','quarter','side'][i]}.png`),png);
    faces.push({input:png,left:i*S,top:0});
  }
  await sharp({create:{width:S*3,height:S,channels:4,background:'#e9f6ff'}}).composite(faces).png().toFile(path.join(out,'53-face-closeup.png'));
  const referencePose=snapshot(actor({}));
  const referenceImage=await sharp(render(referencePose,.55,true,.18),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
  const referenceLabel=Buffer.from('<svg width="480" height="36"><text x="14" y="25" font-family="sans-serif" font-size="15" fill="#263b52">CPU geometry inspection · reference viewing angle</text></svg>');
  await sharp(referenceImage).composite([{input:referenceLabel,left:0,top:0}]).png().toFile(path.join(out,'53-face-reference-angle.png'));
  details.png=path.join(out,'53-avatar-contact-sheet.png');
  const jobPanels=[];
  for(let i=0;i<jobScenarios.length;i++){
    const [label,config]=jobScenarios[i];
    for(let back=0;back<2;back++){
      const png=await sharp(render(snapshot({...config}),back?Math.PI+.25:.45,false,.04,true),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
      const name='54-job-'+config.jb+'-'+config.jt+(back?'-back':'-front')+'.png';
      fs.writeFileSync(path.join(out,name),png);
      const column=i%3,row=Math.floor(i/3)*2+back;
      jobPanels.push({input:png,left:column*S,top:row*(S+35)});
      jobPanels.push({input:Buffer.from('<svg width="480" height="35"><text x="14" y="25" font-family="sans-serif" font-size="18" fill="#263b52">'+label+(back?' / back':' / front')+'</text></svg>'),left:column*S,top:row*(S+35)});
    }
  }
  await sharp({create:{width:S*3,height:(S+35)*4,channels:4,background:'#e9f6ff'}}).composite(jobPanels).png().toFile(path.join(out,'54-jobs-contact-sheet.png'));
  const flightPanels=[];
  for(const [i,key] of ['run','glide','mine-ready','mine-hit'].entries()){
    const config=scenarios.find(s=>s[0]===key)[1],png=await sharp(render(snapshot(actor(config)),Math.PI/2,false,0,key==='glide'),{raw:{width:S,height:S,channels:4}}).png().toBuffer();
    fs.writeFileSync(path.join(out,'54-motion-'+key+'.png'),png);flightPanels.push({input:png,left:i*S,top:0});
  }
  await sharp({create:{width:S*4,height:S,channels:4,background:'#e9f6ff'}}).composite(flightPanels).png().toFile(path.join(out,'54-motion-side-sheet.png'));
}else details.png='sharp unavailable; matrix/geometry checks still ran';
details.results=results;fs.writeFileSync(path.join(out,'53-static-results.json'),JSON.stringify(details,null,2));
const failures=results.filter(r=>!r.pass);console.log(`${results.length-failures.length}/${results.length} checks passed; ${details.png}`);
process.exitCode=failures.length?1:0;
