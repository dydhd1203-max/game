'use strict';
// Shared harness for the headless stage-3 guards (WP0): foundation-signature.cjs
// and verify-student-avatar-unchanged.cjs. Nothing here writes to a served tree.
//
//   const H=require('./verify-harness.cjs');
//   const tree=H.fsTree(root,{'avatar-pixel.js':'/scratch/avatar-pixel.js'}); // overlay = scratch copy served instead
//   const base=H.gitTree(repoDir,'origin/main','퀴즈나라/');                 // a commit, read straight from git objects
//   const server=await H.serve(tree);      // http://127.0.0.1:<free port>/, server.log lists every request
//   const browser=await H.launch();         // headless only, DETERMINISTIC_ARGS (or {args:H.RASTER_ARGS});
//                                           // QUIZ_BROWSER_EXECUTABLE picks the binary, QUIZ_BROWSER_ARGS overrides the flags
//   await H.isolate(context,report);        // Firebase stubbed/blocked, every non-local host blocked
//   H.png.decode(buffer) / H.png.encode({width,height,data}); H.sha256(x)
//
// The tools never move the mouse and never open a headed window.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.json':'application/json; charset=utf-8','.zip':'application/zip','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');

// A served path relative to the tree root, or null when it leaves the tree.
function relPath(p){const rel=path.posix.normalize(String(p).replace(/\\/g,'/').replace(/^\/+/,''));return !rel||rel==='.'||rel.startsWith('..')?null:rel;}
function readOverlay(overlay,rel){const file=overlay&&overlay[rel];return file?fs.readFileSync(file):undefined;}

