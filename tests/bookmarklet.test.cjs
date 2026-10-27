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
test('emergency contacts, references and employers keep their own details',()=>{
  const emergency={querySelector:()=>({textContent:'Emergency contact'}),parentElement:null};
  const inEmergency=selector=>selector==='fieldset'?emergency:null;
  const fields=[field('Full name'),field('Name',{},{closest:inEmergency}),field('Phone',{},{type:'tel',closest:inEmergency}),field('Full name',{},{name:'references[0][name]'}),field('Name',{},{name:'employer_name'}),field('Name',{autocomplete:'organization'}),field('Email',{'aria-describedby':'hint'}),field('Phone',{autocomplete:'section-emergency tel'})];
  run(fields,{hint:{textContent:'Your referee will be contacted'}});
  assert.deepEqual(fields.map(item=>item.value),[profile.name,'','','','','','','']);
});
test('social profile URLs never fall back to the personal website',()=>{
  const fields=['LinkedIn Profile URL','LinkedIn URL (optional)','GitHub profile URL','Twitter URL','Other website','Personal website'].map(name=>field(name,{autocomplete:'url'},{type:'url'}));
  run(fields);
  assert.deepEqual(fields.map(item=>item.value),[profile.linkedin,profile.linkedin,profile.github,'','',profile.website]);
});
test('invisible and off-screen controls are skipped',()=>{
  const fields=[field('Email',{},{checkVisibility:()=>false}),field('Email',{},{getBoundingClientRect:()=>({width:200,height:30,right:-9799,bottom:40})}),field('Email',{},{getBoundingClientRect:()=>({width:0,height:0,right:10,bottom:10})}),field('Email',{},{checkVisibility:()=>true,getBoundingClientRect:()=>({width:200,height:30,right:220,bottom:40})})];
  run(fields);
  assert.deepEqual(fields.map(item=>item.value),['','','',profile.email]);
});
test('common label variants and numeric postal codes are recognised',()=>{
  const fields=[field('Full name ✱'),field('Mobile phone',{},{type:'tel'}),field('Preferred phone',{},{type:'tel'}),field('State/Province'),field('Zip/Postal code',{},{type:'number'}),field('Email:')];
  run(fields);
  assert.deepEqual(fields.map(item=>item.value),[profile.name,profile.phone,profile.phone,profile.state,profile.postalCode,profile.email]);
});
