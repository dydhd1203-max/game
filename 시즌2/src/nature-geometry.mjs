// Shared static scenery primitives. Leaf sprays have a serrated outline and
// overlapping folded surfaces; rocks have fractured faces and surface moss.
// Every shape owns position/normal/color attributes. Callers own disposal.
export function createNatureGeometries(THREE){
  function mesh(vertices,indices,kind='plain'){
    const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));indexed.setIndex(indices);
    const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();
    const p=g.attributes.position,n=g.attributes.normal,colors=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ny=n.getY(i);
      if(kind==='rock'){
        // Moss follows a broken patch across upward stone facets. It is vertex
        // colour in the rock itself, never a separate green plate or extra draw.
        const patch=Math.sin(x*13+z*7)*Math.cos(z*11-y*4)+Math.sin(x*5-z*17)*.35;
        const moss=Math.max(0,Math.min(.72,(ny-.12)*1.2))*Math.max(0,Math.min(1,(patch+.45)*1.2));
        const grain=.91+.09*Math.sin(x*19+y*13+z*23)**2;
        colors.push(grain*(1-moss*.35),grain*(1-moss*.1),grain*(1-moss*.45));
      }else if(kind==='leaf'){
        const shade=.9+.1*Math.max(0,ny);colors.push(shade*.99,shade,shade*.94);
      }else colors.push(1,1,1);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  const lp=[],li=[];
  const outline=[[-.54,.04],[-.28,-.16],[-.28,-.48],[.08,-.26],[.4,-.43],[.28,-.02],[.52,.25],[-.03,.23],[-.2,.49],[-.2,.2]];
  function spray(cx,cy,cz,angle,size){
    const base=lp.length/3,co=Math.cos(angle),si=Math.sin(angle),n=outline.length;
    for(let layer=0;layer<2;layer++)for(let i=0;i<n;i++){
      const [ox,oz]=outline[i],inset=layer?1:.83;
      const x=ox*inset+(layer?0:.035),z=oz*inset-(layer?0:.025);
      // Unequal lifted tips and a sloping lower shoulder make a solid crown
      // lobe. A tall, off-centre peak removes the old flat shelf silhouette.
      const yy=layer?.075+Math.sin(i*1.9)*.075+ox*.13+oz*.08:-.07+Math.sin(i*1.9)*.026+ox*.05;
      lp.push(cx+(x*co+z*si)*size,cy+yy*size,cz+(-x*si+z*co)*size);
    }
    const bottom=lp.length/3;lp.push(cx+.095*size,cy-.19*size,cz-.065*size);
    const top=lp.length/3;lp.push(cx-.14*size,cy+.56*size,cz+.07*size);
    for(let i=0;i<n;i++){
      const j=(i+1)%n;li.push(top,base+n+j,base+n+i,bottom,base+i,base+j,base+i,base+n+i,base+n+j,base+i,base+n+j,base+j);
    }
  }
  spray(-.11,0,.055,-.31,.86);spray(.16,.075,-.105,1.82,.66);
  const leaf=mesh(lp,li,'leaf');
  const rp=[],ri=[],n=7;
  const radii=[.46,.53,.39,.5,.44,.54,.41],levels=[[-.5,.84,-.045,.04],[-.16,1,.015,-.025],[.36,.69,.045,.015]];
  for(let j=0;j<levels.length;j++)for(let i=0;i<n;i++){
    const [y,s,dx,dz]=levels[j],a=i*Math.PI*2/n;
    rp.push(Math.cos(a)*radii[i]*s+dx,y+(j===0?0:Math.sin(i*2.31+j)*.075),Math.sin(a)*radii[i]*s+dz);
  }
  for(let j=0;j<2;j++)for(let i=0;i<n;i++){
    const k=(i+1)%n,a=j*n+i,b=j*n+k,c=(j+1)*n+i,d=(j+1)*n+k;ri.push(a,c,b,b,c,d);
  }
  for(let i=1;i<n-1;i++){ri.push(0,i,(i+1));ri.push(n*2,n*2+i+1,n*2+i);}
  const rock=mesh(rp,ri,'rock');
  const stem=new THREE.CylinderGeometry(.19,.5,1,6);
  stem.setAttribute('color',new THREE.Float32BufferAttribute(new Array(stem.attributes.position.count*3).fill(1),3));stem.computeBoundingBox();
  const fp=[],fi=[];
  for(let j=0;j<7;j++){
    const a=j*Math.PI*2/7+.11*Math.sin(j*2),co=Math.cos(a),si=Math.sin(a),base=fp.length/3,len=.43+.13*Math.sin(j*1.8)**2;
    fp.push(0,0,0,co*.25-si*.12,.22,si*.25+co*.12,co*len,.1,si*len,co*.25+si*.12,.22,si*.25-co*.12,co*.23,.34,si*.23);
    fi.push(base,base+1,base+4,base+1,base+2,base+4,base+2,base+3,base+4,base+3,base,base+4);
  }
  const fern=mesh(fp,fi,'leaf');
  return {leaf,rock,stem,fern};
}
