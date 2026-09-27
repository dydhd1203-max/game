// Runs inside the game page. Fixtures are used only to isolate contracts;
// the full routes below use normal input from the real start to the finish.
export function race76Physics(){
  const W=window,A=W.__race74,P=W.__PL,G=W.__G,KEY=W.__KEY,Y=W.__MINI().Y;
  const flights=[],manual=[],carries=[],ramps=[],slides=[],slideExits=[],routes=[],checkpoints=[],knocks=[],clocks=[];
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
    for(const pad of donuts){
      reset(pad.x,pad.z-3,Y+pad.y);KEY.w=true;let auto=false;
      for(let i=0;i<fps*.65;i++){step(1/fps);auto ||= A.state.flight>0||!!A.state.pending;}
      const walked=P.z-(pad.z-3);
      reset(pad.x+pad.bounce.zone+1,pad.z,Y+pad.y);press();step(1/fps);
      manual.push({seed,fps,pad:pad.id,auto,walked,outsideZoneSpring:A.state.flight>0||!!A.state.pending});
    }
    for(const pad of W.__RACE_P().filter(p=>p.bounce)){
      reset(pad.x,pad.z,Y+pad.y);KEY.w=true;if(pad.bounce.manual)press();
      let count=0,elapsed=0,launchedAt=0,launch=null,gravity=null,land=null,peak=0,heldRepeat=false;
      for(let i=0;i<fps*5;i++){
        step(1/fps,(before,dt)=>{elapsed+=dt;
          if(before.flight===0&&A.state.flight>0){count++;launchedAt=elapsed;launch={vy:P.vy,vz:P.vz,y:P.y,z:P.z};}
          else if(launch&&gravity===null&&!P.ground)gravity=(before.vy-P.vy)/dt;
          peak=Math.max(peak,P.y-Y-pad.y);
          if(launch&&before.ground===false&&P.ground&&!land)land={pad:A.under()?.id,z:P.z,y:P.y,time:elapsed-launchedAt};
        });
        if(land)break;if(P.y<Y-6||W.__RACE().fallT>0)break;
      }
      if(land&&pad.bounce.manual){clear();KEY[' ']=true;
        for(let i=0;i<fps*.35;i++){step(1/fps);heldRepeat ||= A.state.flight>0||!!A.state.pending;}}
      const rate=pad.bounce.rate||1.18;
      flights.push({seed,fps,pad:pad.id,kind:pad.kind,isManual:!!pad.bounce.manual,count,launch,gravity,
        expectedVy:pad.bounce.v*rate,expectedVz:pad.bounce.forward*rate,expectedGravity:W.__gravNow()*rate*rate,
        peak,land,heldRepeat,viewChange:Math.abs(P.yaw-Math.PI)+Math.abs(P.pitch+.22)});
    }
    const moving=W.__RACE_P().find(p=>p.mv),pose=A.pose(moving,0),offset=1.2;
    reset(pose.x+offset,pose.z,Y+moving.y);let ground=true;
    for(let i=0;i<fps*2;i++){step(1/fps);ground&&=P.ground;}
    const now=A.pose(moving,W.__RACE().t),expected={x:now.x+offset*Math.cos(now.a),z:now.z-offset*Math.sin(now.a)};
    carries.push({seed,fps,ground,error:Math.hypot(P.x-expected.x,P.z-expected.z),yaw:P.yaw,pitch:P.pitch,
      supported:A.contains(moving,P.x,P.z,.1,W.__RACE().t),movement:Math.hypot(now.x-pose.x,now.z-pose.z),rotation:now.a});
    const ramp=W.__RACE_P().find(p=>p.shape==='ramp'),startZ=ramp.z-12,x=11.5;
    reset(x,startZ,A.surface(ramp,x,startZ));for(let i=0;i<fps;i++)step(1/fps);
    const idle={z:P.z,vz:P.vz,ground:P.ground};
    const b=ramp.boosts[0];reset(b.x,b.z,A.surface(ramp,b.x,b.z));KEY.w=true;
    let boostSpeed=0,boosted=false;for(let i=0;i<fps*.3;i++){step(1/fps);boostSpeed=Math.max(boostSpeed,P.vz);boosted ||= A.state.boostT>0;}
    ramps.push({seed,fps,idleBack:startZ-idle.z,idleSpeed:idle.vz,idleGround:idle.ground,boostSpeed,boosted});
    const slide=W.__RACE_P().find(p=>p.shape==='slide'),slideX=4.5,z0=slide.z-slide.d/2+.4;
    reset(slideX,z0,A.surface(slide,slideX,z0));KEY.w=true;
    let maxSpeed=0,hit=false;for(let i=0;i<fps*.4;i++){step(1/fps);maxSpeed=Math.max(maxSpeed,P.vz);hit ||= W.__RACE().hitCd>0;}
    slides.push({seed,fps,maxSpeed,hit,ground:P.ground,dz:P.z-z0,drop:Y+slide.y-P.y});
    const exitZ=slide.z+slide.d/2-3.5;reset(slideX,exitZ,A.surface(slide,slideX,exitZ),6);P.vz=56.2;KEY.w=true;
    let crossed=false,landed=false,minGapSpeed=Infinity,exitTime=0;
    for(let i=0;i<fps*2;i++){step(1/fps,()=>{if(P.z>slide.z+slide.d/2&&P.z<758){crossed=true;minGapSpeed=Math.min(minGapSpeed,P.vz);}
        if(crossed&&P.ground&&A.under()?.cp===7)landed=true;});exitTime=(i+1)/fps;if(landed&&W.__MINE.cp===7)break;}
    slideExits.push({seed,fps,crossed,landed,minGapSpeed,exitTime,checkpoint:W.__MINE.cp,z:P.z});
  }
  // A held key cannot cause another donut launch. A fresh press must work.
  const pad=W.__RACE_P().find(p=>p.bounce?.manual);
  reset(pad.x,pad.z,Y+pad.y);press();let first=false;
  for(let i=0;i<120;i++){step(1/120);if(A.state.flight>0){first=true;break;}}
  Object.assign(P,{x:pad.x,z:pad.z,y:Y+pad.y+.4,vy:-5,vx:0,vz:0,ground:false,_px:pad.x,_pz:pad.z});
  let touched=false,heldLaunch=false;for(let i=0;i<100;i++){step(1/120);touched ||= P.ground;heldLaunch ||= touched&&A.state.flight>0;}
  clear();press();let fresh=false;for(let i=0;i<40;i++){step(1/120);fresh ||= A.state.flight>0;}
  const freshPress={first,touched,heldLaunch,fresh};
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
    const trail=[],gatePasses=[];let previousCp=0,lastRecorded=-10;
    for(let f=0;f<fps*180&&W.__MINE.fin<0;f++){
      const S=W.__RACE(),z=P.z,under=P.ground?A.under():null;
      let target=0,go=true,sprint=false,jump=false;
      if(z<78){
        // Read the visible alternating broad openings. After the first row,
        // pass the intervening fixed bags before moving left across the deck.
        target=z<35?0:z<45?8:z<55?5:z<74?-8:0;
        if(z>=55&&z<58&&Math.abs(P.x-target)>1)go=false;
      }
      else if(z<210){
        const bar=W.__raceHazards(S.t).filter(h=>h.k==='bar').find(h=>h.z>z-10);
        target=bar?bar.x<0?6.8:bar.x>0?-6.8:6.8:0;
        const dist=bar?bar.z-z:99;
        sprint=dist<13&&dist>-12;
        if(P.ground&&dist<10.5&&dist>-7)jump=true;
        if(!P.ground&&airAge>.48&&!doubleUsed&&(P.jumps|0)<1){jump=true;doubleUsed=true;}
      }else if(z<476){
        if(under?.bounce?.manual){target=under.x;
          if(Math.abs(P.x-target)<.6&&Math.abs(z-under.z)<.65){go=false;jump=true;}
          else if(z>under.z+.3){go=false;KEY.s=true;}
        }else if(P.ground&&z>225.8&&z<233){jump=true;}
      }else if(z<570){
        const ramp=W.__RACE_P().find(p=>p.shape==='ramp'),b=ramp.boosts.find(b=>b.z>z-2);target=b?.x??0;
        // Jump clear of a visible rock approaching this lane.
        if(P.ground&&W.__raceHazards(S.t).some(h=>h.k==='rock'&&Math.abs(h.x-P.x)<3&&h.z>z&&h.z-z<8))jump=true;
      }else if(z<676){
        const circles=W.__RACE_P().filter(p=>p.sec===4&&p.mv),current=under?.mv?under:null;
        let next=current?circles[circles.indexOf(current)+1]:circles.find(p=>A.pose(p,S.t).z>z+1);
        const pose=next?A.pose(next,S.t+.55):{x:0,z:680};target=pose.x;
        if(P.ground){const edge=current?A.pose(current,S.t).z+current.d/2:586;
          if(W.__stamina()<.45&&z<edge-1){go=false;}
          else {sprint=true;if(z>=edge-1.4)jump=true;}
        }else sprint=true;
      }else if(z<758){target=4.5;if(P.ground&&z>750.5)jump=true;}
      else target=0;
      const reverse=!!KEY.s;steer(target,go);if(reverse&&!go)KEY.s=true;if(sprint)KEY.shift=true;if(jump){press();jumps++;}
      const oldGround=P.ground,oldFlight=A.state.flight;step(1/fps);elapsed=(f+1)/fps;
      for(const gate of [42,61])if(z<gate&&P.z>=gate)gatePasses.push({gate,x:P.x,t:elapsed});
      if(oldFlight===0&&A.state.flight>0&&A.state.flightKind==='manual')manualLaunches++;
      if(P.ground){airAge=0;doubleUsed=false;}else airAge+=1/fps;
      if(S.hitCd>lastHit+.05)hits++;lastHit=S.hitCd;
      if(S.fallT>0&&!lastFall)falls++;lastFall=S.fallT>0;
      maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
      if(W.__MINE.cp!==previousCp||elapsed-lastRecorded>=10||W.__MINE.fin>=0){trail.push({t:+elapsed.toFixed(2),cp:W.__MINE.cp,x:+P.x.toFixed(2),z:+P.z.toFixed(2),y:+(P.y-Y).toFixed(2),falls,hits});previousCp=W.__MINE.cp;lastRecorded=elapsed;}
      if(![P.x,P.y,P.z,P.vx,P.vy,P.vz].every(Number.isFinite))break;
    }
    routes.push({seed,fps,finished:W.__MINE.fin>=0,seconds:elapsed,falls,hits,jumps,manualLaunches,checkpoint:W.__MINE.cp,z:P.z,maxViewChange,gatePasses,trail});
  }
  for(const fps of [30,60,120])for(const mode of ['normal','popup','paused']){
    reset(0,-19,Y);G.paused=mode==='paused';const begin=W.__RACE().t;
    for(let i=0;i<fps;i++){if(mode==='normal')step(1/fps);else {if(mode==='popup')G.t-=1/fps;A.tick(1/fps);}}
    clocks.push({fps,mode,elapsed:W.__RACE().t-begin,expected:mode==='paused'?0:1});G.paused=false;}
  const S=W.__RACE();S.slipT=.8;S.hitCd=1;S.fallT=.5;S.knock={x:1,z:1};S.on=true;
  A.state.flight=1;A.state.rate=2.36;A.state.boostT=.7;A.state.pending={p:pad,t:.05};A.state.pulse.set(1,.8);
  Object.assign(P,{vx:3,vz:5,vy:8});clear();G.phase='day';G.mini=null;W.__miniLeave();
  const leftRace={on:S.on,slip:S.slipT,hit:S.hitCd,fall:S.fallT,knock:S.knock,velocity:[P.vx,P.vy,P.vz],flight:A.state.flight,rate:A.state.rate,boost:A.state.boostT,pending:A.state.pending,pulses:A.state.pulse.size};
  return {limit:W.__MINI().RACE,flights,manual,freshPress,carries,ramps,slides,slideExits,knocks,checkpoints,skipped,skippedFinish,belowDeck,routes,clocks,leftRace};
}

