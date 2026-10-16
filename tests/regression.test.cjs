/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    if (name.startsWith('.')) return load(path.join(path.dirname(filename), name + '.ts'), mocks);
    return require(name);
  };
  vm.runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require: localRequire, ...mocks }, { filename });
  return loadedModule.exports;
}
test('tailor rejects malformed and oversized requests; valid requests score', async () => {
  const { POST } = load('app/api/tailor/route.ts', { '@/lib/ai': { getAIEnhancedSuggestions: async () => null } });
  for (const body of [null, [], 3, { resumeText: 42, jobDescription: 'x'.repeat(30) }, { resumeText: 'resume', jobDescription: 'x'.repeat(30), profileSkills: [null] }]) {
    assert.equal((await POST({ json: async () => body })).status, 400);
  }
  assert.equal((await POST({ json: async () => ({ resumeText: 'x'.repeat(100001), jobDescription: 'x'.repeat(30) }) })).status, 413);
  const response = await POST({ json: async () => ({ resumeText: 'Python SQL developer', profileSkills: ['Python', 'SQL'], jobDescription: 'Looking for a Python SQL developer' }) });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result.matchedSkills, ['Python', 'SQL']);
});
test('storage tolerates corrupt JSON, invalid shapes and unavailable storage', () => {
  const values = new Map();
  const callbacks = new Map();
  const window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }, addEventListener: (k,v) => callbacks.set(k,v), removeEventListener: k => callbacks.delete(k) };
  const storage = load('lib/storage.ts', { window, react: { useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot(); } } });
  for (const value of ['{', 'null', '42', '{}', '{"skills":[]}']) {
    values.set('aca:profile', value); values.set('aca:applications', value);
    assert.equal(storage.useProfile(), null);
    assert.equal(storage.useApplications().length, 0);
  }
  const profile = { name: 'Ada Lovelace', email: '', phone: '', skills: ['Python'], resumeText: 'Python', updatedAt: '2026-10-15' };
  storage.setProfile(profile);
  assert.equal(storage.useProfile().name, 'Ada Lovelace');
  assert.ok(callbacks.has('storage'));
  window.localStorage.getItem = () => { throw new Error('blocked'); };
  assert.equal(storage.useProfile(), null);
  assert.equal(storage.useApplications().length, 0);
});
test('bookmarklet fills contact fields while preserving employer and readonly fields', () => {
  const { buildAutofillBookmarklet } = load('lib/bookmarklet.ts');
  const fields = ['full name', 'company name', 'email address', 'first name', 'last name'].map(name => ({ name, value: '', type: 'text', labels: [], getAttribute: () => '', closest: () => null, dispatchEvent: () => {} }));
  fields.push({ ...fields[0], readOnly: true });
  const uri = buildAutofillBookmarklet({ name: 'Ada Lovelace', email: 'ada@example.test', phone: '' });
  vm.runInNewContext(decodeURIComponent(uri.slice('javascript:'.length)), { document: { querySelectorAll: () => fields }, window: { alert: () => {} }, Event: class {} });
  assert.deepEqual(fields.map(f => f.value), ['Ada Lovelace', '', 'ada@example.test', 'Ada', 'Lovelace', '']);
});

test('posting links reject script and data URLs', () => {
  const { safeWebUrl } = load('lib/urls.ts', { URL });
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '/relative', 'not a URL']) assert.equal(safeWebUrl(url), undefined);
  assert.equal(safeWebUrl('https://example.test/jobs'), 'https://example.test/jobs');
});

test('PDF profile extraction supports curly apostrophes and accented names', async () => {
  const { EventEmitter } = require('node:events');
  let lines = [];
  class Parser extends EventEmitter {
    parseBuffer() { this.emit('pdfParser_dataReady', { Pages: [{ Texts: lines.map((text,y) => ({ x: 1, y, R: [{ T: encodeURIComponent(text) }] })) }] }); }
  }
  const { POST } = load('app/api/upload/route.ts', { pdf2json: { default: Parser }, File, Buffer });
  for (const name of ['Jordan O’Neil', 'Élodie García']) {
    lines = [name, 'candidate@example.test', '415-555-0168', '48 Pine Road', 'Denver, CO 80202', 'Skills: Java, Docker'];
    const response = await POST({ formData: async () => ({ get: () => new File(['%PDF-test'], 'synthetic.pdf', { type: 'application/pdf' }) }) });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.profile.name, name);
    assert.equal(result.profile.phone, '415-555-0168');
    assert.equal(result.profile.address, '48 Pine Road');
  }
});
