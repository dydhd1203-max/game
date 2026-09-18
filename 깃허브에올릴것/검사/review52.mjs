// Local, Firebase-free screenshots of the title and playable third-person view.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
const out=path.resolve(process.argv[2]||'../../artifacts');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
 const p=await b.newPage({viewport:{width:1366,height:768}});
 await p.goto('http://127.0.0.1:8900/?gfx=mid',{waitUntil:'load'});
 await p.waitForFunction(()=>window.__READY===true);
 await p.evaluate(()=>document.fonts.ready);
 await p.screenshot({path:path.join(out,'52-title.png')});
 await p.fill('#iName','하늘');await p.evaluate(()=>document.getElementById('bSolo').click());
 await p.waitForFunction(()=>window.__G.started);
 await p.waitForTimeout(6500);
 await p.evaluate(()=>{window.__G.paused=false;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));});
 await p.screenshot({path:path.join(out,'52-game.png')});
 console.log(out);
} finally {await b.close();}
