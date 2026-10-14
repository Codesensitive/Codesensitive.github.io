import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samples,buildIndex,search,excerpt,evaluate} from './dist/engine.js';
test('bundled evaluation passes',()=>assert.ok(evaluate().every(c=>c.pass)));
test('uploaded corpus is actually indexed and searchable',()=>{const index=buildIndex([{id:'custom',name:'notes.txt',text:'The project codename is marigold. Deployment uses an isolated browser.'}]);assert.equal(search(index,'What is the project codename?')[0].docId,'custom');assert.match(excerpt(search(index,'codename')[0],'codename'),/marigold/);assert.equal(search(index,'platypus').length,0);});
test('chunking preserves overlap and source identity',()=>{const text=Array.from({length:150},(_,i)=>`word${i}`).join(' ');const index=buildIndex([{id:'x',name:'x.md',text}],60);assert.equal(index.chunks.length,3);assert.equal(index.chunks[1].text.split(' ')[0],'word48');assert.equal(index.chunks[1].docId,'x');});
test('empty and stop-word queries return no evidence',()=>{const index=buildIndex(samples);assert.deepEqual(search(index,'the and is'),[]);assert.deepEqual(search(buildIndex([]),'privacy'),[]);});
test('excerpt is verbatim even for untrusted document markup',()=>{const text='<script>alert(1)</script> is plain source text.';assert.equal(excerpt({text},'source'),text);});
