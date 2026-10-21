/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers.cjs');

test('Google sign-in opens the popup immediately and asks the user to choose an account',()=>{
  const auth={};const expected=Promise.resolve({user:{uid:'google-user'}});let called=false;
  class GoogleAuthProvider { setCustomParameters(parameters){this.parameters=parameters;} }
  const api=load('lib/google-auth.ts',{
    './firebase-client':{getFirebase:()=>({auth})},
    'firebase/auth':{GoogleAuthProvider,signInWithPopup:(actual,provider)=>{
      called=true;assert.equal(actual,auth);assert.equal(provider.parameters.prompt,'select_account');return expected;
    }},
  });
  assert.equal(api.signInWithGoogle(),expected);
  assert.equal(called,true,'No asynchronous setup before opening the popup');
});

test('Google sign-in errors give safe recovery guidance without exposing provider details',()=>{
  const {googleSignInError}=load('lib/google-auth.ts',{'./firebase-client':{},'firebase/auth':{}});
  for(const code of ['auth/popup-closed-by-user','auth/cancelled-popup-request'])assert.equal(googleSignInError({code}),'');
  assert.match(googleSignInError({code:'auth/popup-blocked'}),/Allow popups/);
  assert.match(googleSignInError({code:'auth/unauthorized-domain'}),/email and password/);
  assert.match(googleSignInError({code:'auth/operation-not-allowed'}),/not configured/);
  assert.match(googleSignInError({code:'auth/account-exists-with-different-credential'}),/original method/);
  assert.match(googleSignInError({code:'auth/network-request-failed'}),/connection/);
  assert.equal(googleSignInError({message:'PRIVATE_PROVIDER_RESPONSE'}).includes('PRIVATE_PROVIDER_RESPONSE'),false);
});

test('security policy permits only the configured Firebase auth frame, retaining frame embedding protection',()=>{
  const {proxy}=load('proxy.ts',{
    process:{env:{NODE_ENV:'production',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'demo-aca.firebaseapp.com'}},
    'next/server':{NextResponse:{next:()=>({headers:new Headers()})}},
  });
  const csp=proxy({headers:new Headers()}).headers.get('Content-Security-Policy');
  assert.match(csp,/frame-src 'self' https:\/\/demo-aca\.firebaseapp\.com;/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.equal(csp.includes('unsafe-eval'),false);
  assert.equal(csp.includes('http://127.0.0.1'),false);
});
