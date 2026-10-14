import {cpSync,mkdirSync} from 'node:fs';
const source=new URL('../node_modules/pdfjs-dist/',import.meta.url);
const target=new URL('../dist/vendor/pdfjs/',import.meta.url);
mkdirSync(target,{recursive:true});
for(const [from,to] of [['legacy/build/pdf.mjs','pdf.mjs'],['legacy/build/pdf.worker.mjs','pdf.worker.mjs'],['LICENSE','LICENSE'],['cmaps','cmaps'],['standard_fonts','standard_fonts'],['wasm','wasm']])cpSync(new URL(from,source),new URL(to,target),{recursive:true});
console.log('Local PDF.js runtime prepared.');
