import {BEACON, BOSS_HOME, GATE, SPAWN, TEAM_COLORS, VILLAGE_GROVE, VILLAGE_SITES} from './content.mjs';

// The map is an atlas and a 2D overlay, never a second scene render. The atlas is
// built once; player dots update at most five times a second with no timers.
const SIZE=256, CENTER=SIZE/2, RADIUS=120, PIXELS_PER_METRE=4;
const ATLAS={left:-40,top:-146,width:80,height:184};
const TEAM_INKS=TEAM_COLORS.map(c=>`#${c.toString(16).padStart(6,'0')}`);

export function mapObjective(state){
  if(state.phase==='forest')return state.beacon?{...GATE,label:'보스 입구'}:{...BEACON,label:'숲의 봉화'};
  if(state.phase==='boss')return {...(state.boss||BOSS_HOME),label:'가시등 멧돼지'};
  if(state.phase==='village')return {x:0,z:-8,label:'북쪽 숲길'};
  return {...SPAWN,label:'마을 광장'};
}

export function mapProjection(x,z,centerX,centerZ,range){
  const dx=(x-centerX)*RADIUS/range,dy=(z-centerZ)*RADIUS/range;
  const distance=Math.hypot(dx,dy),limit=RADIUS-10,scale=distance>limit?limit/distance:1;
  return {x:CENTER+dx*scale,y:CENTER+dy*scale,offscreen:distance>limit};
}

