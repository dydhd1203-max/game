// Season 1 updPlayer/sprintMul/burst/updParts motion cues. Observe the displayed
// local actor so guests react on predicted input, never twice on a host echo.
// Reuses the scene's opaque tiny-instance bank: no lights, textures or passes.
export function createSeason1MotionFeedback({punch=()=>{},random=Math.random}={}) {
  const capacity=64,particles=Array.from({length:capacity},()=>({t:0}));
  let index=0,previous=null,runDust=0,trail=0;
  function reset(){for(const p of particles)p.t=0;previous=null;runDust=trail=0;}
  function burst(x,y,z,color,n=10,pow=1,g=1,sz=1,life=1){
    if(![x,y,z,pow,g,sz,life].every(Number.isFinite))return;
    for(let i=0;i<Math.min(capacity,Math.max(0,n|0));i++){
      const p=particles[index=(index+1)%capacity];
      p.t=p.t0=(.55+random()*.35)*life;p.x=x;p.y=y;p.z=z;
      p.vx=(random()-.5)*4*pow;p.vy=1.6+random()*3.4*pow;p.vz=(random()-.5)*4*pow;
      p.g=g;p.sz=sz===1?1:sz*(.8+random()*.4);p.color=color;
    }
  }
  function update(p,dt,{phase='village',paused=false}={}){
    if(!p||p.hp<=0||p.online===false){previous=null;return;}
    if(paused)return;
    dt=Math.max(0,Math.min(.1,dt||0));
    const ground=p.ground!==false,air=!ground,jumps=p.jumps|0;
    const fresh=previous?.id===p.id&&previous.phase===phase&&Math.hypot(p.x-previous.x,p.z-previous.z)<3;
    if(fresh&&phase!=='lobby'){
      if(air&&previous.ground){burst(p.x,p.y+.04,p.z,0xe6dccb,6,.55);punch(2);trail=0;}
      else if(air&&jumps>previous.jumps){burst(p.x,p.y+.05,p.z,0xfffaf0,9,.9);punch(3.2);trail=0;}
      if(ground&&!previous.ground){const hard=previous.vy<-9||p.camDip>=.17;burst(p.x,.13,p.z,0xe6dccb,hard?10:4,hard?.9:.5);}
      if(p.run&&ground&&p.mv){runDust-=dt;if(runDust<=0){runDust=.09;burst(p.x+Math.sin(p.yaw||0)*.45,p.y+.04,p.z+Math.cos(p.yaw||0)*.45,0xe6dccb,1,.32);}}
      if(air){trail-=dt;if(trail<=0&&Math.abs(p.vy)>2.5){trail=.05;burst(p.x,p.y+.15,p.z,0xffffff,1,.26);}}
    }
    previous??={};Object.assign(previous,{id:p.id,phase,x:p.x,z:p.z,ground,jumps,vy:p.vy});
  }
  function render(dt,draw,visible=()=>true){
    dt=Math.max(0,Math.min(.1,dt||0));
    for(const p of particles){
      if(p.t<=0)continue;p.t-=dt;if(p.t<=0)continue;
      p.vy-=17*p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      if(p.g>.5&&p.y<.18){p.y=.18;p.vy*=-.32;p.vx*=.6;p.vz*=.6;}
      if(!visible(p.x,p.z,1))continue;
      const size=.17*Math.min(1,p.t/p.t0*2.2)*p.sz;
      draw('tiny',p.x,p.y,p.z,size,size,size,p.color);
    }
  }
  return {reset,burst,update,render,stats:()=>({capacity,live:particles.reduce((n,p)=>n+(p.t>0),0)})};
}
