import {createWoodlandAtlas} from './woodland-atlas.mjs';

// Only construction-time work. One alpha-tested material is shared with tree
// crowns; each spatial chunk is one draw, even with hundreds of small flowers.
export function createWoodlandFlora(THREE,scene,resources,{chunkSize=28,name='woodland-flora'}={}){
  const atlas=createWoodlandAtlas(THREE,resources),bins=new Map(),matrix=new THREE.Matrix4(),p=new THREE.Vector3(),s=new THREE.Vector3(),e=new THREE.Euler(),q=new THREE.Quaternion(),v=new THREE.Vector3(),color=new THREE.Color();
  const stats={cards:0,triangles:0,batches:0,textures:1,frameUpdates:0,lights:0};
  function card(tile,x,y,z,width,height,yaw=0,tilt=0,tint=0xffffff){
    const geometry=atlas.cardGeometry(tile,{curve:.1}),key=`${Math.floor(x/chunkSize)}:${Math.floor(z/chunkSize)}`;
    let b=bins.get(key);if(!b){b={position:[],uv:[],color:[]};bins.set(key,b);}
    p.set(x,y,z);s.set(width,height,width);e.set(tilt,yaw,Math.sin(yaw)*.07,'YXZ');q.setFromEuler(e);matrix.compose(p,q,s);color.setHex(tint);
    const a=geometry.attributes.position,u=geometry.attributes.uv,index=geometry.index;
    for(let i=0;i<index.count;i++){const k=index.getX(i);v.fromBufferAttribute(a,k).applyMatrix4(matrix);b.position.push(v.x,v.y,v.z);b.uv.push(u.getX(k),u.getY(k));b.color.push(color.r,color.g,color.b);}
    stats.cards++;stats.triangles+=index.count/3;
  }
  function clump(x,z,size=1,seed=1,{flowers=true,shrub=false}={}){
    let state=seed>>>0;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    if(shrub)for(let j=0;j<3;j++)card('shrub',x+(random()-.5)*size,.47*size,z+(random()-.5)*size,1.6*size,1.05*size,j*Math.PI/3,.04,0xd2d6a9);
    for(let i=0;i<8;i++){
      const angle=random()*6.28,r=Math.sqrt(random())*size*.75,xx=x+Math.cos(angle)*r,zz=z+Math.sin(angle)*r,height=size*(.43+random()*.28);
      const tile=flowers&&i%3===0?(i%2?'coralFlowers':'whiteFlowers'):(i%4===1?'fern':'grass');
      card(tile,xx,height*.46,zz,height*(1.15+random()*.6),height,random()*Math.PI,.02+random()*.08,[0xf0edd5,0xd8dfb7,0xffffe4][i%3]);
    }
  }
  function build(){
    for(const [key,b] of bins){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(b.color,3));geometry.computeBoundingSphere();resources.add(geometry);
      const mesh=new THREE.Mesh(geometry,atlas.material);mesh.name=name+'-'+key;mesh.matrixAutoUpdate=false;mesh.updateMatrix();scene.add(mesh);
    }
    stats.batches=bins.size;bins.clear();return stats;
  }
  return {card,clump,build,stats,atlas};
}
