import {samples,buildIndex,search,excerpt,evaluate} from './engine.js?v=20261015-pdf';
import {readDocument,validateFile,corpusBytes,MAX_DOCUMENTS,MAX_CORPUS_BYTES} from './documents.js?v=20261015-pdf';
let docs=structuredClone(samples),index,lastTrace=null,uploading=false;
const $=selector=>document.querySelector(selector);
const el=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
const countWords=text=>(text.match(/\S+/g)||[]).length;
const locationOf=hit=>`${hit.page?`page ${hit.page} · `:''}chunk ${hit.number}`;
function clearResults(){lastTrace=null;$('#results').replaceChildren();$('#evaluation').replaceChildren();$('#status').textContent='';}
function setBusy(busy){
  uploading=busy;
  document.querySelectorAll('.lab button,.lab input,.lab select').forEach(control=>control.disabled=busy);
  $('.upload').setAttribute('aria-disabled',String(busy));
  $('.lab').setAttribute('aria-busy',String(busy));
}
function reindex(){
  index=buildIndex(docs,Number($('#chunk-size').value));
  $('#doc-count').textContent=String(docs.length).padStart(2,'0');
  $('#index-stats').textContent=`${docs.length} documents · ${index.chunks.length} chunks · local index ready`;
  $('#documents').replaceChildren();
  for(const doc of docs){
    const row=el('div','document');row.append(el('span','','▤'));
    const info=el('div');
    const metadata=doc.kind==='pdf'?`${doc.pageCount} pages · ${countWords(doc.text)} words`:`${countWords(doc.text)} words · ${samples.some(sample=>sample.id===doc.id)?'sample':'uploaded'}`;
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
function ask(question){
  if(uploading)return;
  clearResults();
  if(!docs.length){$('#status').textContent='Add a document or restore the sample corpus to search.';return;}
  const start=performance.now(),hits=search(index,question,Number($('#top-k').value)),elapsed=performance.now()-start;
  const results=$('#results');
  if(!hits.length){results.append(el('p','empty-answer','No matching evidence found. Try wording that appears in your documents, or add a relevant source. No answer has been generated.'));return;}
  const head=el('div','result-header');head.append(el('h4','','Retrieved evidence'),el('small','',`${hits.length} ${hits.length===1?'passage':'passages'} · ${elapsed.toFixed(1)} ms`));results.append(head);
  const excerpts=hits.map(hit=>excerpt(hit,question));
  hits.forEach((hit,i)=>{
    const p=el('p','excerpt',excerpts[i]),ref=el('button','citation',`[${i+1}]`);ref.type='button';
    ref.setAttribute('aria-label',`Open source ${i+1}: ${hit.name}${hit.page?`, page ${hit.page}`:''}`);
    ref.onclick=()=>{const source=document.getElementById(`source-${i}`);source.open=true;source.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});source.querySelector('summary').focus();};
    p.append(ref);results.append(p);
  });
  results.append(el('p','sources-title','SOURCES / INSPECT THE CONTEXT'));
  hits.forEach((hit,i)=>{
    const details=el('details','source');details.id=`source-${i}`;
    details.append(el('summary','',`[${i+1}] ${hit.name} · ${locationOf(hit)}`),el('div','source-meta',`BM25 score ${hit.score.toFixed(3)} · relevance signal, not confidence`),el('p','',hit.text));results.append(details);
  });
  lastTrace={version:2,mode:'BM25 retrieval with verbatim extractive assembly; no LLM',question,settings:{chunkWords:Number($('#chunk-size').value),overlap:.2,topK:Number($('#top-k').value)},elapsedMs:elapsed,results:hits.map((hit,i)=>({source:hit.name,page:hit.page,chunk:hit.number,score:hit.score,text:hit.text,excerpt:excerpts[i]}))};
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
        const document=await readDocument(file,progress=>{$('#status').textContent=`${file.name}: ${progress}`;});
        if(total+document.textBytes>MAX_CORPUS_BYTES)throw new Error('Session limit reached (8 MB of extracted text).');
        docs.push({id:crypto.randomUUID(),name:file.name,...document});total+=document.textBytes;added++;
        if(document.emptyPages)warnings.push(`${file.name}: ${document.emptyPages} page(s) had no selectable text; only extracted text is searchable.`);
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
reindex();
