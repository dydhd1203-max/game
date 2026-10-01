// 82차 rainbow roller coaster — native-rate actual controller checks (each frame calls updPlayer once,
// so a support or crest regression cannot hide in substeps). Runs inside the game page.
export function race82ChutePhysics(){
 const W=window,P=W.__PL,G=W.__G,A=W.__race74,K=W.__KEY,Y=W.__MINI().Y,C=W.__CH82,Z1=W.__CH82_Z1,result=[];
 G.players.clear();W.__pcMap.clear();G.phase='mini';G.mini.st='run';G.paused=false;
 const clear=()=>{for(const k of Object.keys(K))delete K[k];};
 const Q=z=>{const q=W.__chuteQ82(z);return {cx:q.cx,sn:q.sn,cs:q.cs,y:q.y};};
 const rows=C.bumpRows.map(([zr,ds,Rr])=>({z:C.z0+zr,ds,R:Rr||C.bumpR}));
 // Open lanes of a candy row (body radius and a small margin included), in chute-lateral d.
 const gaps=row=>{const lim=C.hw-P.R-.03,bl=row.ds.map(d=>[d-row.R-P.R-.35,d+row.R+P.R+.35]).sort((a,b)=>a[0]-b[0]),o=[];let cur=-lim;
   for(const [a,b] of bl){if(a>cur)o.push([cur,a]);cur=Math.max(cur,b);}if(cur<lim)o.push([cur,lim]);return o.filter(([a,b])=>b-a>.6);};
 const yardZ=C.z0+(C.humps.at(-1)[0]+C.humps.at(-1)[1]+C.knots.find(k=>k[0]>C.humps.at(-1)[0])[0])/2;
 for(const fps of [30,60,120]){
  W.__raceBuild(13);const chute=W.__RACE_P().find(p=>p.chute);
  const reset=(x,z,V,y)=>{clear();A.reset();W.__kbReset();W.__setStamina(1);G.t=180;W.__MINE.cp=6;W.__MINE.fin=-1;
   Object.assign(W.__RACE(),{t:1,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:0,z:680,y:30}});const q=Q(z);
   Object.assign(P,{x,z,y:y??A.surface(chute,x,z),vx:q.sn*V,vz:q.cs*V,vy:0,_px:x,_pz:z,ground:true,jumps:0,down:false,glide:false,yaw:Math.PI,pitch:-.22,flipT:99});};
  const step=()=>{G.t-=1/fps;W.__updPlayer(1/fps);A.tick(1/fps);};
  const lat=()=>{const q=Q(P.z);return {d:(P.x-q.cx)*q.cs,V:P.vx*q.sn+P.vz*q.cs,vd:P.vx*q.cs-P.vz*q.sn};};
  const controls=[];
  for(const mode of ['coast','accelerate','brake','left','right']){
   reset(Q(yardZ).cx,yardZ,46);let ground=true,hit=false;
   for(let f=0;f<Math.round(fps*.3);f++){clear();if(mode==='accelerate')K.w=true;if(mode==='brake')K.s=true;if(mode==='left')K.a=true;if(mode==='right')K.d=true;
    step();ground&&=P.ground;hit ||= W.__RACE().hitCd>0;}
   controls.push({mode,...lat(),ground,hit});
  }
  // A no-steer run from the landing yard lined up behind the first candy meets it and bounces as a short chute hop.
  {const d0=C.bumpRows[0][1][0],q=Q(yardZ);reset(q.cx+d0/q.cs,yardZ,46);}let centerHit=null;
  for(let f=0;f<fps*2&&!centerHit;f++){clear();step();if(W.__RACE().hitCd>0)centerHit={z:P.z,kind:A.state.flightKind,...lat()};}
  // Whole ride from the flag deck at native rate: W held, steering toward the lane a child can see ahead.
  const ride=pol=>{reset(0,682,0,Y+30.075);let t=0,hits=0,lastHit=0,falls=0,air=0,airStart=0,kind='',maxWallS1=0,maxView=0,tEnter=null,tLip=null,prevZ=P.z,landZ=null;const hops=[];
   for(let f=0;f<fps*20;f++){clear();if(pol==='skill'||t<.8)K.w=true;
    if(pol==='skill'&&P.z>C.z0){const nxt=rows.find(r=>r.z+r.R>P.z);
     if(nxt&&nxt.z-P.z<70){const {d,vd}=lat(),pred=d+vd*.3;let best=null,bd=1e9;
      for(const [a,b] of gaps(nxt)){const w=b-a,tg=Math.max(a+Math.min(2,w/2),Math.min(b-Math.min(2,w/2),pred));if(Math.abs(tg-pred)<bd){bd=Math.abs(tg-pred);best=tg;}}
      if(best!==null){if(pred<best-.35)K.a=true;else if(pred>best+.35)K.d=true;}}}
    step();t+=1/fps;
    if(tEnter===null&&P.z>=C.z0)tEnter=t;if(tLip===null&&prevZ<Z1&&P.z>=Z1)tLip=t;
    if(!P.ground&&!air){air=1;airStart=t;}
    if(P.ground&&air){air=0;hops.push({z:+P.z.toFixed(1),dur:+(t-airStart).toFixed(2),kind});if(prevZ>Z1-1&&landZ===null)landZ=P.z;}
    kind=A.state.flightKind||kind;
    if(W.__RACE().hitCd>lastHit+.05)hits++;lastHit=W.__RACE().hitCd;if(W.__RACE().fallT>0){falls++;break;}
    const rz=P.z-C.z0;if(P.ground&&rz>27&&rz<131)maxWallS1=Math.max(maxWallS1,P.y-Y-Q(P.z).y);
    maxView=Math.max(maxView,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));prevZ=P.z;
    if(W.__MINE.cp===7&&landZ!==null)break;}
   return {pol,cp:W.__MINE.cp,hits,falls,hops,ride:tLip!==null&&tEnter!==null?+(tLip-tEnter).toFixed(2):null,landZ,maxWallS1:+maxWallS1.toFixed(2),maxView};};
  const pad7=W.__RACE_P().find(p=>p.cp===7);
  result.push({fps,controls,centerHit,skill:ride('skill'),coast:ride('coast'),pad7:{z:pad7.z,d:pad7.d}});
 }
 clear();return result;
}
export function validateRace82Chute(result){
 const check=(v,m)=>{if(!v)throw Error(m);};check(result.length===3,'Native roller-coaster checks cover 30/60/120 Hz');
 for(const q of result){const get=m=>q.controls.find(x=>x.mode===m);
  check(q.controls.every(x=>x.ground&&!x.hit),'Native-rate chute controls stay grounded on the landing yard');
  check(get('accelerate').V>get('coast').V+1.5&&get('brake').V<get('coast').V-2.5,'W speeds up and S slows the roller coaster');
  check(get('left').vd>2&&get('right').vd<-2,'A/D give real sideways authority inside the U');
  check(q.centerHit&&q.centerHit.kind==='chute','A no-steer run lined up behind the first candy meets it and pops as a short chute hop');
  const s=q.skill,c=q.coast,crest=h=>h.kind==='chute'&&h.dur>.25&&h.dur<1;
  check(s.cp===7&&s.hits===0&&s.falls===0&&s.maxView<1e-8,'A real-input native-rate ride threads every candy row, stays inside and reaches the next checkpoint without touching the camera');
  check(s.hops.filter(crest).length>=3&&s.maxWallS1>1.5,'The ride pops over the three humps and climbs the first S-curve wall');
  check(s.ride>6&&s.ride<9.5&&c.ride>s.ride&&c.ride<11,'The ride lasts 6–9.5 s held forward and longer when coasting');
  const onPad=z=>z!==null&&Math.abs(z-q.pad7.z)<q.pad7.d/2-2;
  check(onPad(s.landZ)&&onPad(c.landZ)&&c.cp===7&&c.falls===0,'The kicker lands on the next flag deck whether steering or coasting (hits allowed)');
 }
}
