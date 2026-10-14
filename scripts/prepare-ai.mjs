import {cpSync,mkdirSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
function copy(from,to){const destination=new URL(`dist/vendor/${to}`,root);mkdirSync(new URL('./',destination),{recursive:true});cpSync(new URL(`node_modules/${from}`,root),destination,{recursive:true});}
copy('@huggingface/transformers/dist/transformers.min.js','transformers/transformers.js');
copy('@huggingface/transformers/LICENSE','transformers/LICENSE');
for(const file of ['ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm'])copy(`onnxruntime-web/dist/${file}`,`ort/${file}`);
copy('onnxruntime-web/README.md','ort/README.md');
copy('tesseract.js/dist/tesseract.esm.min.js','ocr/tesseract.js');
copy('tesseract.js/dist/worker.min.js','ocr/worker.min.js');
copy('tesseract.js/dist/worker.min.js.LICENSE.txt','ocr/worker.LICENSE.txt');
copy('tesseract.js/LICENSE.md','ocr/LICENSE.md');
for(const file of readdirSync(new URL('node_modules/tesseract.js-core/',root)).filter(file=>file.includes('.wasm')))copy(`tesseract.js-core/${file}`,`ocr/core/${file}`);
copy('tesseract.js-core/LICENSE','ocr/core/LICENSE');
copy('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','ocr/lang/eng.traineddata.gz');
copy('@tesseract.js-data/eng/README.md','ocr/lang/README.md');
console.log('Pinned browser embedding and OCR runtimes prepared.');
