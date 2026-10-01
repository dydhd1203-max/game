const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const deployments=['퀴즈게임'];
if(process.argv.includes('--root-deployment'))deployments.push('../퀴즈게임');
for(const entry of ['index.html',...deployments.map(p=>p+'/index.html')]){
  const html=fs.readFileSync(path.join(root,entry),'utf8');
  let count=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(match[1])){new vm.Script(match[2],{filename:entry+':inline'+(++count)});}
  }
  console.log(entry+': '+count+' inline scripts parse successfully');
}
for(const file of ['avatar-pixel.js','avatar-clothes.js','avatar-effects.js','avatar-pets.js','avatar-shoes.js','demo.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
console.log('Avatar and isolated preview scripts parse successfully');
if(process.argv.includes('--deployment')||process.argv.includes('--root-deployment')){
  for(const target of deployments)for(const file of require('./deployment-files.cjs')){
    assert(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,target,file))),'Deployment file differs: '+target+'/'+file);
  }
  console.log('Deployment HTML, scripts, CSS and bitmap atlas match the current game');
}
