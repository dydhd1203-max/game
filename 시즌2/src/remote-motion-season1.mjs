// Existing Season 2 snapshots already contain these Season 1 motion fields.
// Keep them on the same eight-point display timeline as friendSeg/friendLerp;
// copying the newest packet's flip would rotate a body whose feet still lag.
export function enqueueSeason1Pose(entry,p,time){
  const poses=entry.poses??=[];
  if(poses.length===8)poses.shift();
  poses.push({time,run:p.run,take:p.take??p.takeT??0,land:p.land??p.landT??0,
    flipT:Number.isFinite(p.flipT)?p.flipT:p.flip>0?p.flip*.6:Infinity});
}
export function applySeason1RemotePose(entry,p,clock){
  const q=entry.motion,poses=entry.poses;
  p.take=p.land=p.flip=0;p.takeT=p.landT=0;p.flipT=Infinity;p.run=undefined;
  if(!poses?.length||!q.fn||q.down)return;
  let i=q.fn-1;while(i>0&&q.fq[i*4+3]>clock)i--;
  let a=i,b=i,u=0;
  if(i<q.fn-1&&q.fq[i*4+3]<=clock){
    if(q.fj[i+1])a=b=i+1;
    else {b=i+1;u=(clock-q.fq[a*4+3])/(q.fq[b*4+3]-q.fq[a*4+3]);}
  }
  const first=poses[a],last=poses[b];
  if(!first||!last)return;
  const time=a===b?first.time+Math.max(0,clock-q.fq[a*4+3]):first.time+(last.time-first.time)*u;
  p.run=first.run;
  const windows=entry.poseWindows??={};
  const finishWindow=(field,start,duration)=>{
    if(!Number.isFinite(start))return 0;
    const left=Math.max(0,duration-(time-start));
    const previous=windows[field];
    // friendSeg retimestamps the final position after an idle buffer. That
    // must not rewind a jump/landing that has already played at that position.
    if(previous&&start<previous.start-1e-7)return 0;
    if(previous&&Math.abs(start-previous.start)<1e-7){previous.left=Math.min(previous.left,left);return previous.left;}
    windows[field]={start,left};return left;
  };
  const remaining=(field,duration)=>{
    let start=-Infinity;
    for(const pose of poses){
      const value=pose[field];
      if(!Number.isFinite(value)||value<=0||value>duration)continue;
      const at=pose.time-(duration-value);
      if(at<=time+1e-8)start=Math.max(start,at);
    }
    return finishWindow(field,start,duration);
  };
  const take=remaining('take',.12),land=remaining('land',.22);
  let start=-Infinity;
  for(const pose of poses)if(pose.flipT>=0&&pose.flipT<.6){
    const at=pose.time-pose.flipT;if(at<=time+1e-8)start=Math.max(start,at);
  }
  const flipLeft=finishWindow('flip',start,.6);
  if(p.air){
    p.take=p.takeT=take;
    if(flipLeft>0){p.flipT=.6-flipLeft;p.flip=p.flipT/.6;}
  }else p.land=p.landT=land;
}
