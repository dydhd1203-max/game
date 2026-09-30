// Runs inside the game page. Fixtures are used only to isolate contracts;
// the full routes below use normal input from the real start to the finish.
export function race76Physics(){
  const W=window,A=W.__race74,P=W.__PL,G=W.__G,KEY=W.__KEY,Y=W.__MINI().Y;
  const flights=[],manual=[],carries=[],ramps=[],slides=[],slideExits=[],routes=[],checkpoints=[],knocks=[],clocks=[],crowdPush=[],centerLandings=[];
  G.players.clear();W.__pcMap.clear();G.phase='mini';G.mini.st='run';G.paused=false;
  const clear=()=>{for(const k of Object.keys(KEY))delete KEY[k];};
  const reset=(x,z,y,cp=0)=>{clear();A.reset();const S=W.__RACE();
    Object.assign(S,{t:0,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:0,z:W.__MINI().PADZ,y:0}});
    G.t=W.__MINI().RACE;W.__MINE.fin=-1;W.__MINE.cp=cp;W.__MINE.prog=0;W.__setStamina(1);
    Object.assign(P,{x,z,y,ground:true,vx:0,vz:0,vy:0,jumps:0,down:false,glide:false,yaw:Math.PI,pitch:-.22,_px:x,_pz:z,flipT:99,takeT:0});};
  const step=(dt,observe)=>{G.t-=dt;const n=Math.ceil(dt/(1/120)),sub=dt/n;
    for(let k=0;k<n;k++){const before={flight:A.state.flight,vy:P.vy,ground:P.ground};W.__updPlayer(sub);observe?.(before,sub);}
    A.tick(dt);};
  const steer=(x,forward=true)=>{clear();if(forward)KEY.w=true;if(P.x<x-.18)KEY.a=true;else if(P.x>x+.18)KEY.d=true;};
  const press=()=>{KEY[' ']=true;W.__wantJump();};
  for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
    G.mini.seed=seed;W.__raceBuild(seed);
    const donuts=W.__RACE_P().filter(p=>p.bounce?.manual);
    for(const pad of donuts){const jp=A.jumpPose(pad);
      reset(jp.x,jp.z-3,Y+pad.y);KEY.w=true;let auto=false;
      for(let i=0;i<fps*.3;i++){step(1/fps);auto ||= A.state.flightKind==='manual'||!!A.state.pending?.p?.bounce?.manual;}
      const walked=P.z-(jp.z-3);
      reset(jp.x,jp.z-3.5,Y+pad.y);press();step(1/fps);
      manual.push({seed,fps,pad:pad.id,auto,walked,outsideZoneSpring:A.state.flightKind==='manual'||!!A.state.pending?.p?.bounce?.manual});
    }
    for(const pad of W.__RACE_P().filter(p=>p.bounce)){
      const jp=A.jumpPose(pad);reset(jp.x,jp.z,Y+pad.y);KEY.w=true;if(pad.bounce.manual)press();
      const destination=W.__RACE_P().find(p=>p.bounce?.manual&&p.z>pad.z)||W.__RACE_P().find(p=>p.cp===4);
      const landing=A.landingPose(destination);
      let count=0,elapsed=0,launchedAt=0,launch=null,gravity=null,land=null,peak=0,heldRepeat=false;
      for(let i=0;i<fps*5;i++){
        if(pad.bounce.manual&&launch){steer(landing.x-P.vx*.25,false);KEY[' ']=true;}
        step(1/fps,(before,dt)=>{elapsed+=dt;
          if(before.flight===0&&A.state.flight>0){count++;launchedAt=elapsed;launch={vy:P.vy,vz:P.vz,y:P.y,z:P.z};}
          else if(launch&&gravity===null&&!P.ground)gravity=(before.vy-P.vy)/dt;
          peak=Math.max(peak,P.y-Y-pad.y);
          if(launch&&before.ground===false&&P.ground&&!land)land={pad:A.under()?.id,z:P.z,y:P.y,time:elapsed-launchedAt};
        });
        if(land)break;if(P.y<Y-6||W.__RACE().fallT>0)break;
      }
      if(land&&pad.bounce.manual){clear();KEY[' ']=true;
        for(let i=0;i<fps*.35;i++){step(1/fps);heldRepeat ||= A.state.flightKind==='manual'||!!A.state.pending?.p?.bounce?.manual;}}
      const rate=pad.bounce.rate||1.18;
      flights.push({seed,fps,pad:pad.id,kind:pad.kind,isManual:!!pad.bounce.manual,count,launch,gravity,
        expectedVy:pad.bounce.manual?pad.bounce.v-72/120:pad.bounce.v*rate,expectedVz:pad.bounce.forward*rate,expectedGravity:pad.bounce.manual?72:W.__gravNow()*rate*rate,
        peak,land,heldRepeat,viewChange:Math.abs(P.yaw-Math.PI)+Math.abs(P.pitch+.22)});
    }
    const first=donuts[0],next=donuts[1],start=A.jumpPose(first);reset(start.x,start.z,Y+first.y);press();
    let centerHit=false,centerLaunched=false,centerAir=0;
    for(let i=0;i<fps*4;i++){if(centerLaunched){steer(next.x-P.vx*.25,false);KEY[' ']=true;}
      step(1/fps);centerLaunched ||= A.state.flightKind==='manual';centerAir=(i+1)/fps;
      if(W.__RACE().hitCd>0){centerHit=true;break;}if(centerLaunched&&P.ground)break;}
    centerLandings.push({seed,fps,launched:centerLaunched,hit:centerHit,time:centerAir,x:P.x,z:P.z,y:P.y-Y});
    for(const moving of W.__RACE_P().filter(p=>p.mv)){const pose=A.pose(moving,0),offset=1.2;
    reset(pose.x+offset,pose.z,Y+moving.y);let ground=true;
    for(let i=0;i<fps*2;i++){step(1/fps);ground&&=P.ground;}
    const now=A.pose(moving,W.__RACE().t),expected={x:now.x+offset*Math.cos(now.a),z:now.z-offset*Math.sin(now.a)};
    carries.push({seed,fps,pad:moving.id,ground,error:Math.hypot(P.x-expected.x,P.z-expected.z),yaw:P.yaw,pitch:P.pitch,
      supported:A.contains(moving,P.x,P.z,.1,W.__RACE().t),movement:Math.hypot(now.x-pose.x,now.z-pose.z),rotation:now.a});}
    const ramp=W.__RACE_P().find(p=>p.shape==='ramp'),startZ=ramp.z-12,x=11.5;
    reset(x,startZ,A.surface(ramp,x,startZ));for(let i=0;i<fps;i++)step(1/fps);
    const idle={z:P.z,vz:P.vz,ground:P.ground};
    const b=ramp.boosts[0];reset(b.x,b.z,A.surface(ramp,b.x,b.z));KEY.w=true;
    let boostSpeed=0,boosted=false;for(let i=0;i<fps*.3;i++){step(1/fps);boostSpeed=Math.max(boostSpeed,P.vz);boosted ||= A.state.boostT>0;}
    ramps.push({seed,fps,idleBack:startZ-idle.z,idleSpeed:idle.vz,idleGround:idle.ground,boostSpeed,boosted});
    // 82차 — the slide is the curved U roller coaster: start at its mouth from rest, hold W for 1.2 s down the steep drop.
    const slide=W.__RACE_P().find(p=>p.shape==='slide'),Z1=W.__CH82_Z1,z0=W.__CH82.z0+.4,slideX=W.__chuteQ82(z0).cx;
    reset(slideX,z0,A.surface(slide,slideX,z0));KEY.w=true;
    let maxSpeed=0,hit=false;for(let i=0;i<fps*1.2;i++){step(1/fps);maxSpeed=Math.max(maxSpeed,Math.hypot(P.vx,P.vz));hit ||= W.__RACE().hitCd>0;}
    slides.push({seed,fps,maxSpeed,hit,ground:P.ground,dz:P.z-z0,drop:Y+slide.y-P.y});
    // The kicker at its end throws every rider onto the next flag deck (≈1.4 s flight).
    const exitZ=Z1-3.5,qe=W.__chuteQ82(exitZ);reset(qe.cx,exitZ,A.surface(slide,qe.cx,exitZ),6);P.vx=qe.sn*56.2;P.vz=qe.cs*56.2;KEY.w=true;
    let crossed=false,landed=false,minGapSpeed=Infinity,exitTime=0,kind='';
    for(let i=0;i<fps*3;i++){step(1/fps,()=>{if(P.z>Z1&&!P.ground){crossed=true;minGapSpeed=Math.min(minGapSpeed,P.vz);kind=A.state.flightKind||kind;}
        if(crossed&&P.ground&&A.under()?.cp===7)landed=true;});exitTime=(i+1)/fps;if(landed&&W.__MINE.cp===7)break;}
    slideExits.push({seed,fps,crossed,landed,minGapSpeed,exitTime,kind,checkpoint:W.__MINE.cp,z:P.z});
  }
  // A held key cannot cause another donut launch. A fresh press must work.
  const pad=W.__RACE_P().find(p=>p.bounce?.manual);
  const jp=A.jumpPose(pad);reset(jp.x,jp.z,Y+pad.y);press();let first=false;
  for(let i=0;i<120;i++){step(1/120);if(A.state.flight>0){first=true;break;}}
  Object.assign(P,{x:jp.x,z:jp.z,y:Y+pad.y+.4,vy:-5,vx:0,vz:0,ground:false,_px:jp.x,_pz:jp.z});
  let touched=false,heldLaunch=false;for(let i=0;i<100;i++){step(1/120);touched ||= P.ground;heldLaunch ||= touched&&A.state.flight>0;}
  clear();press();let fresh=false;for(let i=0;i<40;i++){step(1/120);fresh ||= A.state.flight>0;}
  const freshPress={first,touched,heldLaunch,fresh};
  // Replay twenty nearby children entering a narrow breathing seam. No fixture
  // applies an impulse: actual sheepBump inside updPlayer must cause the contact.
  for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
    G.mini.seed=seed;W.__raceBuild(seed);
    const bag=W.__raceHazards(1).find(h=>h.id==='jellyGate0:2'),startX=bag.x+bag.r+P.R+.35,startZ=bag.z;
    const probe=crowded=>{G.players.clear();reset(startX,startZ,Y);W.__RACE().t=1;W.__kbReset();
      if(crowded)for(let i=0;i<20;i++)G.players.set('push'+i,{uid:'push'+i,x:startX+.95+(i%5)*.95,z:startZ+(Math.floor(i/5)-1.5)*.85,y:Y,down:false});
      let hit=false,maxPush=0,maxSpeed=0,minBeforeContact=Infinity;
      for(let i=0;i<fps*.4;i++){
        for(const q of G.players.values())q.x-=2.8/fps;
        step(1/fps);hit ||= W.__RACE().hitCd>0;maxPush=Math.max(maxPush,startX-P.x);
        maxSpeed=Math.max(maxSpeed,Math.hypot(W.__kb().x,W.__kb().z));
        if(!hit)minBeforeContact=Math.min(minBeforeContact,Math.abs(P.x-bag.x)-bag.r-P.R);
        if(hit)break;
      }
      return {hit,maxPush,maxSpeed,minBeforeContact,players:G.players.size+1};};
    crowdPush.push({seed,fps,solo:probe(false),crowd:probe(true)});G.players.clear();W.__kbReset();
  }
  // The same post-contact integration must move five times farther for the new
  // punch impulse than the old eight-unit impulse, without changing its duration.
  const bag=W.__raceHazards(1).find(h=>h.k==='punch'&&h.sec===0&&Math.abs(h.x)<3);
  if(bag){const startX=bag.x+bag.r+.2,z=bag.z;
    const run=reference=>{reset(startX,z,Y);W.__RACE().t=1;
      if(reference){Object.assign(P,{vx:8,vz:0,vy:7,ground:false,jumps:1});Object.assign(A.state,{flight:.001,flightKind:'knock',rate:1});W.__RACE().hitCd=1.1;}
      else {A.after(1/120);}
      const impulse=Math.hypot(P.vx,P.vz);for(let i=0;i<24;i++)step(1/120);return {dx:P.x-startX,dz:P.z-z,impulse};};
    const actual=run(false),old=run(true);knocks.push({actual,old,ratio:Math.hypot(actual.dx,actual.dz)/Math.hypot(old.dx,old.dz)});}
  // Checkpoint fixtures test ordering and recovery. These placements are NOT
  // used in the continuous route below.
  const cps=W.__RACE_P().filter(p=>p.cp).sort((a,b)=>a.cp-b.cp);
  reset(cps[3].x,cps[3].z,Y+cps[3].y);step(1/60);const skipped=W.__MINE.cp;
  for(const cp of cps){reset(cp.x,cp.z,Y+cp.y,cp.cp-1);step(1/60);const registered=W.__MINE.cp,expected={...W.__RACE().cp};
    P.x=1000;P.y=Y-8;P.ground=false;P.vy=-5;for(let i=0;i<75;i++)step(1/60);
    checkpoints.push({cp:cp.cp,registered,expected,yWorld:Y+expected.y,x:P.x,z:P.z,y:P.y,ground:P.ground,fall:W.__RACE().fallT});}
  const finish=W.__RACE_P().find(p=>p.fin);reset(finish.x,finish.z,Y+finish.y,0);step(1/60);const skippedFinish=W.__MINE.fin;
  reset(cps[0].x,cps[0].z,Y+cps[0].y-2);P.ground=false;P.vy=-4;
  const buriedStart=P.y;step(1/60);const belowDeck={before:buriedStart,after:P.y,ground:P.ground};
  // Full course: normal input only. Phase-aware jumping through the sweep gates,
  // centered Space presses, uphill booster lanes, sprint jumps between moving
  // circles and a visible slalom lane through the final chute.
  for(const seed of [13,7919,740021])for(const fps of [30,60,120]){
    G.mini.seed=seed;W.__raceBuild(seed);reset(0,-19,Y);
    let elapsed=0,falls=0,hits=0,lastFall=false,lastHit=0,jumps=0,manualLaunches=0,airAge=0,doubleUsed=false,maxViewChange=0;
    const trail=[],gatePasses=[],events=[];let previousCp=0,lastRecorded=-10,bridgeGoal=null,donutWalk=null;
    for(let f=0;f<fps*180&&W.__MINE.fin<0;f++){
      const S=W.__RACE(),z=P.z,under=P.ground?A.under():null;
      let target=0,go=true,sprint=false,jump=false,reverse=false;
      if(z<78){
        // Read one of the narrow, breathing seams in each row, then cross to the other side.
        const gates=W.__raceHazards(S.t).filter(h=>h.id.startsWith(z<51?'jellyGate0:':'jellyGate1:')).sort((a,b)=>a.x-b.x);
        const seam=z<51?(gates[2].x+gates[3].x)/2:(gates[3].x+gates[4].x)/2;
        // Read the fixed columns before choosing a breathing seam. The former
        // x=7.5 approach walked straight into the preceding row at z=35.
        target=z<30?0:z<46?seam:z<56?4.5:z<74?seam:0;
        if((z>=46&&z<49||z>=56&&z<58)&&Math.abs(P.x-target)> .45)go=false;
      }
      else if(z<210){
        const bar=W.__raceHazards(S.t).filter(h=>h.k==='bar').find(h=>h.z>z-2);
        target=bar?bar.x<0?6.8:bar.x>0?-6.8:6.8:0;
        const dist=bar?bar.z-z:99;
        sprint=dist<13&&dist>-12;
        // The restored walking speed needs a later take-off and an earlier switch toward the next scattered bar.
        if(P.ground&&dist<5.8&&dist>-7)jump=true;
        if(!P.ground&&airAge>.48&&!doubleUsed&&(P.jumps|0)<1){jump=true;doubleUsed=true;}
      }else if(z<476){
        const donuts=W.__RACE_P().filter(p=>p.bounce?.manual);
        if(A.state.flightKind==='manual'&&!P.ground){
          const launch=donuts.find(p=>p.id===A.state.lastPad),next=donuts.find(p=>p.z>(launch?.z??z))||W.__RACE_P().find(p=>p.cp===4);
          target=A.landingPose(next).x-P.vx*.25;go=false;donutWalk=null;
        }else if(under?.bounce?.manual){const jp=A.jumpPose(under),lp=A.landingPose(under);
          if(!donutWalk||donutWalk.id!==under.id)donutWalk={id:under.id,phase:0};
          const way=[{x:lp.x,z:under.z+8.5},{x:jp.x,z:under.z+8.5},jp];
          let goal=way[donutWalk.phase];
          if(Math.hypot(P.x-goal.x,z-goal.z)<.7&&donutWalk.phase<2)goal=way[++donutWalk.phase];
          target=goal.x-P.vx*.025;go=z<goal.z-.3;reverse=z>goal.z+.3;
          if(donutWalk.phase===2&&Math.hypot(P.x-jp.x,z-jp.z)<.65){go=false;reverse=false;jump=true;}
        }else {target=A.landingPose(donuts[0]).x;if(P.ground&&z>225.8&&z<233)jump=true;donutWalk=null;}
      }else if(z<570){
        const ramp=W.__RACE_P().find(p=>p.shape==='ramp'),b=ramp.boosts.find(b=>b.z>z-2);target=b?.x??0;
        // Jump clear of a visible rock approaching this lane.
        if(P.ground&&W.__raceHazards(S.t).some(h=>h.k==='rock'&&Math.abs(h.x-P.x)<3&&h.z>z&&h.z-z<8))jump=true;
      }else if(z<676){
        const circles=W.__RACE_P().filter(p=>p.sec===4&&p.mv),current=under?.mv?under:null;
        let next=current?circles[circles.indexOf(current)+1]:circles.find(p=>A.pose(p,S.t).z>z+1);
        if(P.ground)bridgeGoal=next||null;
        const pose=bridgeGoal?A.pose(bridgeGoal,S.t+Math.max(0,1.05-airAge)):{x:0,z:680};target=pose.x-P.vx*.025;
        if(P.ground){const edge=current?A.pose(current,S.t).z+current.d/2:586;
          if(z>=edge-1.4)jump=true;
        }else {go=z<pose.z-.4;if(z>pose.z+.4)reverse=true;}
      }else if(z<W.__CH82_Z1+2){
        // 82차 roller coaster: hold W, read the next candy row's open lane ahead and steer into it (lateral d → world x).
        const C=W.__CH82,q=W.__chuteQ82(Math.min(z,W.__CH82_Z1)),d=(P.x-q.cx)*q.cs,vd=P.vx*q.cs-P.vz*q.sn,pred=d+vd*.3;
        const row=C.bumpRows.map(([zr,ds,Rr])=>({z:C.z0+zr,ds,R:Rr||C.bumpR})).find(r=>r.z+r.R>z);let want=pred;
        if(row&&row.z-z<70&&z>C.z0){const lim=C.hw-P.R-.03,bl=row.ds.map(x=>[x-row.R-P.R-.35,x+row.R+P.R+.35]).sort((a,b)=>a[0]-b[0]),open=[];let cur=-lim,bd=1e9;
          for(const [a,b] of bl){if(a>cur)open.push([cur,a]);cur=Math.max(cur,b);}if(cur<lim)open.push([cur,lim]);
          for(const [a,b] of open){const w=b-a;if(w<.6)continue;const tg=Math.max(a+Math.min(2,w/2),Math.min(b-Math.min(2,w/2),pred));if(Math.abs(tg-pred)<bd){bd=Math.abs(tg-pred);want=tg;}}}
        target=P.x+(want-pred)/q.cs;
      }
      else target=0;
      steer(target,go);if(reverse&&!go)KEY.s=true;if(sprint)KEY.shift=true;if(jump){press();jumps++;}
      const oldGround=P.ground,oldFlight=A.state.flight;step(1/fps);elapsed=(f+1)/fps;
      for(const gate of [42,61])if(z<gate&&P.z>=gate){const row=W.__raceHazards(S.t).filter(h=>h.id.startsWith('jellyGate'+(gate===42?0:1)+':')).sort((a,b)=>a.x-b.x);
        const left=row.filter(h=>h.x<P.x).at(-1),right=row.find(h=>h.x>P.x),lo=left?left.x+left.r+P.R:Infinity,hi=right?right.x-right.r-P.R:-Infinity;
        gatePasses.push({gate,x:P.x,t:elapsed,lo,hi,clear:P.x>lo&&P.x<hi,width:hi-lo});}
      if(oldFlight===0&&A.state.flight>0&&A.state.flightKind==='manual')manualLaunches++;
      if(events.length<24&&((oldFlight===0&&A.state.flight>0)||S.hitCd>lastHit+.05||S.fallT>0&&!lastFall))events.push({time:elapsed,x:P.x,z:P.z,y:P.y-Y,flight:A.state.flightKind,vx:P.vx,vz:P.vz,vy:P.vy,lastPad:A.state.lastPad,hit:S.hitCd,fall:S.fallT});
      if(P.ground){airAge=0;doubleUsed=false;}else airAge+=1/fps;
      if(S.hitCd>lastHit+.05)hits++;lastHit=S.hitCd;
      if(S.fallT>0&&!lastFall)falls++;lastFall=S.fallT>0;
      maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
      if(W.__MINE.cp!==previousCp||elapsed-lastRecorded>=10||W.__MINE.fin>=0){trail.push({t:+elapsed.toFixed(2),cp:W.__MINE.cp,x:+P.x.toFixed(2),z:+P.z.toFixed(2),y:+(P.y-Y).toFixed(2),falls,hits});previousCp=W.__MINE.cp;lastRecorded=elapsed;}
      if(![P.x,P.y,P.z,P.vx,P.vy,P.vz].every(Number.isFinite))break;
    }
    routes.push({seed,fps,finished:W.__MINE.fin>=0,seconds:elapsed,falls,hits,jumps,manualLaunches,checkpoint:W.__MINE.cp,z:P.z,maxViewChange,gatePasses,trail,events});
  }
  for(const fps of [30,60,120])for(const mode of ['normal','popup','paused']){
    reset(0,-19,Y);G.paused=mode==='paused';const begin=W.__RACE().t;
    for(let i=0;i<fps;i++){if(mode==='normal')step(1/fps);else {if(mode==='popup')G.t-=1/fps;A.tick(1/fps);}}
    clocks.push({fps,mode,elapsed:W.__RACE().t-begin,expected:mode==='paused'?0:1});G.paused=false;}
  const S=W.__RACE();S.slipT=.8;S.hitCd=1;S.fallT=.5;S.knock={x:1,z:1};S.on=true;
  A.state.flight=1;A.state.rate=2.36;A.state.boostT=.7;A.state.pending={p:pad,t:.05};A.state.pulse.set(1,.8);
  Object.assign(P,{vx:3,vz:5,vy:8});clear();G.phase='day';G.mini=null;W.__miniLeave();
  const leftRace={on:S.on,slip:S.slipT,hit:S.hitCd,fall:S.fallT,knock:S.knock,velocity:[P.vx,P.vy,P.vz],flight:A.state.flight,rate:A.state.rate,boost:A.state.boostT,pending:A.state.pending,pulses:A.state.pulse.size};
  return {limit:W.__MINI().RACE,flights,manual,freshPress,carries,ramps,slides,slideExits,knocks,crowdPush,centerLandings,checkpoints,skipped,skippedFinish,belowDeck,routes,clocks,leftRace};
}

