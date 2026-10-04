/* Side-view jewelry and headwear. These are separate drawings, not narrowed
 * copies of the frontal illustration. The original nodes remain untouched. */
(function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg',rigs=new WeakMap();
  let serial=0;
  const catalog=Object.freeze({
    hat:Object.freeze(['cap','straw','beanie','crown','witch','ribbon','cat_ears','santa','grad','flower','halo_hat','cowboy','pirate','army','chef','police','capback','headphone','hairband','horn']),
    glass:Object.freeze(['round','square','sun','heart','star_g','goggle','thick','mono','pince','sport','half','eyepatch']),
    face:Object.freeze(['mus','beard','goatee','stubble','freckle','mole','band','mask','tear','paint','whisker','glow']),
    ear:Object.freeze(['dot','star_e','heart_e','drop','ring','flower_e','cross_e','bell','long_e']),
    neck:Object.freeze(['bead','heart_n','star_n','choker','pearl','cross_n','key','scarf','gem']),
    back:Object.freeze(['angel','devil','fairy','butterfly','cape','bag','halo','balloon','star_back'])
  });
  const node=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
  const attr=(el,key,value)=>{if(value===null){if(el.hasAttribute(key))el.removeAttribute(key);}else if(el.getAttribute(key)!==String(value))el.setAttribute(key,String(value));};
  const shade=(hex,amount)=>{const p=String(hex).match(/[a-f\d]{2}/gi)||['aa','77','88'];return '#'+p.slice(0,3).map(x=>{const v=parseInt(x,16),n=amount>0?v+(255-v)*amount:v*(1+amount);return Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0');}).join('');};
  function colors(category,value){const [shape,index]=String(value||'').split(':');let color='#d6a468';if(typeof CAT!=='undefined'&&typeof PAL!=='undefined'){const palette=PAL[CAT[category]?.pal];color=palette?.[Number(index)]?.[0]||palette?.[0]?.[0]||color;}return {shape,color,dark:shade(color,-.32),light:shade(color,.43)};}
  const path=(d,fill,stroke='#6c4d41',width=.18)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const line=(d,color,width=.2)=>path(d,'none',color,width);
  const oval=(x,y,rx,ry,fill,stroke='none',width=.18)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  function star(x,y,r,fill,edge=shade(fill,-.28)){let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.46:r;d+=(i?'L':'M')+(x+Math.cos(a)*rr).toFixed(3)+' '+(y+Math.sin(a)*rr).toFixed(3);}return path(d+'Z',fill,edge,.13);}
  const heart=(x,y,r,c,d=shade(c,-.3))=>path(`M${x} ${y+r*.86}C${x-r*1.45} ${y-r*.1} ${x-r*.7} ${y-r*1.12} ${x} ${y-r*.36}C${x+r*.7} ${y-r*1.12} ${x+r*1.45} ${y-r*.1} ${x} ${y+r*.86}Z`,c,d,.13);
  const quiet=(paint,opacity=.5)=>`<g opacity="${opacity}">${paint}</g>`;
  function flower(x,y,r,c){let s='';for(let i=0;i<5;i++){const a=i*Math.PI*2/5,px=x+Math.cos(a)*r*.8,py=y+Math.sin(a)*r*.8;s+=oval(px,py,r*.62,r*.68,c,shade(c,-.2),.1)+quiet(oval(px-r*.16,py-r*.2,r*.25,r*.3,shade(c,.5)),.4);}return s+oval(x,y,r*.4,r*.4,'#ffdd85','#ba944f',.1)+oval(x-r*.1,y-r*.1,r*.12,r*.1,'#fff1be');}
  function bow(x,y,c,d,l,side=false){const w=side?2.1:3;return path(`M${x} ${y}C${x-w} ${y-2.2} ${x-w-1} ${y+.8} ${x-.1} ${y+1}Z`,c,d)+path(`M${x+.2} ${y}C${x+2.6} ${y-1.3} ${x+2.7} ${y+1.5} ${x+.2} ${y+1}Z`,shade(c,.23),d)+path(`M${x-.3} ${y+.7}Q${x-.55} ${y+2} ${x-.8} ${y+3.3}L${x+.3} ${y+2.7}L${x+1.1} ${y+3}Q${x+.65} ${y+1.8} ${x+.7} ${y+.7}Z`,c,d)+quiet(line(`M${x-w*.8} ${y-.4}Q${x-w*.65} ${y+.4} ${x-.45} ${y+.45}M${x+.7} ${y+.5}Q${x+1.8} ${y+.3} ${x+2.1} ${y-.15}`,l,.22),.65)+quiet(line(`M${x-w*.65} ${y+.65}L${x-.45} ${y+.55}M${x+.45} ${y+1.15}L${x+.7} ${y+2.5}`,d,.12),.6)+oval(x+.1,y+.5,.55,.6,c,d,.15)+line(`M${x-.08} ${y+.15}L${x-.08} ${y+.65}`,l,.18);}
  function gradients(id,c,d,l,paint){
    // Only install material paints used by this item. They are made once with
    // the cached artwork, never during a pose update.
    const fills={
      '':`<linearGradient id="${id}" x1=".12" y1="0" x2=".84" y2="1"><stop offset="0" stop-color="${shade(c,.3)}"/><stop offset=".42" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-.2)}"/></linearGradient>`,
      cloth:`<radialGradient id="${id}-cloth" cx=".28" cy=".2" r=".85"><stop offset="0" stop-color="${shade(c,.29)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-.19)}"/></radialGradient>`,
      metal:`<linearGradient id="${id}-metal" x1="0" y1="0" x2=".75" y2="1"><stop offset="0" stop-color="${l}"/><stop offset=".29" stop-color="${c}"/><stop offset=".48" stop-color="${shade(c,.55)}"/><stop offset=".69" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>`,
      gem:`<radialGradient id="${id}-gem" cx=".3" cy=".22" r=".88"><stop offset="0" stop-color="${shade(c,.78)}"/><stop offset=".28" stop-color="${l}"/><stop offset=".73" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient>`,
      pearl:`<linearGradient id="${id}-pearl" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset=".48" stop-color="#fff7e9"/><stop offset="1" stop-color="#ded5c9"/></linearGradient>`,
      wing:`<radialGradient id="${id}-wing" cx=".24" cy=".22" r=".88"><stop offset="0" stop-color="${shade(c,.62)}" stop-opacity=".87"/><stop offset=".43" stop-color="${shade(c,.2)}" stop-opacity=".9"/><stop offset="1" stop-color="${shade(c,-.16)}"/></radialGradient>`
    };
    return '<defs>'+Object.entries(fills).filter(([suffix])=>!suffix||paint.includes(`url(#${id}-${suffix})`)).map(([,fill])=>fill).join('')+'</defs>';
  }
  function hatArt(s,c,d,l,id){
    const fill=`url(#${id}-cloth)`,gem=`url(#${id}-gem)`;
    // A brim extends from the forehead (right); the rear band wraps the skull.
    const dome=path('M5.5 8.7C5.1 3.8 8.3 .7 12.3 .3C16.4 -.3 20.5 2.6 21.2 8.6C16.2 10.1 10.2 10.4 5.5 8.7Z',fill,d,.22)+quiet(path('M7.3 6.4Q7.7 2.2 12.1 1.6Q9.1 3.1 8.8 6.6Z',l,'none'),.24);
    const band=path('M5.7 8.2Q13 9.7 21 8.2L21.3 10.4Q13.5 12 5.6 10.6Z',fill,d,.2)+quiet(line('M5.9 10.45Q13.6 11.7 21 10.25',d,.48),.35)+line('M6.5 8.8Q13.5 10 20.5 8.8',l,.16);
    const seam=quiet(line('M11.5 1.3Q14.6 3.9 15.2 8.8',l,.19),.68);
    if(s==='ribbon')return bow(16.3,5.3,c,d,l,true)+line('M13 6.6Q9.8 7.5 8 8.8',d,.35);
    if(s==='flower')return line('M12 7.8Q17 5 18.5 2.9','#68834f',.4)+flower(16.6,5.8,1.8,c)+flower(13.7,4.5,1.05,l)+path('M14.3 7.5Q10.6 5.7 11.3 8.5Q13.6 9.3 14.3 7.5Z','#8fab64','#5f7c45',.14);
    if(s==='halo_hat'||s==='halo')return oval(14,-.2,6.2,1.45,'none',d,.8)+oval(14,-.45,6.2,1.45,'none',c,.56)+line('M9.5 -1.3Q13 -2 16.8 -1.4',l,.25);
    if(s==='cat_ears')return path('M8 7.3Q6.8 3.2 9.1 1Q13.1 2.2 13.7 7.6Z',d,d)+path('M14.8 7.5Q15 2.1 19.1 .5Q22.2 3.5 21.5 8.3Z',fill,d,.22)+path('M16.4 6.3L18.9 2.4L20.3 6.9Z','#f6b2bf',shade(c,-.22)) + line('M8 9Q14 6.9 22 9',c,.7);
    if(s==='horn')return path('M8.4 7.4C5.3 4 6.4 .6 8.8 -.8C9 2.4 12 4.7 11.6 7.2Z',d,d)+path('M15.3 7.5C14.1 3.7 16.5 .2 19.4 -1.6C18.7 2.3 18.5 4.3 20.3 7.9Z',fill,d,.2)+line('M16.7 6.4Q16.6 3.4 18.4 .3',l,.4);
    if(s==='crown')return path('M7.6 7.7L6.4 1.6L10.4 4L13.4 -1L16.6 3.4L20.3 -.2L21.4 7.9Z',`url(#${id}-metal)`,d,.24)+band+oval(17.8,5.4,.85,1.2,'#ed789c','#a45373')+oval(17.55,5,.2,.34,'#ffe4e8')+oval(10.3,6.4,.55,.75,'#75cbdc','#4f8ca3')+oval(10.15,6.12,.12,.2,'#ebfbff')+line('M8.5 8.4Q14 9.3 20.3 8.6',l,.3)+quiet(line('M7.3 3L8.7 7.3M14.1 1.5L16.5 4.5',l,.22),.7);
    if(s==='witch')return path('M7.5 8.2C8.5 3.3 11.3 -4.8 15.4 -6.5C17.6 -7.1 21 -5.8 22.1 -3.8Q18.4 -4 17.1 -1.1L20.6 8.1Z',fill,d,.23)+path('M1.5 9.8Q9.8 5.7 24.5 8.7Q29.1 10.5 26 11.8Q12.4 14.2 2.1 11.6Z',fill,d,.24)+line('M9.5 6.7Q14.5 8 20 6.9',l,.85)+path('M17.8 6.6L19.7 6.7L20 8.3L18.1 8.3Z','#ffdb85',d);
    if(s==='grad')return path('M1.6 5L12.2 1L27.1 6.1L17 10.1Z',fill,d,.23)+path('M8.8 7.2L19.7 8.5L19.8 11.4Q14.2 13 8.6 10.7Z',d,d)+line('M24.5 6.9Q25.8 11.1 24.5 14.5','#e9bd5d',.35)+oval(24.4,14.7,.65,1.2,'#f5d171','#a3894d');
    if(s==='straw') {let texture='';for(let x=6.5;x<21;x+=1.5)texture+=line(`M${x} 5.8q.3 1 .5 2.4`,d,.1);for(let x=3;x<26;x+=1.6)texture+=line(`M${x} 10.5l1.25 .4`,d,.12);return path('M1.2 10.2Q8.8 7.7 22.7 8.9Q29.7 10.8 26.8 12.2Q12.7 14.1 1.2 12Z',fill,d,.24)+quiet(line('M2 11.8Q13.7 13.4 26.2 12',d,.38),.3)+dome+quiet(texture,.48)+line('M6 8Q14 9.7 21 8.2','#bf6d69',.75)+bow(9.5,8.9,'#ed9394','#b45f67','#ffd0c9',true);}
    if(s==='cowboy')return path('M5.4 8Q6.2 1.6 10.4 .1Q12.5 3.1 15.4 1Q18.1 .3 20.1 8.1Z',fill,d,.23)+path('M.8 8.7Q4.3 12 9.1 10.4Q18.4 8.7 24.3 10Q27.7 10.2 28.5 7.8Q30.5 11.1 26.1 12.8Q14.2 15 3 12.2Q.7 11.3 .8 8.7Z',fill,d,.25)+line('M7 7.7Q13.8 9 20.4 7.8',d,.85)+oval(17.6,8.2,.55,.65,l,d);
    if(s==='santa')return path('M5.5 8.4Q5.5 .4 12.5 0Q17.8 -.4 22.6 3.8Q24.6 5.8 21.7 7.7Q21 4 17.4 4.8L19.5 8.7Z','#eb6879','#a2455d',.22)+oval(22.9,7.2,1.8,1.8,'#fff9ee','#d4c5c5')+path('M5.4 8Q12.7 9.2 20.4 8V11Q13 12.5 5.6 10.8Z','#fff9ee','#d4c5c5',.2);
    if(s==='beanie'){let ribs='';for(let x=7;x<21;x+=1.4)ribs+=line(`M${x} 8.9q-.12 .8 .1 1.6`,d,.12);return dome+quiet(line('M9.9 1.6Q8.3 4.1 8.7 7.6M13.1 1.6Q13.8 4.4 13.8 8M16.1 2.1Q18 4.7 18.2 7.7',l,.16),.5)+oval(12.3,.2,1.85,1.7,fill,d,.16)+quiet(line('M11.3 -.3q-.4 .6 .1 1.1M12.8 -.8q.6 .6 .5 1.3',l,.22),.65)+band+quiet(ribs,.6);}
    if(s==='pirate')return dome+band+path('M6 8.5Q2.1 11 .9 15.8L5.4 14.6L7.1 9.4Z',fill,d)+path('M6.1 9.9L3.5 13.3L7.1 13L8 10Z',d,d)+oval(17.1,5.2,.6,.6,l)+oval(10,3.4,.45,.45,l)+line('M9 7.9Q15 6.8 20 7.8',l,.2);
    if(s==='chef')return oval(8.3,1.8,3.4,2.5,'#fffaf0','#c8c1b6')+oval(13.7,.1,4,3,'#fffdf6','#c8c1b6')+oval(19.2,1.9,3.3,2.4,'#fffaf0','#c8c1b6')+path('M7.3 2.8Q14 3.5 21 2.8V8.4Q14 10 7.3 8.4Z','#fffaf0','#c8c1b6')+band+line('M9.4 4L9.3 7.7M17.9 4L18.2 7.8','#ded5c7',.2);
    if(s==='headphone')return path('M7.3 22Q3.2 9.1 10.7 4.6Q16.5 2.1 23.7 11.9L22.4 13.2Q16.2 5 11.7 6.7Q6.6 9.3 9.1 21.3Z',fill,d,.23)+path('M8.4 18Q11.8 17.1 13.6 20.3L13.8 24.6Q11.4 27.6 8.5 25.3L7.7 22Z',fill,d,.22)+path('M9.6 19.4Q11.7 18.9 12.3 21.1V24.1Q10.7 25.3 9.4 23.9Z',l,d,.15)+line('M10.8 20.8V23.1',c,.2);
    if(s==='hairband')return path('M7.4 16Q5.2 7.8 11.6 4.5Q16.6 2.4 23 11.5L21.8 12.9Q16.6 5.6 12.5 6.1Q7.7 8.3 9 15.7Z',fill,d,.2)+oval(16.4,6.3,.85,.65,l,d);
    const frontBrim=path('M19.8 8.3Q24.5 7.8 27.3 10.3Q26.9 11.9 20.2 10.5Z',fill,d,.2)+quiet(path('M20.2 9.95Q25.1 11.1 27.3 10.3Q26.9 11.9 20.2 10.5Z',d,'none'),.42)+line('M21.7 8.8Q24.5 8.8 25.9 9.8',l,.16);
    if(s==='capback')return dome+band+seam+path('M5.8 8.6Q1.3 8.6 -.3 10.8Q.6 12.1 6.1 10.7Z',fill,d)+quiet(line('M.4 10.95Q3 11.35 5.8 10.45',d,.32),.45)+path('M18.1 8.7H21V10H18.1Z',l,d,.14)+line('M18.6 9.2H20.5',d,.1);
    if(s==='army'||s==='police')return path('M5.8 7.8Q6.7 1.1 12.6 1Q17.8 .7 21.2 7.9Z',fill,d,.23)+band+frontBrim+(s==='police'?path('M19 4.2L20.5 4L21.2 6.3L20.1 7.3L19 6.2Z','#f5d275','#b58e42')+star(20.1,5.7,.65,d):star(19.5,5.6,1,l));
    return dome+band+seam+frontBrim+oval(12.6,.6,.48,.3,l,d,.12);
  }
  function glassesArt(s,c,d,l,id){
    const fill=`url(#${id}-gem)`;
    // A tapered temple rests above the ear, with a hinge at the near lens.
    // The short bridge and translucent pad bear on the nose rather than hang
    // beyond it as a second frontal lens.
    const arm=line('M-1.9 -.7Q-5 -1.75 -7.65 -.75Q-8.45 -.3 -8.5 1.1',d,.32)+line('M-2.2 -.83Q-5 -1.7 -7.5 -.88',c,.19)+quiet(line('M-3 -1Q-5.3 -1.65 -6.9 -1.06',l,.11),.75)+oval(-1.88,-.66,.29,.23,c,d,.1)+oval(-1.93,-.73,.07,.06,l);
    const bridge=line('M1.8 -.5Q2.7 -.95 3.45 -.45',c,.22)+quiet(oval(2.32,.15,.22,.42,l,d,.08),.55);
    const clear=oval(0,0,1.95,2.2,'#ffffff0d',c,s==='thick'?.43:.24)+quiet(path('M-1.15 -1.4Q-.6 -1.75 .4 -1.6L-.5 -.95Z',l,'none'),.38)+line('M-1.12 1.25L-.8 1.57',l,.12);
    if(s==='eyepatch')return line('M-8.7 -1.4Q-3.4 -3.9 3.2 -1.2M-8.3 2Q-2.3 4.3 2.7 1.9',c,.27)+path('M-2.2 -1.9Q0 -3 2.2 -1.8L2 1.8Q0 3.3 -2 1.7Z',`url(#${id})`,d,.24)+star(.1,0,.65,'#ffe8b9');
    if(s==='mono')return clear+line('M1.3 2Q3.5 4.4 1.9 6.5',c,.16)+oval(1.8,6.7,.24,.24,c,d,.12);
    if(s==='pince')return oval(.25,.2,1.68,1.95,'#ffffff12',c,.23)+line('M1.85 -.2Q2.6 -.85 3.35 -.45',c,.24)+quiet(oval(2.15,.25,.2,.37,l,d,.08),.55)+line('M-.7 -1.05L.1 -1.3',l,.16);
    if(s==='half')return arm+bridge+path('M-2.1 .2Q0 4.4 2.1 .2Z','#ffffff12',c,.25)+line('M-2.2 .1H2.1',c,.22);
    if(s==='heart')return arm+bridge+heart(0,-.1,2.35,fill,c)+line('M-.9 -1.1L-.4 -1.4',l,.3);
    if(s==='star_g')return arm+bridge+star(0,0,2.8,fill,c)+line('M-.3 -1.6L.15 -.8',l,.25);
    if(s==='goggle'||s==='sport')return line('M-8.75 .7Q-6 -1.8 -2.1 -1',d,s==='goggle'?.62:.48)+line('M-8.2 .15Q-5.8 -1.65 -2.3 -1.2',c,.28)+path('M-2.15 -1.9Q.1 -2.55 2.4 -1.5L1.95 1.7Q-.1 2.75 -2 1.5Z',`url(#${id})`,c,.28)+path('M-1.55 -1.3Q0 -1.85 1.75 -1L1.4 1.2Q-.1 1.9 -1.4 .9Z',s==='goggle'?'#bfe9ff99':fill,d,.16)+quiet(path('M-1.25 -.85L-.65 -1.2L.75 -1.25L-.1 -.55Z','#f8ffff','none'),.65)+bridge;
    if(['square','thick','sun'].includes(s))return arm+bridge+`<rect x="-1.95" y="-2.05" width="3.95" height="4.15" rx=".76" fill="${s==='sun'?fill:'#ffffff0d'}" stroke="${c}" stroke-width="${s==='thick'?.43:.25}"/>`+quiet(path('M-1.18 -1.2L.15 -1.45L-.55 -.87Z',l,'none'),.5)+line('M-1.25 1.27L-.88 1.58',l,.12);
    return arm+bridge+clear;
  }
  function faceArt(s,c,d,l,id){
    const fill=`url(#${id})`,cheek=[-2.5,3.6];
    if(s==='mask')return line('M-8.35 3.05Q-4.8 2.8 -1 3.7M-8.35 3.05Q-7.7 5.3 -1.3 5.7',d,.2)+path('M-1.2 2.6Q2.7 2.4 4.7 3.6L3.4 6.5Q.5 8.2 -2.3 5.9Z',fill,d,.22)+quiet(path('M-1.5 4.9Q.7 6.5 3.7 5.8L3.4 6.5Q.5 8.2 -2.3 5.9Z',d,'none'),.15)+line('M-.8 3.7Q1.1 4.7 3.5 4.3M-.7 5.1Q1.2 6 3.1 5.5',l,.17);
    if(s==='mus')return path('M3 4.8Q1.1 3.5 -.3 4.9Q-1.6 6.2 -2.8 4.9Q-1.8 7.6 1.1 6Q2.4 5.2 3.4 5.4Z',fill,d,.17);
    if(s==='beard')return path('M-6.8 3.1Q-5.3 7.7 -.2 7.6Q2.3 6.4 3.4 5.4Q4.3 8.2 .7 10.4Q-5.8 10.1 -6.8 3.1Z',fill,d,.18)+line('M-4.8 7.5Q-2 9.4 .8 8.8',l,.19);
    if(s==='goatee')return path('M-.6 7Q.8 7.1 1.9 6.3Q2.1 9.8 .5 10Q-1 9.4 -.6 7Z',fill,d,.18)+line('M.5 7.9L.65 9.1',l,.18);
    if(s==='stubble'){let a='';for(const [x,y]of[[-5,5.7],[-4,6.7],[-3,7.4],[-1.9,7.8],[-.5,7.8],[.6,7.5],[1.6,6.9],[2.4,6.3]])a+=line(`M${x} ${y}l.13 .42`,c,.16);return a;}
    if(s==='freckle'){let a='';for(const [x,y]of[[-3.3,3.4],[-2.1,3.7],[-.8,3.3],[-2.8,4.5],[-1.3,4.4]])a+=oval(x,y,.17,.17,c);return a;}
    if(s==='mole')return oval(-1.7,4.7,.32,.32,c,d,.06)+oval(-1.78,4.56,.08,.08,l);
    if(s==='band')return `<g transform="translate(-3.1 3.7) rotate(-21)">${path('M-2 -.7H2Q2.4 -.7 2.4 -.2V.6Q2.4 1.1 2 1.1H-2Q-2.4 1.1 -2.4 .6V-.2Q-2.4 -.7 -2 -.7Z','#efc6a7',c,.16)}<rect x="-.55" y="-.4" width="1.1" height="1.2" rx=".14" fill="#ffe3c8"/>${oval(-1.6,.1,.1,.1,d)+oval(1.6,.1,.1,.1,d)}</g>`;
    if(s==='tear')return path('M-.4 1.2Q-2.7 4.8 -.6 5.7Q1.3 5.1 -.4 1.2Z','#87d3ef','#438fae',.18)+oval(-.9,3.8,.22,.52,'#effbff');
    if(s==='paint')return line('M-4 3.1Q-1.9 3.4 .1 2.6M-3.8 4.4Q-1.7 4.7 .1 3.9',c,.58);
    if(s==='whisker')return line('M1.5 4L5.3 3.1M1.8 4.7L5.7 4.9M1.4 5.3L5.1 6.4',c,.18)+oval(3.7,3.9,.45,.32,c,d,.1);
    return `<g opacity=".4">${oval(...cheek,1.45,.8,c,'none')+line('M-3.8 3.2l.8 -.5M-1.8 3.4l.7 -.4',l,.22)}</g>`;
  }
  function earArt(s,c,d,l,id){
    const gem=`url(#${id}-gem)`,stud=quiet(oval(0,-.1,.42,.36,d),.28)+oval(0,.04,.32,.38,gem,d,.11)+oval(-.1,-.08,.1,.12,l);
    if(s==='dot')return stud+oval(.08,.72,.63,.73,gem,d,.13)+oval(-.1,.48,.13,.2,'#fff9ed');
    if(s==='ring')return stud+oval(.15,1.45,.78,1.2,'none',d,.4)+oval(.08,1.39,.78,1.2,'none',c,.24)+line('M-.45 .8Q-.72 1.4 -.45 2',l,.16);
    if(s==='star_e')return stud+line('M0 .3L.1 1.1',c,.16)+star(.15,1.95,1.2,gem,d);
    if(s==='heart_e')return stud+line('M0 .3L.15 1',c,.16)+heart(.15,1.7,1.12,gem,d);
    if(s==='flower_e')return stud+flower(.12,1.65,1,c);
    if(s==='cross_e')return stud+line('M.1 .6V3.4M-.85 1.7H1.05',d,.47)+line('M.04 .6V3.3M-.85 1.63H1',c,.28)+line('M-.02 .8V1.2',l,.15);
    if(s==='bell')return stud+path('M.1 .7Q-1 .8 -1.2 2.8Q.1 3.4 1.4 2.8Q1.2 .8 .1 .7Z',`url(#${id})`,d,.16)+line('M-.9 2.65Q.1 3 1.1 2.65',l,.2)+oval(.1,3.2,.31,.37,d)+line('M-.6 1.3L-.78 2.2',l,.2);
    if(s==='long_e')return stud+line('M.1 .4Q-.3 1.3 .1 3.4',c,.18)+oval(.1,1.6,.36,.46,l,d,.1)+oval(.1,3.75,.7,.89,gem,d,.15);
    return stud+line('M0 .4L.1 1.1',c,.17)+path('M.1 .9Q-1.5 3.1 .1 3.7Q1.7 3.1 .1 .9Z',gem,d,.18)+line('M-.45 2.2L-.55 2.8',l,.2);
  }
  function neckArt(s,c,d,l,id){
    const fill=`url(#${id}-cloth)`,gem=`url(#${id}-gem)`,chain=line('M14.45 28.7Q15.6 30.65 18.8 30.5L19.2 29.4',d,.25)+line('M14.55 28.75Q15.7 30.55 18.8 30.45L19.1 29.55',c,.16);
    if(s==='scarf')return path('M13.8 28.3Q16.6 29.75 19.35 28.95L19.15 30.5Q16.8 31.2 13.95 29.7Z',fill,d,.17)+quiet(line('M14.3 29.6Q16.9 30.9 19.05 30.3',d,.35),.35)+path('M18.55 30.2Q19.75 31.75 19.9 34.8L18.25 35.45Q18.5 32.8 17.8 30.6Z',fill,d,.18)+line('M18.6 31.1Q19.05 32.65 19.1 34.55',l,.21)+quiet(line('M18.25 35.15l.05 .55M18.95 34.95l.08 .55M19.6 34.75l.07 .55',d,.12),.6);
    if(s==='choker')return path('M14.25 28.5Q16.7 29.7 19.35 29.05L19.15 30.05Q16.75 30.65 14.4 29.45Z',fill,d,.14)+line('M14.7 28.95Q16.8 29.9 18.9 29.45',l,.13)+`<g transform="translate(18.9 29.8) scale(.7 .72)">${bow(0,0,c,d,l,true)}</g>`;
    if(s==='bead'||s==='pearl'){let a=chain;for(const [x,y]of[[14.5,28.9],[15.15,29.55],[16.05,30.05],[17.05,30.35],[18.1,30.45],[18.95,30.05]])a+=oval(x,y,.29,.35,s==='pearl'?`url(#${id}-pearl)`:gem,s==='pearl'?'#baaca0':d,.09)+oval(x-.08,y-.12,.07,.09,'#fffdf2');return a;}
    const pendant=s==='star_n'?star(18.95,31.55,.92,gem,d):s==='heart_n'?heart(19,31.45,.92,gem,d):s==='cross_n'?line('M19 30.8V33M18.35 31.6H19.7',d,.42)+line('M18.95 30.8V32.95M18.35 31.55H19.7',c,.26):s==='key'?oval(18.95,31.12,.45,.54,'none',c,.23)+line('M18.97 31.65L19.1 33.5L19.75 33.25M19.05 32.85L19.6 32.75',c,.24):path('M18.9 30.85L19.85 31.85L19.1 33.1L18.15 31.9Z',gem,d,.16)+line('M18.95 31.08L19.05 32.65',l,.15);
    return chain+oval(18.9,30.65,.18,.24,'none',c,.13)+pendant;
  }
  function backArt(s,c,d,l,id){
    const fill=`url(#${id}-cloth)`;
    if(s==='bag')return line('M12.1 29.55Q11.55 27.45 13.35 27.65Q14.2 28 14.1 29.7',d,.42)+line('M12.1 29.5Q11.75 27.8 13.35 27.9',c,.22)+path('M10.6 29.3Q12.5 28.5 14.45 29.65Q15.1 33.6 15.15 37.25Q14.6 39 11.1 38.25Q10.45 38.1 10.35 36.85L9.95 31.25Q9.9 29.85 10.6 29.3Z',fill,d,.22)+quiet(path('M13.85 30Q14.55 32.55 14.5 37.55L15.15 37.25Q15.1 33.6 14.45 29.65Z',d,'none'),.22)+path('M10.5 33.75Q12.2 34.15 14.3 33.85L14.5 36.55Q12.9 37.15 10.75 36.7Z',fill,d,.16)+line('M10.75 34.25Q12.55 34.6 14.1 34.3',l,.17)+line('M10.7 31.2Q12.3 31.65 14.2 31.15',d,.22)+line('M10.8 31.52Q12.4 31.9 14.18 31.5',l,.12)+oval(13.9,32,.2,.35,l,d,.09)+quiet(line('M10.7 32L11.1 36.85',l,.22),.6);
    if(s==='cape')return path('M14.7 28.3Q11.7 30.1 11 35.4Q9.1 39.1 7.8 42.5Q11.7 43.4 15.2 41.9Q15.2 37.2 14.5 33Q15.9 30.5 17.7 29.2Z',fill,d,.22)+quiet(path('M13.2 30.6Q12.6 36.6 10.5 42.4L12.2 42.4Q13.7 36.1 13.2 30.6Z',l,'none'),.17)+line('M13.4 30.1Q12.1 35.2 10.7 41.6',l,.18)+quiet(line('M14.2 34.2Q13.6 39.7 14.4 41.6',d,.22),.55)+path('M13.7 28.2Q15.8 29.15 18.2 28.5L18.1 29.6Q15.7 30.15 13.6 29.4Z',fill,d,.16)+line('M14.1 29.25Q15.9 29.7 17.7 29.2',l,.13);
    if(s==='balloon')return line('M9.5 29Q8 34.5 13.5 39',d,.15)+oval(9.4,23.1,3.1,4.6,fill,d,.2)+oval(8.1,21.3,.46,1.2,l)+path('M9.2 27.7L9.9 27.7L10.4 28.7L8.7 28.7Z',c,d,.12);
    if(s==='star_back')return star(7.8,29.4,1.55,l)+star(10.2,38.6,1.05,c)+star(13,25.8,.75,l)+star(7,34.7,.8,c);
    if(s==='halo'){let a=oval(12.4,30.1,4.8,7.3,c,'none');for(let i=0;i<10;i++){const t=i*Math.PI/5,x=12.4+Math.cos(t)*5.3,y=30.1+Math.sin(t)*7.8;a+=line(`M${x} ${y}l${Math.cos(t)*1.8} ${Math.sin(t)*1.9}`,c,.28);}return `<g opacity=".45">${a}</g>`;}
    if(s==='fairy'||s==='butterfly'){const wing=`url(#${id}-wing)`;return `<g opacity="${s==='fairy'?.76:1}">${path('M14.15 31.4Q7.6 20.6 3.8 26.3Q2.5 32 10.9 34.9Q4.1 34.3 5.1 40Q10.5 41.5 14.2 34.3Z',wing,d,.22)}${quiet(path('M5.1 26.45Q7.6 24.9 11.5 29.7Q7.5 26.3 5.1 27.25Z',l,'none'),.28)}${line('M13.85 32.9Q8.1 27.4 5.1 27.1M13.5 34.75Q8.8 36.2 6.2 38.7',l,.2)}${quiet(line('M10.4 29.2Q8.8 29.8 8.5 31.4M10.4 36.1Q9.8 37 10.1 38',l,.14),.65)}${s==='butterfly'?oval(5.9,28,1.05,1.5,`url(#${id}-gem)`,d,.1)+oval(7.3,37.3,.72,1,l,d,.1):''}${quiet(line('M13.9 31.75Q12.9 33.4 13.7 35',d,.42),.32)}</g>`;}
    if(s==='devil')return path('M14.7 31.2Q9.5 22 3 24Q6.6 26 6.3 29.7Q9.1 29.1 9.2 33.6Q11.8 31.8 14.4 36Z',fill,d,.23)+line('M14.5 32Q10.8 27.7 6.3 26.3M10 28.8L9.2 33.3',l,.22);
    return path('M14.6 31.3Q9 30 6 23.3Q2.5 27.9 4.8 32.1Q2.8 34.5 6.7 36Q5.8 38.8 9.2 39.1Q12.2 39.2 14.9 34.7Z',`url(#${id}-pearl)`,'#aebbc9',.22)+line('M6.1 27.1Q6.4 30 12.5 32.5M5.7 31.2Q7.2 34.1 12.7 34.2M7 35.1Q9.1 37.4 13.6 35.5','#c7d4dd',.24)+quiet(line('M7.3 26.6Q9 29.1 12.8 30.7M5.8 32.2Q8.2 34.75 12.6 34.9','#ffffff',.33),.85)+quiet(path('M14.6 31.3Q12.4 32.1 12.9 34.3L14.9 34.7Z','#afbdc8','none'),.23);
  }
  const painters={hat:hatArt,glass:glassesArt,face:faceArt,ear:earArt,neck:neckArt,back:backArt};
  function rearHatArt(s,c,d,l,id){
    const fill=`url(#${id}-cloth)`,dome=path('M6.4 10Q6.2 2.3 16 2.1Q25.8 2.3 25.6 10Q16 12.1 6.4 10Z',fill,d,.22)+quiet(path('M8.6 7.7Q9.3 3.3 14.5 3.1Q11.2 4.7 10.1 8.1Z',l,'none'),.21);
    const band=path('M6.5 9.1Q16 10.5 25.5 9.1V11.5Q16 13.3 6.5 11.5Z',fill,d,.2)+quiet(line('M6.8 11.3Q16 13 25.2 11.3',d,.47),.34)+line('M7.1 9.8Q16 11.15 24.9 9.8',l,.15);
    const seam=quiet(line('M16 2.5V8.4M10.2 3.5Q9 6.1 9.4 8.9M21.8 3.5Q23 6.1 22.6 8.9',l,.17),.66);
    if(s==='halo_hat'||s==='halo')return oval(16,1.1,6.3,1.5,'none',d,.7)+oval(16,.9,6.3,1.5,'none',c,.45)+line('M11 -.1Q15.3 -.8 19 -.2',l,.22);
    if(s==='ribbon')return bow(16,6.3,c,d,l)+line('M12 8.6Q16 9.1 20 8.6',d,.22);
    if(s==='flower')return flower(7.8,9,1.6,c)+flower(10,7.5,1.1,l)+line('M8 10Q10.8 11.5 12.7 10.5','#718f56',.35);
    if(s==='cat_ears')return path('M7.2 9Q6.4 3.5 8.5 1.8Q13 4 13.1 8.8Z',fill,d,.22)+path('M18.9 8.8Q19 4 23.5 1.8Q25.6 3.5 24.8 9Z',fill,d,.22)+line('M7.8 7.8Q8.6 4.9 9.1 3.5M24.2 7.8Q23.4 4.9 22.9 3.5',l,.35)+line('M8 10Q16 8 24 10',c,.7);
    if(s==='horn')return path('M7.4 8.8Q4.5 4.2 8.3 0Q8.1 4.8 11.3 8Z',fill,d,.22)+path('M24.6 8.8Q27.5 4.2 23.7 0Q23.9 4.8 20.7 8Z',fill,d,.22)+line('M8.1 2Q6.9 5.3 8.9 7.4M23.9 2Q25.1 5.3 23.1 7.4',l,.3);
    if(s==='crown')return path('M8.4 9L6.8 2.3L12 5.1L16 .7L20 5.1L25.2 2.3L23.6 9Z',`url(#${id}-metal)`,d,.23)+path('M8.5 8.5Q16 7.7 23.5 8.5L23 11Q16 12 9 11Z',`url(#${id}-metal)`,d,.19)+line('M10 9.6Q16 9 22 9.6',l,.26)+quiet(line('M9.3 10.85Q16 11.7 22.7 10.85',d,.36),.38)+oval(12,9.4,.35,.45,l,d,.1)+oval(20,9.4,.35,.45,l,d,.1);
    if(s==='witch')return path('M9.2 9Q11.3 2.6 14.9 -3.7Q17.1 -5.9 20.7 -2.5Q18.5 -2.8 17.7 .8L22.8 9Z',fill,d,.23)+oval(16,10,10,2,fill,d,.22)+line('M10.3 7.3Q16 8.7 21.5 7.1',l,.65);
    if(s==='grad')return path('M16 1L28 5.2L16 9.5L4 5.2Z',fill,d,.23)+path('M10 7.6Q16 9.7 22 7.6V11Q16 12.8 10 11Z',d,d)+line('M26.6 5.7Q28 10 26.4 13.5','#efcd72',.3)+oval(26.3,13.9,.6,1,'#f7dd8b','#aa8a50');
    if(s==='straw'){let weave='';for(let x=5;x<28;x+=1.6)weave+=line(`M${x} 11.1l.7 .45`,d,.11);return oval(16,11.5,11.7,2.3,fill,d,.2)+quiet(line('M5.1 12.2Q16 14.9 26.9 12.2',d,.35),.3)+dome+line('M7.2 8.9Q16 10.3 24.8 8.9','#b46b66',.65)+seam+quiet(weave,.46);}
    if(s==='cowboy')return path('M7.8 9.7Q8.7 2 13.4 1.6Q16 4.5 18.6 1.6Q23.3 2 24.2 9.7Z',fill,d,.23)+path('M2.5 9.5Q5 12.2 9.2 11.2Q16 10.5 22.8 11.2Q27 12.2 29.5 9.5Q30.1 13.3 26 14.1Q16 16 6 14.1Q1.9 13.3 2.5 9.5Z',fill,d,.22)+line('M9 8.9Q16 10.3 23 8.9',d,.75);
    if(s==='santa')return path('M6.8 10Q6.8 2 15 1.6Q22.2 .7 26 5.6Q29.7 8.8 26.5 11.1Q25.7 6.4 21.9 6.3L24.8 10Z','#eb6879','#a2455d',.22)+oval(26.5,11.3,1.8,1.8,'#fffaf0','#d5c8c6')+path('M6.4 9.4Q16 10.8 25.1 9.4V12.2Q16 13.5 6.4 12.2Z','#fffaf0','#d5c8c6',.2);
    if(s==='beanie'){let ribs='';for(let x=8;x<25;x+=1.6)ribs+=line(`M${x} 10q-.1 .7 .1 1.5`,d,.12);return dome+quiet(line('M12.5 3Q10.9 5.3 11.2 8.9M19.5 3Q21.1 5.3 20.8 8.9',l,.16),.55)+oval(16,2.1,1.8,1.65,fill,d,.16)+quiet(line('M15.1 1.5q-.4 .7 .15 1.2M16.8 1.2q.55 .75 .35 1.45',l,.21),.65)+band+seam+quiet(ribs,.6);}
    if(s==='pirate')return dome+band+path('M14.7 10.7Q11 13.8 12.2 17.7L15.3 16.2L16.4 11.1Z',fill,d)+path('M16 11Q20.1 13.5 19.8 16.9L17 15.8L15.6 11.1Z',fill,d)+oval(16,11.1,.8,.65,l,d)+line('M13.5 13.6L13.8 16M18.2 13.5L18.8 15.5',l,.2);
    if(s==='chef')return oval(10.1,3.4,3.8,2.9,'#fff9ef','#cfc5b7')+oval(16,2,4.2,3.1,'#fffdf5','#cfc5b7')+oval(21.9,3.4,3.8,2.9,'#fff9ef','#cfc5b7')+path('M8 5.1Q16 6.5 24 5.1V9.7Q16 11.1 8 9.7Z','#fff9ef','#cfc5b7')+band+line('M11.1 6.4V9M16 6.5V9.4M20.9 6.4V9','#d9cfc1',.2);
    if(s==='headphone')return path('M5.3 21.5Q4 7.1 16 6.7Q28 7.1 26.7 21.5H24.9Q25.7 9 16 8.7Q6.3 9 7.1 21.5Z',fill,d,.23)+path('M4.5 20Q7.6 19.1 8.7 21.3V26.5Q6.5 28.2 4.5 26.7Z',fill,d,.22)+path('M27.5 20Q24.4 19.1 23.3 21.3V26.5Q25.5 28.2 27.5 26.7Z',fill,d,.22)+line('M5.5 21.6V25.6M26.5 21.6V25.6',l,.5);
    if(s==='hairband')return path('M6.7 17Q6.2 8.3 16 7.9Q25.8 8.3 25.3 17L23.8 17Q23.6 10.2 16 9.7Q8.4 10.2 8.2 17Z',fill,d,.18)+line('M9.6 10.5Q16 8.7 22.4 10.5',l,.23);
    if(s==='army'||s==='police')return dome+band+line('M9 5Q16 2.6 23 5',l,.27)+line('M11.7 10Q16 10.4 20.3 10',d,.25);
    if(s==='capback')return dome+band+seam+path('M6.3 11Q16 9.8 25.7 11Q28.2 13.7 24.1 14.2Q16 15 7.9 14.2Q3.8 13.7 6.3 11Z',d,d,.22)+line('M8 11.4Q16 10.6 24 11.4',l,.25);
    return dome+band+seam+path('M12.7 9.8Q16 7.7 19.3 9.8V11.8Q16 12.6 12.7 11.8Z',d,d,.15)+line('M13.3 10.9H18.7',l,.45)+oval(19.1,10.8,.22,.27,l,d,.1);
  }
  function rearNeckArt(s,c,d,l,id){
    if(s==='scarf')return path('M12.6 28.5Q16 29.8 19.4 28.5V30.15Q16 31.55 12.6 30.15Z',`url(#${id}-cloth)`,d,.18)+quiet(line('M12.9 30.05Q16 31.4 19.1 30.05',d,.36),.33)+line('M13.2 29.35Q16 30.35 18.8 29.35',l,.16);
    const chain=line('M12.9 28.8Q16 30.1 19.1 28.8',d,s==='choker'?.65:.24)+line('M13 28.8Q16 30 19 28.8',c,s==='choker'?.43:.15);
    return chain+oval(16,29.65,.31,.23,l,d,.1)+line('M15.5 29.65H16.5',d,.1);
  }
  function rearBackArt(s,c,d,l,id){
    const fill=`url(#${id}-cloth)`;
    if(s==='bag')return line('M13.15 28.8Q11.1 28.8 10.55 31.1L10.6 35.5Q10.8 37 12 37.25M18.85 28.8Q20.9 28.8 21.45 31.1L21.4 35.5Q21.2 37 20 37.25',d,.8)+line('M13.15 28.8Q11.1 28.8 10.55 31.1L10.6 35.5Q10.8 37 12 37.25M18.85 28.8Q20.9 28.8 21.45 31.1L21.4 35.5Q21.2 37 20 37.25',c,.48)+line('M13.3 29.15Q13.5 27.1 16 27.1Q18.5 27.1 18.7 29.15',d,.6)+line('M13.55 28.9Q13.8 27.4 16 27.4Q18.2 27.4 18.45 28.9',c,.3)+path('M11.35 29.65Q12.55 28.6 16 28.55Q19.45 28.6 20.65 29.65L21.05 36.9Q21 39 16 39.15Q11 39 10.95 36.9Z',fill,d,.23)+quiet(path('M11.5 30.2L12.1 36.85Q12.2 38 13.2 38.65L11.9 38.45Q10.95 37.9 10.95 36.9L11.35 29.65Z',d,'none'),.16)+quiet(path('M19.7 30.2Q20 34.6 19.8 37.4L20.8 37.7Q21.1 34.3 20.65 29.65Z',d,'none'),.18)+path('M12.25 33.55Q16 32.85 19.75 33.55L19.65 36.85Q16 38 12.35 36.85Z',fill,d,.17)+line('M12.7 34.1Q16 33.6 19.3 34.1',l,.17)+line('M12.25 31.75Q16 30.75 19.75 31.75',d,.27)+line('M12.45 32.1Q16 31.3 19.55 32.1',l,.15)+oval(19.55,32.35,.22,.43,l,d,.09)+path('M15.6 35.1H16.4V36.1H15.6Z',`url(#${id}-metal)`,d,.12)+quiet(line('M11.75 30.95L12.05 32.9M20.25 30.95L19.95 32.9',l,.19),.6);
    if(s==='cape')return path('M12.6 28.6Q16 29.7 19.4 28.6Q22.7 33.6 25 42Q21 44.1 16 42.5Q11 44.1 7 42Q9.3 33.6 12.6 28.6Z',fill,d,.23)+quiet(path('M13.5 30.1Q11.3 34.6 10.4 41.8L12.1 42.4Q13.6 36.4 13.5 30.1Z',l,'none'),.16)+quiet(path('M18.5 30.1Q20.7 34.6 21.6 41.8L19.9 42.4Q18.4 36.4 18.5 30.1Z',d,'none'),.16)+line('M13.1 30Q11.9 36 10.5 41.7M18.9 30Q20.1 36 21.5 41.7',l,.19)+quiet(line('M15.9 31Q15.45 36.4 15.9 41.8',d,.22),.5)+line('M13.1 29.4Q16 30.25 18.9 29.4',l,.17);
    if(s==='balloon')return line('M18.7 38Q26.4 35.2 27.7 30.1',d,.16)+oval(27.5,24.9,3.7,5,fill,d,.21)+oval(26.1,22.6,.57,1.45,l)+path('M27.2 30L28 30L28.5 31H26.8Z',c,d,.12);
    if(s==='halo'){let a=oval(16,30.4,7.9,8.7,c);for(let i=0;i<12;i++){const t=i*Math.PI/6,x=16+Math.cos(t)*9.1,y=30.4+Math.sin(t)*10;a+=line(`M${x} ${y}l${Math.cos(t)*1.6} ${Math.sin(t)*1.8}`,c,.28);}return `<g opacity=".34">${a}</g>`;}
    if(s==='star_back')return star(4,29,1.7,l)+star(28,31.3,1.45,c)+star(6.7,39.1,1.15,c)+star(26,39.4,1.05,l);
    const one=()=>{
      if(s==='devil')return path('M15.5 31.3Q8.5 22.6 2.5 24.4Q6.1 27.2 5.7 30.8Q9.1 30 9.5 34.1Q12.6 33.1 15.5 37Z',fill,d,.23)+line('M15.2 33Q10.5 27.2 5.4 26.8M10.4 28.9L9.5 34',l,.2)+quiet(path('M14.5 31.5Q13.3 33.2 14.6 35.8L15.5 37V31.3Z',d,'none'),.2);
      if(['fairy','butterfly'].includes(s))return path('M15.5 31.7Q7.9 21 3.1 25Q.4 31.7 11.2 35Q3.5 34.5 4.7 41Q11.9 42.7 15.5 35.3Z',`url(#${id}-wing)`,d,.22)+quiet(path('M4.65 25.4Q7.5 24 11.8 29.9Q7.4 26.3 4.65 26.25Z',l,'none'),.28)+line('M15 33.4Q9 27.8 4.7 26.4M15 35.4Q9 37.2 6.1 39.6',l,.2)+quiet(line('M9.8 29.2Q7.8 29.85 7.2 32M10.2 37Q8.5 37.9 8.4 40',l,.14),.65)+(s==='butterfly'?oval(5.8,28.6,1.05,1.45,`url(#${id}-gem)`,d,.1)+oval(7.9,38.5,.8,1,l,d,.1):'')+quiet(line('M15.3 31.95Q14.35 33.8 15.25 35.6',d,.43),.32);
      return path('M15.5 31.3Q7.2 30.1 3.2 23.9Q-.6 30.9 4 35.4Q2.3 38.3 6.3 39Q9 43 15.5 36Z',`url(#${id}-pearl)`,'#b4c2d0',.23)+line('M4.9 27.9Q5.2 32 13.8 33.5M4.5 32.6Q6.1 36.8 13.3 35.8M7 37.2Q9.3 39.8 14.1 36.9','#c6d3df',.23)+quiet(line('M5.2 27.2Q7.2 30.4 12.4 31.8M5.1 33.5Q8 36.6 12.4 36.2','#ffffff',.3),.85)+quiet(path('M15.5 31.3Q13.45 32.1 13.7 34.95L15.5 36Z','#afbdc8','none'),.22);
    };
    return `<g opacity="${s==='fairy'?.76:1}">${one()}<g transform="translate(32 0) scale(-1 1)">${one()}</g></g>`+oval(16,33.7,.47,1.3,s==='angel'?`url(#${id}-pearl)`:fill,s==='angel'?'#b4c2d0':d,.14);
  }
  function renderRear(category,value,id='qpa-rear-preview'){
    if(!value||!['hat','ear','neck','back'].includes(category))return '';
    const {shape,color,dark,light}=colors(category,value);if(!catalog[category].includes(shape))return '';
    const paint=category==='hat'?rearHatArt(shape,color,dark,light,id):category==='neck'?rearNeckArt(shape,color,dark,light,id):category==='back'?rearBackArt(shape,color,dark,light,id):`<g transform="translate(6.8 24.8)">${earArt(shape,color,dark,light,id)}</g><g transform="translate(25.2 24.8)">${earArt(shape,color,dark,light,id)}</g>`;
    return gradients(id,color,dark,light,paint)+paint;
  }
  function render(category,value,id='qpa-preview'){
    if(!value||!painters[category])return '';
    const {shape,color,dark,light}=colors(category,value);if(!catalog[category].includes(shape))return '';
    const paint=painters[category](shape,color,dark,light,id);
    return gradients(id,color,dark,light,paint)+paint;
  }
  function renderBackStrap(value,id){
    const {shape,color,dark,light}=colors('back',value);if(shape!=='bag')return '';
    // Only the near strap lies over the chest. The pack and far strap remain
    // behind the torso, all carried by the same upper-body pose.
    const paint=line('M14.4 29.2Q16.55 29.35 17.05 31.3L16.55 34.75Q15.75 36.4 14.35 36.7',dark,.64)+line('M14.4 29.2Q16.55 29.35 17.05 31.3L16.55 34.75Q15.75 36.4 14.35 36.7',color,.38)+quiet(line('M14.8 29.35Q16.3 29.65 16.75 31.2L16.3 33.25',light,.12),.7)+path('M16.25 33.1L16.9 33.2L16.75 34.2L16.1 34.05Z',`url(#${id}-metal)`,dark,.09);
    return gradients(id,color,dark,light,paint)+paint;
  }
  function avatar(svg,pose){try{return JSON.parse(decodeURIComponent(pose.head.dataset.qpxHead||svg.querySelector('.qpx-hair')?.dataset.qpxHead||''));}catch{return {};}}
  function originalNodes(r){
    // Direction owns the complete frontal head's visibility. Its first apply
    // may already have hidden those nodes: recording "hidden" here would make
    // a later wave restore invisible jewelry. Only body accessories are ours.
    const all=[...r.svg.querySelectorAll('[data-qpx-body-accessory]')];
    for(const el of all)if(!el.closest('[data-qpx-accessory-profile]')&&!r.originals.has(el))r.originals.set(el,el.getAttribute('visibility'));
  }
  function prepare(svg,pose){
    if(!svg||!pose?.head||!pose?.upper)return null;
    let r=rigs.get(svg);
    if(r){r.pose=pose;if(r.head.parentNode!==pose.head){pose.head.append(r.head);originalNodes(r);}if(r.rearHead.parentNode!==pose.head)pose.head.append(r.rearHead);if(r.backStrap.parentNode!==pose.upper)pose.upper.insertBefore(r.backStrap,r.neck.parentNode===pose.upper?r.neck:null);if(r.neck.parentNode!==pose.upper)pose.upper.append(r.neck);if(r.rearBody.parentNode!==pose.upper)pose.upper.append(r.rearBody);if(r.back.parentNode!==r.backParent)r.backParent.append(r.back);if(r.rearAmbient.parentNode!==r.backParent)r.backParent.append(r.rearAmbient);return r;}
    const av=avatar(svg,pose),uid='qpa-'+(++serial),head=node('g',{'data-qpx-accessory-profile':'head',style:'display:none'}),neck=node('g',{'data-qpx-accessory-profile':'neck',style:'display:none'}),back=node('g',{'data-qpx-accessory-profile':'back',style:'display:none'}),backStrap=node('g',{'data-qpx-accessory-profile':'back-strap',style:'display:none'}),headGroups={};
    for(const cat of ['face','glass','ear','hat']){const el=node('g',{'data-qpx-accessory-category':cat,'data-qpx-accessory-shape':String(av[cat]||'').split(':')[0]});el.innerHTML=render(cat,av[cat],uid+'-'+cat);head.append(el);headGroups[cat]=el;}
    for(const [cat,el]of[['neck',neck],['back',back]]){el.dataset.qpxAccessoryCategory=cat;el.dataset.qpxAccessoryShape=String(av[cat]||'').split(':')[0];el.innerHTML=render(cat,av[cat],uid+'-'+cat);}
    backStrap.innerHTML=renderBackStrap(av.back,uid+'-back-strap');
    const backOriginal=svg.querySelector('[data-qpx-body-accessory="back"]'),bodyRoot=pose.body.closest('[data-qpx-direction-part="body-profile"]')||pose.body;
    const backParent=backOriginal?.parentNode||bodyRoot.parentNode;
    pose.head.append(head);pose.upper.append(backStrap,neck);if(backOriginal)backParent.insertBefore(back,backOriginal.nextSibling);else backParent.insertBefore(back,bodyRoot);
    const rearHead=node('g',{'data-qpx-accessory-back':'head',style:'display:none'}),rearBody=node('g',{'data-qpx-accessory-back':'body',style:'display:none'}),rearAmbient=node('g',{'data-qpx-accessory-back':'ambient',style:'display:none'});
    for(const cat of['ear','hat']){const el=node('g',{'data-qpx-rear-accessory-category':cat,'data-qpx-accessory-shape':String(av[cat]||'').split(':')[0]});el.innerHTML=renderRear(cat,av[cat],uid+'-rear-'+cat);rearHead.append(el);}
    for(const cat of['neck','back']){const el=node('g',{'data-qpx-rear-accessory-category':cat,'data-qpx-accessory-shape':String(av[cat]||'').split(':')[0]});el.innerHTML=renderRear(cat,av[cat],uid+'-rear-'+cat);(cat==='back'&&String(av.back||'').startsWith('halo:')?rearAmbient:rearBody).append(el);}
    pose.head.append(rearHead);pose.upper.append(rearBody);if(backOriginal)backParent.insertBefore(rearAmbient,backOriginal);else backParent.insertBefore(rearAmbient,bodyRoot);
    r={svg,pose,uid,av,head,neck,back,backStrap,rearHead,rearBody,rearAmbient,backParent,headGroups,originals:new Map(),profile:false,view:'front',anchorKey:''};rigs.set(svg,r);originalNodes(r);return r;
  }
  function placeHead(r,anchors){
    if(!r.defaultEye){
      const painted=r.pose.head.querySelector('[data-qpx-profile-eye-x]');
      if(painted)r.defaultEye=[Number(painted.dataset.qpxProfileEyeX),Number(painted.dataset.qpxProfileEyeY)];
      else {
        const lid=r.pose.head.querySelector('[data-qpx-profile-eye="closed"] path');
        const points=lid?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
        // This fallback reads the painted eyelid's actual eye center, never
        // assumes the same eye position for all twenty-four hairstyles.
        if(points?.length>=6)r.defaultEye=[points[2],points[1]-.45];
      }
    }
    const eye=anchors?.eye||r.defaultEye||[21,22];
    const ear=anchors?.ear||[eye[0]-8.4,eye[1]+2.2],crown=anchors?.crown||[16,7.8];
    const key=[...eye,...ear,...crown].join('/');if(key===r.anchorKey)return;r.anchorKey=key;
    attr(r.headGroups.glass,'transform',`translate(${eye[0]} ${eye[1]})`);
    const face=String(r.av.face||'').split(':')[0];
    const faceY=['mus','beard','goatee','stubble'].includes(face)?-2.25:face==='tear'?0:face==='mask'?-1.25:-1.5;
    attr(r.headGroups.face,'transform',`translate(${eye[0]} ${eye[1]+faceY})`);
    attr(r.headGroups.ear,'transform',`translate(${ear[0]} ${ear[1]})`);
    attr(r.headGroups.hat,'transform',`translate(${crown[0]-14} ${crown[1]-8.5})`);
    r.head.dataset.qpxAccessoryEye=eye.join(',');r.head.dataset.qpxAccessoryEar=ear.join(',');
  }
  function restore(r){for(const [el,visibility]of r.originals)if(el.isConnected||r.svg.contains(el))attr(el,'visibility',visibility);}
  function apply(svg,options,pose){
    const r=prepare(svg,pose);if(!r)return false;const profile=!!options?.profile,backView=!!options?.backView,view=profile?'profile':backView?'back':'front';
    if(view!==r.view){r.view=view;r.profile=profile;for(const el of[r.head,r.neck,r.back,r.backStrap])el.style.display=profile?'':'none';for(const el of[r.rearHead,r.rearBody,r.rearAmbient])el.style.display=backView?'':'none';if(view==='front')restore(r);}
    if(view!=='front')for(const [el]of r.originals)attr(el,'visibility','hidden');
    if(profile){placeHead(r,options.anchors);attr(r.back,'transform',pose.upper.getAttribute('transform'));}
    if(backView)attr(r.rearAmbient,'transform',pose.upper.getAttribute('transform'));
    if(svg.dataset.qpxAccessoryView!==view)svg.dataset.qpxAccessoryView=view;return profile;
  }
  function reset(svg){const r=rigs.get(svg);if(!r)return false;r.profile=false;r.view='front';for(const el of[r.head,r.neck,r.back,r.backStrap,r.rearHead,r.rearBody,r.rearAmbient])el.style.display='none';restore(r);svg.removeAttribute('data-qpx-accessory-view');return true;}
  function destroy(svg){const r=rigs.get(svg);if(!r)return false;reset(svg);for(const el of[r.head,r.neck,r.back,r.backStrap,r.rearHead,r.rearBody,r.rearAmbient])el.remove();rigs.delete(svg);return true;}
  window.QPAvatarAccessoryDirection=Object.freeze({catalog,render,renderRear,prepare,apply,reset,destroy});
})();
