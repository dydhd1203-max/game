'use strict';
/* Runtime files of the garment records (stage 3), for tools/deployment-files.cjs:
   the generated index, then per record (sorted by id) its data file, its atlas
   per sex and its file:// bundle. Read from assets/sd-garments-index.js, so a
   record added or removed by tools/garment/build-index.cjs needs no edit here. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),INDEX='assets/sd-garments-index.js';
const sandbox={};
new vm.Script(fs.readFileSync(path.join(root,INDEX),'utf8'),{filename:INDEX}).runInNewContext({window:sandbox,globalThis:sandbox});
const index=sandbox.QPFoundationGarmentIndex;
if(!index)throw new Error(INDEX+' did not define QPFoundationGarmentIndex');
const files=[INDEX];
for(const id of Object.keys(index.records).sort()){const f=index.records[id].files;files.push(f.data,...index.records[id].sexes.map(sex=>f[sex]),f.bundle);}
module.exports=files;
