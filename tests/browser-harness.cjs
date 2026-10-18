/* eslint-disable @typescript-eslint/no-require-imports */
// Self-contained production browser test. Synthetic data; dynamic port; cleanup
// on success, failure, SIGINT, and SIGTERM. PLAYWRIGHT_EXECUTABLE_PATH optional.
const { chromium }=require('@playwright/test');
const {spawn}=require('node:child_process');
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pdf}=require('./helpers.cjs');
const emulate = process.env.ACA_AUTH_E2E === 'true';
let server,browser,page, testAuth, testApp, testAdminApp, testDatabase;
const testEmail = 'maya-'+Date.now()+'@example.test';
const testPassword = 'Synthetic-Only-Password-27!';
async function verifyEmail(email) {
  const {oobCodes=[]}=await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-aca/oobCodes')).json();
  const action=oobCodes.findLast(item=>item.email===email && item.requestType==='VERIFY_EMAIL');
  assert.ok(action,'Verification email must be sent');
  await require('firebase/auth').applyActionCode(testAuth,action.oobCode);
}
async function register(email) {
  console.log('Checking registration and verification screen.');
  await page.goto(originForTest+'/register');
  await page.getByLabel('Your name',{exact:true}).fill('Maya');
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(testPassword);
  await page.getByLabel('Confirm password',{exact:true}).fill(testPassword);
  await page.getByRole('button',{name:'Create my account'}).click();
  await page.getByRole('heading',{name:'Check your inbox.'}).waitFor();
}
let originForTest;
async function poll(check) { for(let i=0;i<50;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Persisted state did not arrive'); }
const errors=[];
let logs='';
async function cleanup(){if(testDatabase){await testDatabase.terminate().catch(()=>{});testDatabase=null;}if(testAdminApp){await require('firebase-admin/app').deleteApp(testAdminApp).catch(()=>{});testAdminApp=null;}if(testApp){await require('firebase/app').deleteApp(testApp);testApp=null;}if(browser){await browser.close().catch(()=>{});browser=null;}if(server){const child=server;server=null;child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup().finally(()=>process.exit(1));});
async function port(){const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const value=listener.address().port;await new Promise(r=>listener.close(r));return value;}
(async()=>{
  const origin=`http://127.0.0.1:${await port()}`;
  originForTest=origin;
  if(emulate && (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw Error('Both local Firebase emulators are required');
  const env=emulate ? {NEXT_BUILD_DIR:'.next-emulator-turbo',NEXT_PUBLIC_FIREBASE_API_KEY:'demo-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'demo-aca.firebaseapp.com',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'demo-aca',NEXT_PUBLIC_FIREBASE_APP_ID:'demo-app',FIREBASE_PROJECT_ID:'demo-aca',NEXT_PUBLIC_FIREBASE_EMULATORS:'true'} : {};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next',emulate?'dev':'start','--hostname','127.0.0.1','--port',new URL(origin).port],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,ANTHROPIC_API_KEY:'',APP_ORIGINS:origin,...env}});
  server.stdout.on('data',b=>{logs=(logs+b).slice(-8000);});server.stderr.on('data',b=>{logs=(logs+b).slice(-8000);});
  let ready=false;
  for(let i=0;i<300;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw Error('Server failed to start: '+logs);
  const response=await fetch(origin);const csp=response.headers.get('content-security-policy');assert.ok(csp.includes('nonce-'));assert.equal(response.headers.get('x-powered-by'),null);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const bundled=chromium.executablePath();
  const candidates=[process.env.PLAYWRIGHT_EXECUTABLE_PATH,bundled,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  const executablePath=candidates.find(p=>fs.existsSync(p));
  if(!executablePath)throw Error('Install Chromium with npx playwright install chromium or set PLAYWRIGHT_EXECUTABLE_PATH');
  browser=await chromium.launch({executablePath,headless:true});
  page=await browser.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
  console.log('Browser server ready; checking public routes and authentication boundary.');
  // Landing page: readable headline, the CTA leads to the app, no runtime errors.
  await page.goto(origin);
  await page.getByRole('heading',{level:1,name:/Apply with a resume/}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Start with your resume'}).getAttribute('href'),'/login');
  await page.goto(origin+'/app');
  await page.waitForURL('**/login');
  await page.getByRole('heading',{name:'Back to your orbit.'}).waitFor();
  const artifacts=path.resolve('tests/artifacts');fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'login-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Login must fit a mobile viewport');
  await page.screenshot({path:path.join(artifacts,'login-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:720});
  for (const route of ['upload','tailor','session']) {
    const response=await fetch(origin+'/api/'+route,{method:'POST',headers:{origin,'content-type':route==='upload'?'multipart/form-data; boundary=test':'application/json'},body:'{}'});
    assert.equal(response.status,401);
  }
  await page.getByRole('link',{name:'Create an account'}).click();
  await page.getByRole('heading',{name:'Your next chapter starts here.'}).waitFor();
  if(!emulate) {
    assert.deepEqual(errors,[]);
    console.log('PASS: production landing → login → register, protected workspace and APIs, headers and hydration.');
    return;
  }
  testApp=require('firebase/app').initializeApp({apiKey:'demo-key',projectId:'demo-aca'},'test-actions');
  testAuth=require('firebase/auth').getAuth(testApp);
  require('firebase/auth').connectAuthEmulator(testAuth,'http://127.0.0.1:9099',{disableWarnings:true});
  await register(testEmail);
  const credential=await require('firebase/auth').signInWithEmailAndPassword(testAuth,testEmail,testPassword);
  const rejected=await fetch(origin+'/api/tailor',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer '+await credential.user.getIdToken()},body:'{}'});
  assert.equal(rejected.status,403,'unverified users cannot process resumes');
  await verifyEmail(testEmail);
  await page.getByRole('button',{name:'I’ve verified my email'}).click();
  await page.waitForURL('**/app');
  console.log('Verified account opened workspace; checking upload, matching and persistence.');
  const adminApp=require('firebase-admin/app').initializeApp({projectId:'demo-aca'},'browser-test');
  const db=require('firebase-admin/firestore').getFirestore(adminApp);
  testAdminApp=adminApp;testDatabase=db;
  const userId=credential.user.uid;
  const lines=['Maya Chen','maya@example.test','202-555-0142','123 Maple Street','Boston, MA 02110','Skills: Python, SQL, React, TypeScript','Experience','Built reporting dashboards and web applications.'];
  await page.getByLabel('Upload PDF resume').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf(lines)});
  await page.getByRole('heading',{name:'Maya Chen'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/^Match/}).click();
  await page.getByLabel('Company',{exact:true}).fill('Example Company');
  await page.getByLabel('Job title',{exact:true}).fill('Python Developer');
  await page.getByLabel('Job description',{exact:true}).fill('We seek a Python SQL developer to build reporting dashboards and web applications.');
  assert.equal(await page.getByRole('checkbox').isChecked(),false);
  await page.getByRole('button',{name:'Analyze match'}).click();
  await page.getByRole('button',{name:'Save to Applications'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/^Profile/}).click();
  await page.getByRole('navigation').getByRole('button',{name:/^Match/}).click();
  assert.ok((await page.getByLabel('Job description',{exact:true}).inputValue()).includes('Python SQL'));
  await page.getByLabel('Job title',{exact:true}).fill('Revised Developer');
  await page.getByRole('button',{name:'Save to Applications'}).click();
  await page.getByRole('button',{name:'Saved to Applications'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();
  await page.getByLabel('Application status for Revised Developer').selectOption('interviewing');
  await poll(async()=> (await db.collection('users/'+userId+'/applications').get()).docs.some(item=>item.data().status==='interviewing'));
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();
  assert.equal(await page.getByLabel('Application status for Revised Developer').inputValue(),'interviewing');
  // Clipboard rejection must provide a selectable fallback rather than an unhandled promise.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
  await page.getByRole('button',{name:'Copy bookmarklet'}).click();await page.getByLabel('Bookmarklet code').waitFor();
  // A second scoring of the same opportunity merges, keeping the workflow status.
  await page.getByRole('navigation').getByRole('button',{name:/^Match/}).click();
  await page.getByLabel('Company',{exact:true}).fill('Example Company');await page.getByLabel('Job title',{exact:true}).fill('Revised Developer');
  await page.getByLabel('Job description',{exact:true}).fill('We seek a Python SQL developer to build reporting dashboards and web applications.');
  await page.getByRole('button',{name:'Analyze match'}).click();await page.getByRole('button',{name:'Save to Applications'}).click();await page.getByRole('button',{name:'Saved to Applications'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();assert.equal(await page.locator('.tracker-row').count(),1);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.waitForURL('**/login');
  assert.equal(await page.getByRole('heading',{name:'Maya Chen'}).count(),0);
  await page.getByRole('button',{name:'Forgot password?'}).click();
  await page.getByLabel('Email address',{exact:true}).fill(testEmail);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await page.getByRole('status').filter({hasText:'If an account exists'}).waitFor();
  await page.getByRole('button',{name:'Back to sign in'}).click();
  await page.getByLabel('Email address',{exact:true}).fill(testEmail);
  await page.getByLabel('Password',{exact:true}).fill(testPassword);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/app');
  await page.getByRole('heading',{name:'Maya Chen'}).waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.waitForURL('**/login');
  const secondEmail='other-'+Date.now()+'@example.test';
  await register(secondEmail);await verifyEmail(secondEmail);
  await page.getByRole('button',{name:'I’ve verified my email'}).click();
  await page.waitForURL('**/app');
  await page.getByLabel('Upload PDF resume').waitFor();
  assert.equal(await page.getByRole('heading',{name:'Maya Chen'}).count(),0,'Other accounts cannot see the profile');
  assert.equal((await db.collection('users/'+userId+'/applications').get()).size,1);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(artifacts,'flow.png'),fullPage:true});
  console.log('PASS: register → verify → upload → tailor → track → persist → deduplicate → sign out → reset → sign in → account isolation.');
})().catch(async error=>{console.error(error);console.error('Browser errors:',errors);console.error('Server logs:',logs);if(page)console.error((await page.locator('body').innerText()).slice(0,5000));process.exitCode=1;}).finally(cleanup);
