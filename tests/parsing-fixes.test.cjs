/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {load:loadModule,pdfWithLinks}=require('./helpers.cjs');
const load=(file,mocks={})=>loadModule(file,{'@/lib/firebase-server':{requireUser:async()=>'verified-test-user'},...mocks});
const origin='http://localhost:3000';
const skills=load('lib/skills.ts');
const extractSkills=text=>[...skills.extractSkills(text)];
const {extractProfileLinks}=load('lib/profile-links.ts');
async function parse(lines){
  const {POST}=load('app/api/upload/route.ts',{'@/lib/pdf':{parseResumePdf:async()=>({lines,links:[]})}});
  const form=new FormData();form.append('resume',new File(['%PDF-test'],'resume.pdf',{type:'application/pdf'}));
  return (await(await POST(new NextRequest(origin+'/api/upload',{method:'POST',headers:{origin},body:form}))).json()).profile;
}

test('phone stays on its own line and ignores ZIPs, apartments and URL digits',async()=>{
  assert.equal((await parse(['Ann Lee','Austin, TX 78701','512-555-0100'])).phone,'512-555-0100');
  assert.equal((await parse(['Ann Lee','Austin, TX 78701-1234','Apt 12','(512) 555-0100'])).phone,'(512) 555-0100');
  assert.equal((await parse(['Ann Lee','Austin, TX 78701 512-555-0100'])).phone,'512-555-0100');
  assert.equal((await parse(['Ann Lee','+1 (512) 555-0100'])).phone,'+1 (512) 555-0100');
  assert.equal((await parse(['Ann Lee','1-512-555-0100'])).phone,'1-512-555-0100');
  assert.equal((await parse(['Ann Lee','Austin, TX 78701 1-512-555-0100'])).phone,'1-512-555-0100');
  assert.equal((await parse(['Ann Lee','linkedin.com/in/jane-5125550100','linkedin.com/in/5125550100'])).phone,'');
});
test('email drops surrounding punctuation and keeps plus addressing',async()=>{
  for(const line of ['jane@x.com,','(jane@x.com)','Email:jane@x.com'])assert.equal((await parse(['Ann Lee',line])).email,'jane@x.com');
  assert.equal((await parse(['Ann Lee','jane+jobs@gmail.com.'])).email,'jane+jobs@gmail.com');
});
test('name strips credentials, keeps particles and skips job titles',async()=>{
  assert.equal((await parse(['Jane Doe, PhD','Senior Data Scientist'])).name,'Jane Doe');
  assert.equal((await parse(['Maria de la Cruz','Austin, TX 78701'])).name,'Maria de la Cruz');
  assert.equal((await parse(['Senior Data Scientist','Jane Doe'])).name,'Jane Doe');
});
test('street address must start the line and location fallback is only City, ST ZIP',async()=>{
  assert.equal((await parse(['Ann Lee','Increased revenue 30 percent to drive growth'])).address,undefined);
  assert.equal((await parse(['Ann Lee','123 N. Main St.','Austin, TX 78701'])).address,'123 N. Main St.');
  assert.equal((await parse(['Ann Lee','Austin, TX 78701 | (512) 555-0100'])).address,'Austin, TX 78701');
});
test('city names keep abbreviations, hyphens, apostrophes and accents',async()=>{
  for(const [line,city] of [['St. Louis, MO 63101','St. Louis'],['Winston-Salem, NC 27101','Winston-Salem'],['Coeur d’Alene, ID 83814','Coeur d’Alene'],['San José, CA 95112','San José']]) {
    const profile=await parse(['Ann Lee',line]);assert.equal(profile.city,city,line);
  }
  const profile=await parse(['Ann Lee','123 Main St Austin, TX 78701']);
  assert.deepEqual([profile.address,profile.city,profile.state,profile.postalCode],['123 Main St','Austin','TX','78701']);
});
test('ambiguous skills are found under any short heading, bullets and mixed lists',()=>{
  assert.deepEqual(extractSkills('Technical Skills: C, Go, R, Python'),['C','Go','Python','R']);
  assert.deepEqual(extractSkills('Programming Languages: C, C++, Go, R'),['C','C++','Go','R']);
  assert.deepEqual(extractSkills('• C, C++, Go'),['C','C++','Go']);
  assert.deepEqual(extractSkills('Python, C, Go, Machine Learning'),['C','Go','Machine Learning','Python']);
});
test('ordinary words, names and hyphenated prose are not skills',()=>{
  for(const text of ['Helped teams react quickly to incidents','rust prevention','Ruby Jenkins\nruby@example.test','angular momentum','Go-to-market strategy','C-suite advisory'])assert.deepEqual(extractSkills(text),[],text);
  assert.deepEqual(extractSkills('Skills: react, rust'),['React','Rust']);
  assert.deepEqual(extractSkills('Built dashboards with React and Angular'),['Angular','React']);
});
test('multi-word skills do not also count their shorter parts',()=>{
  assert.deepEqual(extractSkills('Experience with Tailwind CSS'),['Tailwind CSS']);
  assert.deepEqual(extractSkills('Built GitHub Actions pipelines'),['GitHub Actions']);
});
test('tailoring uses the edited profile skills instead of re-adding parsed ones',async()=>{
  const {POST}=load('app/api/tailor/route.ts',{'@/lib/ai':{getAIEnhancedSuggestions:async()=>null}});
  const request=body=>new NextRequest(origin+'/api/tailor',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const base={resumeText:'Skills: Python, SQL',jobDescription:'Looking for a Python SQL developer'};
  assert.deepEqual((await(await POST(request({...base,profileSkills:['Python']}))).json()).result.missingSkills,['SQL']);
  assert.deepEqual((await(await POST(request(base))).json()).result.matchedSkills,['Python','SQL']);
});
test('LinkedIn country and mobile hosts and spaced handles are LinkedIn profiles',async()=>{
  for(const url of ['https://uk.linkedin.com/in/jane-doe','https://in.linkedin.com/in/jane-doe','https://mobile.linkedin.com/in/jane-doe']) {
    assert.deepEqual({...extractProfileLinks('',[url])},{github:undefined,linkedin:url,portfolio:undefined,website:undefined});
  }
  assert.equal(extractProfileLinks('linkedin.com/in/ jane-doe').linkedin,'https://linkedin.com/in/jane-doe');
  assert.equal(extractProfileLinks('https://linkedin.com.evil.test/in/jane').linkedin,undefined);
  const {POST}=load('app/api/upload/route.ts');
  const form=new FormData();form.set('resume',new File([await pdfWithLinks(['Jane Doe','LinkedIn'],['https://uk.linkedin.com/in/jane-doe'])],'r.pdf',{type:'application/pdf'}));
  const {profile}=await(await POST(new NextRequest(origin+'/api/upload',{method:'POST',headers:{origin},body:form}))).json();
  assert.equal(profile.linkedin,'https://uk.linkedin.com/in/jane-doe');assert.equal(profile.website,undefined);
});
