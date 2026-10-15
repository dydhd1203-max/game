/* Local, isolated preview. This adapter is never enabled on the real game URL. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('demo')!=='1') return;
  const session=params.get('session')||'playground';
  const storageKey='qp_preview_v4_'+session;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(storageKey):null;
  const listeners=new Set();
  // Optional regression mode mirrors Firebase's cache lifetime: once() does
  // not retain a view, and a transaction can start with null without a loaded
  // value listener. This remains isolated from the real database.
  const cache={mode:params.get('cache')==='cold'?'cold':'warm',coldStarts:0};
  const hasLoadedView=p=>[...listeners].some(l=>l.loaded&&(p===l.path||p.startsWith(l.path+'/')));
  const copy=v=>v==null?null:JSON.parse(JSON.stringify(v));
  const bank={
    demo_quiz:{title:'우리 함께 · 상식 퀴즈',qs:[
      {q:'밤하늘에서 지구 주위를 도는 천체는?',a:'달'},
      {q:'물이 얼어서 단단해진 것을 뭐라고 할까요?',a:'얼음'},
      {q:'나무가 햇빛을 받아 양분을 만드는 과정은?',a:'광합성'},
      {q:'대한민국의 수도는 어디일까요?',a:'서울/서울특별시'},
      {q:'봄 다음에 오는 계절은?',a:'여름'},
      {q:'멍멍 짖는 우리 집 반려동물은?',a:'강아지/개'},
      {q:'책을 빌려 읽을 수 있는 곳은?',a:'도서관'},
      {q:'1년은 모두 몇 개월일까요?',a:'12/12개월/열두/열두개월'}]},
    demo_ox:{title:'모두 끝까지 · OX 퀴즈',qs:[
      {q:'지구는 태양 주위를 돈다.',a:'O'},
      {q:'고래는 물고기이다.',a:'X'},
      {q:'일 년은 12개월이다.',a:'O'},
      {q:'오각형에는 꼭짓점이 6개 있다.',a:'X'},
      {q:'펭귄은 새이다.',a:'O'},
      {q:'거미는 다리가 6개이다.',a:'X'}]}
  };
  function initial(){return {quiz:{bank,users:{}}};}
  let tree;
  function reload(){try{tree=JSON.parse(localStorage.getItem(storageKey))||initial();}catch{tree=initial();}}
  reload();
  function valueAt(p){if(p==='.info/serverTimeOffset')return 0;return p.split('/').filter(Boolean).reduce((v,k)=>v==null?null:v[k],tree)??null;}
  function writeAt(p,v){const a=p.split('/').filter(Boolean);if(!a.length){tree=copy(v)||{};return;}let obj=tree;for(const k of a.slice(0,-1)){if(!obj[k]||typeof obj[k]!=='object')obj[k]={};obj=obj[k];}if(v==null)delete obj[a.at(-1)];else obj[a.at(-1)]=copy(v);}
  function snapshot(p,v=valueAt(p)) {const saved=copy(v);return {key:p.split('/').at(-1)||null,val:()=>copy(saved),exists:()=>saved!=null,numChildren:()=>saved&&typeof saved==='object'?Object.keys(saved).length:0,child(k){return snapshot(p+'/'+k,saved&&saved[k]);},forEach(fn){for(const k of Object.keys(saved||{})){if(fn(snapshot(p+'/'+k,saved[k]))===true)break;}}};}
  function notify(){for(const l of [...listeners]){const s=JSON.stringify(valueAt(l.path));if(s!==l.last){l.last=s;queueMicrotask(()=>{if(listeners.has(l))l.cb(snapshot(l.path));});}}}
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(tree));}catch{}channel?.postMessage('update');notify();}
  channel && (channel.onmessage=()=>{reload();notify();});
  addEventListener('storage',e=>{if(e.key===storageKey){reload();notify();}});
  const locked=fn=>navigator.locks?navigator.locks.request(storageKey,fn):Promise.resolve().then(fn);
  class Ref {
    constructor(p){this.path=p.replace(/^\/+|\/+$/g,'');this.key=this.path.split('/').at(-1)||null;}
    child(k){return new Ref(this.path+'/'+k);}
    on(event,cb){if(event!=='value')throw new Error('Preview supports value listeners');const l={path:this.path,cb,loaded:false,last:JSON.stringify(valueAt(this.path))};listeners.add(l);queueMicrotask(()=>{if(listeners.has(l)){l.loaded=true;cb(snapshot(this.path));}});return cb;}
    off(event,cb){for(const l of listeners)if(l.path===this.path&&(!cb||l.cb===cb))listeners.delete(l);}
    once(){reload();return Promise.resolve(snapshot(this.path));}
    set(v,cb){return locked(()=>{reload();writeAt(this.path,v);persist();cb?.(null);}).then(()=>undefined);}
    update(patch,cb){return locked(()=>{reload();for(const [k,v] of Object.entries(patch))writeAt(this.path+'/'+k,v);persist();cb?.(null);}).then(()=>undefined);}
    remove(cb){return this.set(null,cb);}
    transaction(fn,complete){return locked(()=>{reload();const cold=cache.mode==='cold'&&!hasLoadedView(this.path);if(cold)cache.coldStarts++;const current=cold?null:copy(valueAt(this.path)),next=fn(current);const committed=next!==undefined;if(committed){writeAt(this.path,next);persist();}const result={committed,snapshot:snapshot(this.path)};complete?.(null,committed,result.snapshot);return result;});}
    onDisconnect(){return {remove:()=>Promise.resolve(),cancel:()=>Promise.resolve(),set:()=>Promise.resolve(),update:()=>Promise.resolve()};}
    push(v){const r=this.child('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));if(v!==undefined)r.set(v);return r;}
    orderByChild(){return this;}
    limitToLast(){return this;}
  }
  const db={ref:p=>new Ref(p),goOffline(){},goOnline(){}};
  const database=()=>db;
  database.ServerValue={TIMESTAMP:{'.sv':'timestamp'},increment:n=>n};
  window.firebase={apps:[],initializeApp(){this.apps.push({});return{};},database};
  window.QPDemo={db,bank,storageKey,session,cache};

  addEventListener('DOMContentLoaded',async()=>{
    if(!window.QPGame){console.warn('QPGame preview hooks are missing');return;}
    const game=window.QPGame;
    game.initFB();
    const role=params.get('role')||'student';
    game.setBank?.(bank);
    // role=admin (or the older role=teacher) logs in the demo operator account 선생님 and shows the 운영자 tab.
    const admin=role==='admin'||role==='teacher';
    if(admin)await game.enterAdmin();
    else{
      const name=params.get('user')||'하늘';
      const key='demo_'+name;
      let user=(await db.ref('quiz/users/'+key).once()).val();
      if(!user){
        const av=game.newAvatar('f');
        Object.assign(av,{sk:0,hair:'bob:1',top:'hood:7',bottom:'skirt:7',shoes:'sneaker:8',expression:'soft:0',pet:'cat:8',bg:'garden:4',frame:'garden:2',effect:'angel:0'});
        user={name,gold:1200,av,owned:{'expression:soft:0':1,'top:hood:7':1,'pet:cat:8':1,'bg:garden:4':1,'frame:garden:2':1,'effect:angel:0':1},stat:{solved:0,correct:0},day:{}};
        await db.ref('quiz/users/'+key).set(user);
      }
      game.enterUser(key,user);
    }
    const toolbar=document.createElement('div');
    toolbar.className='qp-demo-toolbar';
    toolbar.innerHTML='<strong>체험 모드</strong><button data-quizquiz>QUIZQUIZ</button><button data-shop>꾸미기</button><button data-hide aria-label="체험 메뉴 접기">⌄</button><small>체험 데이터는 이 브라우저에만 저장돼요</small>';
    const style=document.createElement('style');
    style.textContent='.qp-demo-toolbar{position:fixed;right:14px;bottom:12px;z-index:900;display:flex;gap:5px;align-items:center;flex-wrap:wrap;max-width:480px;padding:9px 12px;border:1px solid #d5c5e9;border-radius:15px;background:#fffaf1f5;box-shadow:0 5px 18px #41306020;font-size:11px;color:#675779}.qp-demo-toolbar button{padding:7px 10px;border-radius:9px;background:#ece2ff;font-weight:800;font-size:11px}.qp-demo-toolbar small{width:100%;color:#8c8499;font-size:10px}.qp-demo-toolbar.collapsed [data-mode],.qp-demo-toolbar.collapsed [data-shop],.qp-demo-toolbar.collapsed small{display:none}@media(max-width:600px){.qp-demo-toolbar{max-width:calc(100vw - 20px);right:10px;bottom:6px;padding:6px}}';
    document.head.appendChild(style);document.body.appendChild(toolbar);
    function collapse(){toolbar.classList.add('collapsed');toolbar.querySelector('[data-hide]').textContent='메뉴 열기';}
    toolbar.querySelector('[data-hide]').onclick=()=>{toolbar.classList.toggle('collapsed');toolbar.querySelector('[data-hide]').textContent=toolbar.classList.contains('collapsed')?'메뉴 열기':'접기';};
    toolbar.querySelector('[data-shop]').onclick=()=>{collapse();game.go('shop');};
    toolbar.querySelector('[data-quizquiz]').onclick=()=>{collapse();game.go('quizquiz');};
    document.addEventListener('click',event=>{if(event.target.closest('#mShop,#mQuiz,#tbShop,#tbQuiz'))collapse();},true);
    if(params.get('avatar')==='foundation'&&['campus','playground','village','forestgarden','treehouse','skyisland','picnicpark','autumnpark','camp','adventure'].includes(params.get('screen'))){
      const started=performance.now();
      try{
        await new Promise((resolve,reject)=>{const timer=setInterval(()=>{
          if(window.QPFoundationOutfit?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.ready&&window.QPAvatar?.atlas.ready&&window.QPAvatarDirection?.atlas.ready&&window.QPAvatarDirection.atlas.backReady){clearInterval(timer);resolve();}
          else if(performance.now()-started>60000){clearInterval(timer);reject(new Error('기준 몸 원화를 불러오지 못했어요. 새로고침해 주세요.'));}
        },50);});
        game.go(params.get('screen'));
      }catch(error){console.warn(error);window.QPGame.toast?.(error.message);}
    }
    if(params.get('avatar')!=='foundation'&&['campus','playground','village','forestgarden','treehouse','skyisland','picnicpark','autumnpark','camp','adventure'].includes(params.get('screen')))game.go(params.get('screen'));
    if(admin&&params.get('screen')==='teacher')game.go('teacher');
    window.addEventListener('beforeunload',()=>{channel?.close();});
  });
})();
