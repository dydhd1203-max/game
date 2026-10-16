'use strict';
// The hat art files the deployment ships (tools/hair/build-hat.py writes
// assets/hat-art/hat-art.json and avatar-hat-art.js): the data file, every
// picture and every hair-hide mask the records name (their narrow views too), and the hair drawn under a
// pulled-on hat (tools/hair/build-hat-hair.py) with its kept-skin masks.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DATA=path.join(ROOT,'assets','hat-art','hat-art.json');
const files=['avatar-hat-art.js'];
if(fs.existsSync(DATA)){
  const all=JSON.parse(fs.readFileSync(DATA,'utf8'));
  for(const rec of Object.values(all))for(const set of [rec.views,rec.narrow||{}])for(const views of Object.values(set))for(const v of Object.values(views)){files.push(v.src);if(v.hide)files.push(v.hide.src);}
}
const HAIR=path.join(ROOT,'assets','hat-art','hair','hair.json');
if(fs.existsSync(HAIR))for(const hairs of Object.values(JSON.parse(fs.readFileSync(HAIR,'utf8'))))for(const views of Object.values(hairs))for(const v of Object.values(views))files.push(v.src,v.keep.src);
module.exports=[...new Set(files)];
