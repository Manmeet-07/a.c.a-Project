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
let server,browser,page;
const errors=[];
let logs='';
async function cleanup(){if(browser){await browser.close().catch(()=>{});browser=null;}if(server){const child=server;server=null;child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup().finally(()=>process.exit(1));});
async function port(){const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const value=listener.address().port;await new Promise(r=>listener.close(r));return value;}
(async()=>{
  const origin=`http://127.0.0.1:${await port()}`;
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',new URL(origin).port],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,ANTHROPIC_API_KEY:'',APP_ORIGINS:origin}});
  server.stdout.on('data',b=>{logs=(logs+b).slice(-8000);});server.stderr.on('data',b=>{logs=(logs+b).slice(-8000);});
  let ready=false;
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw Error('Server failed to start: '+logs);
  const response=await fetch(origin);const csp=response.headers.get('content-security-policy');assert.ok(csp.includes('nonce-'));assert.equal(response.headers.get('x-powered-by'),null);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const bundled=chromium.executablePath();
  const candidates=[process.env.PLAYWRIGHT_EXECUTABLE_PATH,bundled,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  const executablePath=candidates.find(p=>fs.existsSync(p));
  if(!executablePath)throw Error('Install Chromium with npx playwright install chromium or set PLAYWRIGHT_EXECUTABLE_PATH');
  browser=await chromium.launch({executablePath,headless:true});
  page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  const lines=['Maya Chen','maya@example.test','202-555-0142','123 Maple Street','Boston, MA 02110','Skills: Python, SQL, React, TypeScript','Experience','Built reporting dashboards and web applications.'];
  await page.getByLabel('Upload PDF resume').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf(lines)});
  await page.getByRole('heading',{name:'Hello, Maya.'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Tailor a resume/}).click();
  await page.getByLabel('Company',{exact:true}).fill('Example Company');
  await page.getByLabel('Job title',{exact:true}).fill('Python Developer');
  await page.getByLabel('Job description',{exact:true}).fill('We seek a Python SQL developer to build reporting dashboards and web applications.');
  assert.equal(await page.getByRole('checkbox').isChecked(),false);
  await page.getByRole('button',{name:'Analyze match'}).click();
  await page.getByRole('button',{name:'Save to application tracker'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/My profile/}).click();
  await page.getByRole('navigation').getByRole('button',{name:/Tailor a resume/}).click();
  assert.ok((await page.getByLabel('Job description',{exact:true}).inputValue()).includes('Python SQL'));
  await page.getByLabel('Job title',{exact:true}).fill('Revised Developer');
  await page.getByRole('button',{name:'Save to application tracker'}).click();
  await page.getByRole('button',{name:'Saved to tracker'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();
  await page.getByLabel('Application status for Revised Developer').selectOption('interviewing');
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();
  assert.equal(await page.getByLabel('Application status for Revised Developer').inputValue(),'interviewing');
  // Clipboard rejection must provide a selectable fallback rather than an unhandled promise.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
  await page.getByRole('button',{name:'Copy bookmarklet'}).click();await page.getByLabel('Bookmarklet code').waitFor();
  // A second scoring of the same opportunity merges, keeping the workflow status.
  await page.getByRole('navigation').getByRole('button',{name:/Tailor a resume/}).click();
  await page.getByLabel('Company',{exact:true}).fill('Example Company');await page.getByLabel('Job title',{exact:true}).fill('Revised Developer');
  await page.getByLabel('Job description',{exact:true}).fill('We seek a Python SQL developer to build reporting dashboards and web applications.');
  await page.getByRole('button',{name:'Analyze match'}).click();await page.getByRole('button',{name:'Save to application tracker'}).click();await page.getByRole('button',{name:'Saved to tracker'}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Applications/}).click();assert.equal(await page.locator('.tracker-row').count(),1);
  // Storage failures are surfaced without changing the persisted record.
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});
  await page.getByLabel('Application status for Revised Developer').selectOption('offer');await page.getByRole('alert').filter({hasText:'storage is full'}).waitFor();
  assert.deepEqual(errors,[]);
  const artifacts=path.resolve('tests/artifacts');fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,'flow.png'),fullPage:true});
  console.log('PASS: upload → tailor → navigate → track → persist → deduplicate → clipboard/storage failures; production headers and hydration.');
})().catch(async error=>{console.error(error);console.error('Browser errors:',errors);console.error('Server logs:',logs);if(page)console.error((await page.locator('body').innerText()).slice(0,5000));process.exitCode=1;}).finally(cleanup);
