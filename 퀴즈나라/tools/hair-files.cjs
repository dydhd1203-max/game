'use strict';
// The hair layer files the deployment ships (stage 3 H2/H3): the runtime, the
// data file tools/hair/build-heads.py writes and every atlas it names.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DATA=path.join(ROOT,'assets','sd-hair-data.js');
function hairData(){
  const m=fs.readFileSync(DATA,'utf8').match(/window\.QPHairData=(\{[\s\S]*\});\s*$/);
  if(!m)throw new Error('assets/sd-hair-data.js: window.QPHairData not found');
  return JSON.parse(m[1]);
}
const files=['avatar-foundation-head.js'];
if(fs.existsSync(DATA)){files.push('assets/sd-hair-data.js');for(const e of Object.values(hairData().styles))files.push(e.file.replace(/^\.\//,''));}
module.exports=[...new Set(files)];
module.exports.hairData=hairData;
