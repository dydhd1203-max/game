/* Normal village/night camera port from Season 1 106차, 클로드/index.html:
 * updPlayer camera block, AIM_VIEW, wheel handler and fovTick.
 * Source SHA-256: 91c2c21654161390e37d84b70c96d5736f56f07de0add7fea950a0ab15d1173f.
 * Season 2 has no castle stairs/covered corridors, race or spectator rig.
 * Their special handling is intentionally excluded. World collision is adapted
 * to bounded analytic cylinders instead of importing Season 1's voxel castle.
 */
export const SEASON1_CAMERA = Object.freeze({
  fov:70, near:.08, far:420, yaw:0, pitch:-.22, zoom:3.2,
  minZoom:1.6, maxZoom:12.5, zoomStep:1.2, eye:1.12,
  mouseSensitivity:.0024, touchSensitivity:.0055, pitchLimit:1.5,
  lobbyPitch:-.17, lobbyBack:4.4
});
const AIM_VIEW = Object.freeze({back:2.90,height:1.58,shoulder:1.10,lift:.10,fov:68});
const CAMERA_RADIUS=.14;

/** The original wheel transition has no intermediate 0 < zoom < 1.6 view. */
export function season1Zoom(zoom,deltaY){
  const before=Number.isFinite(zoom)?zoom:SEASON1_CAMERA.zoom;
  if(!Number.isFinite(deltaY)||deltaY===0)return before;
  let next=Math.max(0,Math.min(SEASON1_CAMERA.maxZoom,before+Math.sign(deltaY)*SEASON1_CAMERA.zoomStep));
  if(next>0&&next<SEASON1_CAMERA.minZoom)next=before>next?0:SEASON1_CAMERA.minZoom;
  return next;
}

/** Allocation-free swept camera volume. `top` is a world-space height.
 * Fine tree trunks/resource stones may use camera:false, matching Season 1.
 * A finite top avoids treating short market goods as infinitely tall walls.
 */
export function season1CameraClearance(x,y,z,ox,oy,oz,obstacles=[],groundY=.08,skip=0){
  const length=Math.hypot(ox,oy,oz);
  if(length<1e-8)return 0;
  const start=Math.min(1,Math.max(0,skip/length)),radial=ox*ox+oz*oz;
  let entry=1,hit=false;
  if(y+oy*start-CAMERA_RADIUS<groundY){entry=start;hit=true;}
  else if(oy<0&&y+oy-CAMERA_RADIUS<groundY){entry=(groundY+CAMERA_RADIUS-y)/oy;hit=true;}
  for(let i=0;i<obstacles.length;i++){
    const o=obstacles[i];
    if(o.camera===false||!Number.isFinite(o.top)||!(o.r>0))continue;
    const dx=x-o.x,dz=z-o.z,r=o.r+CAMERA_RADIUS,c=dx*dx+dz*dz-r*r;
    let enter=start,leave=1;
    if(radial<1e-12){if(c>0)continue;}
    else{
      const b=dx*ox+dz*oz,disc=b*b-radial*c;
      if(disc<0)continue;
      const root=Math.sqrt(disc);
      enter=Math.max(enter,(-b-root)/radial);leave=Math.min(leave,(-b+root)/radial);
      if(enter>leave)continue;
    }
    const top=o.top+CAMERA_RADIUS;
    if(Math.abs(oy)<1e-12){if(y>top)continue;}
    else if(oy>0)leave=Math.min(leave,(top-y)/oy);
    else enter=Math.max(enter,(top-y)/oy);
    if(enter>leave||leave<start||enter>entry)continue;
    entry=Math.max(start,enter);hit=true;
  }
  // One original 0.12m scan interval before contact, never a minimum boom
  // distance that could push the camera back through a wall.
  return hit?Math.max(0,length*entry-.12):length;
}

/** view uses Season 1 signs: forward=(-sin(yaw),-cos(yaw)); pitch<0 looks down.
 * Player y is the visible foot height; ground/sprinting/gait come from motion.
 * The returned record is reused. bodyHidden includes a chosen first-person view.
 */
