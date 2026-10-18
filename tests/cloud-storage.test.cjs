/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {load}=require('./helpers.cjs');
const profile={name:'Alice',email:'alice@example.test',phone:'',resumeText:'Python',skills:['Python'],updatedAt:'2026-10-17'};
const application={id:'one',job:{company:'Example',title:'Developer',description:'Python'},status:'tailored',createdAt:'2026-10-17',updatedAt:'2026-10-17'};
function fixture() {
  const values=new Map(),listeners=new Set();
  const auth={currentUser:{uid:'alice',emailVerified:true}};
  let queue=Promise.resolve();let fail=false;
  const snapshot=ref=>({exists:()=>values.has(ref),data:()=>values.get(ref),metadata:{fromCache:false,hasPendingWrites:false}});
  function emit(){for(const {ref,next,collection} of listeners){next(collection?{docs:[...values].filter(([key])=>key.startsWith(ref+'/')).map(([,value])=>({data:()=>value})),metadata:{fromCache:false,hasPendingWrites:false}}:snapshot(ref));}}
  const firestore={
    doc:(_db,...parts)=>parts.join('/'),collection:(_db,...parts)=>parts.join('/'),
    onSnapshot:(ref,_options,next)=>{const listener={ref,next,collection:ref.endsWith('/applications')};listeners.add(listener);emit();return()=>listeners.delete(listener);},
    setDoc:async(ref,value)=>{if(fail)throw{code:'permission-denied'};values.set(ref,value);emit();},
    deleteDoc:async ref=>{values.delete(ref);emit();},
    runTransaction:(_db,run)=>{const result=queue.then(async()=>{if(fail)throw{code:'permission-denied'};const operations=[];await run({get:async ref=>snapshot(ref),set:(ref,value)=>operations.push(()=>values.set(ref,value)),update:(ref,value)=>operations.push(()=>values.set(ref,{...values.get(ref),...value}))});operations.forEach(run=>run());emit();});queue=result.catch(()=>{});return result;},
  };
  const api=load('lib/storage.ts',{'./firebase-client':{getFirebase:()=>({auth,db:{}})},'firebase/firestore':firestore,crypto:webcrypto,react:{useSyncExternalStore:(_subscribe,get)=>get()}});
  api.connectWorkspace('alice');
  return{api,auth,values,deny:()=>{fail=true;}};
}
test('cloud workspace clears all account snapshots and rejects writes after sign-out',async()=>{
  const {api,auth,values}=fixture();
  await api.setProfile(profile);await api.upsertApplication(application);
  assert.equal(api.getProfile().name,'Alice');assert.equal(api.getApplications().length,1);
  auth.currentUser={uid:'bob',emailVerified:true};api.connectWorkspace('bob');
  assert.equal(api.getProfile(),null);assert.equal(api.getApplications().length,0);
  assert.ok(!api.exportBackup().includes('alice@example.test'));
  assert.ok([...values.keys()].every(key=>key.startsWith('users/alice/')));
  auth.currentUser=null;api.connectWorkspace(null);
  await assert.rejects(api.setProfile(profile),/sign in/);
  assert.throws(()=>api.exportBackup(),/sign in/);
});
test('cloud transactions deduplicate opportunities and preserve workflow status',async()=>{
  const {api}=fixture();
  await api.upsertApplication(application);
  const id=api.getApplications()[0].id;
  await api.updateApplicationStatus(id,'interviewing');
  await api.upsertApplication({...application,id:'other',notes:'Updated'});
  assert.equal(api.getApplications().length,1);
  assert.equal(api.getApplications()[0].status,'interviewing');
  assert.equal(api.getApplications()[0].notes,'Updated');
  await api.deleteApplication(id);assert.equal(api.getApplications().length,0);
});
test('cloud imports validate before writes, merge applications, and keep a recovery snapshot',async()=>{
  const {api,values}=fixture();await api.setProfile(profile);await api.upsertApplication(application);
  const backup=api.exportBackup();
  await assert.rejects(api.importBackup('{'),/Invalid backup/);
  const count=values.size;
  await api.importBackup(backup);
  assert.equal(values.size,count);
  assert.equal(api.getApplications().length,1);
  assert.ok(api.exportPreviousBackup().includes('alice@example.test'));
});
test('permission failures remain actionable and never change the visible snapshot',async()=>{
  const {api,deny}=fixture();await api.setProfile(profile);deny();
  await assert.rejects(api.setProfile({...profile,name:'changed'}),/denied/);
  assert.equal(api.getProfile().name,'Alice');
});