export function validateRace76(p){
  const check=(ok,why)=>{if(!ok)throw Error(why);};
  check(p.limit===180,'The race limit must be 180 seconds');
  check(p.manual.length===36&&p.manual.every(q=>!q.auto&&q.walked>2&&q.outsideZoneSpring),
    'Walking never launches a donut, and a fresh Space outside the former tiny jump zone now launches from the supported platform');
  check(p.flights.length===45&&p.flights.every(q=>q.count===1&&q.launch&&q.land&&q.viewChange<1e-8&&
    Math.abs(q.launch.vy-q.expectedVy)<1e-8&&Math.abs(q.launch.vz-q.expectedVz)<1e-8&&Math.abs(q.gravity-q.expectedGravity)<1e-6),
    'Every actual spring must launch once, integrate its calibrated impulse/gravity, land, and preserve the view');
  check(p.flights.filter(q=>q.isManual).every(q=>q.peak>22&&q.peak<24&&q.land.time>2.5&&q.land.time<2.7&&
    q.land.z-q.launch.z>53&&q.land.z-q.launch.z<59&&!q.heldRepeat),
    'Manual donuts have a 23-meter high buoyant arc, steer onto staggered islands, and do not repeat from a held key');
  check(p.freshPress.first&&p.freshPress.touched&&!p.freshPress.heldLaunch&&p.freshPress.fresh,
    'A new Space press, rather than holding Space after landing, must arm another spring');
  check(p.crowdPush.length===9&&p.crowdPush.every(q=>!q.solo.hit&&q.crowd.hit&&q.crowd.players===21&&q.crowd.maxPush>.15&&q.crowd.maxSpeed<=3.5),
    'Twenty nearby children must push a safely placed player into an actual narrow-lane bumper through bounded real sheepBump integration');
  check(p.centerLandings.length===9&&p.centerLandings.every(q=>q.launched&&q.hit&&q.time>1.5&&q.time<3),
    'A center-only landing attempt must collide with the interior chicane during the real descending jump arc');
  check(p.carries.length===63&&p.carries.every(q=>q.ground&&q.supported&&q.error<.05&&q.movement>.01&&Math.abs(q.rotation)>.1&&q.yaw===Math.PI&&q.pitch===-.22),
    'Moving circles must carry a rider through X/Z translation and rotation without turning the camera');
  check(p.ramps.every(q=>q.idleBack>2&&q.idleSpeed<0&&q.idleGround&&q.boosted&&q.boostSpeed>14),
    'The uphill ramp must slide idle players back and accelerate them on actual booster strips');
  check(p.slides.every(q=>q.maxSpeed>38&&!q.hit&&q.ground&&q.drop>1),
    'The roller-coaster mouth must accelerate down the steep drop while staying on its curved surface');
  check(p.slideExits.length===9&&p.slideExits.every(q=>q.crossed&&q.landed&&q.kind==='chute'&&q.minGapSpeed>30&&q.exitTime<2.2&&q.checkpoint===7),
    'The roller-coaster kicker must throw every rider across the gap onto the next checkpoint without requiring a jump');
  check(p.knocks.length>0&&p.knocks.every(q=>Math.abs(q.actual.impulse-40)<1e-8&&Math.abs(q.ratio-5)<.04),
    'Punch contact must cause five times the measured travel of the former impulse');
  check(p.skipped===0&&p.skippedFinish<0&&p.checkpoints.length===7&&p.checkpoints.every(q=>q.registered===q.cp&&q.ground&&!q.fall&&
    Math.hypot(q.x-q.expected.x,q.z-q.expected.z)<.03&&Math.abs(q.y-q.yWorld)<.03),
    'Checkpoints must register sequentially and falling must return to the registered section entrance');
  check(!p.belowDeck.ground&&p.belowDeck.after<p.belowDeck.before,'A descending player below a platform must not snap up through its surface');
  check(p.routes.length===9&&p.routes.every(q=>q.finished&&q.seconds<180&&q.checkpoint===7&&q.manualLaunches>=4&&q.jumps>=10&&q.maxViewChange<1e-8),
    'All three seeds must complete the connected 180-second course using real jumps and manual launches at 30/60/120 Hz');
  check(p.routes.every(q=>[42,61].every(gate=>q.gatePasses.some(g=>g.gate===gate&&g.clear&&g.width>1&&g.width<3.5))),
    'Every continuous route must cross real narrow gaps between both rows of independently swaying crowd bumpers');
  check(p.clocks.every(q=>Math.abs(q.elapsed-q.expected)<.02),'The race clock must count elapsed time once and pause correctly');
  check(JSON.stringify(p.leftRace)===JSON.stringify({on:false,slip:0,hit:0,fall:0,knock:null,velocity:[0,0,0],flight:0,rate:1,boost:0,pending:null,pulses:0}),
    'Leaving the course must clear every race-only impulse, gravity, booster and movement lock');
}
