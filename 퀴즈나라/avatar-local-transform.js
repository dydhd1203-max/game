/* Relative rig coordinates without forcing browser layout between SVG writes.
 * Posed rig groups use SVG transform attributes; camera/root CSS cancels at
 * their common ancestor. Unknown CSS/nested viewports retain the native path. */
(() => {
  'use strict';
  const cache=new WeakMap();
  function local(element){
    if(element.localName==='svg'||element.style?.transform)return null;
    const source=element.getAttribute('transform')||'',old=cache.get(element);
    if(old?.source===source)return old.matrix;
    if(element.querySelector?.(':scope > animateTransform'))return null;
    let matrix=new DOMMatrix();
    const list=element.transform?.baseVal;
    if(list)for(let i=0;i<list.numberOfItems;i++)matrix=matrix.multiply(list.getItem(i).matrix);
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
      let matrix=new DOMMatrix();
      for(let node=element;node!==common;node=node.parentNode){const part=local(node);if(!part)return null;matrix=part.multiply(matrix);}
      return matrix;
    };
    const a=chain(from),b=chain(to);return a&&b?b.inverse().multiply(a):measured(from,to);
  }
  window.QPAvatarLocalTransform=Object.freeze({relative});
})();
