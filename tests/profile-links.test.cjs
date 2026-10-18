/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,pdf,pdfWithLinks}=require('./helpers.cjs');
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
  assert.equal(extractProfileLinks('https://example.test/'+'é'.repeat(500)).website,undefined);
  assert.equal(extractProfileLinks('https://maya.github.io').github,undefined);
  assert.equal(extractProfileLinks('https://maya.github.io').website,'https://maya.github.io');
  assert.equal(extractProfileLinks('github.com/maya/project github.com/maya').github,'https://github.com/maya');
});
test('separate website and portfolio links remain distinct',()=>{
  const links=extractProfileLinks('', ['https://maya.dev/portfolio','https://maya.dev']);
  assert.equal(links.portfolio,'https://maya.dev/portfolio');
  assert.equal(links.website,'https://maya.dev');
});
test('PDF upload preserves a visible scheme-free GitHub profile in its response',async()=>{
  const {POST}=load('app/api/upload/route.ts',{'@/lib/firebase-server':{requireUser:async()=>'verified-user'}});
  const data=new FormData();data.set('resume',new File([pdf(['Maya Chen','maya@example.test','github.com/maya-dev','Skills: Python'])],'resume.pdf',{type:'application/pdf'}));
  const response=await POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost'},body:data}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).profile.github,'https://github.com/maya-dev');
});
test('PDF upload reads GitHub and LinkedIn URLs hidden behind labels in compressed annotations',async()=>{
  const bytes=await pdfWithLinks(['Maya Chen','maya@example.test','GitHub | LinkedIn','Skills: Python'],[
    'github.com/maya-dev', 'https://www.linkedin.com/in/maya',
    'javascript:alert(1)', 'file:///private',
  ]);
  const {POST}=load('app/api/upload/route.ts',{'@/lib/firebase-server':{requireUser:async()=>'verified-user'}});
  const data=new FormData();data.set('resume',new File([bytes],'linked-resume.pdf',{type:'application/pdf'}));
  const response=await POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost'},body:data}));
  assert.equal(response.status,200);
  const {profile}=await response.json();
  assert.equal(profile.github,'https://github.com/maya-dev');
  assert.equal(profile.linkedin,'https://www.linkedin.com/in/maya');
  assert.equal(profile.website,undefined);
  assert.ok(!profile.resumeText.includes('github.com'),'Hyperlinks must not alter the resume scoring text');
  const {buildAutofillBookmarklet}=load('lib/bookmarklet.ts');
  const field={name:'github',value:'',type:'url',labels:[],getAttribute:()=>'',closest:()=>null,dispatchEvent:()=>{}};
  require('node:vm').runInNewContext(decodeURIComponent(buildAutofillBookmarklet(profile).slice(11)),{document:{querySelectorAll:()=>[field]},window:{alert(){}},Event:class{}});
  assert.equal(field.value,'https://github.com/maya-dev','Detected GitHub link is available to application Fill-Assist');
});
test('PDF hyperlink extraction keeps safe targets bounded and ignores non-web actions',async()=>{
  const {parseResumePdf}=load('lib/pdf.ts');
  const {links}=await parseResumePdf(await pdfWithLinks(['Maya Chen','GitHub'],[
    'javascript:alert(1)','file:///private','https://user:password@github.com/maya','https://example.test/'+'é'.repeat(500),
    ...Array.from({length:110},(_,i)=>'https://github.com/user-'+i),
  ]));
  assert.equal(links.length,100);
  assert.ok(links.every(link=>link.startsWith('https://github.com/user-')));
});
