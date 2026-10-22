/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers.cjs');

test('optional MFA offer choice belongs to one account and clears for the next sign-in',()=>{
  const values=new Map([['unrelated-app-setting','keep']]);
  const sessionStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const api=load('lib/mfa-offer.ts',{window:{sessionStorage}});
  assert.equal(api.readMfaOfferChoice('alice'),false);
  api.saveMfaOfferChoice('alice');
  assert.equal(api.readMfaOfferChoice('alice'),true);
  assert.equal(api.readMfaOfferChoice('bob'),false);
  api.clearMfaOfferChoice();
  assert.equal(api.readMfaOfferChoice('alice'),false);
  assert.equal(values.get('unrelated-app-setting'),'keep');
});

test('blocked session storage does not prevent choosing or clearing the optional offer',()=>{
  const window={get sessionStorage(){throw Error('Storage unavailable');}};
  const api=load('lib/mfa-offer.ts',{window});
  assert.equal(api.readMfaOfferChoice('alice'),false);
  assert.doesNotThrow(()=>api.saveMfaOfferChoice('alice'));
  assert.doesNotThrow(()=>api.clearMfaOfferChoice());
});
