// Native-rate actual controller checks: unlike the long route, each frame calls
// updPlayer once, so a steep-slope support regression cannot hide in substeps.
export function race78SlidePhysics(){
 const W=window,P=W.__PL,G=W.__G,A=W.__race74,K=W.__KEY,Y=W.__MINI().Y,result=[];
 G.players.clear();W.__pcMap.clear();G.phase='mini';G.mini.st='run';G.paused=false;
 const clear=()=>{for(const k of Object.keys(K))delete K[k];};
 for(const fps of [30,60,120]){
  W.__raceBuild(13);const slide=W.__RACE_P().find(p=>p.shape==='slide');
  const reset=(x,z,vz=0)=>{clear();A.reset();W.__kbReset();W.__setStamina(1);G.t=180;W.__MINE.cp=6;W.__MINE.fin=-1;
   Object.assign(W.__RACE(),{t:1,on:true,fallT:0,hitCd:0,slipT:0,cp:{x:0,z:680,y:30}});
   Object.assign(P,{x,z,y:A.surface(slide,x,z),vx:0,vz,vy:0,_px:x,_pz:z,ground:true,jumps:0,down:false,glide:false,yaw:Math.PI,pitch:-.22,flipT:99});};
  const step=()=>{G.t-=1/fps;W.__updPlayer(1/fps);A.tick(1/fps);};
  const steer=(x,brake)=>{clear();K[brake?'s':'w']=true;if(P.x<x-.1)K.a=true;else if(P.x>x+.1)K.d=true;};
  const controls=[];
  for(const mode of ['coast','accelerate','brake','left','right']){
   reset(-3.4,690.2,58);if(mode==='accelerate')K.w=true;if(mode==='brake')K.s=true;if(mode==='left')K.a=true;if(mode==='right')K.d=true;
   let ground=true,hit=false;for(let f=0;f<Math.round(fps*.15);f++){step();ground&&=P.ground;hit ||= W.__RACE().hitCd>0;}
   controls.push({mode,vx:P.vx,vz:P.vz,x:P.x,ground,hit});
  }
  reset(0,690.2,58);K.w=true;let centerHit=false,centerTime=0;
  for(let f=0;f<fps;f++){step();centerTime=(f+1)/fps;if(W.__RACE().hitCd>0){centerHit=true;break;}}
  const center={hit:centerHit,time:centerTime,x:P.x,z:P.z,kind:A.state.flightKind};
  reset(-3.4,690.4,19);let hits=0,lastHit=0,unsupported=0,finished=false,maxViewChange=0;const gates=[],trail=[];
  for(let f=0;f<fps*5;f++){
   const z=P.z,ahead=z+P.vz*.12;
   const target=(ahead<703?-3.4:ahead>739?-3.4:-3.4*Math.cos((ahead-703)/18*Math.PI))-P.vx*.07;
   steer(target,z<744);step();
   if(P.z<752&&!P.ground)unsupported++;
   if(W.__RACE().hitCd>lastHit+.05)hits++;lastHit=W.__RACE().hitCd;
   for(const gate of [703,721,739])if(z<gate&&P.z>=gate)gates.push({z:gate,x:P.x,ground:P.ground});
   maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-Math.PI),Math.abs(P.pitch+.22));
   if(f%Math.max(1,Math.floor(fps/10))===0)trail.push({t:(f+1)/fps,x:P.x,z:P.z,vx:P.vx,vz:P.vz,ground:P.ground,target});
   if(W.__MINE.cp===7){finished=true;break;}if(W.__RACE().fallT>0||hits)break;
  }
  result.push({fps,controls,center,carve:{finished,hits,unsupported,gates,maxViewChange,trail}});
 }
 clear();return result;
}
export function validateRace78Slide(result){
 const check=(v,m)=>{if(!v)throw Error(m);};check(result.length===3,'Native slide checks cover 30/60/120 Hz');
 for(const q of result){const get=m=>q.controls.find(x=>x.mode===m);
  check(q.controls.every(x=>x.ground&&!x.hit),'Native-rate slide steering remains grounded on the curved descent');
  check(get('accelerate').vz>get('coast').vz+2&&get('brake').vz<get('coast').vz-7,'W accelerates and S meaningfully brakes the descent');
  check(get('left').vx>15&&get('right').vx<-15,'A/D provide actual sideways carving authority');
  check(q.center.hit&&q.center.kind==='knock','A straight center-only descent must contact the visible alternating obstacles');
  check(q.carve.finished&&q.carve.hits===0&&q.carve.unsupported===0&&q.carve.gates.length===3&&q.carve.maxViewChange<1e-8,'A real-input native-rate slalom clears all three gates, stays grounded, and reaches the next checkpoint');
 }
}
