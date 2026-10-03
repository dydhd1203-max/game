/* Shared double-tap recognizer. Key repeats and held aliases are not taps. */
(function(root){
  'use strict';
  const directions=Object.freeze({ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'});
  const opposite={left:'right',right:'left',up:'down',down:'up'};
  function create(windowMs=250){
    const held=new Map();let tap=null,runCode=null;
    function down(code,now,repeat=false){
      const direction=directions[code];if(!direction||repeat||held.has(code))return false;
      const sameHeld=[...held.values()].some(value=>value.direction===direction);
      if(runCode&&held.get(runCode)?.direction===opposite[direction])runCode=null;
      if(!sameHeld&&tap?.direction===direction&&now-tap.started<=windowMs&&now>=tap.released){runCode=code;tap=null;}
      else if(tap?.direction!==direction)tap=null;
      held.set(code,{direction,started:now});return true;
    }
    function up(code,now){const item=held.get(code);if(!item)return false;held.delete(code);
      if(runCode===code){runCode=null;tap=null;}else if(now-item.started<=windowMs)tap={...item,released:now};else tap=null;return true;
    }
    function reset(){held.clear();tap=null;runCode=null;}
    return Object.freeze({down,up,reset,isRunning:()=>Boolean(runCode&&held.has(runCode)),has:direction=>[...held.values()].some(value=>value.direction===direction)});
  }
  const api=Object.freeze({create,directions,walkSpeed:225,runSpeed:337.5,windowMs:250});root.QPRunInput=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