// The working files (uncommitted changes included).
function fsTree(root,overlay={}){
  root=path.resolve(root);
  return{kind:'fs',root,overlay,label:root+(Object.keys(overlay).length?' + overlay '+Object.keys(overlay).join(','):''),
    async read(p){const rel=relPath(p);if(!rel)return null;const o=readOverlay(overlay,rel);if(o)return o;try{return await fs.promises.readFile(path.join(root,rel));}catch{return null;}}};
}
// A commit, read from git objects through one `git cat-file --batch` process:
// the same bytes a fresh worktree of that commit would hold, without
// registering a worktree or exporting the 400+ MB asset folder.
function gitTree(repo,rev,prefix,overlay={}){
  const sha=execFileSync('git',['rev-parse','--verify',rev+'^{commit}'],{cwd:repo}).toString().trim();
  prefix=prefix?prefix.replace(/\/?$/,'/'):'';let proc=null,chunks=[];const queue=[];
  function buffer(){if(chunks.length>1){chunks=[Buffer.concat(chunks)];}return chunks[0]||Buffer.alloc(0);}
  function pump(){
    while(queue.length){const buf=buffer(),nl=buf.indexOf(10);if(nl<0)return;const head=buf.subarray(0,nl).toString(),q=queue[0];
      if(/ missing$/.test(head)||/ ambiguous$/.test(head)){chunks=[buf.subarray(nl+1)];queue.shift();q.resolve(null);continue;}
      const m=head.match(/^[0-9a-f]+ (\w+) (\d+)$/);if(!m){queue.shift();q.reject(new Error('git cat-file: '+head));chunks=[buf.subarray(nl+1)];continue;}
      const n=Number(m[2]);if(buf.length<nl+1+n+1)return;const data=Buffer.from(buf.subarray(nl+1,nl+1+n));chunks=[buf.subarray(nl+2+n)];queue.shift();q.resolve(m[1]==='blob'?data:null);}
  }
  function start(){proc=spawn('git',['cat-file','--batch'],{cwd:repo,stdio:['pipe','pipe','inherit']});proc.stdout.on('data',d=>{chunks.push(d);pump();});proc.on('exit',()=>{proc=null;for(const q of queue.splice(0))q.reject(new Error('git cat-file exited'));});}
  return{kind:'git',repo,rev,sha,prefix,overlay,label:'git '+sha.slice(0,12)+':'+prefix+(Object.keys(overlay).length?' + overlay '+Object.keys(overlay).join(','):''),
    read(p){const rel=relPath(p);if(!rel)return Promise.resolve(null);const o=readOverlay(overlay,rel);if(o)return Promise.resolve(o);if(!proc)start();return new Promise((resolve,reject)=>{queue.push({resolve,reject});proc.stdin.write(sha+':'+prefix+rel+'\n');});},
    close(){if(proc){proc.stdin.end();proc=null;}}};
}
// Static server for one tree on a free local port. Every request is logged
// (path, query, status) so a tool can compare network logs.
function serve(tree){
  const log=[];
  return new Promise((resolve,reject)=>{
    const server=http.createServer(async(req,res)=>{
      let url;try{url=new URL(req.url,'http://127.0.0.1');decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
      let name=decodeURIComponent(url.pathname);if(name.endsWith('/'))name+='index.html';
      const data=await tree.read(name).catch(()=>null);log.push({path:name,search:url.search,status:data?200:404});
      if(!data){res.writeHead(404,{'Content-Type':'text/plain'}).end('File not found');return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(name).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    });
    server.on('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve({base:'http://127.0.0.1:'+server.address().port+'/',log,tree,close:()=>new Promise(r=>{server.closeAllConnections?.();server.close(()=>r());})}));
  });
}
const BROWSERS=['/opt/pw-browsers/chromium-1194/chrome-linux/chrome','/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell','/usr/bin/chromium'];
function browserExecutable(){return process.env.QUIZ_BROWSER_EXECUTABLE||BROWSERS.find(f=>fs.existsSync(f));}
// Pixel-identity runs. RASTER_ARGS: one raster thread and software raster, so the
// same DOM always rasterises to the same bytes (with parallel raster a downscaled
// image was off by one level in 1–7 pixels of 16 of 2376 R0 samples between runs);
// enough for still avatar grids. DETERMINISTIC_ARGS adds: every compositor stage
// and image decode finished before a frame is drawn, animations and scrolling on
// the main thread — for whole live game screens (about 3x slower on big grids).
const RASTER_ARGS=['--num-raster-threads=1','--disable-gpu-rasterization','--disable-partial-raster','--force-color-profile=srgb'];
const DETERMINISTIC_ARGS=[...RASTER_ARGS,'--run-all-compositor-stages-before-draw','--disable-checker-imaging','--disable-threaded-animation','--disable-threaded-scrolling'];
async function launch({args=DETERMINISTIC_ARGS}={}){const {chromium}=require('playwright');return chromium.launch({headless:true,executablePath:browserExecutable(),args:process.env.QUIZ_BROWSER_ARGS?process.env.QUIZ_BROWSER_ARGS.split(' ').filter(Boolean):args});}
// Isolated demo only: the Firebase SDK is stubbed, a Firebase data request is
// a failure, any other remote host is answered empty (and listed).
async function isolate(context,report){
  report.blocked??=[];report.errors??=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(['data:','blob:'].includes(u.protocol)||['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
    if(/firebaseio\.com|firebasedatabase\.app/.test(u.hostname)){report.errors.push('Firebase data request: '+u.href);return route.abort();}
    if(u.hostname==='www.gstatic.com'&&u.pathname.includes('/firebasejs/'))return route.fulfill({contentType:'text/javascript',body:'/* isolated demo */'});
    report.blocked.push(u.origin+u.pathname);return route.fulfill({status:200,body:''});
  });
}

// Minimal PNG codec (8-bit greyscale/RGB/palette/RGBA, no interlace): enough
// for browser screenshots and contact sheets without extra packages.
const png={
  decode(buf){
    if(buf.readUInt32BE(0)!==0x89504e47)throw Error('not a PNG');let off=8,width,height,depth,type,interlace,palette,trns;const idat=[];
    while(off<buf.length){const len=buf.readUInt32BE(off),kind=buf.toString('latin1',off+4,off+8),data=buf.subarray(off+8,off+8+len);off+=12+len;
      if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];interlace=data[12];}
      else if(kind==='PLTE')palette=data;else if(kind==='tRNS')trns=data;else if(kind==='IDAT')idat.push(data);else if(kind==='IEND')break;}
    if(depth!==8||interlace)throw Error('unsupported PNG (depth '+depth+', interlace '+interlace+')');
    const ch={0:1,2:3,3:1,4:2,6:4}[type],stride=width*ch,raw=zlib.inflateSync(Buffer.concat(idat)),px=Buffer.alloc(stride*height);
    for(let y=0;y<height;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),row=px.subarray(y*stride,(y+1)*stride),up=y?px.subarray((y-1)*stride,y*stride):null;
      for(let x=0;x<stride;x++){const a=x>=ch?row[x-ch]:0,b=up?up[x]:0,c=up&&x>=ch?up[x-ch]:0;let v=src[x];
        if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
        row[x]=v&255;}}
    const out=Buffer.alloc(width*height*4);
    for(let i=0;i<width*height;i++){const o=i*4,s=i*ch;
      if(type===6){px.copy(out,o,s,s+4);}else if(type===2){out[o]=px[s];out[o+1]=px[s+1];out[o+2]=px[s+2];out[o+3]=255;}
      else if(type===0||type===4){out[o]=out[o+1]=out[o+2]=px[s];out[o+3]=type===4?px[s+1]:255;}
      else{const k=px[s];out[o]=palette[k*3];out[o+1]=palette[k*3+1];out[o+2]=palette[k*3+2];out[o+3]=trns&&k<trns.length?trns[k]:255;}}
    return{width,height,data:out};
  },
  encode({width,height,data}){
    const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++){raw[y*(width*4+1)]=0;Buffer.from(data.buffer,data.byteOffset+y*width*4,width*4).copy(raw,y*(width*4+1)+1);}
    const chunk=(kind,body)=>{const len=Buffer.alloc(4);len.writeUInt32BE(body.length);const kb=Buffer.from(kind,'latin1'),crc=Buffer.alloc(4);crc.writeUInt32BE(zlib.crc32(Buffer.concat([kb,body]))>>>0);return Buffer.concat([len,kb,body,crc]);};
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
    return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
  },
  // sha256 of one rectangle's RGBA bytes (row by row).
  hashRect(img,x,y,w,h){const hash=crypto.createHash('sha256');for(let r=y;r<y+h;r++)hash.update(img.data.subarray((r*img.width+x)*4,(r*img.width+x+w)*4));return hash.digest('hex').slice(0,24);},
  crop(img,x,y,w,h){const data=Buffer.alloc(w*h*4);for(let r=0;r<h;r++)img.data.copy(data,r*w*4,((y+r)*img.width+x)*4,((y+r)*img.width+x+w)*4);return{width:w,height:h,data};}
};

// --key value / --flag / --key=value; repeated keys collect into arrays.
function args(argv=process.argv.slice(2)){
  const out={_:[]};
  for(let i=0;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--')){out._.push(a);continue;}
    let [k,v]=a.slice(2).split(/=(.*)/s);if(v===undefined){v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;}
    out[k]=k in out?[].concat(out[k],v):v;}
  return out;
}
const list=(v,fallback)=>v===undefined||v===true?fallback:[].concat(v).flatMap(s=>String(s).split(',')).filter(Boolean);

module.exports={MIME,sha256,relPath,fsTree,gitTree,serve,launch,RASTER_ARGS,DETERMINISTIC_ARGS,browserExecutable,isolate,png,args,list};
