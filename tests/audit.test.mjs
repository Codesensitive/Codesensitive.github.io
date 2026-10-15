import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EmbeddingClient} from '../dist/embeddings.js';
import {LLMClient} from '../dist/llm.js';
import {addSamples} from '../dist/corpus.js';
import {samples} from '../dist/engine.js';
import {buildGroundedPrompt} from '../dist/llm-models.js';
import {readDocument} from '../dist/documents.js';
import {imageDimensions} from '../dist/image-info.js';
import {recognizeImage} from '../dist/ocr.js';
import {prepareSite} from '../scripts/prepare-site.mjs';

for(const Client of [EmbeddingClient,LLMClient]){
 test(`${Client.name}: late errors cannot kill a new worker`,async()=>{
  const workers=[],client=new Client(()=>{const w={postMessage(data){this.last=data;},terminate(){this.terminated=true;}};workers.push(w);return w;});
  const first=client.request({action:'load'});client.cancel();await assert.rejects(first,/cancelled/);
  const second=client.request({action:'load'});workers[0].onerror({message:'late failure'});workers[0].onmessageerror();
  assert.equal(workers[1].terminated,undefined);workers[1].onmessage({data:{id:workers[1].last.id,type:'result',value:42}});assert.equal(await second,42);client.cancel();
 });
 test(`${Client.name}: send failures clean pending work and permit retry`,async()=>{
  let attempts=0,worker;const client=new Client(()=>worker={postMessage(data){if(!attempts++)throw new Error('DataCloneError');this.last=data;},terminate(){}});
  await assert.rejects(client.request({action:'load'}),/could not be sent/);assert.equal(client.pending.size,0);
  const retry=client.request({action:'load'});worker.onmessage({data:{id:worker.last.id,type:'result',value:'ok'}});assert.equal(await retry,'ok');client.cancel();
 });
 test(`${Client.name}: startup failures reject and concurrent operations are blocked`,async()=>{
  const bad=new Client(()=>{throw new Error('Workers blocked');});await assert.rejects(bad.request({}),/could not start/);
  const client=new Client(()=>({postMessage(){},terminate(){}})),pending=client.request({});
  await assert.rejects(client.request({}),/already running/);client.cancel();await assert.rejects(pending,/cancelled/);
 });
}
test('sample loading preserves uploads, deduplicates and enforces the corpus limit',()=>{
 const own={id:'own',name:'private.txt',text:'My uploaded text.'};const first=addSamples([own],samples);
 assert.equal(first[0],own);assert.equal(addSamples(first,samples).length,4);assert.throws(()=>addSamples([own],samples,3),/slots/);
 first[1].text='changed';assert.notEqual(samples[0].text,'changed');
});
test('generation context retains relevant evidence near the end of long chunks',()=>{
 const text='Background information about an unrelated subject. '.repeat(30)+'The launch date is 21 November 2026.';
 const prompt=buildGroundedPrompt('What is the launch date?',Array.from({length:5},(_,i)=>({name:`doc${i}.txt`,text})));
 assert.ok(prompt.sources.every(source=>source.text.includes('21 November 2026')));assert.ok(prompt.sources.every(source=>text.includes(source.text)));
});
test('non-ASCII questions and escaped filenames fit a bounded prompt without hanging',()=>{
 const question='界'.repeat(500),prompt=buildGroundedPrompt(question,Array.from({length:5},()=>({name:'\n\\"'.repeat(100),text:'😀 context '.repeat(300)})));
 assert.equal(prompt.questionUsed,question);assert.equal(prompt.questionTruncated,false);
 assert.ok(new TextEncoder().encode(prompt.messages.map(item=>item.content).join('')).length<=3400);
 assert.ok(prompt.sources.every(source=>!source.source.includes('\n')));
});
const png=(w,h)=>{const buffer=new ArrayBuffer(24),data=new Uint8Array(buffer),view=new DataView(buffer);data.set([137,80,78,71,13,10,26,10]);view.setUint32(16,w);view.setUint32(20,h);return buffer;};
test('image dimension checks reject oversized images before pixel decoding',async()=>{
 assert.deepEqual(imageDimensions(png(800,600)),{width:800,height:600});
 await assert.rejects(readDocument(new File([png(100000,100000)],'huge.png'),()=>{},{ocr:true}),/16-megapixel/);
 assert.throws(()=>imageDimensions(new ArrayBuffer(10)),/PNG\/JPEG/);
 const jpg=new Uint8Array([255,216,255,192,0,7,8,2,88,3,32]);assert.deepEqual(imageDimensions(jpg.buffer),{width:800,height:600});
});
test('uploads can be aborted before or during file reading and have an overall deadline',async()=>{
 const abort=new AbortController();abort.abort();let read=false;
 const stuck={name:'notes.txt',size:100,arrayBuffer(){read=true;return new Promise(()=>{});}};
 await assert.rejects(readDocument(stuck,()=>{},{signal:abort.signal}),/abort/i);assert.equal(read,false);
 const running=new AbortController(),job=readDocument(stuck,()=>{},{signal:running.signal});running.abort();await assert.rejects(job,/abort/i);
 await assert.rejects(readDocument(stuck,()=>{},{timeoutMs:5}),/timed out/);
});
test('OCR cancellation and deadlines stop initialized workers exactly once',async()=>{
 for(const kind of ['cancel','timeout']){
  let stopped=0,ready;const started=new Promise(resolve=>ready=resolve),abort=new AbortController();
  const job=recognizeImage('image',()=>{},{signal:abort.signal,timeoutMs:kind==='timeout'?5:1000,createWorker:async()=>({recognize(){ready();return new Promise(()=>{});},terminate(){stopped++;}})});
  await started;if(kind==='cancel')abort.abort();await assert.rejects(job,kind==='cancel'?/abort/i:/timed out/);assert.equal(stopped,1);
 }
});
test('OCR workers that initialize after cancellation are also released',async()=>{
 let initialize,stopped=0;const abort=new AbortController(),job=recognizeImage('image',()=>{},{signal:abort.signal,createWorker:()=>new Promise(resolve=>initialize=resolve)});
 abort.abort();await assert.rejects(job,/abort/i);initialize({terminate(){stopped++;}});await new Promise(resolve=>setImmediate(resolve));assert.equal(stopped,1);
});
test('build fingerprints imported modules and workers and updates parent hashes',t=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'evidence-build-test-'));
 t.after(()=>{if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('evidence-build-test-'))rmSync(root,{recursive:true,force:true});});
 writeFileSync(path.join(root,'index.html'),'<link href="style.css"><link href="/case-study.css"><script src="app.js"></script>');writeFileSync(path.join(root,'style.css'),'body{color:black}');
 writeFileSync(path.join(root,'case-study.css'),'.case{color:green}');writeFileSync(path.join(root,'evidence-lab.html'),'<link href="/style.css"><link href="/case-study.css">');
 writeFileSync(path.join(root,'app.js'),"import './client.js?v=old';");writeFileSync(path.join(root,'client.js'),"new Worker(new URL('./worker.js?v=old',import.meta.url));");writeFileSync(path.join(root,'worker.js'),"import './vendor/runtime.js'; const version=1;");
 const first=prepareSite(root);assert.ok(readFileSync(path.join(root,'assets',first['worker.js']),'utf8').includes('../vendor/runtime.js'));
 writeFileSync(path.join(root,'worker.js'),"import './vendor/runtime.js'; const version=2;");writeFileSync(path.join(root,'case-study.css'),'.case{color:blue}');const second=prepareSite(root);
 assert.notEqual(first['case-study.css'],second['case-study.css']);
 for(const page of ['index.html','evidence-lab.html']){const html=readFileSync(path.join(root,page),'utf8');assert.ok(html.includes(`assets/${second['case-study.css']}`));assert.ok(html.includes(`assets/${second['style.css']}`));}
 for(const name of ['app.js','client.js','worker.js'])assert.notEqual(first[name],second[name]);
 for(const [name,filename] of Object.entries(second))assert.ok(existsSync(path.join(root,'assets',filename)),name);
 assert.deepEqual(prepareSite(root),second);assert.equal(readdirSync(path.join(root,'assets')).length,5);
 assert.ok(readFileSync(path.join(root,'index.html'),'utf8').includes(`assets/${second['app.js']}`));
});

