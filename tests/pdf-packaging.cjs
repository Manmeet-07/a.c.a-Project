/* eslint-disable @typescript-eslint/no-require-imports */
// Verify actual worker dependencies are present in the production file trace.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const tracePath=path.resolve(process.env.NEXT_BUILD_DIR||'.next','server/app/api/upload/route.js.nft.json');
const normalize=value=>process.platform==='win32'?value.toLowerCase():value;
const trace=JSON.parse(fs.readFileSync(tracePath,'utf8'));
const included=new Set(trace.files.map(file=>normalize(path.resolve(path.dirname(tracePath),file))));
require('pdf2json');require('pdf-lib');
assert.ok(included.has(normalize(path.resolve('workers/pdf.cjs'))),'Missing PDF worker in upload function trace');
const packages=['pdf2json','pdf-lib','@pdf-lib/standard-fonts','@pdf-lib/upng','pako','tslib'];
const dependencies=Object.keys(require.cache).filter(file=>packages.some(name=>file.replaceAll('\\','/').includes('/node_modules/'+name+'/')));
const missing=dependencies.filter(file=>!included.has(normalize(file)));
assert.deepEqual(missing,[],'PDF worker dependencies must ship with the upload function');
console.log(`PASS: PDF worker and ${dependencies.length} loaded dependency files included in production trace.`);
