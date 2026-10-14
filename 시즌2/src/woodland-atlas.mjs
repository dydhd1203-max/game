// One painted cutout atlas for trees, shrubs and flowers. Generated once; no
// image request, transparent sorting, wind animation or extra lighting pass.
const cache=new WeakMap();
export const WOODLAND_TILES=Object.freeze({crown:0,crownLight:1,pine:2,shrub:3,grass:4,whiteFlowers:5,coralFlowers:6,fern:7});

export function createWoodlandAtlas(THREE,resources){
  if(cache.has(resources))return cache.get(resources);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d'),tile=256;
  let seed=81317;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const ellipse=(x,y,rx,ry,angle,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fill();};
  function stroke(points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.stroke();}
  function leaf(x,y,len,w,angle,color){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-len*.5,0);ctx.quadraticCurveTo(-len*.15,-w,len*.5,0);ctx.quadraticCurveTo(len*.1,w,-len*.5,0);ctx.fill();ctx.restore();
  }
  function broadleaf(light=false,shrub=false){
    const palettes=light?['#547540','#406536','#769249','#355730','#8ea459']:['#33573b','#426b43','#65834b','#25482f','#7b9356'];
    // Off-centre, unequal boughs; a lobed perimeter retains leaf-sized gaps.
    const lobes=shrub?[[69,163,44,60],[143,111,64,78],[198,175,41,56],[119,185,58,43]]:[[50,153,37,43],[75,87,44,50],[128,67,42,49],[177,89,51,47],[207,139,37,46],[159,158,55,51],[102,171,45,37]];
    for(const [x,y,rx,ry] of lobes){
      ellipse(x,y,rx,ry,.12,palettes[3]);
      for(let k=0;k<23;k++){
        const a=random()*Math.PI*2,r=Math.sqrt(random())*.93,xx=x+Math.cos(a)*r*rx,yy=y+Math.sin(a)*r*ry;
        ellipse(xx,yy,10+random()*15,7+random()*10,random()*Math.PI,palettes[k%3]);
      }
    }
    // Dry-brush strokes and small attached leaves break the broad colour fields.
    ctx.save();ctx.globalCompositeOperation='source-atop';
    for(let i=0;i<1350;i++){
      const x=14+random()*227,y=15+random()*218;
      leaf(x,y,2+random()*8,1+random()*2.5,-.7+random()*1.9,palettes[(i+(y<110?2:0))%5]);
    }
    for(let i=0;i<430;i++){ctx.globalAlpha=.2;ctx.fillStyle=i%2?'#8ba463':'#163528';ctx.fillRect(random()*256,random()*256,.6+random()*1.3,.6+random()*2);}
    ctx.restore();
    for(let i=0;i<80;i++){
      const l=lobes[i%lobes.length],a=random()*6.28,x=l[0]+Math.cos(a)*l[2],y=l[1]+Math.sin(a)*l[3];
      leaf(x,y,5+random()*7,2+random()*2,a,palettes[i%5]);
    }
  }
  function pine(){
    stroke([[128,244],[126,18]],'#5d6346',5);
    for(let tier=0;tier<9;tier++){
      const y=41+tier*20,span=(13+tier*10.4)*(.87+random()*.24);
      for(const side of [-1,1]){
        stroke([[127,y-18],[127+side*span,y+17]],'#495f43',3);
        for(let k=0;k<11;k++){
          const d=k/10,xx=127+side*span*d,yy=y+17*d+(random()-.5)*7;
          ctx.fillStyle=['#33513b','#426643','#59754b'][tier%3];ctx.beginPath();
          ctx.moveTo(xx-side*15,yy+13);ctx.lineTo(xx-side*5,yy+1);ctx.lineTo(xx-side*7,yy-6);ctx.lineTo(xx,yy-14-11*(1-d));ctx.lineTo(xx+side*5,yy-5);ctx.lineTo(xx+side*4,yy+2);ctx.lineTo(xx+side*(12+random()*9),yy+20);ctx.lineTo(xx+side*3,yy+14);ctx.lineTo(xx-side*3,yy+11);ctx.fill();
          for(let j=0;j<5;j++)leaf(xx+(random()-.5)*20,yy+(random()-.5)*27,6+random()*10,1.1,side*.66,['#718b57','#456b46','#294d3b'][j%3]);
        }
      }
    }
  }
  function grass(){
    for(let i=0;i<56;i++){
      const x=28+random()*200,root=241-random()*16,tipX=x+(random()-.5)*75,tipY=53+random()*150,w=2+random()*6;
      ctx.fillStyle=['#526c37','#788846','#385d35','#8d9c50'][i%4];ctx.beginPath();ctx.moveTo(x-w,root);ctx.quadraticCurveTo(x+(tipX-x)*.23,tipY+30,tipX,tipY);ctx.quadraticCurveTo(x+(tipX-x)*.5,tipY+50,x+w,root);ctx.fill();
    }
    for(let i=0;i<21;i++)leaf(30+random()*190,194+random()*39,17+random()*17,4,random()*6.28,['#4e733e','#7b9651','#335b34'][i%3]);
  }
  function flowers(coral=false){
    grass();
    for(let i=0;i<13;i++){
      const x=24+random()*206,y=30+random()*129,rootX=128+(x-128)*.6;
      stroke([[rootX,241],[(rootX+x)*.5,y+42],[x,y]],'#59763a',2);
      leaf((rootX+x)*.5+5,y+50,22,5,-.7,'#789043');leaf((rootX+x)*.5-6,y+78,19,5,.6,'#627e3e');
      const size=coral?5.8+random()*3.9:3.6+random()*2.8,petals=coral?5:6;
      for(let p=0;p<petals;p++){const a=p*Math.PI*2/petals;ellipse(x+Math.cos(a)*size*.8,y+Math.sin(a)*size*.8,size*.66,size*.46,a,coral?['#dd8069','#e5aa76','#c76658'][i%3]:['#f1e9c5','#e5e4c4','#f4df99'][i%3]);}
      ellipse(x,y,size*.35,size*.35,0,coral?'#edc074':'#b7a047');
    }
  }
  function fern(){
    for(let f=0;f<9;f++){
      const angle=(f-4)*.24,len=122+random()*85,bx=126,by=241;
      const tipX=bx+Math.sin(angle)*len,tipY=by-Math.cos(angle)*len;
      stroke([[bx,by],[(bx+tipX)*.5,tipY+len*.45],[tipX,tipY]],'#718248',2);
      for(let k=1;k<13;k++){
        const t=k/13,x=bx+(tipX-bx)*t,y=by+(tipY-by)*t,span=Math.sin(t*Math.PI)*18;
        for(const side of [-1,1])leaf(x+side*span*.4,y+4,span*1.4,2.8,side*.43+angle,['#3e673d','#6c8546','#315934'][(k+f)%3]);
      }
    }
  }
  for(let i=0;i<8;i++){
    ctx.save();ctx.translate(i%4*tile,Math.floor(i/4)*tile);ctx.beginPath();ctx.rect(3,3,250,250);ctx.clip();
    if(i<2)broadleaf(i===1);else if(i===2)pine();else if(i===3)broadleaf(true,true);else if(i===4)grass();else if(i<7)flowers(i===6);else fern();ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=2;resources.add(texture);
  // Baked painted light preserves warm tops/dark undersides without the harsh
  // black back faces of lit paper cards. Fog still shades distant layers.
  const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.42,alphaToCoverage:true,side:THREE.DoubleSide,vertexColors:true,fog:true});
  material.name='woodland-painted-cutouts';resources.add(material);
  const geometries=new Map();
  function cardGeometry(name,{crossed=false,curve=.09}={}){
    const key=`${name}:${crossed}:${curve}`;if(geometries.has(key))return geometries.get(key);
    const tileId=WOODLAND_TILES[name]??0,positions=[],uvs=[],indices=[],normals=[],colors=[],planes=crossed?3:1;
    const u0=(tileId%4*256+3)/1024,u1=(tileId%4*256+253)/1024,v0=1-(Math.floor(tileId/4)*256+253)/512,v1=1-(Math.floor(tileId/4)*256+3)/512;
    for(let plane=0;plane<planes;plane++){
      const angle=plane*Math.PI/3,co=Math.cos(angle),si=Math.sin(angle),base=positions.length/3;
      for(let y=0;y<=2;y++)for(let x=0;x<=3;x++){
        const xx=x/3-.5,yy=y/2-.5,zz=(1-xx*xx*4)*curve*(.65+yy*.4);
        positions.push(xx*co+zz*si,yy,-xx*si+zz*co);normals.push(si,0,co);colors.push(1,1,1);uvs.push(u0+(u1-u0)*x/3,v0+(v1-v0)*y/2);
      }
      for(let y=0;y<2;y++)for(let x=0;x<3;x++){const a=base+y*4+x;indices.push(a,a+1,a+4,a+1,a+5,a+4);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingSphere();resources.add(geometry);geometries.set(key,geometry);return geometry;
  }
  const api={texture,material,cardGeometry};cache.set(resources,api);return api;
}
