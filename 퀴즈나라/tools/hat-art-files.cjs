'use strict';
// The hat art files the deployment ships (tools/hair/build-hat.py writes
// assets/hat-art/hat-art.json and avatar-hat-art.js): the data file, every
// picture and every hair-hide mask the records name.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DATA=path.join(ROOT,'assets','hat-art','hat-art.json');
const files=['avatar-hat-art.js'];
if(fs.existsSync(DATA)){
  const all=JSON.parse(fs.readFileSync(DATA,'utf8'));
  for(const rec of Object.values(all))for(const views of Object.values(rec.views))for(const v of Object.values(views)){files.push(v.src);if(v.hide)files.push(v.hide.src);}
}
module.exports=[...new Set(files)];
