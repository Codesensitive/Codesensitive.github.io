import {samples,buildIndex,search,excerpt,evaluate} from './engine.js?v=20261015-ai';
import {readDocument,validateFile,corpusBytes,MAX_DOCUMENTS,MAX_CORPUS_BYTES} from './documents.js?v=20261015-ai';
import {EmbeddingClient} from './embeddings.js?v=20261015-ai';
import {MODEL_CATALOG,MODEL_CACHE,MAX_SEMANTIC_CHUNKS} from './models.js?v=20261015-ai';
let docs=structuredClone(samples),index,lastTrace=null,uploading=false;
let activeModel='bm25';const embeddings=new EmbeddingClient();
const $=selector=>document.querySelector(selector);
const el=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
const countWords=text=>(text.match(/\S+/g)||[]).length;
const locationOf=hit=>`${hit.page?`page ${hit.page} · `:''}chunk ${hit.number}${hit.ocr?' · OCR':''}`;
function clearResults(){lastTrace=null;$('#results').replaceChildren();$('#evaluation').replaceChildren();$('#status').textContent='';}
function setBusy(busy,cancellable=false){
  uploading=busy;
  document.querySelectorAll('.lab button,.lab input,.lab select').forEach(control=>control.disabled=busy);
  $('.upload').setAttribute('aria-disabled',String(busy));
  $('.lab').setAttribute('aria-busy',String(busy));
  $('#cancel-model').hidden=!busy||!cancellable;$('#cancel-model').disabled=false;
}
function reindex(){
  index=buildIndex(docs,Number($('#chunk-size').value));
  $('#doc-count').textContent=String(docs.length).padStart(2,'0');
  $('#index-stats').textContent=`${docs.length} documents · ${index.chunks.length} chunks · local index ready`;
  $('#documents').replaceChildren();
  for(const doc of docs){
    const row=el('div','document');row.append(el('span','','▤'));
    const info=el('div');
    const metadata=(doc.kind==='pdf'?`${doc.pageCount} ${doc.pageCount===1?'page':'pages'} · ${countWords(doc.text)} words`:`${countWords(doc.text)} words · ${samples.some(sample=>sample.id===doc.id)?'sample':'uploaded'}`)+(doc.ocrPages?` · OCR ${doc.ocrPages} page(s)`:'');
    info.append(el('strong','',doc.name),el('small','',metadata));
    const remove=el('button','remove','×');remove.type='button';remove.disabled=uploading;remove.setAttribute('aria-label',`Remove ${doc.name}`);
    remove.onclick=()=>{if(uploading)return;docs=docs.filter(item=>item.id!==doc.id);clearResults();reindex();};
    row.append(info,remove);$('#documents').append(row);
  }
}
function downloadTrace(){
  if(!lastTrace)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(lastTrace,null,2)],{type:'application/json'}));
  const a=el('a');a.href=url;a.download='evidence-lab-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function ask(question){
  if(uploading)return;
  clearResults();
  if(!docs.length){$('#status').textContent='Add a document or restore the sample corpus to search.';return;}
  const start=performance.now(),modelUsed=activeModel;let hits;
  if(modelUsed==='bm25')hits=search(index,question,Number($('#top-k').value));
  else{
    setBusy(true,true);
    try{
      if(index.chunks.length>MAX_SEMANTIC_CHUNKS)throw new Error('Use BM25 or reduce this corpus to 200 chunks for local embeddings.');
      const ranked=await embeddings.request({action:'search',model:modelUsed,chunks:index.chunks.map(chunk=>chunk.text),question,k:Number($('#top-k').value)},message=>$('#status').textContent=message);
      hits=ranked.map(hit=>({...index.chunks[hit.i],score:hit.score}));$('#status').textContent='';
    }catch(error){$('#status').textContent=error.message+' Switch to BM25 to continue without a model.';return;}
    finally{setBusy(false);}
  }
  const elapsed=performance.now()-start;
  const results=$('#results');
  if(!hits.length){results.append(el('p','empty-answer',modelUsed==='bm25'?'No matching evidence found. Try wording that appears in your documents, or add a relevant source. No answer has been generated.':`No passages passed the cosine similarity cutoff (${MODEL_CATALOG[modelUsed].cutoff}). This heuristic is not a guarantee of answerability. Try another query or BM25.`));return;}
  const head=el('div','result-header');head.append(el('h4','','Retrieved evidence'),el('small','',`${hits.length} ${hits.length===1?'passage':'passages'} · ${elapsed.toFixed(1)} ms`));results.append(head);
  const excerpts=hits.map(hit=>modelUsed==='bm25'?excerpt(hit,question):hit.text);
  hits.forEach((hit,i)=>{
    const p=el('p','excerpt',excerpts[i]),ref=el('button','citation',`[${i+1}]`);ref.type='button';
    ref.setAttribute('aria-label',`Open source ${i+1}: ${hit.name}${hit.page?`, page ${hit.page}`:''}`);
    ref.onclick=()=>{const source=document.getElementById(`source-${i}`);source.open=true;source.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});source.querySelector('summary').focus();};
    p.append(ref);results.append(p);
  });
  results.append(el('p','sources-title','SOURCES / INSPECT THE CONTEXT'));
  hits.forEach((hit,i)=>{
    const details=el('details','source');details.id=`source-${i}`;
    details.append(el('summary','',`[${i+1}] ${hit.name} · ${locationOf(hit)}`),el('div','source-meta',`${modelUsed==='bm25'?'BM25 score':'Cosine similarity'} ${hit.score.toFixed(3)} · relevance signal, not confidence`),el('p','',hit.text));results.append(details);
  });
  lastTrace={version:3,mode:modelUsed==='bm25'?'BM25 extractive retrieval':'Local semantic retrieval; no generative LLM',model:MODEL_CATALOG[modelUsed]?.id||'BM25',question,settings:{chunkWords:Number($('#chunk-size').value),overlap:.2,topK:Number($('#top-k').value),similarityCutoff:MODEL_CATALOG[modelUsed]?.cutoff??null},elapsedMs:elapsed,results:hits.map((hit,i)=>({source:hit.name,page:hit.page,ocr:hit.ocr,chunk:hit.number,score:hit.score,text:hit.text,excerpt:excerpts[i]}))};
  const exportButton=el('button','quiet','Download query trace ↓');exportButton.onclick=downloadTrace;results.append(exportButton);
}
$('#query-form').addEventListener('submit',event=>{event.preventDefault();const question=$('#question').value.trim();if(question)ask(question);});
document.querySelectorAll('[data-question]').forEach(button=>button.onclick=()=>{$('#question').value=button.dataset.question;ask(button.dataset.question);});
$('#open-files').onclick=()=>{if(!uploading)$('#files').click();};
$('#files').addEventListener('change',async event=>{
  if(uploading)return;
  const input=event.target,files=[...input.files];if(!files.length)return;
  clearResults();setBusy(true);
  const errors=[],warnings=[];let total=corpusBytes(docs),added=0;
  try{
    for(const file of files){
      try{
        validateFile(file);
        if(docs.length>=MAX_DOCUMENTS)throw new Error('Session limit reached (20 documents).');
        $('#status').textContent=`Reading ${file.name}…`;
        const document=await readDocument(file,progress=>{$('#status').textContent=`${file.name}: ${progress}`;},{ocr:$('#enable-ocr').checked});
        if(total+document.textBytes>MAX_CORPUS_BYTES)throw new Error('Session limit reached (8 MB of extracted text).');
        docs.push({id:crypto.randomUUID(),name:file.name,...document});total+=document.textBytes;added++;
        if(document.emptyPages)warnings.push(`${file.name}: ${document.emptyPages} page(s) had no selectable text; only extracted text is searchable.`);
        if(document.ocrPages)warnings.push(`${file.name}: OCR used on ${document.ocrPages} page(s). Recognition can contain errors; inspect the source.`);
      }catch(error){errors.push(`${file.name}: ${error.message||'Could not process this file.'}`);}
    }
  }finally{
    input.value='';reindex();setBusy(false);
    $('#status').textContent=[added?`${added} document${added===1?'':'s'} added. Ask a question about ${added===1?'its':'their'} contents.`:'No documents added.',...warnings,...errors].join(' ');
  }
});
for(const id of ['chunk-size','top-k'])$('#'+id).onchange=()=>{clearResults();reindex();$('#status').textContent='Settings updated. Submit your question to retrieve again.';};
$('#reset').onclick=()=>{if(uploading)return;docs=structuredClone(samples);clearResults();reindex();$('#status').textContent='Sample corpus restored.';};
$('#evaluate').onclick=()=>{
  const panel=$('#evaluation');panel.replaceChildren();const checks=evaluate();
  const head=el('div','result-header');head.append(el('h4','',`Sample evaluation · ${checks.filter(check=>check.pass).length}/${checks.length} passed`));panel.append(head);
  checks.forEach(check=>{const row=el('div','eval-row');row.append(el('span','',check.name),el('strong',check.pass?'pass':'fail',check.pass?'PASS':'FAIL'));panel.append(row);});
  panel.append(el('p','eval-note','Five deterministic smoke checks against a fresh sample index. These test retrieval wiring, no-match behavior, and excerpt fidelity; they do not measure arbitrary-document answer quality.'));
};
function updateModelChoice(){
  const choice=$('#embedding-model').value,info=MODEL_CATALOG[choice];
  $('#model-description').textContent=info?`${info.description} ${info.size}; 384 dimensions; ${info.license}. Up to 200 chunks. Inputs are limited to ${info.tokens} tokens; longer chunks are truncated. Similarity cutoff ${info.cutoff} is a heuristic, not confidence.`:'Instant lexical search. No weights, download, or inference required.';
  $('#activate-model').textContent=info?'Download & activate locally':'Activate BM25';
  for(const id of ['model-card','model-download'])$('#'+id).hidden=!info;
  if(info){$('#model-card').href=`https://huggingface.co/${info.id}`;$('#model-download').href=`https://huggingface.co/${info.id}/resolve/main/onnx/model_quantized.onnx?download=true`;}
}
function showActive(){
  $('#model-status').textContent=`Active: ${MODEL_CATALOG[activeModel]?.label||'BM25'} · vectors rebuild automatically after document/chunk changes`;
  $('#retrieval-mode').textContent=`LOCAL RETRIEVAL / ${MODEL_CATALOG[activeModel]?.label.toUpperCase()||'BM25'}`;
}
$('#embedding-model').onchange=updateModelChoice;
$('#cancel-model').onclick=()=>embeddings.cancel();
$('#activate-model').onclick=async()=>{
  const choice=$('#embedding-model').value;clearResults();
  if(choice==='bm25'){embeddings.cancel();activeModel='bm25';showActive();return;}
  setBusy(true,true);
  try{
    if(index.chunks.length>MAX_SEMANTIC_CHUNKS)throw new Error('Local embeddings support up to 200 chunks. Reduce your corpus or use BM25.');
    const result=await embeddings.request({action:'activate',model:choice,chunks:index.chunks.map(chunk=>chunk.text)},message=>$('#model-status').textContent=message);
    activeModel=choice;showActive();$('#status').textContent=`${MODEL_CATALOG[choice].label} ready. ${result.chunks} passages embedded locally. Model files may be cached; documents are not persisted.`;
  }catch(error){embeddings.cancel();activeModel='bm25';showActive();$('#status').textContent=`${error.message} BM25 remains available.`;}
  finally{setBusy(false);}
};
$('#clear-models').onclick=async()=>{
  if(uploading)return;embeddings.cancel();activeModel='bm25';showActive();clearResults();
  try{if('caches' in window)await caches.delete(MODEL_CACHE);$('#status').textContent='Embedding model cache cleared and active vectors released. BM25 is active.';}
  catch{$('#status').textContent='BM25 is active. Your browser did not allow clearing the model cache.';}
};
updateModelChoice();showActive();
reindex();
