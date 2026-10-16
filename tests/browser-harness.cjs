/* eslint-disable @typescript-eslint/no-require-imports */
// Local browser harness. Synthetic data only. Run: node tests/browser-harness.cjs
const fs = require('node:fs');
const http = require('node:http');
const vm = require('node:vm');
const ts = require('typescript');
const { spawn } = require('node:child_process');
const path = require('node:path');
const source = ts.transpileModule(fs.readFileSync('lib/bookmarklet.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext(source, { exports: loaded.exports });
const build = loaded.exports.buildAutofillBookmarklet;
const resumes = {
  maya: ['Maya Chen', 'maya.chen@example.test', '+1 (202) 555-0142', '123 Maple Street', 'Boston, MA 02110', 'https://linkedin.com/in/maya-test', 'https://github.com/maya-test', 'https://maya.example.test', 'Skills: Python, SQL, React, TypeScript', 'Experience', 'Built reporting dashboards and web applications.'],
  jordan: ["Jordan O'Neil", 'jordan.oneil@example.test', '415-555-0168', '48 Pine Road', 'Denver, CO 80202', 'https://linkedin.com/in/jordan-test', 'https://github.com/jordan-test', 'https://jordan.example.test', 'Skills: Java, Docker, AWS, PostgreSQL', 'Experience', 'Developed backend services and deployment pipelines.'],
};
function pdf(lines) {
  const stream = 'BT /F1 12 Tf 50 740 Td ' + lines.map((l,i) => (i ? '0 -24 Td ' : '') + '(' + l.replace(/[\\()]/g, '\\$&') + ') Tj').join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let data = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((obj,i) => { offsets.push(Buffer.byteLength(data)); data += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(data);
  return data + `xref\n0 6\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}
const fields = [
  ['first_name','First name'], ['last_name','Last name'], ['full_name','Full name'], ['email','Email address'], ['phone','Phone number'], ['address','Street address'], ['address2','Address line 2'], ['city','City'], ['state','State'], ['postal_code','Postal code'], ['linkedin','LinkedIn'], ['github','GitHub'], ['website','Website'], ['company','Company name'], ['emergency','Emergency contact name'], ['username','Username'], ['existing','Email already entered','reviewer@example.test'], ['readonly','Read-only full name','','readonly'],
];
const profiles = {};
(async () => {
  for (const [id,lines] of Object.entries(resumes)) {
    const filename = path.resolve('tests/artifacts/'+id+'.pdf'); fs.writeFileSync(filename,pdf(lines));
    const form = new FormData(); form.append('resume',new Blob([fs.readFileSync(filename)],{type:'application/pdf'}),id+'.pdf');
    const response = await fetch('http://127.0.0.1:3000/api/upload',{method:'POST',body:form});
    const result = await response.json(); if (!result.success) throw Error(id+': '+result.error);
    profiles[id] = result.profile;
  }
  fs.writeFileSync('tests/artifacts/parsed-profiles.json',JSON.stringify(profiles,null,2));
  const escape = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const server = http.createServer((req,res) => {
    const id = req.url === '/jordan' ? 'jordan' : 'maya';
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><title>ACA synthetic application test</title><style>body{font:14px system-ui;margin:25px auto;max-width:900px;background:#f4f6f8;color:#203040;padding:20px}h1{font-size:24px}form{display:grid;grid-template-columns:1fr 1fr;gap:13px}label{display:grid;gap:5px}input{padding:9px;border:1px solid #ccd4df;border-radius:5px}a{display:inline-block;margin:15px 10px 20px 0;padding:12px;background:#234f95;color:white;border-radius:5px}output{display:block;margin:20px 0;color:#256845}button{padding:10px}small{display:block;margin:8px 0}</style><h1>Application autofill test: ${escape(profiles[id].name)}</h1><p>Synthetic candidate data · Local test form · Nothing is sent to an employer</p><a href="${escape(build(profiles[id]))}">Run ACA Fill-Assist</a><a href="/${id === 'maya' ? 'jordan' : 'maya'}">Switch candidate</a><output id="events">Input events: 0 · Change events: 0 · Submissions: 0</output><form>${fields.map(([name,label,value='',attrs=''])=>`<label for="${name}">${label}<input id="${name}" name="${name}" value="${value}" ${attrs}></label>`).join('')}<button type="submit">Submit test form</button></form><script>const expected=${JSON.stringify(profiles[id])};let inputs=0,changes=0,submits=0;function show(){document.querySelector('output').textContent='Input events: '+inputs+' · Change events: '+changes+' · Submissions: '+submits+' · Email correct: '+(document.getElementById('email').value===expected.email)+' · Phone correct: '+(document.getElementById('phone').value===expected.phone)}document.addEventListener('input',()=>{inputs++;show()});document.addEventListener('change',()=>{changes++;show()});document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();submits++;show()});</script></html>`);
  });
  server.listen(3102,'127.0.0.1',()=>console.log('Fixture http://127.0.0.1:3102/maya'));
  const app = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3103','--hostname','127.0.0.1'],{windowsHide:true,stdio:'inherit'});
  process.on('SIGINT',()=>{app.kill();server.close();process.exit(0)});
})().catch(e=>{console.error(e.message);process.exitCode=1});
