/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {load}=require('./helpers.cjs');
const profile={name:'Alice',email:'alice@example.test',phone:'',resumeText:'Python',skills:['Python'],updatedAt:'2026-10-20T00:00:00.000Z'};
const app={id:'one',job:{company:'Example',title:'Developer',description:'Python'},status:'tailored',createdAt:'2026-10-17',updatedAt:'2026-10-17'};
function fixture(initial=[],ls=new Map()) {
  const values=new Map(initial),listeners=new Set();
  const auth={currentUser:{uid:'alice',emailVerified:true}};
  let queue=Promise.resolve();
  const snapshot=ref=>({exists:()=>values.has(ref),data:()=>values.get(ref),metadata:{fromCache:false,hasPendingWrites:false}});
  function emit(){for(const {ref,next,collection} of listeners){next(collection?{docs:[...values].filter(([key])=>key.startsWith(ref+'/')).map(([,value])=>({data:()=>value})),metadata:{fromCache:false,hasPendingWrites:false}}:snapshot(ref));}}
  const firestore={
    doc:(_db,...parts)=>{const path=parts.join('/');return Object.assign(new String(path),{id:parts.at(-1)});},
    collection:(_db,...parts)=>parts.join('/'),
    onSnapshot:(ref,_options,next)=>{const listener={ref:String(ref),next,collection:String(ref).endsWith('/applications')};listeners.add(listener);emit();return()=>listeners.delete(listener);},
    setDoc:async(ref,value)=>{values.set(String(ref),value);emit();},
    deleteDoc:async ref=>{values.delete(String(ref));emit();},
    runTransaction:(_db,run)=>{const result=queue.then(async()=>{const operations=[];await run({get:async ref=>snapshot(String(ref)),set:(ref,value)=>operations.push(()=>values.set(String(ref),value)),update:(ref,value)=>operations.push(()=>values.set(String(ref),{...values.get(String(ref)),...value}))});operations.forEach(run=>run());emit();});queue=result.catch(()=>{});return result;},
  };
  const window={localStorage:{getItem:k=>ls.get(k)??null,setItem:(k,v)=>ls.set(k,v),removeItem:k=>ls.delete(k)},addEventListener(){},removeEventListener(){}};
  const api=load('lib/storage.ts',{'./firebase-client':{getFirebase:()=>({auth,db:{}})},'firebase/firestore':firestore,crypto:webcrypto,window,react:{useSyncExternalStore:(_subscribe,get)=>get()}});
  api.connectWorkspace('alice');
  return{api,auth,values,ls};
}
const legacy=(apps,legacyProfile)=>new Map([['aca:applications',JSON.stringify(apps)],...(legacyProfile?[['aca:profile',JSON.stringify(legacyProfile)]]:[])]);
test('a profile save started by one account is refused after switching accounts',async()=>{
  const {api,auth,values}=fixture();
  const owner=api.workspaceAccount();
  auth.currentUser=null;api.connectWorkspace(null);
  auth.currentUser={uid:'bob',emailVerified:true};api.connectWorkspace('bob');
  await assert.rejects(api.setProfile(profile,owner),/account changed/);
  assert.ok(![...values.keys()].some(key=>key.startsWith('users/bob/')));
  await api.setProfile({...profile,name:'Bob'},api.workspaceAccount());
  assert.equal(api.getProfile().name,'Bob');
});
test('re-saving a job keeps stored URL and description unless new ones are given',async()=>{
  const {api}=fixture();
  const job=()=>({...api.getApplications()[0].job});
  await api.upsertApplication({...app,job:{...app.job,url:'',description:'Full description'}});
  await api.upsertApplication({...app,id:'tracker',job:{...app.job,url:'https://jobs.example/1',description:''}});
  assert.equal(api.getApplications().length,1);
  assert.deepEqual(job(),{company:'Example',title:'Developer',url:'https://jobs.example/1',description:'Full description'});
  await api.upsertApplication({...app,id:'tailor',job:{...app.job,url:'',description:'Updated description'}});
  assert.equal(api.getApplications().length,1);
  assert.deepEqual(job(),{company:'Example',title:'Developer',url:'https://jobs.example/1',description:'Updated description'});
});
test('legacy import keeps the newest duplicate, skips invalid records and keeps a newer account profile',async()=>{
  const newer={...app,status:'offer',updatedAt:'2026-10-19'};
  const older={...app,id:'old',updatedAt:'2026-10-18'};
  const oversized={...app,id:'big',job:{company:'Big',title:'Role',description:'x'.repeat(60000)}};
  const {api,values,ls}=fixture([],legacy([newer,older,oversized],{...profile,name:'Stale',updatedAt:'2026-01-01'}));
  await api.setProfile(profile);
  assert.equal(api.hasLegacyBrowserData(),true);
  assert.equal((await api.importLegacyBrowserData()).skipped,1);
  assert.equal(api.getApplications().length,1);
  assert.equal(api.getApplications()[0].status,'offer');
  assert.equal(values.get('users/alice/profile/current').name,'Alice');
  assert.equal(api.hasLegacyBrowserData(),false);
  assert.ok(ls.get('aca:applications').includes('Big'));
});
test('legacy import fills an empty profile; regular backups still replace it',async()=>{
  const {api}=fixture([],legacy([],{...profile,name:'Legacy',updatedAt:'2026-01-01'}));
  await api.importLegacyBrowserData();
  assert.equal(api.getProfile().name,'Legacy');
  await api.importBackup(JSON.stringify({version:1,entries:{'aca:profile':JSON.stringify({version:1,data:{...profile,name:'Older',updatedAt:'2025-01-01'}})}}));
  assert.equal(api.getProfile().name,'Older');
});
test('accounts stay within the 400-application backup limit',async()=>{
  const existing=Array.from({length:400},(_,i)=>[`users/alice/applications/a${i}`,{...app,id:`a${i}`,job:{...app.job,title:`Role ${i}`}}]);
  const {api}=fixture(existing);
  assert.equal(api.getApplications().length,400);
  await assert.rejects(api.upsertApplication({...app,id:'new',job:{...app.job,title:'Another'}}),/up to 400/);
  await api.upsertApplication({...app,id:'a1',job:{...app.job,title:'Role 1'},notes:'still editable'});
  assert.equal(api.getApplications().find(item=>item.id==='a1').notes,'still editable');
  const backup=JSON.stringify({version:1,entries:{'aca:applications':JSON.stringify({version:1,data:[{...app,id:'extra',job:{...app.job,title:'Extra'}}]})}});
  await assert.rejects(api.importBackup(backup),/over 400/);
  assert.equal(api.getApplications().length,400);
  await api.importBackup(api.exportBackup());
  assert.equal(api.getApplications().length,400);
});
