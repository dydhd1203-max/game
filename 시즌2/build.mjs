import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {importWorkshop} from './tools/import-workshop-glb.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
// Compile the committed Blender source asset into the offline bundle on every
// build so a changed GLB cannot leave stale generated workshop geometry.
await importWorkshop(undefined,undefined,{quiet:true});
const result=await build({entryPoints:[path.join(root,'src/app.mjs')],bundle:true,write:false,format:'iife',target:['chrome110'],minify:true,legalComments:'inline'});
const html=await readFile(path.join(root,'index.html'),'utf8'),css=await readFile(path.join(root,'style.css'),'utf8');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const output=html.replace(/<link\b[^>]*href=["'](?:\.\/)?style\.css["'][^>]*>/,()=>'<style>'+css+'</style>').replace(/<script\s+type=["']module["']\s+src=["'](?:\.\/)?src\/app\.mjs["']\s*><\/script>/,()=>'<script>'+script+'</script>');
if(output.includes('src/app.mjs')||output.includes('href="style.css"'))throw Error('실행 HTML 참조를 묶지 못했습니다.');
await mkdir(path.join(root,'배포용'),{recursive:true});
await writeFile(path.join(root,'배포용/index.html'),output);
await copyFile(path.join(root,'vendor/THREE-LICENSE.txt'),path.join(root,'배포용/THREE-LICENSE.txt'));
await writeFile(path.join(root,'배포용/_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n');
console.log('시즌2/배포용/index.html 생성: '+Buffer.byteLength(output).toLocaleString()+' bytes (독립 실행; 온라인 방은 인터넷 필요)');
