'use strict';
// The face art files the deployment ships (tools/hair/build-face.py writes
// assets/face-art/face-art.json and avatar-face-art.js): the data file, every
// picture and every part cover the records name, and the per-hair fringe masks.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DATA=path.join(ROOT,'assets','face-art','face-art.json');
const files=['avatar-face-art.js'];
if(fs.existsSync(DATA)){
  const all=JSON.parse(fs.readFileSync(DATA,'utf8'));
  for(const views of Object.values(all.fringe?.files||{}))for(const hairs of Object.values(views))files.push(...Object.values(hairs));
  for(const rec of Object.values(all.items))for(const views of Object.values(rec.views))for(const v of Object.values(views)){files.push(v.src);if(v.cover)files.push(v.cover);}
}
module.exports=[...new Set(files)];
