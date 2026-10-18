/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {load}=require('./helpers.cjs');
const {buildAutofillBookmarklet}=load('lib/bookmarklet.ts');
const profile={name:'Maya Chen',email:'maya@example.test',phone:'202-555-0142',address:'123 Maple Street',city:'Boston',state:'MA',postalCode:'02110',github:'https://github.com/maya-dev',linkedin:'https://linkedin.com/in/maya',website:'https://maya.dev',portfolio:'https://maya.dev/portfolio'};
function field(name,attributes={},extra={}) { return {tagName:'INPUT',name,value:'',type:'text',labels:[],getAttribute:key=>attributes[key]||'',closest:()=>null,dispatchEvent:()=>{},...extra}; }
function run(fields,nodes={}) {
  vm.runInNewContext(decodeURIComponent(buildAutofillBookmarklet(profile).slice(11)),{document:{querySelectorAll:()=>fields,getElementById:id=>nodes[id]},window:{alert(){}},Event:class{}});
}
test('specific profile links take priority over generic URL autocomplete',()=>{
  const fields=['GitHub URL','LinkedIn profile','Portfolio website','Website'].map(name=>field(name,{autocomplete:'url'},{type:'url'}));
  run(fields);
  assert.deepEqual(fields.map(item=>item.value),[profile.github,profile.linkedin,profile.portfolio,profile.website]);
});
test('contact matching handles accessible labels, camelCase names and required markers',()=>{
  const fields=[field('firstName'),field('lastName'),field('opaque',{'aria-labelledby':'email-label required'}),field('Phone number (required)'),field('postalCode'),field('State or region')];
  run(fields,{'email-label':{textContent:'Email address'},required:{textContent:'*'}});
  assert.deepEqual(fields.map(item=>item.value),['Maya','Chen',profile.email,profile.phone,profile.postalCode,profile.state]);
});
test('address textareas and matching state dropdown options fill and emit input/change events',()=>{
  const events=[];
  const fields=[field('Street address',{}, {tagName:'TEXTAREA',type:'textarea'}),field('State',{}, {tagName:'SELECT',type:'select-one',options:[{value:'',textContent:'Choose'},{value:'state-ma',textContent:'Massachusetts'}]})];
  fields.forEach(item=>item.dispatchEvent=event=>events.push(event.type));
  // The fake Event records the same event names native controls must receive.
  vm.runInNewContext(decodeURIComponent(buildAutofillBookmarklet(profile).slice(11)),{document:{querySelectorAll:()=>fields},window:{alert(){}},Event:class{constructor(type){this.type=type;}}});
  assert.deepEqual(fields.map(item=>item.value),[profile.address,'state-ma']);
  assert.deepEqual(events,['input','change','input','change']);
});
test('existing answers, disabled/hidden controls, screening fields and unmatched selects stay unchanged',()=>{
  const fields=[field('First name',{}, {value:'First name',placeholder:'First name'}),field('Email',{}, {disabled:true}),field('Email',{}, {readOnly:true}),field('Email',{}, {matches:()=>true}),field('Email',{}, {getClientRects:()=>[]}),field('Why do you want this job?',{}, {tagName:'TEXTAREA',type:'textarea'}),field('State',{}, {tagName:'SELECT',type:'select-one',options:[{value:'CA',textContent:'California'}]}),field('Email',{}, {type:'hidden'})];
  run(fields);
  assert.deepEqual(fields.map(item=>item.value),['First name','','','','','','','']);
});
