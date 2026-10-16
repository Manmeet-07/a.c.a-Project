/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers.cjs');
const profile={name:'Ada',email:'',phone:'',resumeText:'Python',skills:['Python'],updatedAt:'2026-10-16'};
const app={id:'one',job:{company:'Example',title:'Developer',description:'Python'},status:'tailored',createdAt:'2026-10-16',updatedAt:'2026-10-16'};
function storage(values=new Map()) {
  let queue=Promise.resolve();
  const navigator={locks:{request:(_key,fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}}};
  const window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},addEventListener(){},removeEventListener(){}};
  const api=load('lib/storage.ts',{window,navigator,react:{useSyncExternalStore:(_subscribe,snapshot)=>snapshot()}});
  return {api,window,values};
}
test('storage migrates legacy records, quarantines invalid data, validates results',async()=>{
  const {api,values}=storage(new Map([['aca:applications',JSON.stringify([app,{...app,id:'bad',tailorResult:{score:90,band:'bogus',aiEnhanced:'yes',matchedSkills:[],missingSkills:[],suggestions:[]}}])]]));
  assert.equal(api.getApplications().length,1);
  await api.upsertApplication({...app,id:'two',job:{...app.job,title:'Designer'}});
  assert.equal(JSON.parse(values.get('aca:applications')).version,1);
  assert.ok(values.get('aca:applications:invalid').includes('bogus'));
  assert.ok(api.useStorageWarning());
  values.set('aca:applications','{');await api.upsertApplication(app);
  assert.ok(JSON.parse(values.get('aca:applications:invalid')).includes('{'));
  values.set('aca:applications',JSON.stringify({version:99,data:[app]}));
  await assert.rejects(api.upsertApplication(app),/newer storage version/);
  assert.equal(JSON.parse(values.get('aca:applications')).version,99);
});
test('quota and blocked storage errors remain actionable; failed quarantine aborts writes',async()=>{
  const {api,window,values}=storage(new Map([['aca:applications','broken']]));
  window.localStorage.setItem=()=>{const e=new Error();e.name='QuotaExceededError';throw e;};
  assert.throws(()=>api.setProfile(profile),/storage is full/);
  await assert.rejects(api.upsertApplication(app),/storage is full/);
  assert.equal(values.get('aca:applications'),'broken');
});
test('serialized updates preserve fresh fields and merge duplicate opportunities',async()=>{
  const {api}=storage();await api.upsertApplication(app);
  await Promise.all([api.upsertApplication({...app,job:{...app.job,title:'Revised'}}),api.updateApplicationStatus('one','interviewing')]);
  assert.equal(api.getApplications()[0].job.title,'Revised');assert.equal(api.getApplications()[0].status,'interviewing');
  await api.upsertApplication({...app,id:'new-id',job:{...app.job,title:'Revised'}});
  assert.equal(api.getApplications().length,1);assert.equal(api.getApplications()[0].status,'interviewing');
});
test('backup roundtrip includes quarantine and preserves pre-import snapshot',async()=>{
  const a=storage();a.api.setProfile(profile);await a.api.upsertApplication(app);
  const backup=a.api.exportBackup();const b=storage();await b.api.importBackup(backup);
  assert.equal(b.api.getProfile().name,'Ada');assert.equal(b.api.getApplications().length,1);assert.ok(b.values.has('aca:pre-import'));
  await assert.rejects(b.api.importBackup('{'),/Invalid backup/);
});
