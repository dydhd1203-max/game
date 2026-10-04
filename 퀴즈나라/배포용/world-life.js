/* Living details use the CURRENT source pixels. Boundary-pinned deformation
   keeps roots, silhouettes, map seams, furniture and tree visibility registered. */
(() => {
  'use strict';
  const root=new URL('assets/world-life/',document.currentScript.src).href;
  // Coordinates in each original map's logical composition, not screenshot UI.
  const details={
    village:{size:[1115,736],flowers:[[649,282,25,22],[903,249,32,29],[610,316,26,26],[653,402,34,29],[871,473,32,28],[977,478,31,30],[464,254,33,27],[395,250,26,27]],grass:[[450,621,25,28],[327,317,33,34],[574,53,20,24]]},
    forestgarden:{size:[962,541],flowers:[[353,124,23,19],[709,330,31,24],[373,393,26,22],[638,119,27,26],[578,427,24,22],[165,477,26,31],[194,481,34,31]],grass:[]},
    treehouse:{size:[946,740],flowers:[],grass:[[631,541,42,38],[342,643,32,40]]},
    skyisland:{size:[956,553],flowers:[[268,170,33,25],[723,297,30,24],[746,346,36,26],[378,208,26,26],[854,265,24,25]],grass:[[450,369,30,22],[761,282,21,20],[341,235,25,20],[831,297,24,18]]},
    autumnpark:{size:[1122,752],fire:[[319,427,31,39]],grass:[]},
    camp:{size:[1339,750],fire:[[650,326,38,60]],flowers:[[804,486,49,32],[1016,502,45,29]],grass:[[400,520,36,30]]},
    adventure:{size:[1308,1202],flowers:[[323,882,39,33],[1024,867,37,36]],grass:[]}
  };
  function mount(world,scene,zone){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),patches=[],specials=[];let dead=false,last=0,elapsed=0,previous=0,activeCount=0,paintMs=0,updates=0;
    const original=world.querySelector('img[data-art]');const config=details[zone];
    const within=(r,v)=>r.x+r.w>v.x&&r.x<v.x+v.width&&r.y+r.h>v.y&&r.y<v.y+v.height;
    const style=(n,r,z=1)=>{n.style.cssText='position:absolute;left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px;z-index:'+z+';pointer-events:none';n.setAttribute('aria-hidden','true');};
    function patch(kind,r,image=original,source=null,index=patches.length){
      if(!image)return;const node=document.createElement('canvas');node.className='wl-patch';node.dataset.life=kind;style(node,r);world.append(node);patches.push({node,kind,r,image,source,index,ctx:null,ready:false});
    }
    if(config&&original){
      const kx=parseFloat(original.style.width)/config.size[0],ky=parseFloat(original.style.height)/config.size[1],rectangle=([x,y,w,h])=>({x:x*kx,y:y*ky,w:w*kx,h:h*ky});
      const trees=window.QPMapAvatarDisplay?.forScene(scene)?.trees||[];
      trees.forEach((t,i)=>{const r={x:t.cx-t.rx*.82,y:t.cy-t.ry*.9,w:t.rx*1.64,h:t.ry*1.55};if(r.x>=0&&r.y>=0&&r.x+r.w<=scene.width&&r.y+r.h<=scene.height)patch('leaves',r,original,null,i);});
      for(const kind of ['flowers','grass','fire'])for(const r of config[kind]||[])patch(kind,rectangle(r));
      if(zone==='skyisland'){
        for(const [i,[x,y]] of [[197,121.75],[645,281.75],[533,377.75]].entries()){
          const r=rectangle([x-23,y-48,46,59]),n=document.createElement('div');n.className='wl-mole';n.dataset.life='mole';n.dataset.hole=String(i+1);n.dataset.openingWidth=String(30*kx);style(n,r,Math.round((y+11)*ky));
          // Lower clipping arc stays inside the existing hole; its painted rim
          // stays visible. No artificial oval or replacement dirt is drawn.
          n.innerHTML='<svg viewBox="0 0 46 59" width="100%" height="100%"><defs><clipPath id="wl-hole-'+i+'"><path d="M0 0H46V46L40 50Q24 61 7 51L0 47Z"/></clipPath></defs><g clip-path="url(#wl-hole-'+i+')"><image class="wl-mole-art" href="'+root+'mole.webp" x="11" y="29" width="24" height="27"/></g></svg>';
          world.append(n);specials.push({node:n,art:n.querySelector('image'),r,kind:'mole',index:i});
        }
      }
      for(const [i,p]of patches.filter(p=>p.kind==='fire').entries()){
        const n=document.createElement('div');n.className='wl-embers';n.dataset.life='embers';const r={x:p.r.x,y:p.r.y-p.r.h*.4,w:p.r.w,h:p.r.h*1.5};style(n,r,Math.round(p.r.y+p.r.h));n.innerHTML='<i></i><i></i><i></i>';world.append(n);specials.push({node:n,r,kind:'embers',index:i});
      }
    }
    // School trees are source SVG crops, not one continuous background image.
    // Reuse their registered source pixels only inside the foliage/window area.
    if(zone==='campus')for(const id of ['class-window','group-window-left','group-window-right']){
      const windowArt=world.querySelector('[data-art="'+id+'"]');if(!windowArt)continue;const n=document.createElement('div');n.className='wl-window-light';n.dataset.life='sunlight';const r={x:parseFloat(windowArt.style.left)+12,y:parseFloat(windowArt.style.top)+15,w:100,h:98};style(n,r,21);world.append(n);specials.push({node:n,r,kind:'sunlight',index:specials.length});
    }
    if(zone==='playground'&&window.QPSchoolFoliage){
      const source=new Image();source.src=root+'school-foliage.webp';
      window.QPSchoolFoliage.forEach((p,i)=>patch('leaves',p.r,source,p.source,i));
    }
    function prepare(p){if(p.ready)return true;const im=p.image;if(!im.complete||!im.naturalWidth)return false;
      const sx=im.naturalWidth/(parseFloat(im.style.width)||scene.width),sy=im.naturalHeight/(parseFloat(im.style.height)||scene.height);p.source=p.source||{x:p.r.x*sx,y:p.r.y*sy,w:p.r.w*sx,h:p.r.h*sy};
      p.node.width=Math.ceil(p.source.w);p.node.height=Math.ceil(p.source.h);p.ctx=p.node.getContext('2d',{alpha:false});p.ready=true;return true;
    }
    function paint(p,time){if(!prepare(p))return;const {ctx:c,node:n,source:s,image:im}=p,w=n.width,h=n.height,fire=p.kind==='fire';
      const phase=time/(fire?195:950)+p.index*1.73,amp=fire?1.65:p.kind==='leaves'?1.05:1.3;
      // Six columns per strip, all boundary vertices pinned. Continuous strips
      // cover every pixel; no punched-out ground or duplicate silhouette.
      const rows=fire?20:14,cols=6;
      c.drawImage(im,s.x,s.y,s.w,s.h,0,0,w,h);
      for(let j=0;j<rows;j++){
        const y0=Math.round(h*j/rows),y1=Math.round(h*(j+1)/rows),v=(j+.5)/rows;
        const offset=Math.sin(phase+v*(fire?7:1.8))*Math.sin(Math.PI*v)*amp;
        for(let i=0;i<cols;i++){
          const x0=w*i/cols,x1=w*(i+1)/cols,dx0=x0+Math.sin(Math.PI*i/cols)*offset,dx1=x1+Math.sin(Math.PI*(i+1)/cols)*offset;
          c.drawImage(im,s.x+x0*s.w/w,s.y+y0*s.h/h,(x1-x0)*s.w/w,(y1-y0)*s.h/h,dx0,y0,dx1-dx0,y1-y0);
        }
      }
      p.node.dataset.frame=String(Math.round(time/50));
    }
    function update(now,view,paused,crowd=1){
      const dt=previous?Math.min(80,now-previous):0;previous=now;
      if(dead)return;
      if(paused||reduced.matches){paintMs=0;world.classList.add('wl-paused');return;}world.classList.remove('wl-paused');elapsed+=dt;const interval=crowd>=20?90:crowd>=10?70:50,budget=crowd>=20?8:crowd>=10?12:18;if(now-last<interval)return;last=now;
      const started=performance.now();
      const visible=patches.filter(p=>within(p.r,view)).sort((a,b)=>({fire:3,flowers:2,grass:1}[b.kind]||0)-({fire:3,flowers:2,grass:1}[a.kind]||0)||Math.hypot(a.r.x+a.r.w/2-view.x-view.width/2,a.r.y+a.r.h/2-view.y-view.height/2)-Math.hypot(b.r.x+b.r.w/2-view.x-view.width/2,b.r.y+b.r.h/2-view.y-view.height/2)).slice(0,budget),active=new Set(visible);
      for(const p of patches){p.node.hidden=!active.has(p);if(active.has(p))paint(p,elapsed);}
      activeCount=visible.length;updates++;paintMs=performance.now()-started;
      for(const p of specials){const visible=within(p.r,view);p.node.hidden=!visible;if(!visible)continue;
        if(p.kind==='mole'){
          const period=6900+p.index*1050,t=((elapsed+p.index*2260)%period)/period;let rise=0;
          if(t>.16&&t<.29)rise=(t-.16)/.13;else if(t>=.29&&t<.61)rise=1;else if(t>=.61&&t<.74)rise=1-(t-.61)/.13;
          rise=rise*rise*(3-2*rise);const tilt=rise>.98?Math.sin(elapsed/600+p.index)*2:0;
          p.art.setAttribute('transform','translate(0 '+((1-rise)*59).toFixed(2)+') rotate('+tilt.toFixed(2)+' 23 45)');p.node.dataset.rise=rise.toFixed(3);
        }else if(p.kind==='sunlight'||p.kind==='canopy-light')p.node.style.opacity=(.035+.025*Math.sin(elapsed/2100+p.index)).toFixed(3);
      }
    }
    // Reduced motion starts with static art. Avoid an un-clipped first frame.
    patches.forEach(p=>p.node.hidden=true);specials.forEach(p=>{if(p.art)p.art.setAttribute('transform','translate(0 5)');});
    const onReduced=()=>world.classList.toggle('wl-paused',reduced.matches);reduced.addEventListener('change',onReduced);onReduced();
    return {update,inspect:()=>({zone,patches:patches.length,specials:specials.length,active:activeCount,paintMs,updates,elapsed,reduced:reduced.matches}),destroy(){dead=true;reduced.removeEventListener('change',onReduced);patches.forEach(p=>{p.node.width=p.node.height=0;p.node.remove();});specials.forEach(p=>p.node.remove());}};
  }
  window.QPWorldLife=Object.freeze({mount,details});
})();
