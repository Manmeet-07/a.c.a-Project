/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const cache = new Map();
  function read(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const localRequire = name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/')) return read(name.slice(2) + '.ts');
      if (name.startsWith('.')) return read(path.join(path.dirname(filename), name + '.ts'));
      return require(name);
    };
    vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: localRequire, process, Buffer, File, Blob, FormData, Request, Response, Headers, URL, TextDecoder, TextEncoder, AbortSignal, Uint8Array, crypto: require('node:crypto').webcrypto, setTimeout, clearTimeout, console: {info(){}}, ...mocks }, { filename });
    return loaded.exports;
  }
  return read(file);
}
function pdf(lines, pages = 1) {
  const stream = 'BT /F1 12 Tf 50 740 Td ' + lines.map((l,i) => (i ? '0 -24 Td ' : '') + '(' + l.replace(/[\\()]/g, '\\$&') + ') Tj').join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${i+5} 0 R`).join(' ')}] /Count ${pages} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  for(let i=0;i<pages;i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>');
  let data = '%PDF-1.4\n'; const offsets=[];
  objs.forEach((obj,i)=>{offsets.push(Buffer.byteLength(data)); data+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(data);
  return Buffer.from(data+`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
async function pdfWithLinks(lines, links) {
  const { PDFDocument, PDFName, PDFString, PDFHexString }=require('pdf-lib');
  const document=await PDFDocument.load(pdf(lines));
  const annotations=links.map((link,index)=>document.context.register(document.context.obj({
    Type:'Annot',Subtype:'Link',Rect:[50,700-index*20,150,720-index*20],
    A:{S:'URI',URI:index%2 ? PDFHexString.fromText(link) : PDFString.of(link)},
  })));
  document.getPages()[0].node.set(PDFName.of('Annots'),document.context.obj(annotations));
  return Buffer.from(await document.save());
}
module.exports = { load, pdf, pdfWithLinks };
