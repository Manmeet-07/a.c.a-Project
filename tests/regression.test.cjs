/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { NextRequest } = require('next/server');
const { load, pdf } = require('./helpers.cjs');
const origin = 'http://localhost:3000';
function request(body, headers = {}) { return new NextRequest(origin+'/api/tailor', { method:'POST', headers:{origin, 'content-type':'application/json', ...headers}, body:JSON.stringify(body) }); }
const valid = {resumeText:'Python SQL developer', jobDescription:'Looking for a Python SQL developer'};
test('real requests enforce JSON, same-origin, shape and bounded inputs; derive skills', async () => {
  let calls=0;
  const { POST }=load('app/api/tailor/route.ts', {'@/lib/ai':{getAIEnhancedSuggestions:async()=>{calls++;return null;}}});
  for(const body of [null, [], 3, {...valid,resumeText:42}, {...valid,profileSkills:[null]}, {...valid,useAI:'yes'}]) assert.equal((await POST(request(body))).status,400);
  assert.equal((await POST(request(valid,{'content-type':'text/plain'}))).status,415);
  assert.equal((await POST(request(valid,{origin:'https://evil.example'}))).status,403);
  assert.equal((await POST(request(valid,{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await POST(request({...valid,jobDescription:'x'.repeat(50001)}))).status,413);
  assert.equal((await POST(request({...valid,resumeText:'x'.repeat(100001)}))).status,200);
  const result=await (await POST(request(valid))).json();
  assert.deepEqual(result.result.matchedSkills,['Python','SQL']);
  await POST(request({...valid,useAI:true}));
  assert.equal(calls,0,'unsigned or non-consenting requests never call AI');
});
test('bounded reader rejects declared and chunked oversized bodies', async()=>{
  const {readBounded}=load('lib/http.ts');
  await assert.rejects(readBounded(new Request(origin,{method:'POST',body:'small',headers:{'content-length':'1000'}}),10), e=>e.status===413);
  await assert.rejects(readBounded(new Request(origin,{method:'POST',body:'x'.repeat(11)}),10),e=>e.status===413);
  assert.equal((await readBounded(new Request(origin,{method:'POST',body:'12345'}),10)).length,5);
});
test('PDF parser handles actual PDFs, page limits and resource bounds', {timeout:20000}, async()=>{
  const {parsePdf}=load('lib/pdf.ts');
  const lines=await parsePdf(pdf(['Ada Lovelace','ada@example.test','Skills: Python, SQL']));
  assert.ok(lines.includes('Ada Lovelace'));
  await assert.rejects(parsePdf(pdf(['Skills: Python'],21)),e=>e.status===422);
  await assert.rejects(parsePdf(Buffer.from('%PDF-broken')),e=>e.status===422);
});
test('PDF worker timeout and abnormal exit always settle and terminate', async()=>{
  const {EventEmitter}=require('node:events'); let terminated=0;
  class Worker extends EventEmitter { terminate(){terminated++;return Promise.resolve(1);} }
  const {parsePdf}=load('lib/pdf.ts', {'node:worker_threads':{Worker}, './limits':{PDF_TIMEOUT_MS:10}, '@/lib/limits':{PDF_TIMEOUT_MS:10}});
  // Loader resolves relative mocks before loading modules.
  await assert.rejects(parsePdf(Buffer.from('x')),e=>e.status===503);
  assert.equal(terminated,1);
});
test('amplified PDFs stay off the event loop and fail within the worker budget', {timeout:15000}, async()=>{
  const {parsePdf}=load('lib/pdf.ts');
  const start=performance.now();
  let ticked=false;
  const tick=setTimeout(()=>{ticked=true;},20);
  await assert.rejects(parsePdf(pdf(['Technical experience '.repeat(1000)],3000)),e=>e.status===422||e.status===503);
  clearTimeout(tick);
  assert.ok(ticked,'main event loop stays responsive');
  assert.ok(performance.now()-start<13000);
});
test('header extraction is bounded on a 100KB token and preserves names', async()=>{
  let lines=['x'.repeat(100000)];
  const {POST}=load('app/api/upload/route.ts', {'@/lib/pdf':{parsePdf:async()=>lines}});
  async function run(){ const form=new FormData();form.append('resume',new File(['%PDF-test'],'resume.pdf',{type:'application/pdf'}));return POST(new NextRequest(origin+'/api/upload',{method:'POST',headers:{origin},body:form}));}
  const start=performance.now();const result=await (await run()).json();
  assert.ok(performance.now()-start<100,'100KB single-token extraction must not stall');
  assert.equal(result.profile.email,'');assert.ok(result.profile.resumeText.length<=100000);
  for(const name of ['Jordan O’Neil','Élodie García']) {
    lines=[name,'candidate@example.test','415-555-0168','48 Pine Road','Denver, CO 80202','Skills: Python, SQL'];
    const body=await(await run()).json();assert.equal(body.profile.name,name);assert.equal(body.profile.address,'48 Pine Road');
  }
  assert.equal((await POST(new NextRequest(origin+'/api/upload',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}))).status,415);
});
test('skill extraction avoids prose false positives and evidence supports aliases',()=>{
  const {extractSkills,mentionsSkill}=load('lib/skills.ts');
  assert.equal(extractSkills("Spring 2025 Dean's list. I go above and beyond, take the rest of the work. Express yourself. Vitamin C. R&D intern. Graph node. 5 ml sample").length,0);
  assert.ok(!extractSkills('Skills: C++, C#').includes('C'));
  assert.ok(extractSkills('Skills: Go, R, C, REST, ML, TS').includes('Go'));
  assert.ok(mentionsSkill('Skills: JS, Python','JavaScript'));
  assert.ok(!mentionsSkill('Great communicator','C'));
});
test('nontechnical identical texts score 100 and sentence punctuation is normalized',()=>{
  const {scoreMatch}=load('lib/ats.ts');
  assert.equal(scoreMatch('Customer support scheduling',[], 'Customer support scheduling').score,100);
  assert.equal(scoreMatch('Python.', ['Python'], 'Python').score,100);
});
test('bookmarklet skips all eight audit negative labels and honors autocomplete/types',()=>{
  const {buildAutofillBookmarklet}=load('lib/bookmarklet.ts');
  const negatives=['Please state why you want this role','Which site did you hear about us on?','Security PIN','First day you can start','Last day at current job','Name of person who referred you','Your LinkedIn summary (in your own words)','Address any gaps in your employment history'];
  const names=['full name','company name','email address','first name','last name',...negatives];
  const fields=names.map(name=>({name,value:'',type:'text',labels:[],getAttribute:()=>'',closest:()=>null,dispatchEvent:()=>{}}));
  fields.push({...fields[0],name:'Given',getAttribute:key=>key==='autocomplete'?'given-name':''});
  fields.push({...fields[0],type:'email'});
  const uri=buildAutofillBookmarklet({name:'Ada Lovelace',email:'ada@example.test',phone:'1234567890',state:'MA',postalCode:'12345',website:'https://example.test'});
  vm.runInNewContext(decodeURIComponent(uri.slice(11)),{document:{querySelectorAll:()=>fields},window:{alert(){}},Event:class{}});
  assert.deepEqual(fields.map(f=>f.value),['Ada Lovelace','','ada@example.test','Ada','Lovelace',...negatives.map(()=>''),'Ada','']);
});
test('links reject script and data URLs',()=>{
  const {safeWebUrl}=load('lib/urls.ts');for(const u of ['javascript:alert(1)','data:text/html,x','/relative']) assert.equal(safeWebUrl(u),undefined);
});
