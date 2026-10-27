/* eslint-disable @typescript-eslint/no-require-imports */
const React=require('react');
const {createRoot}=require('react-dom/client');
const h=React.createElement;
const initial={first:'',last:'',full:'',email:'',phone:'',address:'',city:'',state:'',postal:'',linkedin:'',github:'',portfolio:'',website:'',existing:'keep@example.test',alias:'First name',readonly:'',disabled:'',inherited:'',hidden:'',sensitive:'',company:'',country:'',multiple:'',password:'',fullMarked:'',mobile:'',province:'',zipNumber:'',linkedinProfile:'',githubOptional:'',twitter:'',invisible:'',transparent:'',offscreen:'',organization:'',reference:'',employerName:'',emergencyName:'',emergencyPhone:'',emergencyEmail:'',employerCity:''};
function ApplicationForm(){
  const [values,setValues]=React.useState(initial);
  window.applicationState=values;
  const control=(id,label,attributes={},tag='input',children=[])=>{
    const input=h(tag,{id,name:id,type:'text',...attributes,value:values[id],onChange:event=>{const value=event.target.value;window.applicationChanges.push(id);setValues(previous=>({...previous,[id]:value}));}},...children);
    return h('div',{key:id},label?h('label',{htmlFor:id},label):null,input);
  };
  return h('form',{'data-ready':true,method:'post',action:'/submit',onSubmit:event=>{event.preventDefault();window.applicationSubmissions++;}},
    h('h1',null,'Synthetic job application'),
    control('first','First name *',{name:'firstName'}),
    control('last','Last name',{name:'lastName'}),
    control('full','Full name'),
    h('span',{id:'email-label'},'Email address'),h('span',{id:'required'},'*'),
    control('email',null,{type:'email','aria-labelledby':'email-label required'}),
    control('phone','Phone number (required)',{type:'tel',autoComplete:'tel'}),
    control('address','Street address',{type:undefined,autoComplete:'street-address'},'textarea'),
    control('city','City',{autoComplete:'address-level2'}),
    h('label',null,'State',control('state',null,{type:undefined,autoComplete:'address-level1'},'select',[h('option',{key:'empty',value:''},'Choose'),h('option',{key:'ca',value:'state-ca'},'California'),h('option',{key:'ma',value:'state-ma'},'Massachusetts'),h('option',{key:'nh',value:'state-nh'},'New Hampshire'),h('option',{key:'dc',value:'state-dc'},'District of Columbia')])),
    control('postal','ZIP / Postal code',{autoComplete:'postal-code'}),
    control('linkedin','LinkedIn URL',{type:'url',autoComplete:'url'}),
    control('github','GitHub website',{type:'url',autoComplete:'url'}),
    control('portfolio','Portfolio',{type:'url',autoComplete:'url'}),
    control('website','Website',{type:'url',autoComplete:'url'}),
    control('fullMarked','Full name \u2731'),
    control('mobile','Mobile phone',{type:'tel'}),
    control('province','State/Province'),
    control('zipNumber','Zip/Postal code',{type:'number'}),
    control('linkedinProfile','LinkedIn Profile URL',{type:'url',autoComplete:'url'}),
    control('githubOptional','GitHub profile URL (optional)',{type:'url',autoComplete:'url'}),
    control('twitter','Twitter URL',{type:'url',autoComplete:'url'}),
    control('invisible','Email',{type:'email',style:{visibility:'hidden'}}),
    control('transparent','Phone',{type:'tel',style:{opacity:0}}),
    control('offscreen','City',{style:{position:'absolute',left:'-9999px'}}),
    control('organization','Name',{autoComplete:'organization'}),
    control('reference','Full name',{name:'references[0][name]'}),
    control('employerName','Name',{name:'employer_name'}),
    h('fieldset',null,h('legend',null,'Emergency contact'),control('emergencyName','Name'),control('emergencyPhone','Phone',{type:'tel'}),control('emergencyEmail','Email',{type:'email'})),
    control('existing','Email address',{type:'email'}),
    control('alias','First name',{placeholder:'First name'}),
    control('readonly','Full name',{readOnly:true}),
    control('disabled','Phone',{disabled:true}),
    h('fieldset',{disabled:true},control('inherited','Email',{type:'email'})),
    control('hidden','City',{style:{display:'none'}}),
    control('sensitive','Why do you want this job?',{type:undefined},'textarea'),
    control('company','Company name'),
    control('country','Country',{type:undefined},'select',[h('option',{key:'empty',value:''},'Choose'),h('option',{key:'us',value:'US'},'United States')]),
    h('select',{id:'multiple','aria-label':'State',multiple:true,defaultValue:[]},h('option',{value:'MA'},'Massachusetts')),
    control('password','Password',{type:'password'}),
    h('input',{id:'secret',name:'email',type:'hidden',defaultValue:''}),
    h('input',{id:'file',type:'file'}),
    h('input',{id:'work-auth',type:'checkbox','aria-label':'Authorized to work'}),
    h('h3',null,'Current employer'),
    control('employerCity','City'),
    h('button',{type:'submit'},'Submit application')
  );
}
window.applicationChanges=[];window.applicationSubmissions=0;
createRoot(document.getElementById('root')).render(h(ApplicationForm));