function makeAtlas(canvas){
  const atlas=canvas.ownerDocument.createElement('canvas');
  atlas.width=ATLAS.width*PIXELS_PER_METRE;atlas.height=ATLAS.height*PIXELS_PER_METRE;
  const ctx=atlas.getContext('2d',{alpha:false});
  if(!ctx)return null;
  ctx.scale(PIXELS_PER_METRE,PIXELS_PER_METRE);ctx.translate(-ATLAS.left,-ATLAS.top);
  ctx.fillStyle='#343d25';ctx.fillRect(ATLAS.left,ATLAS.top,ATLAS.width,ATLAS.height);
  // Land, tree cover, and the actual north/south route are static ink marks.
  ctx.fillStyle='#566443';ctx.fillRect(-20.5,-13,41,42.5);ctx.fillRect(-19,-90,38,77);
  ctx.beginPath();ctx.ellipse(0,-115,31,22,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<98;i++){
    const z=27-i*1.7,x=(i%2?-1:1)*(15.7+((i*13)%11)*.8);
    ctx.fillStyle=i%3?'#414e2f':'#657249';ctx.beginPath();ctx.ellipse(x,z,1.4+(i%3)*.4,2.2,((i*7)%10)/8,0,Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle='#9c9564';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,29);ctx.lineTo(0,-13);ctx.bezierCurveTo(2,-31,-2,-50,0,-64);ctx.lineTo(0,-115);ctx.stroke();
  ctx.strokeStyle='#c0ac76';ctx.lineWidth=.65;ctx.setLineDash([1.1,1.6]);ctx.stroke();ctx.setLineDash([]);
  for(const site of Object.values(VILLAGE_SITES)){
    ctx.fillStyle='#343726';ctx.fillRect(site.x-site.r*.63,site.z-site.r*.62,site.r*1.3,site.r*1.3);
    ctx.fillStyle='#a39361';ctx.strokeStyle='#d9c388';ctx.lineWidth=.3;
    ctx.beginPath();ctx.moveTo(site.x-site.r*.64,site.z-site.r*.52);ctx.lineTo(site.x,site.z-site.r*.9);ctx.lineTo(site.x+site.r*.64,site.z-site.r*.52);ctx.lineTo(site.x+site.r*.64,site.z+site.r*.46);ctx.lineTo(site.x-site.r*.64,site.z+site.r*.46);ctx.closePath();ctx.fill();ctx.stroke();
  }
  for(const tree of VILLAGE_GROVE){ctx.fillStyle='#32472d';ctx.beginPath();ctx.arc(tree.x,tree.z,2.1,0,Math.PI*2);ctx.fill();}
  for(const place of [BEACON,GATE,BOSS_HOME]){ctx.strokeStyle='#bdaf7c';ctx.lineWidth=.6;ctx.strokeRect(place.x-1.4,place.z-1.4,2.8,2.8);}
  return atlas;
}

export function createMinimap(canvas){
  canvas.width=SIZE;canvas.height=SIZE;
  const ctx=canvas.getContext('2d',{alpha:false});
  const atlas=ctx?makeAtlas(canvas):null;
  let lastDraw=-Infinity,lastSignature='',draws=0,description='';
  function update(state,localId,expanded=false,now=performance.now()){
    if(!ctx||!atlas||now-lastDraw<200||canvas.closest('[hidden]'))return false;
    lastDraw=now;
    const me=state.players?.[localId];if(!me)return false;
    const target=mapObjective(state),range=expanded?100:31,centerX=expanded?0:me.x,centerZ=expanded?-54:me.z;
    const players=Object.values(state.players||{}).filter(p=>p.online!==false);
    const signature=[expanded,state.phase,state.beacon,target.x,target.z,localId,...players.flatMap(p=>[p.id,p.team,p.x.toFixed(2),p.z.toFixed(2),(p.yaw||0).toFixed(2),p.hp>0])].join('|');
    if(signature===lastSignature)return false;lastSignature=signature;
    ctx.fillStyle='#262c1d';ctx.fillRect(0,0,SIZE,SIZE);ctx.save();
    ctx.beginPath();ctx.arc(CENTER,CENTER,RADIUS,0,Math.PI*2);ctx.clip();
    const scale=RADIUS/range/PIXELS_PER_METRE;
    ctx.drawImage(atlas,CENTER+(ATLAS.left-centerX)*RADIUS/range,CENTER+(ATLAS.top-centerZ)*RADIUS/range,atlas.width*scale,atlas.height*scale);
    const waypoint=mapProjection(target.x,target.z,centerX,centerZ,range);
    ctx.save();ctx.translate(waypoint.x,waypoint.y);ctx.fillStyle='#f4d991';ctx.strokeStyle='#30291b';ctx.lineWidth=2;
    ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,r=i%2?3:7;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    for(const p of players){
      if(p.id===localId)continue;
      const point=mapProjection(p.x,p.z,centerX,centerZ,range);
      // Distant friends remain discoverable on the full route map, without
      // crowding the rim of the local map with misleading clamped markers.
      if(point.offscreen)continue;
      ctx.fillStyle=p.hp>0?(TEAM_INKS[p.team]||'#d5c9a2'):'#e9e0c7';ctx.strokeStyle='#20251b';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(point.x,point.y,p.hp>0?3.1:4,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(p.hp<=0){ctx.strokeStyle='#973e31';ctx.beginPath();ctx.moveTo(point.x-2,point.y);ctx.lineTo(point.x+2,point.y);ctx.moveTo(point.x,point.y-2);ctx.lineTo(point.x,point.y+2);ctx.stroke();}
    }
    const point=mapProjection(me.x,me.z,centerX,centerZ,range);
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(-(me.yaw||0));ctx.fillStyle='#f3cf77';ctx.strokeStyle='#332719';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5.7,5);ctx.lineTo(0,2.5);ctx.lineTo(-5.7,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.restore();draws++;
    const nextDescription=`${expanded?'전체 원정 지도':'주변 지도'}. 위쪽은 북쪽. 금색 화살표는 나, 색 점은 친구, 별은 ${target.label}.`;
    if(description!==nextDescription){description=nextDescription;canvas.setAttribute('aria-label',description);}
    return true;
  }
  return {update,stats:()=>({draws,atlasBuilds:atlas?1:0,width:SIZE,height:SIZE,maxHz:5})};
}
