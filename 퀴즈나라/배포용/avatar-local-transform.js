/* Relative rig coordinates without forcing browser layout between SVG writes.
 * Posed rig groups use SVG transform attributes; camera/root CSS cancels at
 * their common ancestor. Unknown CSS/nested viewports retain the native path. */
(() => {
  'use strict';
  const cache=new WeakMap();
  const identity=()=>[1,0,0,1,0,0];
  const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  function local(element){
    if(element.localName==='svg'||element.style?.transform)return null;
    const source=element.getAttribute('transform')||'',old=cache.get(element);
    if(old?.source===source)return old.matrix;
    for(let child=element.firstElementChild;child;child=child.nextElementSibling)if(child.localName==='animateTransform')return null;
    let matrix=identity();
    const list=element.transform?.baseVal;
    if(list)for(let i=0;i<list.numberOfItems;i++){const m=list.getItem(i).matrix;matrix=multiply(matrix,[m.a,m.b,m.c,m.d,m.e,m.f]);}
    cache.set(element,{source,matrix});return matrix;
  }
  function measured(from,to){
    const a=from?.getCTM?.(),b=to?.getCTM?.();return a&&b?b.inverse().multiply(a):null;
  }
  function relative(from,to){
    if(!from||!to)return null;
    if(from===to)return new DOMMatrix();
    const ancestors=new Set();
    for(let node=from;node;node=node.parentNode){ancestors.add(node);if(node.localName==='svg')break;}
    let common=to;
    while(common&&!ancestors.has(common)){if(common.localName==='svg')return measured(from,to);common=common.parentNode;}
    if(!common)return measured(from,to);
    const chain=element=>{
      let matrix=identity();
      for(let node=element;node!==common;node=node.parentNode){const part=local(node);if(!part)return null;matrix=multiply(part,matrix);}
      return matrix;
    };
    const a=chain(from),b=chain(to);if(!a||!b)return measured(from,to);
    const determinant=b[0]*b[3]-b[1]*b[2];if(!determinant)return measured(from,to);
    const inverse=[b[3]/determinant,-b[1]/determinant,-b[2]/determinant,b[0]/determinant,(b[2]*b[5]-b[3]*b[4])/determinant,(b[1]*b[4]-b[0]*b[5])/determinant];
    return new DOMMatrix(multiply(inverse,a));
  }
  window.QPAvatarLocalTransform=Object.freeze({relative});
})();