export function createSeason1Camera(THREE,camera,{obstacles=[],groundY=.08}={}){
  let anchorX=null,anchorZ=0,camGY=null,camDistance=null,camShoulder=0;
  let camBodyHidden=false,camAimBlend=0,camHi=0,fovRun=0,fovKick=0;
  const result={firstPerson:false,bodyHidden:false,zoom:SEASON1_CAMERA.zoom,
    distance:null,shoulder:0,aimBlend:0,fovRun:0,footAnchor:null};
  camera.fov=SEASON1_CAMERA.fov;camera.near=SEASON1_CAMERA.near;camera.far=SEASON1_CAMERA.far;
  camera.updateProjectionMatrix();
  function reset(){
    anchorX=camGY=camDistance=null;anchorZ=0;camShoulder=camAimBlend=camHi=fovRun=fovKick=0;camBodyHidden=false;
  }
  function punch(amount){if(Number.isFinite(amount))fovKick=Math.min(4,fovKick+Math.max(0,amount));}
  function update(player,dt,view={}){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
    const x=player.x,z=player.z,footY=Number.isFinite(player.y)?player.y:groundY;
    const yaw=Number.isFinite(view.yaw)?view.yaw:Number.isFinite(player.yaw)?player.yaw:SEASON1_CAMERA.yaw;
    const lobby=view.phase==='lobby';
    const pitch=Number.isFinite(view.pitch)?view.pitch:lobby?SEASON1_CAMERA.lobbyPitch:SEASON1_CAMERA.pitch;
    let zoom=Number.isFinite(view.zoom)?Math.max(0,Math.min(SEASON1_CAMERA.maxZoom,view.zoom)):SEASON1_CAMERA.zoom;
    if(zoom>0&&zoom<SEASON1_CAMERA.minZoom)zoom=0;
    if(lobby){
      // lobbyMove78's fixed boom/look-at. Season 2's lobby occupies the open
      // village, so its structures replace Season 1's enclosing room bounds.
      const back=SEASON1_CAMERA.lobbyBack,pi=Math.max(-.8,Math.min(.18,pitch));
      const ox=Math.sin(yaw)*back,oy=.55-Math.sin(pi)*back,oz=Math.cos(yaw)*back;
      const length=Math.hypot(ox,oy,oz),cy=footY+1.05;
      const clear=season1CameraClearance(x,cy,z,ox,oy,oz,obstacles,groundY),ratio=length>0?clear/length:0;
      camera.position.set(x+ox*ratio,cy+oy*ratio,z+oz*ratio);
      camera.lookAt(x,cy,z);camera.updateMatrixWorld();
      reset();
      if(camera.fov!==SEASON1_CAMERA.fov){camera.fov=SEASON1_CAMERA.fov;camera.updateProjectionMatrix();}
      result.firstPerson=false;result.bodyHidden=clear<.52;result.zoom=zoom;result.distance=clear;
      result.shoulder=result.aimBlend=result.fovRun=0;result.footAnchor=footY;
      return result;
    }
    const down=!!player.down||player.hp===0,moving=player.moving??player.mv??(Math.hypot(player.vx||0,player.vz||0)>.06);
    const sprinting=!!(player.sprinting??player.run),ground=player.ground!==false;
    const third=zoom>=SEASON1_CAMERA.minZoom;
    const aimWant=!down&&third&&(view.aim??player.aim)?1:0;
    const runK=sprinting&&moving&&ground?Math.min(1,fovRun/10):0;
    camAimBlend+=(aimWant-camAimBlend)*(1-Math.exp(-dt*11));
    if(Math.abs(camAimBlend-aimWant)<.0001)camAimBlend=aimWant;
    const viewPitch=Math.max(-1.35,Math.min(1.35,pitch+camAimBlend*AIM_VIEW.lift));
    camera.rotation.set(viewPitch+(view.aimKick||0),yaw+(view.aimSway||0),(view.aimRoll||0)+(view.heldCamRoll||0),'YXZ');
    const back=down?4.6:third?zoom+(AIM_VIEW.back-zoom)*camAimBlend+fovRun*.05*(1-camAimBlend):0;
    const dip=Number.isFinite(player.camDip)?player.camDip:0;
    if(back>0){
      const snap=anchorX===null||Math.hypot(x-anchorX,z-anchorZ)>3||camGY===null||Math.abs(footY-camGY)>3;
      if(snap){anchorX=x;anchorZ=z;camGY=footY;camDistance=null;}
      else{
        // Village/night deliberately has no horizontal following lag.
        anchorX=x;anchorZ=z;
        camGY+=(footY-camGY)*(1-Math.exp(-dt*18));
        camGY=Math.max(footY-.22,Math.min(footY+.22,camGY));
      }
      const look=third&&!down?.80+(AIM_VIEW.height-.80)*camAimBlend:1.55;
      const ty=down?footY+.95:camGY+look-dip*.25;
      const cp=Math.cos(viewPitch),dx=-Math.sin(yaw)*cp,dy=Math.sin(viewPitch),dz=-Math.cos(yaw)*cp;
      const shoulder=third&&!down?AIM_VIEW.shoulder*camAimBlend:0;
      camShoulder+=(shoulder-camShoulder)*(1-Math.exp(-dt*14));
      const ox=-dx*back+Math.cos(yaw)*camShoulder,oz=-dz*back-Math.sin(yaw)*camShoulder,oy=-dy*back;
      const length=Math.hypot(ox,oy,oz);
      let cy=ty,clear=length;
      const cyH=down?ty:Math.max(ty,footY+look-dip*.25);
      const clearH=season1CameraClearance(anchorX,cyH,anchorZ,ox,oy,oz,obstacles,groundY);
      if(cyH-ty<.02){clear=clearH;camHi=0;}
      else{
        cy=ty+(cyH-ty)*camHi;
        const cl=camHi>=1?clearH:season1CameraClearance(anchorX,cy,anchorZ,ox,oy,oz,obstacles,groundY,1);
        if(camHi<1&&cl<1.15&&cl<length-1e-3){camHi=1;cy=cyH;clear=clearH;}
        else{
          clear=cl;
          if(camHi>0&&clearH>=1.3){
            const c0=season1CameraClearance(anchorX,ty,anchorZ,ox,oy,oz,obstacles,groundY,1);
            if(c0>=1.15||c0>=length-1e-3)camHi=Math.max(0,camHi-dt*2);
          }
        }
      }
      camDistance=camDistance===null?clear:clear<camDistance?clear:camDistance+(clear-camDistance)*(1-Math.exp(-dt*12));
      const ratio=length>0?camDistance/length:0;
      camera.position.set(anchorX+ox*ratio,cy+oy*ratio,anchorZ+oz*ratio);
      camBodyHidden=camBodyHidden?camDistance<(camAimBlend>.5?1.75:.90):camDistance<(camAimBlend>.5?1.45:.52);
    }else{
      camera.position.set(x,footY+SEASON1_CAMERA.eye+Math.abs(Math.sin(player.gait??player.gp??0))*.04*runK,z);
      anchorX=camGY=camDistance=null;camShoulder=0;camBodyHidden=false;
    }
    // In Season 1 fovTick runs after updPlayer: the boom uses the previous
    // frame's fovRun, and the lens uses this frame's value.
    const want=sprinting&&moving?10:0,previousRun=fovRun;
    fovRun+=(want-fovRun)*Math.min(1,dt*7);if(Math.abs(fovRun)<.02)fovRun=0;
    const baseFov=SEASON1_CAMERA.fov+(AIM_VIEW.fov-SEASON1_CAMERA.fov)*camAimBlend;
    if(!(fovKick<=0&&fovRun===previousRun&&Math.abs(camera.fov-baseFov-fovRun)<.001)){
      fovKick*=Math.exp(-dt*16);if(fovKick<.02)fovKick=0;
      camera.fov=baseFov+fovRun+fovKick;camera.updateProjectionMatrix();
    }
    result.firstPerson=back<=0;result.bodyHidden=result.firstPerson||camBodyHidden;
    result.zoom=zoom;result.distance=camDistance;result.shoulder=camShoulder;result.aimBlend=camAimBlend;
    result.fovRun=fovRun;result.footAnchor=camGY;
    return result;
  }
  return {update,reset,punch,state:()=>result};
}
