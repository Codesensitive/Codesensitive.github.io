import {test} from 'node:test';
import assert from 'node:assert/strict';
import {samples,buildIndex,search,excerpt,evaluate} from './dist/engine.js';
import {readFile} from 'node:fs/promises';
import {readDocument,validateFile,MAX_FILE_BYTES} from './dist/documents.js';
import {MODEL_CATALOG,modelInfo,cosine,rankVectors} from './dist/models.js';
import {createWorker as createOcrWorker} from 'tesseract.js';
import {fileURLToPath} from 'node:url';
import {fuseRankings,queryMetrics,aggregateMetrics,retrievalProfile} from './dist/retrieval.js';
import {benchmarkDocuments,benchmarkQueries} from './dist/benchmark.js';

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
  assert.throws(()=>validateFile({name:'report.docx',size:20}),/Use a/);
});
test('OCR images require explicit opt in',async()=>assert.rejects(()=>readDocument(new File(['image'],'scan.png')),/Enable English OCR/));
test('supported local model metadata has distinct IDs and pooling',()=>{
  assert.notEqual(MODEL_CATALOG.minilm.id,MODEL_CATALOG.bge.id);
  assert.equal(modelInfo('minilm').pooling,'mean');assert.equal(modelInfo('bge').pooling,'cls');
  assert.match(modelInfo('bge').prefix,/searching relevant passages/);
  assert.throws(()=>modelInfo('gemini'),/supported local/);
});
test('cosine ranking normalizes vectors and enforces dimensions',()=>{
  assert.equal(cosine([2,0],[3,0]),1);assert.equal(cosine([0,0],[3,0]),0);
  assert.throws(()=>cosine([1,0],[1]),/dimensions/);
  assert.deepEqual(rankVectors([[0,1],[3,0],[-1,0]],[1,0],2),[{i:1,score:1}]);
});
test('English OCR recognizes the synthetic scanned image',async()=>{
  const worker=await createOcrWorker('eng',1,{langPath:fileURLToPath(new URL('./node_modules/@tesseract.js-data/eng/4.0.0_best_int/',import.meta.url)),cacheMethod:'none'});
  try{
    const {data}=await worker.recognize(fileURLToPath(new URL('./tests/fixtures/scanned-note.png',import.meta.url)));
    assert.match(data.text,/observatory codename is Cobalt/);
    assert.match(data.text,/18 December 2026/);
  }finally{await worker.terminate();}
});
test('RRF rewards agreement and retains both rank explanations',()=>{
  const lexical=[{id:'exact',score:999},{id:'shared',score:7}],semantic=[{id:'meaning',score:.99},{id:'shared',score:.6}];
  const hits=fuseRankings(lexical,semantic,3);
  assert.equal(hits[0].id,'shared');assert.equal(hits[0].score,2/62);
  assert.equal(hits[0].lexicalRank,2);assert.equal(hits[0].semanticRank,2);
  assert.equal(hits[0].bm25Score,7);assert.equal(hits[0].cosineScore,.6);
  assert.equal(hits[1].semanticRank,null);assert.equal(hits[2].lexicalRank,null);
});
test('RRF is independent of raw score scales and does not double-count duplicate IDs',()=>{
  const lexical=[{id:'a',score:1},{id:'b',score:.5}],semantic=[{id:'b',score:50}];
  assert.deepEqual(fuseRankings(lexical,semantic).map(hit=>hit.id),fuseRankings(lexical.map(hit=>({...hit,score:hit.score*100000})),semantic).map(hit=>hit.id));
  assert.equal(fuseRankings([{id:'a',score:1},{id:'a',score:1}],[])[0].score,1/61);
  assert.deepEqual(fuseRankings([],[]),[]);assert.throws(()=>fuseRankings([],[],3,-1),/nonnegative/);
});
test('retrieval profiles route each hybrid option to its own embedding model',()=>{
  assert.equal(retrievalProfile('hybrid-bge').model,'bge');assert.equal(retrievalProfile('hybrid-minilm').kind,'hybrid');
  assert.equal(retrievalProfile('minilm').kind,'semantic');assert.equal(retrievalProfile('bm25').model,null);
  assert.throws(()=>retrievalProfile('hybrid-unknown'),/Unknown/);
});
test('recall counts unique relevant sources and reciprocal rank uses first supported hit',()=>{
  const metrics=queryMetrics([{docId:'noise'},{docId:'a'},{docId:'a'}],['a','b'],3);
  assert.equal(metrics.hitAt1,0);assert.equal(metrics.recallAtK,.5);assert.equal(metrics.reciprocalRank,.5);
});
test('comparison separates answerable quality from no-answer false evidence',()=>{
  const rows=[{metrics:queryMetrics([{docId:'a'}],['a'])},{metrics:queryMetrics([],['b'])},{metrics:queryMetrics([{docId:'noise'}],[])},{metrics:queryMetrics([],[])}];
  const metrics=aggregateMetrics(rows);assert.equal(metrics.hitAt1,.5);assert.equal(metrics.recallAt3,.5);assert.equal(metrics.mrrAt3,.5);assert.equal(metrics.falseEvidenceRate,.5);
  assert.equal(aggregateMetrics([]).hitAt1,null);assert.equal(queryMetrics([],[]).recallAtK,null);
});
test('every benchmark label refers to an existing unique source and query IDs are unique',()=>{
  const ids=new Set(benchmarkDocuments.map(doc=>doc.id));assert.equal(ids.size,benchmarkDocuments.length);
  assert.equal(new Set(benchmarkQueries.map(query=>query.id)).size,benchmarkQueries.length);
  for(const query of benchmarkQueries)for(const id of query.relevant)assert.ok(ids.has(id));
  assert.ok(benchmarkQueries.some(query=>!query.relevant.length));assert.ok(benchmarkQueries.some(query=>query.relevant.length>1));
});
