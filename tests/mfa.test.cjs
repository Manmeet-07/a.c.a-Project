/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers.cjs');
function setup(overrides={}) {
  const calls=[];
  const user={uid:'alice',email:'alice@example.test',emailVerified:true,providerData:[{providerId:'password'},{providerId:'google.com'}],getIdToken:async refresh=>calls.push(['token',refresh])};
  const mfa={enrolledFactors:[{uid:'registered-totp',factorId:'totp'},{uid:'phone',factorId:'phone'}],getSession:async()=>({testSession:true}),enroll:async assertion=>calls.push(['enroll',assertion]),unenroll:async id=>calls.push(['remove',id])};
  class GoogleAuthProvider {setCustomParameters(value){this.parameters=value;}}
  const api=load('lib/mfa.ts',{
    './firebase-client':{getFirebase:()=>({auth:'test-auth'})},
    'firebase/auth':{
      multiFactor:()=>mfa,GoogleAuthProvider,EmailAuthProvider:{credential:(email,password)=>({email,password})},
      reauthenticateWithPopup:(actual,provider)=>{calls.push(['google',actual.uid,provider.parameters.prompt]);return Promise.resolve();},
      reauthenticateWithCredential:(actual,credential)=>{calls.push(['password',actual.uid,credential.email]);return Promise.resolve();},
      getMultiFactorResolver:(auth,error)=>({auth,error}),
      TotpMultiFactorGenerator:{FACTOR_ID:'totp',generateSecret:async session=>({testSecret:true,session}),assertionForEnrollment:(secret,code)=>({secret,code}),assertionForSignIn:(id,code)=>({id,code})},
      ...overrides,
    },
  });
  return{api,calls,user,mfa};
}
test('MFA sign-in requires a registered TOTP factor and exactly six digits',async()=>{
  const {api}=setup();let resolved=0;
  const resolver={hints:[{uid:'valid',factorId:'totp'},{uid:'phone',factorId:'phone'}],resolveSignIn:async assertion=>{resolved++;assert.equal(assertion.id,'valid');assert.equal(assertion.code,'012345');}};
  for(const code of ['123','1234567','123x56',''])assert.throws(()=>api.resolveTotp(resolver,'valid',code));
  for(const uid of ['other','phone'])assert.throws(()=>api.resolveTotp(resolver,uid,'012345'));
  assert.equal(resolved,0);
  await api.resolveTotp(resolver,'valid','012345');assert.equal(resolved,1);
  const rejected={...resolver,resolveSignIn:async()=>{throw {code:'auth/invalid-verification-code'};}};
  await assert.rejects(api.resolveTotp(rejected,'valid','012345'),error=>error.code==='auth/invalid-verification-code');
});
test('Enrollment requires verified email and confirmation before Firebase enables the factor',async()=>{
  const {api,user,calls}=setup();
  await assert.rejects(api.beginTotpEnrollment({...user,emailVerified:false}));
  const secret=await api.beginTotpEnrollment(user);
  assert.equal(calls.length,0,'Generating a setup key must not enroll the user');
  await assert.rejects(api.finishTotpEnrollment(user,secret,'invalid'));
  assert.equal(calls.length,0);
  await api.finishTotpEnrollment(user,secret,'012345');
  assert.equal(calls[0][0],'enroll');assert.equal(calls[1][0],'token');assert.equal(calls[1][1],true);
});
test('Security reauthentication binds to the current user and removal cannot target an unknown factor',async()=>{
  const {api,user,calls}=setup();
  assert.throws(()=>api.reauthenticateForSecurity({...user,providerData:[]},'google.com',''));
  assert.throws(()=>api.reauthenticateForSecurity(user,'password',''));
  const popup=api.reauthenticateForSecurity(user,'google.com','');
  assert.deepEqual(calls[0],['google','alice','select_account']);await popup;
  await api.reauthenticateForSecurity(user,'password','synthetic-only');
  assert.deepEqual(calls[1],['password','alice','alice@example.test']);
  await assert.rejects(api.removeTotp(user,'not-enrolled'));
  await assert.rejects(api.removeTotp(user,'phone'));
  await api.removeTotp(user,'registered-totp');assert.deepEqual(calls[2],['remove','registered-totp']);
});
test('MFA error handling starts a challenge only for MFA errors and never exposes provider data',()=>{
  const {api}=setup();assert.equal(api.mfaResolver({code:'auth/wrong-password'}),null);
  assert.equal(api.mfaResolver({code:'auth/multi-factor-auth-required'}).auth,'test-auth');
  assert.match(api.mfaError({code:'auth/invalid-verification-code'}),/incorrect or expired/);
  assert.match(api.mfaError({code:'auth/invalid-multi-factor-session'}),/expired/);
  assert.equal(api.mfaError({message:'PRIVATE_BACKEND_PAYLOAD'}).includes('PRIVATE_BACKEND_PAYLOAD'),false);
});
