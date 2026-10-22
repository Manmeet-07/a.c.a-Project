/* eslint-disable @typescript-eslint/no-require-imports */
// Opt-in live Firebase test. Caller supplies an authorized Admin Auth instance
// and an isolated browser page; no real user's credentials are used or logged.
const assert=require('node:assert/strict');
const {createHmac,randomUUID}=require('node:crypto');
function totp(secret,offset=0) {
  let bits='';for(const char of secret.toUpperCase().replace(/=+$/,'')){const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);assert.ok(n>=0);bits+=n.toString(2).padStart(5,'0');}
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(byte=>parseInt(byte,2)));
  const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));
  const digest=createHmac('sha1',key).update(time).digest();const position=digest[digest.length-1]&15;
  return ((digest.readUInt32BE(position)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
function wrongCode(secret){const valid=new Set([-1,0,1].map(offset=>totp(secret,offset)));return ['000000','111111','222222','333333'].find(code=>!valid.has(code));}
async function freshCode(secret,previous){for(let attempt=0;attempt<65;attempt++){const code=totp(secret);if(code!==previous)return code;await new Promise(resolve=>setTimeout(resolve,500));}throw Error('Authenticator clock did not advance');}
module.exports=async function checkMfa({page,adminAuth,origin,confirmTestAccountCreation=false}) {
  assert.equal(confirmTestAccountCreation,true,'Explicit authorization to create and remove a synthetic account is required');
  const email='aca-mfa-test-'+Date.now()+'@example.test';const password=randomUUID()+'-Aa1!';let user;
  page.setDefaultTimeout(60000);
  async function signIn(){await page.goto(origin+'/login');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();}
  async function security(){await page.goto(origin+'/settings/security');await page.getByRole('heading',{name:'Two-factor authentication',exact:true}).waitFor();}
  async function startSetup(){await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();await page.getByLabel('Current password',{exact:true}).fill(password);await page.getByRole('button',{name:'Confirm password',exact:true}).click();await page.getByLabel('Authenticator setup key',{exact:true}).waitFor();return page.getByLabel('Authenticator setup key',{exact:true}).inputValue();}
  try {
    user=await adminAuth.createUser({email,password,emailVerified:true,displayName:'Synthetic MFA test'});
    await signIn();await page.waitForURL('**/app');
    await page.getByRole('heading',{name:'Protect your account.',exact:true}).waitFor();
    await page.getByRole('button',{name:'Set up 2FA',exact:true}).click();
    await page.getByRole('heading',{name:'Two-factor authentication',exact:true}).waitFor();
    await page.getByRole('status').filter({hasText:'Two-factor authentication is off.'}).waitFor();
    await page.getByLabel('Current password',{exact:true}).fill('Incorrect-synthetic-password');
    await page.getByRole('button',{name:'Confirm password',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'We couldn’t confirm your sign-in.'}).waitFor();
    assert.equal(await page.getByLabel('Authenticator setup key',{exact:true}).count(),0);
    await page.getByLabel('Current password',{exact:true}).fill(password);await page.getByRole('button',{name:'Confirm password',exact:true}).click();
    await page.getByLabel('Authenticator setup key',{exact:true}).waitFor();
    assert.equal(((await adminAuth.getUser(user.uid)).multiFactor?.enrolledFactors.length || 0),0,'Displaying a QR code alone must not enable MFA');
    await page.getByRole('button',{name:'Cancel setup',exact:true}).click();
    assert.equal(await page.getByLabel('Authenticator setup key',{exact:true}).count(),0,'Cancel clears the setup key');
    const secret=await startSetup();
    assert.equal(await page.getByRole('button',{name:'Enable two-factor authentication',exact:true}).isDisabled(),true);
    await page.getByRole('checkbox',{name:/I have secured my authenticator backup/}).check();
    await page.getByLabel('Authenticator code',{exact:true}).fill(wrongCode(secret));
    await page.getByRole('button',{name:'Enable two-factor authentication',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'incorrect or expired'}).waitFor();
    assert.equal(((await adminAuth.getUser(user.uid)).multiFactor?.enrolledFactors.length || 0),0);
    let lastAcceptedCode=totp(secret);
    await page.getByLabel('Authenticator code',{exact:true}).fill(lastAcceptedCode);
    await page.getByRole('button',{name:'Enable two-factor authentication',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Two-factor authentication is on.'}).waitFor();
    assert.equal(((await adminAuth.getUser(user.uid)).multiFactor?.enrolledFactors.length || 0),1);
    assert.equal(await page.getByLabel('Authenticator setup key',{exact:true}).count(),0);
    await page.getByRole('link',{name:'Back to workspace'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');
    await signIn();await page.getByRole('heading',{name:'Verify your sign-in.'}).waitFor();
    assert.equal(new URL(page.url()).pathname,'/login','Password alone cannot open the workspace');
    const denied=await page.request.post(origin+'/api/upload',{headers:{origin,'content-type':'multipart/form-data; boundary=test'},data:'{}'});assert.equal(denied.status(),401);
    await page.getByLabel('Authenticator code',{exact:true}).fill(wrongCode(secret));await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'incorrect or expired'}).waitFor();assert.equal(new URL(page.url()).pathname,'/login');
    await page.getByRole('button',{name:'Cancel verification',exact:true}).click();await signIn();await page.getByRole('heading',{name:'Verify your sign-in.'}).waitFor();
    lastAcceptedCode=await freshCode(secret,lastAcceptedCode);
    await page.getByLabel('Authenticator code',{exact:true}).fill(lastAcceptedCode);await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.waitForURL('**/app');
    await page.getByRole('navigation',{name:'Main navigation',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Not now',exact:true}).count(),0,'Enrolled users cannot skip the required code challenge');
    await security();await page.getByRole('button',{name:'Remove authenticator 1',exact:true}).click();
    await page.getByLabel('Current password',{exact:true}).fill(password);await page.getByRole('button',{name:'Confirm password',exact:true}).click();
    await page.getByRole('heading',{name:'Verify your sign-in.'}).waitFor();
    await page.getByLabel('Authenticator code',{exact:true}).fill(wrongCode(secret));await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'incorrect or expired'}).waitFor();
    assert.equal(((await adminAuth.getUser(user.uid)).multiFactor?.enrolledFactors.length || 0),1,'Incorrect removal challenge must preserve MFA');
    lastAcceptedCode=await freshCode(secret,lastAcceptedCode);
    await page.getByLabel('Authenticator code',{exact:true}).fill(lastAcceptedCode);await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.waitForURL('**/login');
    assert.equal(((await adminAuth.getUser(user.uid)).multiFactor?.enrolledFactors.length || 0),0);
    await signIn();await page.waitForURL('**/app');
    await page.getByRole('heading',{name:'Protect your account.',exact:true}).waitFor();
    await page.getByRole('button',{name:'Not now',exact:true}).click();
    await page.getByRole('navigation',{name:'Main navigation',exact:true}).waitFor();
    console.log('PASS: real Firebase TOTP enrollment, cancellation, incorrect codes, sign-in enforcement, and reauthenticated removal. No secrets logged.');
  } finally {if(user)await adminAuth.deleteUser(user.uid);}
};
