/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,pdf}=require('./helpers.cjs');
const {extractProfileLinks}=load('lib/profile-links.ts');

test('resume contacts recognize GitHub URLs with or without a scheme and PDF fragment spaces',()=>{
  for(const value of ['github.com/Manmeet-07','www.github.com/Manmeet-07','https://github.com/Manmeet-07','GitHub: github.com / Manmeet-07','(https://github.com/Manmeet-07).']) {
    assert.equal(extractProfileLinks(value).github,value.includes('www.')?'https://www.github.com/Manmeet-07':'https://github.com/Manmeet-07');
  }
  assert.equal(extractProfileLinks('linkedin.com/in/maya').linkedin,'https://linkedin.com/in/maya');
  assert.equal(extractProfileLinks('www.maya.dev').website,'https://www.maya.dev');
});
test('profile links reject lookalike hosts, credentials and unsafe hyperlink schemes',()=>{
  for(const value of ['https://github.com.evil.test/maya','https://evil.test/github.com/maya','https://github.com@evil.test/maya','email@github.com/maya'])assert.equal(extractProfileLinks(value).github,undefined);
  assert.equal(extractProfileLinks('', ['javascript:alert(1)','file:///private','https://user:password@github.com/maya']).github,undefined);
  assert.equal(extractProfileLinks('', ['javascript:alert(1)','file:///private','../relative']).website,undefined);
  assert.equal(extractProfileLinks('https://maya.github.io').github,undefined);
  assert.equal(extractProfileLinks('https://maya.github.io').website,'https://maya.github.io');
  assert.equal(extractProfileLinks('github.com/maya/project github.com/maya').github,'https://github.com/maya');
});
test('PDF upload preserves a visible scheme-free GitHub profile in its response',async()=>{
  const {POST}=load('app/api/upload/route.ts',{'@/lib/firebase-server':{requireUser:async()=>'verified-user'}});
  const data=new FormData();data.set('resume',new File([pdf(['Maya Chen','maya@example.test','github.com/maya-dev','Skills: Python'])],'resume.pdf',{type:'application/pdf'}));
  const response=await POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost'},body:data}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).profile.github,'https://github.com/maya-dev');
});
