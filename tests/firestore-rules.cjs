/* eslint-disable @typescript-eslint/no-require-imports */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } = require('firebase/firestore');
let environment;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Run this suite through npm run test:firebase; a real project must never be used.');
  environment = await initializeTestEnvironment({ projectId: 'demo-aca', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await environment?.cleanup(); });
const profile = { name: 'Alice', email: 'alice@example.test', phone: '', resumeText: 'Python', skills: ['Python'], updatedAt: '2026-10-17T00:00:00Z' };
const application = { id: 'one', job: { company: 'Example', title: 'Developer', description: 'Python' }, status: 'tailored', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z' };
const database = (uid, verified = true) => environment.authenticatedContext(uid, { email_verified: verified }).firestore();
test('verified owners can use their workspace; strangers and signed-out users cannot', async () => {
  const alice = database('alice'); const bob = database('bob'); const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(alice,'users/alice/profile/current'), profile));
  await assertSucceeds(getDoc(doc(alice,'users/alice/profile/current')));
  await assertFails(getDoc(doc(bob,'users/alice/profile/current')));
  await assertFails(getDoc(doc(anonymous,'users/alice/profile/current')));
  await assertFails(setDoc(doc(bob,'users/alice/profile/current'), profile));
  await assertFails(deleteDoc(doc(bob,'users/alice/profile/current')));
  await assertFails(setDoc(doc(database('unverified',false),'users/unverified/profile/current'),profile));
  await assertFails(getDoc(doc(database('alice',false),'users/alice/profile/current')));
});
test('profile create and update enforce types, allowed fields, skill elements and length', async () => {
  const db = database('schema'); const ref = doc(db,'users/schema/profile/current');
  for (const value of [{...profile,role:'admin'}, {...profile,skills:[{name:'Python'}]}, {...profile,skills:['invented']}, {...profile,resumeText:'x'.repeat(100001)}, {...profile,phone:7}]) await assertFails(setDoc(ref,value));
  await assertSucceeds(setDoc(ref,profile));
  await assertFails(updateDoc(ref,{role:'admin'}));
  await assertFails(updateDoc(ref,{skills:[42]}));
  await assertSucceeds(updateDoc(ref,{name:'Alice Updated'}));
});
test('applications support owner queries and transactions without identity or update bypasses', async () => {
  const db = database('apps'); const ref = doc(db,'users/apps/applications/one');
  await assertSucceeds(setDoc(ref,application));
  await assertSucceeds(getDocs(collection(db,'users/apps/applications')));
  await assertFails(getDocs(collection(database('stranger'),'users/apps/applications')));
  await assertFails(updateDoc(ref,{id:'another'}));
  await assertFails(updateDoc(ref,{createdAt:'changed'}));
  await assertFails(updateDoc(ref,{status:'administrator'}));
  await assertFails(updateDoc(ref,{ownerId:'stranger'}));
  const result = {score:50,band:'Moderate match',aiEnhanced:false,matchedSkills:['Python'],missingSkills:[],suggestions:['Emphasize your Python experience.']};
  await assertSucceeds(updateDoc(ref,{tailorResult:result}));
  await assertFails(updateDoc(ref,{tailorResult:{...result,suggestions:[{html:'bad'}]}}));
  await assertFails(updateDoc(ref,{tailorResult:{...result,score:101}}));
  await assertSucceeds(updateDoc(ref,{status:'interviewing'}));
  await assertSucceeds(deleteDoc(ref));
  await assertFails(getDocs(collection(db,'users')));
});
test('default-deny blocks undefined collections and profile documents', async () => {
  const db = database('alice');
  await assertFails(setDoc(doc(db,'users/alice/profile/extra'),profile));
  await assertFails(setDoc(doc(db,'users/alice'),{role:'admin'}));
  assert.ok(true);
});
