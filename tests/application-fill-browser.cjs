/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
module.exports=async function checkApplicationFill(context,bookmarklet){
  const {webpack}=require('next/dist/compiled/webpack/webpack');
  const output=path.resolve('tests/artifacts/application-fixture');
  await new Promise((resolve,reject)=>{
    const compiler=webpack({mode:'development',target:'web',devtool:false,entry:path.resolve('tests/fixtures/application-form.cjs'),output:{path:output,filename:'application.js'},optimization:{minimize:false}});
    compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
  });
  const job=await context.newPage();
  const errors=[];const requests=[];
  job.on('pageerror',error=>errors.push(error.message));
  job.on('request',request=>requests.push({method:request.method(),url:request.url()}));
  try{
    await job.route('https://applications.example.test/**',route=>route.fulfill({status:200,contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html',body:route.request().url().endsWith('.js')?fs.readFileSync(path.join(output,'application.js'),'utf8'):'<!doctype html><html><head><title>Test application</title></head><body><div id="root"></div><script src="/application.js"></script></body></html>'}));
    await job.goto('https://applications.example.test/apply');
    await job.locator('form[data-ready]').waitFor();
    await job.evaluate(()=>{window.alert=message=>{window.applicationAlert=message;};});
    const script=decodeURIComponent(bookmarklet.slice('javascript:'.length));
    await job.evaluate(script);
    const expected={first:'Maya',last:'Chen',full:'Maya Chen',email:'maya@example.test',phone:'202-555-0142',address:'123 Maple Street',city:'Boston',state:'state-ma',postal:'02110',linkedin:'https://linkedin.com/in/maya',github:'https://github.com/maya-dev',portfolio:'https://maya.dev/portfolio',website:'https://maya.dev'};
    await job.waitForFunction(expected=>Object.entries(expected).every(([id,value])=>window.applicationState[id]===value),expected);
    for(const [id,value] of Object.entries(expected))assert.equal(await job.locator('#'+id).inputValue(),value,id);
    const untouched={existing:'keep@example.test',alias:'First name',readonly:'',disabled:'',inherited:'',hidden:'',sensitive:'',company:'',country:'',password:''};
    for(const [id,value] of Object.entries(untouched))assert.equal(await job.locator('#'+id).inputValue(),value,'Preserve '+id);
    assert.deepEqual(await job.locator('#multiple').evaluate(element=>Array.from(element.selectedOptions).map(option=>option.value)),[]);
    assert.equal(await job.locator('#secret').inputValue(),'');assert.equal(await job.locator('#file').inputValue(),'');
    assert.equal(await job.locator('#work-auth').isChecked(),false);
    assert.equal(await job.evaluate(()=>window.applicationSubmissions),0);
    assert.equal(await job.evaluate(()=>new Set(window.applicationChanges).size),13);
    // Repeated runs only restore cleared contacts; they preserve the user's edits.
    await job.locator('#github').fill('https://github.com/user-choice');
    await job.locator('#city').fill('');
    await job.evaluate(script);
    await job.waitForFunction(()=>window.applicationState.city==='Boston');
    assert.equal(await job.locator('#github').inputValue(),'https://github.com/user-choice');
    assert.equal(await job.evaluate(()=>window.applicationSubmissions),0);
    assert.equal(requests.filter(request=>request.method!=='GET'||request.url.includes('/submit')).length,0);
    assert.deepEqual(errors,[]);
    await job.screenshot({path:path.resolve('tests/artifacts/application-filled.png'),fullPage:true});
    console.log('PASS: all 13 contact fields filled in a React application; 14 protected controls preserved; no submission; repeat-run edits preserved.');
  }finally{await job.close();}
};
