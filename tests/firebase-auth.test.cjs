/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const { spawnSync } = require('node:child_process');
test('Firebase verifier loads when the server disables experimental require(ESM)', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', "require('firebase-admin/app'); require('firebase-admin/auth');"], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || 'Firebase verifier failed to load');
});
function guard({verified=true, reject=false, configured=true}={}) {
  return load('lib/firebase-server.ts', {
    process:{env:configured?{FIREBASE_PROJECT_ID:'demo-aca'}:{}},
    'firebase-admin/app':{getApps:()=>[],initializeApp:()=>({})},
    'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async token=>{if(reject||token!=='signed-token')throw Error('invalid');return{uid:'alice',email_verified:verified};}})},
  });
}
test('backend authorization rejects missing, forged, expired and unverified tokens', async()=>{
  await assert.rejects(guard().requireUser(new Request('http://localhost/api/upload')),e=>e.status===401);
  for(const value of ['forged','expired']) await assert.rejects(guard().requireUser(new Request('http://localhost',{headers:{authorization:'Bearer '+value}})),e=>e.status===401);
  const signed=new Request('http://localhost',{headers:{authorization:'Bearer signed-token'}});
  assert.equal(await guard().requireUser(signed),'alice');
  await assert.rejects(guard({verified:false}).requireUser(signed),e=>e.status===403);
  await assert.rejects(guard({configured:false}).requireUser(signed),e=>e.status===503);
});
test('every processing endpoint invokes authorization before reading personal data',async()=>{
  const { RequestError }=load('lib/http.ts');
  // The loaded route has its own RequestError class; use its HTTP mock as well.
  const http=load('lib/http.ts');
  for(const route of ['upload','tailor','session']) {
    let checked=false;
    const api=load(`app/api/${route}/route.ts`,{
      '@/lib/http':http,
      '@/lib/firebase-server':{requireUser:async()=>{checked=true;throw new http.RequestError(401,'Please sign in');}},
    });
    const type=route==='upload'?'multipart/form-data; boundary=test':'application/json';
    const response=await api.POST(new Request(`http://localhost/api/${route}`,{method:'POST',headers:{origin:'http://localhost','content-type':type},body:'{}'}));
    assert.equal(checked,true);
    assert.equal(response.status,401);
  }
  assert.ok(RequestError);
});
test('workspace schema rejects privileged fields, malformed backups and unsafe IDs',()=>{
  const data=load('lib/workspace-data.ts');
  const profile={name:'Alice',email:'',phone:'',resumeText:'Python',skills:['Python'],updatedAt:'2026-10-17'};
  assert.ok(data.isProfile(profile));
  assert.equal(data.isProfile({...profile,role:'admin'}),false);
  assert.equal(data.isProfile({...profile,skills:[{name:'Python'}]}),false);
  assert.equal(data.isProfile({...profile,resumeText:'x'.repeat(100001)}),false);
  assert.throws(()=>data.parseBackup('{'),/Invalid backup/);
  assert.throws(()=>data.parseBackup(JSON.stringify({version:1,entries:{'aca:profile':JSON.stringify({...profile,ownerId:'other'})}})),/invalid records/);
});
