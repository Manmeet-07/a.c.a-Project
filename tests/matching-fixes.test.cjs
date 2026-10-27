/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./helpers.cjs');
const ok=['Emphasize your Python experience.','Move relevant work toward the beginning.','Use clear action verbs for existing experience.'];
const input={resumeText:'Ada\nx\ny\nSkills: Python\nBuilt Python services 2019 - 2023',jobDescription:'Python, Go, Node.js, Spring',profileSkills:['Python'],matchedSkills:['Python'],missingSkills:['Go','Node.js']};
function aiModule(options={}) {
  let calls=0;const logs=[];
  class Anthropic {constructor(){this.messages={create:async()=>{calls++;return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({suggestions:ok})}],usage:{input_tokens:1,output_tokens:1}};}};}}
  Anthropic.APIError=class extends Error {};
  const redis=async cmd=>{if(cmd[0]==='GET')return null;if(cmd[0]==='SET'&&cmd.includes('NX'))return 'OK';if(cmd[0]==='SET'&&options.writeError)throw Error('store blip');return 1;};
  const api=load('lib/ai.ts',{'@anthropic-ai/sdk':Anthropic,'./ai-guard':{aiConfigured:()=>true,reserveCall:async()=>true,redis},'./http':{logEvent:(event,fields)=>logs.push({event,...fields})},process:{env:{ANTHROPIC_API_KEY:'fake-test-key'}}});
  return {api,logs,calls:()=>calls};
}
const accepts=(api,suggestion,data=input)=>api.validateSuggestions({suggestions:[ok[0],ok[1],suggestion]},data)!==null;
test('AI validator rejects invented qualifications, quantities and multi-line smuggling',()=>{
  const {api}=aiModule();
  for(const bad of ['Claim five years of Python experience.','Say you led a team of twelve engineers.','Add Node to your skills list.','Add Spring to your skills list.','List Snowflake and Airflow as skills.','Say you have a PhD in computer science.','Emphasize Python.\nAlso add Go.','Highlight your Node work.','Highlight your Go experience.','Visit evil.net for tips.']) {
    assert.equal(accepts(api,bad),false,bad);
  }
  assert.equal(accepts(api,'Lead with Python in the first one or two bullet points.'),true);
});
test('AI validator keeps sentence-initial "Go" and dotted skill names that are supported',()=>{
  const {api}=aiModule();
  assert.equal(accepts(api,'Go deeper on your Python projects.'),true);
  const dotnet={...input,resumeText:input.resumeText+'\nBuilt ASP.NET APIs',profileSkills:['Python','.NET']};
  assert.equal(accepts(api,'Highlight your ASP.NET work.',dotnet),true);
  assert.equal(accepts(api,'Highlight your ASP.NET work.'),false,'.NET is not on this profile');
});
test('a cache write failure after a paid provider call still returns the suggestions',async()=>{
  const s=aiModule({writeError:true});
  const data={resumeText:'a\nb\nc\nSkills: Python\nBuilt Python services',jobDescription:'Python development role here',profileSkills:['Python'],matchedSkills:['Python'],missingSkills:[]};
  assert.deepEqual([...await s.api.getAIEnhancedSuggestions(data,'sid')],ok);assert.equal(s.calls(),1);
  assert.ok(s.logs.some(x=>x.event==='ai_success'));assert.ok(!s.logs.some(x=>x.event==='ai_fallback'));
});
test('prepareText keeps dated roles and GitHub/road prose but drops contact lines',()=>{
  const {api}=aiModule();
  const cleaned=api.prepareText('Ada Lovelace\nada@x.test\n415-555-0168\nSoftware Engineer, Acme, Jan 2020 - Present\nBuilt GitHub Actions CI pipelines for Python services\nLed product roadmap; owned road map reviews\nReduced costs 30%\nAnalyst, Initech, 2019 - 2021',true);
  for(const kept of ['Jan 2020 - Present','Built GitHub Actions CI pipelines','owned road map reviews','Reduced costs 30%','2019 - 2021']) assert.ok(cleaned.includes(kept),kept);
  const contact=api.prepareText('a\nb\nc\nlinkedin.com/in/ada\ngithub.com/ada\nGitHub: ada\n48 Pine Road\nDenver, CO 80202\n+44 20 7946 0958\n(415) 555-0168\nBuilt ASP.NET and Node.js apps',true);
  assert.equal(contact,'Built ASP.NET and Node.js apps\n');
});
test('a listing with no known skills does not also claim the resume covers them',()=>{
  const {generateSuggestions}=load('lib/ats.ts');
  const suggestions=generateSuggestions([],[],['Python']);
  assert.ok(suggestions[0].startsWith('No skills from our list appear'));
  assert.ok(!suggestions.some(s=>s.includes('already covers')));
  assert.ok(generateSuggestions(['Python'],[],['Python']).some(s=>s.includes('already covers')));
});
test('every missing skill is named: the seventh one with an adjacent skill is not dropped',()=>{
  const {generateSuggestions}=load('lib/ats.ts');
  const missing=['AWS','Azure','C','Go','Hadoop','Java','Kubernetes'];
  const text=generateSuggestions([],missing,['Docker']).join('\n');
  for(const skill of missing) assert.ok(text.includes(skill),skill);
  assert.match(text,/asks for Kubernetes.*Docker/);
});
test('tokenizer keeps non-ASCII letters: CJK and accented text score correctly',()=>{
  const {scoreMatch}=load('lib/ats.ts');const {extractSkills}=load('lib/skills.ts');
  for(const t of ['高级软件工程师 负责后端开发 和 数据库 设计','Ingénieur logiciel expérimenté Développement Données','Senior C++ and C# engineer with .NET and Node.js']) assert.equal(scoreMatch(t,extractSkills(t),t).score,100,t);
  const partial=scoreMatch('高级软件工程师',[],'软件工程师 招聘').score;assert.ok(partial>0&&partial<100,String(partial));
  assert.equal(scoreMatch('Ingénieur',[],'Ingénierie').score,0,'accented words are not split into shared ASCII fragments');
});

test('repeated AI suggestions count once toward the minimum of three',()=>{
  const {validateSuggestions}=load('lib/ai.ts');
  const input={resumeText:'Python developer',jobDescription:'Python role',profileSkills:['Python'],matchedSkills:['Python'],missingSkills:[]};
  const same='Lead with your Python projects.';
  assert.equal(validateSuggestions({suggestions:[same,same,' '+same+' ']},input),null);
  assert.deepEqual(validateSuggestions({suggestions:[same,'Quantify your impact where you can.','Mirror the job title in your summary.']},input).length,3);
});