export function validateRace76(p){
  const check=(ok,why)=>{if(!ok)throw Error(why);};
  check(p.limit===180,'The race limit must be 180 seconds');
  check(p.manual.length===36&&p.manual.every(q=>!q.auto&&q.walked>3&&!q.outsideZoneSpring),
    'Walking never launches a donut, and Space outside its jump zone remains an ordinary jump');
  check(p.flights.length===45&&p.flights.every(q=>q.count===1&&q.launch&&q.land&&q.viewChange<1e-8&&
    Math.abs(q.launch.vy-q.expectedVy)<1e-8&&Math.abs(q.launch.vz-q.expectedVz)<1e-8&&Math.abs(q.gravity-q.expectedGravity)<1e-6),
    'Every actual spring must launch once, integrate its calibrated impulse/gravity, land, and preserve the view');
  check(p.flights.filter(q=>q.isManual).every(q=>q.peak>22&&q.peak<24&&q.land.time>1&&q.land.time<1.2&&
    q.land.z-q.launch.z>53&&q.land.z-q.launch.z<59&&!q.heldRepeat),
    'Manual donuts retain the 23-meter high, 56-meter long one-second arc and do not repeat from a held key');
  check(p.freshPress.first&&p.freshPress.touched&&!p.freshPress.heldLaunch&&p.freshPress.fresh,
    'A new Space press, rather than holding Space after landing, must arm another spring');
  check(p.carries.every(q=>q.ground&&q.supported&&q.error<.05&&q.movement>.01&&Math.abs(q.rotation)>.1&&q.yaw===Math.PI&&q.pitch===-.22),
    'Moving circles must carry a rider through X/Z translation and rotation without turning the camera');
  check(p.ramps.every(q=>q.idleBack>2&&q.idleSpeed<0&&q.idleGround&&q.boosted&&q.boostSpeed>14),
    'The uphill ramp must slide idle players back and accelerate them on actual booster strips');
  check(p.slides.every(q=>q.maxSpeed>45&&!q.hit&&q.ground&&q.drop>1),
    'The open slide lane must reach the faster downhill speed while staying on its curved surface');
  check(p.slideExits.length===9&&p.slideExits.every(q=>q.crossed&&q.landed&&q.minGapSpeed>45&&q.exitTime<1&&q.checkpoint===7),
    'The fast slide must preserve momentum across its exit gap and land on the next checkpoint without requiring a jump');
  check(p.knocks.length>0&&p.knocks.every(q=>Math.abs(q.actual.impulse-40)<1e-8&&Math.abs(q.ratio-5)<.04),
    'Punch contact must cause five times the measured travel of the former impulse');
  check(p.skipped===0&&p.skippedFinish<0&&p.checkpoints.length===7&&p.checkpoints.every(q=>q.registered===q.cp&&q.ground&&!q.fall&&
    Math.hypot(q.x-q.expected.x,q.z-q.expected.z)<.03&&Math.abs(q.y-q.yWorld)<.03),
    'Checkpoints must register sequentially and falling must return to the registered section entrance');
  check(!p.belowDeck.ground&&p.belowDeck.after<p.belowDeck.before,'A descending player below a platform must not snap up through its surface');
  check(p.routes.length===9&&p.routes.every(q=>q.finished&&q.seconds<180&&q.checkpoint===7&&q.manualLaunches>=4&&q.jumps>=10&&q.maxViewChange<1e-8),
    'All three seeds must complete the connected 180-second course using real jumps and manual launches at 30/60/120 Hz');
  check(p.routes.every(q=>q.gatePasses.some(g=>g.gate===42&&g.x>3)&&q.gatePasses.some(g=>g.gate===61&&g.x<-3)),
    'All continuous routes must actually weave right and left through the two visible crowd openings');
  check(p.clocks.every(q=>Math.abs(q.elapsed-q.expected)<.02),'The race clock must count elapsed time once and pause correctly');
  check(JSON.stringify(p.leftRace)===JSON.stringify({on:false,slip:0,hit:0,fall:0,knock:null,velocity:[0,0,0],flight:0,rate:1,boost:0,pending:null,pulses:0}),
    'Leaving the course must clear every race-only impulse, gravity, booster and movement lock');
}
