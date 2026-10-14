import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samples,buildIndex,search,excerpt,evaluate} from './dist/engine.js';
import {readFile} from 'node:fs/promises';
import {readDocument,validateFile,MAX_FILE_BYTES} from './dist/documents.js';

const fixture=async name=>{const data=await readFile(new URL(`./tests/fixtures/${name}`,import.meta.url));return new File([data],name);};
test('bundled evaluation passes',()=>assert.ok(evaluate().every(c=>c.pass)));
test('uploaded corpus is actually indexed and searchable',()=>{const index=buildIndex([{id:'custom',name:'notes.txt',text:'The project codename is marigold. Deployment uses an isolated browser.'}]);assert.equal(search(index,'What is the project codename?')[0].docId,'custom');assert.match(excerpt(search(index,'codename')[0],'codename'),/marigold/);assert.equal(search(index,'platypus').length,0);});
test('chunking preserves overlap and source identity',()=>{const text=Array.from({length:150},(_,i)=>`word${i}`).join(' ');const index=buildIndex([{id:'x',name:'x.md',text}],60);assert.equal(index.chunks.length,3);assert.equal(index.chunks[1].text.split(' ')[0],'word48');assert.equal(index.chunks[1].docId,'x');});
test('empty and stop-word queries return no evidence',()=>{const index=buildIndex(samples);assert.deepEqual(search(index,'the and is'),[]);assert.deepEqual(search(buildIndex([]),'privacy'),[]);});
test('excerpt is verbatim even for untrusted document markup',()=>{const text='<script>alert(1)</script> is plain source text.';assert.equal(excerpt({text},'source'),text);});

test('PDF extraction, retrieval and page citations work end to end',async()=>{
  const parsed=await readDocument(await fixture('project-brief.pdf'));
  assert.equal(parsed.pageCount,2);assert.match(parsed.text,/Marigold/);
  const index=buildIndex([{id:'pdf',name:'project-brief.pdf',...parsed}]);
  const codename=search(index,'What is the project codename?')[0];
  assert.equal(codename.page,1);assert.match(excerpt(codename,'project codename'),/Marigold/);
  const launch=search(index,'What is the launch date?')[0];
  assert.equal(launch.page,2);assert.match(excerpt(launch,'launch date'),/21 November 2026/);
  assert.equal(search(index,'quasar platypus').length,0);
});
test('PDF chunks never join different pages',()=>{
  const index=buildIndex([{id:'p',name:'p.pdf',text:'alpha beta',pages:[{page:1,text:'alpha'},{page:2,text:''},{page:3,text:'beta'}]}]);
  assert.deepEqual(index.chunks.map(chunk=>chunk.page),[1,3]);
});
test('decimal numbers remain intact in excerpts',()=>assert.equal(excerpt({text:'The latency target is 42.5 milliseconds. The owner is Anuj.'},'latency target'),'The latency target is 42.5 milliseconds.'));
test('empty/image-only PDF reports OCR requirement',async()=>assert.rejects(()=>fixture('no-text.pdf').then(file=>readDocument(file)),/No selectable text.*OCR/));
test('password-protected PDF reports an actionable error',async()=>assert.rejects(()=>fixture('locked.pdf').then(file=>readDocument(file)),/Password-protected/));
test('broken PDF is rejected',async()=>assert.rejects(()=>fixture('broken.pdf').then(file=>readDocument(file)),/PDF/));
test('PDF page count limit is enforced before extraction',async()=>assert.rejects(()=>fixture('too-many-pages.pdf').then(file=>readDocument(file)),/100-page limit/));
test('text ingestion still works and rejects invalid files',async()=>{
  const document=await readDocument(await fixture('extra.txt'));assert.match(document.text,/Mira Sen/);
  await assert.rejects(()=>readDocument(new File([new Uint8Array([255])],'bad.txt')),/UTF-8/);
  await assert.rejects(()=>readDocument(new File(['\0binary'],'bad.txt')),/Binary/);
  assert.throws(()=>validateFile({name:'large.pdf',size:MAX_FILE_BYTES+1}),/2 MB/);
  assert.throws(()=>validateFile({name:'image.png',size:20}),/Use a/);
});
