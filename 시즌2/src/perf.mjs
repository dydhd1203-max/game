import {RELEASE, BUILD} from './content.mjs';
// Bounded frame-time recorder. RAF time includes scheduling; JS and GPU overlap.
export class PerformanceRecord {
  constructor(){this.reset();}
  reset(){this.frames=new Float32Array(18000);this.work=new Float32Array(18000);this.cursor=0;this.count=0;this.elapsed=0;this.fps=60;this.bucket=[];this.history=[];this.next=0;}
  frame(ms,work,stats,state){
    if(!Number.isFinite(ms)||ms<=0)return;
    const i=this.cursor;this.frames[i]=ms;this.work[i]=work;
    this.cursor=(i+1)%this.frames.length;this.count=Math.min(this.frames.length,this.count+1);
    this.elapsed+=ms;this.bucket.push(ms);
    if(this.bucket.length>60)this.bucket.shift();
    this.fps=Math.round(1000/(this.bucket.reduce((a,b)=>a+b,0)/this.bucket.length));
    if(this.elapsed>=this.next){
      this.next=this.elapsed+5000;
      this.history.push({seconds:Math.round(this.elapsed/1000),phase:state.phase,fps:this.fps,players:Object.values(state.players).filter(p=>p.online).length,towers:state.towers.filter(t=>t.state==='deployed').length,enemies:state.enemies.filter(e=>e.hp>0).length,calls:stats.calls,triangles:stats.triangles});
      if(this.history.length>180)this.history.shift();
    }
  }
  report(context={}){
    const a=Array.from(this.frames.subarray(0,this.count)).sort((a,b)=>a-b), n=a.length;
    const avg=n?a.reduce((x,y)=>x+y,0)/n:0,slow=a.slice(Math.floor(n*.99));
    return {season:2,build:RELEASE,protocol:BUILD,created:new Date().toISOString(),...context,frameCount:n,averageFps:avg?+(1000/avg).toFixed(1):0,onePercentLow:slow.length?+(1000/(slow.reduce((x,y)=>x+y,0)/slow.length)).toFixed(1):0,p95FrameMs:n?+a[Math.min(n-1,Math.floor(n*.95))].toFixed(2):0,meanJS:n?+(Array.from(this.work.subarray(0,n)).reduce((x,y)=>x+y,0)/n).toFixed(2):0,samples:this.history,note:'최근 최대 18,000프레임. 1% low는 가장 느린 1% 프레임 시간의 평균을 FPS로 변환. GPU 시간은 별도 미측정. JS와 GPU 시간을 합산하지 않음. 이 기기의 측정이며 실제 21대 검증을 뜻하지 않음.'};
  }
}
