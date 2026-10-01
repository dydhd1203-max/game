const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=require('./deployment-files.cjs');
for(const file of files){
  assert(fs.statSync(path.join(root,file)).isFile(),'Required quiz file is missing: '+file);
}
for(const entry of ['index.html']){
  const html=fs.readFileSync(path.join(root,entry),'utf8');
  let count=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(match[1])){new vm.Script(match[2],{filename:entry+':inline'+(++count)});}
  }
  console.log(entry+': '+count+' inline scripts parse successfully');
}
for(const file of files.filter(file=>file.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
console.log('Avatar and isolated preview scripts parse successfully');
console.log('Quiz folder contains all '+files.length+' required runtime, artwork, font and hosting files');