import {checkedAnswer} from '../dist/answer-check.js';
import {uniqueEvidence} from '../dist/retrieval.js';
test('uncited or invalidly cited generated claims fall back to exact source excerpts',()=>{
 const hits=[{name:'brief.pdf',text:'The launch date is 21 November 2026.'}],sources=[{citation:1}];
 for(const answer of ['The launch date is 18 December 2026.','The launch date is 18 December 2026. [9]']){
  const checked=checkedAnswer(answer,sources,hits,'launch date');assert.equal(checked.fallback,true);assert.equal(checked.text,'The launch date is 21 November 2026. [1]');
 }
 assert.equal(checkedAnswer('The supplied evidence does not answer this question.',sources,hits,'launch').fallback,false);
 assert.equal(checkedAnswer('Launch is 21 November 2026. [1]',sources,hits,'launch').fallback,false);
});
test('duplicate passages cannot crowd unique evidence out of the final results',()=>{
 const first={id:'a',text:'same content'},duplicate={id:'b',text:'same   content'},other={id:'c',text:'different content'};
 assert.deepEqual(uniqueEvidence([first,duplicate,other],2),[first,other]);
});

test('adding samples also respects the extracted-text byte budget',()=>{
 assert.throws(()=>addSamples([{id:'own',text:'12345'}],[{id:'sample',text:'界'}],20,7),/8 MB/);
});
