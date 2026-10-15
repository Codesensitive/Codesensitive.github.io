import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
let sequence=0;
const HOLD=Symbol('hold');
async function setup(t,behavior=()=>{}){
 const dom=new JSDOM(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'http://localhost/',pretendToBeVisual:true});
 const document=dom.window.document,requests=[],workers=[],downloads=[];
 class FakeWorker{
  constructor(url){this.kind=url.pathname.includes('embedding')?'embedding':'llm';workers.push(this);}
  postMessage(payload){
   const request={kind:this.kind,...payload};requests.push(request);
   const override=behavior(request);if(override===HOLD)return;
   queueMicrotask(()=>{
    if(this.terminated)return;
    if(override?.error){this.onmessage({data:{id:payload.id,type:'error',message:override.error}});return;}
    const value=override?.value??(this.kind==='embedding'?(payload.action==='activate'?{chunks:payload.chunks.length}:payload.chunks.length?[{i:0,score:.9}]:[]):payload.action==='generate'?{answer:'The launch date is 21 November 2026. [1]',finishReason:'stop',usage:{total_tokens:40}}:{model:payload.model});
    this.onmessage({data:{id:payload.id,type:'result',value}});
   });
  }
  terminate(){this.terminated=true;}
 }
 const old={};for(const [key,value] of Object.entries({document,window:dom.window,Worker:FakeWorker,matchMedia:()=>({matches:true}),caches:{delete:async()=>true}})){old[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 dom.window.HTMLAnchorElement.prototype.click=function(){downloads.push(this.href);};
 t.after(()=>{
  for(const id of ['cancel-simple','cancel-llm','cancel-model']){const button=document.getElementById(id);if(button&&!button.disabled)button.click();}
  dom.window.close();for(const key of Object.keys(old)){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}
 });
 await import(`../dist/app.js?test=${++sequence}`);
 const $=selector=>document.querySelector(selector),click=id=>$('#'+id).click();
 async function until(predicate){const end=Date.now()+4000;while(!predicate()){if(Date.now()>end)throw new Error('UI did not reach the expected state');await new Promise(resolve=>setTimeout(resolve,5));}}
 const idle=()=>until(()=>$('#lab-panel').getAttribute('aria-busy')!=='true');
 async function upload(files){Object.defineProperty($('#files'),'files',{configurable:true,value:files});$('#files').dispatchEvent(new dom.window.Event('change'));await idle();}
 async function ask(question){$('#question').value=question;$('#query-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await idle();}
 const change=(id,value)=>{$('#'+id).value=value;$('#'+id).dispatchEvent(new dom.window.Event('change'));};
 return {$,click,until,idle,upload,ask,change,requests,workers,downloads,dom};
}
const file=()=>new File(['The launch date is 21 November 2026. The owner is Anuj Yadav.'],'brief.txt');

test('Simple answer model does not silently enable generation in Advanced evidence-only mode',async t=>{
 const app=await setup(t);await app.upload([file()]);await app.ask('What is the launch date?');
 assert.ok(app.$('.generated-answer'));assert.ok(app.requests.some(request=>request.action==='load'&&request.model==='small'));
 app.click('mode-advanced');const before=app.requests.filter(request=>request.action==='generate').length;
 await app.ask('What is the launch date?');assert.equal(app.$('.generated-answer'),null);
 assert.equal(app.requests.filter(request=>request.action==='generate').length,before);assert.match(app.$('#llm-status').textContent,/Advanced answer mode: evidence only/);
});
test('Advanced answer selection survives Simple model use and reloads its configured model',async t=>{
 const app=await setup(t);app.click('mode-advanced');app.change('answer-model','tiny');app.click('load-llm');await app.idle();
 await app.upload([file()]);app.click('mode-simple');await app.ask('launch date');
 app.click('mode-advanced');await app.ask('launch date');
 assert.deepEqual(app.requests.filter(request=>request.action==='load').map(request=>request.model),['tiny','small','tiny']);
 assert.equal(app.requests.filter(request=>request.action==='generate').at(-1).model,'tiny');
});
test('adding sample documents preserves uploaded files and repeated clicks do not duplicate samples',async t=>{
 const app=await setup(t);await app.upload([file()]);app.click('try-samples');app.click('try-samples');
 assert.equal(app.$('#doc-count').textContent,'04');assert.match(app.$('#documents').textContent,/brief.txt/);assert.match(app.$('#status').textContent,/uploads are preserved/);
});
test('cancelling a batch upload keeps earlier documents and stops reading remaining files',async t=>{
 const app=await setup(t);let started=false,third=false;
 const stuck={name:'slow.txt',size:10,arrayBuffer(){started=true;return new Promise(()=>{});}},later={name:'later.txt',size:10,arrayBuffer(){third=true;return new TextEncoder().encode('later').buffer;}};
 Object.defineProperty(app.$('#files'),'files',{configurable:true,value:[file(),stuck,later]});app.$('#files').dispatchEvent(new app.dom.window.Event('change'));
 await app.until(()=>started);app.click('cancel-simple');await app.idle();
 assert.equal(app.$('#doc-count').textContent,'01');assert.equal(third,false);assert.match(app.$('#status').textContent,/Upload cancelled/);assert.equal(app.$('#mode-advanced').disabled,false);
});
test('Simple model failures preserve source excerpts and yield an actionable fallback message',async t=>{
 const app=await setup(t,request=>request.kind==='llm'&&request.action==='load'?{error:'WebGPU is unavailable.'}:undefined);
 await app.upload([file()]);await app.ask('launch date');assert.ok(app.$('.excerpt'));assert.equal(app.$('.generated-answer'),null);assert.match(app.$('#status').textContent,/WebGPU.*source excerpts/i);
});
test('Simple falls back to BM25 after an embedding failure and still answers locally',async t=>{
 const app=await setup(t,request=>request.kind==='embedding'?{error:'Network offline'}:undefined);await app.upload([file()]);await app.ask('launch date');
 assert.ok(app.$('.generated-answer'));assert.match(app.$('#status').textContent,/keyword search/);app.click('mode-advanced');app.click('results');
 app.$('#results button.quiet').click();const trace=await(await fetch(app.downloads.at(-1))).json();assert.equal(trace.mode,'bm25');
});
test('no-evidence queries can be exported and do not invoke a language model',async t=>{
 const app=await setup(t);app.click('mode-advanced');await app.upload([file()]);await app.ask('xylophonic quasars');
 assert.match(app.$('#results').textContent,/No matching evidence/);app.$('#results button.quiet').click();
 const trace=await(await fetch(app.downloads.at(-1))).json();assert.deepEqual(trace.results,[]);assert.equal(trace.interfaceMode,'advanced');assert.equal(app.requests.length,0);
});
test('source markup and generated markup render as inert text',async t=>{
 const payload='<img src=x onerror=alert(1)>',app=await setup(t,request=>request.action==='generate'?{value:{answer:payload+' [1]',finishReason:'stop'}}:undefined);
 await app.upload([new File(['The launch date is today. '+payload],'unsafe.txt')]);await app.ask('launch date');assert.equal(app.$('#results img'),null);assert.match(app.$('.generated-text').textContent,/<img/);
});
test('clearing a different cached answer model does not unload the active answer worker',async t=>{
 const app=await setup(t);app.click('mode-advanced');app.change('answer-model','small');app.click('load-llm');await app.idle();
 const worker=app.workers.at(-1);app.change('answer-model','larger');app.click('clear-llm');await app.idle();
 assert.equal(worker.terminated,undefined);await app.upload([file()]);await app.ask('launch date');assert.equal(app.requests.filter(request=>request.action==='load').length,1);assert.ok(app.$('.generated-answer'));
});
test('comparison cancellation returns control and preserves uploaded documents',async t=>{
 const app=await setup(t,request=>request.kind==='embedding'&&request.action==='activate'?HOLD:undefined);app.click('mode-advanced');await app.upload([file()]);app.click('compare-methods');
 assert.equal(app.$('#mode-simple').disabled,true);app.click('cancel-model');await app.idle();assert.equal(app.$('#doc-count').textContent,'01');assert.match(app.$('#comparison').textContent,/cancelled/i);assert.equal(app.$('#mode-simple').disabled,false);
});

test('an uncited incorrect model answer is replaced by source text in the UI and trace',async t=>{
 const app=await setup(t,request=>request.action==='generate'?{value:{answer:'The launch date is 18 December 2026.',finishReason:'stop'}}:undefined);
 await app.upload([file()]);await app.ask('launch date');assert.match(app.$('.generated-text').textContent,/21 November 2026/);assert.doesNotMatch(app.$('.generated-text').textContent,/18 December/);assert.match(app.$('.generated-answer h4').textContent,/fallback/);
 app.click('mode-advanced');app.$('#results button.quiet').click();const trace=await(await fetch(app.downloads.at(-1))).json();assert.equal(trace.generation.displayMode,'source-excerpts');assert.match(trace.generation.answer,/18 December/);assert.match(trace.generation.displayedAnswer,/21 November/);
});

test('failed embedding activation preserves the previously active strategy',async t=>{
 let fail=false;const app=await setup(t,request=>fail&&request.action==='activate'?{error:'Allocation failed'}:undefined);
 app.click('mode-advanced');await app.upload([file()]);app.change('embedding-model','minilm');app.click('activate-model');await app.idle();fail=true;app.change('embedding-model','bge');app.click('activate-model');await app.idle();
 assert.match(app.$('#model-status').textContent,/Active: MiniLM/);assert.match(app.$('#status').textContent,/Previous retrieval mode preserved/);
});
test('failed answer model replacement preserves the previous Advanced configuration',async t=>{
 const app=await setup(t,request=>request.action==='load'&&request.model==='small'?{error:'Allocation failed'}:undefined);
 app.click('mode-advanced');app.change('answer-model','tiny');app.click('load-llm');await app.idle();app.change('answer-model','small');app.click('load-llm');await app.idle();assert.match(app.$('#llm-status').textContent,/Advanced answer mode: SmolLM2/);
 await app.upload([file()]);await app.ask('launch date');assert.equal(app.requests.filter(request=>request.action==='generate').at(-1).model,'tiny');
});

test('Simple uses BM25 without embedding requests when the corpus exceeds 200 chunks',async t=>{
 const app=await setup(t);await app.upload([new File([('launch date November. ').repeat(10000)],'large-corpus.txt')]);await app.ask('launch date');
 assert.equal(app.requests.filter(request=>request.kind==='embedding').length,0);assert.match(app.$('#status').textContent,/keyword search/);assert.ok(app.$('.generated-answer'));
});
test('batch uploads enforce the 20-document limit without dropping accepted files',async t=>{
 const app=await setup(t);await app.upload(Array.from({length:21},(_,i)=>new File(['Launch date November.'],`doc${i}.txt`)));assert.equal(app.$('#doc-count').textContent,'20');assert.match(app.$('#status').textContent,/20 documents/);
});
test('batch uploads enforce the 8 MiB extracted-text limit',async t=>{
 const app=await setup(t),data='a'.repeat(2*1024*1024);await app.upload([...Array.from({length:4},(_,i)=>new File([data],`doc${i}.txt`)),new File(['x'],'overflow.txt')]);
 assert.equal(app.$('#doc-count').textContent,'04');assert.match(app.$('#status').textContent,/8 MB/);assert.doesNotMatch(app.$('#documents').textContent,/overflow.txt/);
});
