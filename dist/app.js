import {samples,buildIndex,search,excerpt,evaluate} from './engine.js?v=20261015-modes';
import {readDocument,validateFile,corpusBytes,MAX_DOCUMENTS,MAX_CORPUS_BYTES} from './documents.js?v=20261015-webllm';
import {EmbeddingClient} from './embeddings.js?v=20261015-webllm';
import {MODEL_CATALOG,MODEL_CACHE,MAX_SEMANTIC_CHUNKS} from './models.js?v=20261015-webllm';
import {retrievalProfile,fuseRankings,CANDIDATE_DEPTH,RRF_CONSTANT} from './retrieval.js?v=20261015-webllm';
import {runComparison} from './benchmark.js?v=20261015-webllm';
import {LLM_MODELS,weightSize,buildGroundedPrompt,inspectCitations,GENERATION_OPTIONS} from './llm-models.js?v=20261015-webllm';
import {LLMClient} from './llm.js?v=20261015-webllm';
const llm=new LLMClient();let loadedLLM=null;
import {modeSettings} from './modes.js?v=20261015-modes';
let uiMode='simple',simpleCancelled=false;
let docs=[],index,lastTrace=null,uploading=false;
let activeModel='bm25',comparisonAbort=null;const embeddings=new EmbeddingClient();
const $=selector=>document.querySelector(selector);
const el=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
const countWords=text=>(text.match(/\S+/g)||[]).length;
const locationOf=hit=>`${hit.page?`page ${hit.page} · `:''}chunk ${hit.number}${hit.ocr?' · OCR':''}`;
const settings=()=>modeSettings(uiMode,{retrieval:activeModel,chunkWords:Number($('#chunk-size').value),topK:Number($('#top-k').value),ocr:$('#enable-ocr').checked});
function clearResults(){lastTrace=null;$('#results').replaceChildren();$('#evaluation').replaceChildren();$('#status').textContent='';}
function setBusy(busy,cancellable=false){
  uploading=busy;
  document.querySelectorAll('.lab button,.lab input,.lab select,.mode-switch button').forEach(control=>control.disabled=busy);
  $('.upload').setAttribute('aria-disabled',String(busy));
  $('.lab').setAttribute('aria-busy',String(busy));
  $('#cancel-model').hidden=!busy||!cancellable;$('#cancel-model').disabled=false;
  $('#cancel-llm').hidden=true;
  $('#cancel-simple').hidden=uiMode!=='simple'||!busy||!cancellable;$('#cancel-simple').disabled=false;
}
function reindex(){
  index=buildIndex(docs,settings().chunkWords);
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
  simpleCancelled=false;
  clearResults();
  if(!docs.length){$('#status').textContent='Add a document or restore the sample corpus to search.';return;}
  const config=settings(),start=performance.now(),modelUsed=config.retrieval;let profile=retrievalProfile(modelUsed),model=MODEL_CATALOG[profile.model],hits,retrievalWarning='';
  if(profile.kind==='bm25')hits=search(index,question,config.topK);
  else{
    setBusy(true,true);
    try{
      if(index.chunks.length>MAX_SEMANTIC_CHUNKS)throw new Error('Use BM25 or reduce this corpus to 200 chunks for local embeddings.');
      const ranked=await embeddings.request({action:'search',model:profile.model,chunks:index.chunks.map(chunk=>chunk.text),question,k:profile.kind==='hybrid'?CANDIDATE_DEPTH:config.topK},message=>$('#status').textContent=message);
      const semantic=ranked.map(hit=>({...index.chunks[hit.i],score:hit.score}));
      hits=profile.kind==='hybrid'?fuseRankings(search(index,question,CANDIDATE_DEPTH),semantic,config.topK):semantic;$('#status').textContent='';
    }catch(error){
      if(simpleCancelled){$('#status').textContent='Cancelled. Your documents are still here.';return;}
      if(uiMode!=='simple'){$('#status').textContent=error.message+' Switch to BM25 to continue without a model.';return;}
      embeddings.cancel();profile=retrievalProfile('bm25');model=null;hits=search(index,question,config.topK);
      retrievalWarning=`Semantic search unavailable: ${error.message} Using keyword search instead.`;$('#status').textContent=retrievalWarning;
    }
    finally{setBusy(false);}
  }
  const elapsed=performance.now()-start;
  const results=$('#results');
  if(!hits.length){results.append(el('p','empty-answer',profile.kind==='bm25'?'No matching evidence found. Try wording that appears in your documents, or add a relevant source. No answer has been generated.':profile.kind==='hybrid'?'Neither BM25 nor semantic retrieval returned evidence. Try a different query or add a relevant source. Matching rules do not guarantee answerability.':`No passages passed the cosine similarity cutoff (${model.cutoff}). This heuristic is not a guarantee of answerability. Try another query or BM25.`));return;}
  const head=el('div','result-header');head.append(el('h4','','Retrieved evidence'),el('small','',`${hits.length} ${hits.length===1?'passage':'passages'} · ${elapsed.toFixed(1)} ms`));results.append(head);
  const excerpts=hits.map(hit=>profile.kind==='bm25'?excerpt(hit,question):hit.text);
  hits.forEach((hit,i)=>{
    const p=el('p','excerpt',excerpts[i]),ref=el('button','citation',`[${i+1}]`);ref.type='button';
    ref.setAttribute('aria-label',`Open source ${i+1}: ${hit.name}${hit.page?`, page ${hit.page}`:''}`);
    ref.onclick=()=>{const source=document.getElementById(`source-${i}`);source.open=true;source.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});source.querySelector('summary').focus();};
    p.append(ref);results.append(p);
  });
  results.append(el('p','sources-title','SOURCES / INSPECT THE CONTEXT'));
  hits.forEach((hit,i)=>{
    const details=el('details','source');details.id=`source-${i}`;
    const score=profile.kind==='hybrid'?`RRF ${hit.score.toFixed(5)} · BM25 rank ${hit.lexicalRank??'—'} · semantic rank ${hit.semanticRank??'—'}`:`${profile.kind==='bm25'?'BM25 score':'Cosine similarity'} ${hit.score.toFixed(3)}`;
    const meta=el('div','source-meta',`${score} · ranking signal, not confidence`);meta.dataset.advanced='';
    details.append(el('summary','',`[${i+1}] ${hit.name} · ${locationOf(hit)}`),meta,el('p','',hit.text));
    if(profile.kind==='hybrid'){const raw=el('div','source-meta',`Raw BM25 ${hit.bm25Score?.toFixed(3)??'no match'} · cosine ${hit.cosineScore?.toFixed(3)??'below cutoff'}`);raw.dataset.advanced='';details.append(raw);}
    results.append(details);
  });
  lastTrace={version:5,interfaceMode:uiMode,mode:profile.kind,model:model?.id||'BM25',question,settings:{chunkWords:config.chunkWords,overlap:.2,topK:config.topK,similarityCutoff:model?.cutoff??null,...(profile.kind==='hybrid'?{rrfConstant:RRF_CONSTANT,candidateDepth:CANDIDATE_DEPTH}:{})},elapsedMs:elapsed,results:hits.map((hit,i)=>({source:hit.name,page:hit.page,ocr:hit.ocr,chunk:hit.number,score:hit.score,...(profile.kind==='hybrid'?{lexicalRank:hit.lexicalRank,semanticRank:hit.semanticRank,bm25Score:hit.bm25Score,cosineScore:hit.cosineScore}:{}),text:hit.text,excerpt:excerpts[i]}))};
  const exportButton=el('button','quiet','Download query trace ↓');exportButton.dataset.advanced='';exportButton.onclick=downloadTrace;results.append(exportButton);
  if(uiMode==='simple'&&loadedLLM!==config.answerModel){
    llm.cancel();loadedLLM=null;llmBusy();
    try{await llm.request({action:'load',model:config.answerModel},message=>{$('#status').textContent=message;llmStatus(message);});loadedLLM=config.answerModel;llmStatus(`Active: ${LLM_MODELS[loadedLLM].label} · chosen automatically in Simple mode.`);$('#status').textContent=retrievalWarning;}
    catch(error){llm.cancel();llmStatus(`No answer model loaded: ${error.message}`);$('#status').textContent=simpleCancelled?'Cancelled. Retrieved passages are available below.':`${retrievalWarning} Local answer generation unavailable: ${error.message} You can read the source excerpts below.`;return;}
    finally{setBusy(false);}
  }
  if(loadedLLM)await generateAnswer(question,hits,results);
}
function llmBusy(){setBusy(true,true);$('#cancel-model').hidden=true;$('#cancel-llm').hidden=false;$('#cancel-llm').disabled=false;}
function llmStatus(message){$('#llm-status').textContent=message;}
function updateLLMChoice(){
  const info=LLM_MODELS[$('#answer-model').value];
  $('#llm-description').textContent=info?`${info.guidance} ~${weightSize(info)} weight download; ~${(info.vram/1000).toFixed(2)} GB estimated GPU memory, plus browser overhead. ${info.f16?'Requires shader-f16. ':''}${info.license}.`:'Evidence-only mode retrieves and cites source passages without generating an answer.';
  $('#llm-card').hidden=!info;if(info)$('#llm-card').href=`https://huggingface.co/mlc-ai/${info.id}`;
  $('#load-llm').textContent=info?'Download & load answer model':'Use evidence only';
}
$('#answer-model').onchange=updateLLMChoice;
$('#cancel-llm').onclick=()=>{llm.cancel();loadedLLM=null;llmStatus('Cancelled. Evidence-only mode is active; cached downloads may be reused.');};
$('#unload-llm').onclick=()=>{llm.cancel();loadedLLM=null;llmStatus('Evidence-only mode active. GPU resources released; cached weights kept.');};
$('#load-llm').onclick=async()=>{
  if(uploading)return;const choice=$('#answer-model').value;
  llm.cancel();loadedLLM=null;
  if(!LLM_MODELS[choice]){llmStatus('Active: evidence only. No answer model loaded.');return;}
  llmBusy();llmStatus('Checking WebGPU and preparing model download…');
  try{await llm.request({action:'load',model:choice},llmStatus);loadedLLM=choice;llmStatus(`Active: ${LLM_MODELS[choice].label}. Submit a question to generate from retrieved evidence.`);}
  catch(error){llm.cancel();llmStatus(`${error.message} Evidence-only search is available.`);}
  finally{setBusy(false);}
};
$('#clear-llm').onclick=async()=>{
  if(uploading)return;const model=$('#answer-model').value;
  if(!LLM_MODELS[model]){llmStatus('Select a model to clear its cached files.');return;}
  llm.cancel();loadedLLM=null;llmBusy();llmStatus('Clearing the selected answer model cache…');
  try{await llm.request({action:'clear',model});llmStatus(`${LLM_MODELS[model].label} cached files cleared. Evidence-only mode active.`);}
  catch(error){llmStatus(`Could not clear the cache: ${error.message}`);}
  finally{llm.cancel();setBusy(false);}
};
async function generateAnswer(question,hits,results){
  const model=loadedLLM,prompt=buildGroundedPrompt(question,hits),trace=lastTrace;
  const panel=el('section','generated-answer'),answer=el('p','generated-text','Generating locally…'),note=el('p','eval-note');
  panel.append(el('h4','',`Generated answer · ${LLM_MODELS[model].label}`),answer,note);results.prepend(panel);
  const start=performance.now();llmBusy();
  trace.generation={model:LLM_MODELS[model].id,parameters:GENERATION_OPTIONS,context:prompt.sources,status:'running'};
  try{
    const result=await llm.request({action:'generate',model,messages:prompt.messages},text=>{answer.textContent=text||'Generating locally…';});
    if(!result.answer.trim())throw new Error('The model returned an empty answer.');
    answer.textContent=result.answer;
    const citations=inspectCitations(result.answer,prompt.sources);
    note.textContent=[citations.invalid.length?`Invalid source references: ${citations.invalid.join(', ')}.`:citations.missing?'No source citations were supplied.':'Citation numbers refer to the evidence below; their presence does not verify the claims.',prompt.sources.some(source=>source.truncated)?'Context was shortened to fit the model.':'',result.finishReason==='length'?'Output reached the 256-token limit.':'','AI-generated text may be wrong. Check the original sources.'].filter(Boolean).join(' ');
    Object.assign(trace.generation,{...result,citations,status:'complete',elapsedMs:performance.now()-start});
  }catch(error){
    llm.cancel();loadedLLM=null;answer.textContent='No completed answer was generated.';note.textContent=`${error.message} Retrieved evidence remains available below.`;
    Object.assign(trace.generation,{status:'failed',error:error.message,elapsedMs:performance.now()-start});llmStatus('Evidence-only mode active. Reload an answer model to retry.');
  }finally{setBusy(false);}
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
        const document=await readDocument(file,progress=>{$('#status').textContent=`${file.name}: ${progress}`;},{ocr:settings().ocr});
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
$('#try-samples').onclick=$('#reset').onclick;
$('#cancel-simple').onclick=()=>{simpleCancelled=true;embeddings.cancel();llm.cancel();loadedLLM=null;llmStatus('Cancelled. Submit a question to load the automatic answer model again.');};
function switchMode(mode){
  if(uploading)return;uiMode=mode;$('#lab-panel').dataset.mode=mode;$('#lab-panel').setAttribute('aria-labelledby',`mode-${mode}`);
  for(const button of document.querySelectorAll('[data-ui-mode]')){const selected=button.dataset.uiMode===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
  $('#mode-help').textContent=mode==='simple'?'Upload a document, then ask a question. Search, English OCR and the answer model are chosen for you.':'Choose retrieval strategies, embedding and answer models, OCR, chunking and evaluation tools.';
  $('#search-submit').setAttribute('aria-label',mode==='simple'?'Ask documents':'Search documents');
  $('.mode-note').textContent=mode==='simple'?'The first question may download ~300 MB of free models plus runtime. Generation needs WebGPU; source excerpts remain available if it cannot run. Your documents stay in this browser.':'Choose your retrieval strategy and optional WebLLM in the controls. Your documents stay in this browser.';
  reindex();
}
for(const button of document.querySelectorAll('[data-ui-mode]')){
  button.onclick=()=>switchMode(button.dataset.uiMode);
  button.onkeydown=event=>{const modes=['simple','advanced'];let target;if(['ArrowLeft','ArrowRight'].includes(event.key))target=modes.find(mode=>mode!==uiMode);else if(event.key==='Home')target='simple';else if(event.key==='End')target='advanced';if(target){event.preventDefault();switchMode(target);$(`#mode-${target}`).focus();}};
}
$('#evaluate').onclick=()=>{
  const panel=$('#evaluation');panel.replaceChildren();const checks=evaluate();
  const head=el('div','result-header');head.append(el('h4','',`Sample evaluation · ${checks.filter(check=>check.pass).length}/${checks.length} passed`));panel.append(head);
  checks.forEach(check=>{const row=el('div','eval-row');row.append(el('span','',check.name),el('strong',check.pass?'pass':'fail',check.pass?'PASS':'FAIL'));panel.append(row);});
  panel.append(el('p','eval-note','Five deterministic smoke checks against a fresh sample index. These test retrieval wiring, no-match behavior, and excerpt fidelity; they do not measure arbitrary-document answer quality.'));
};
function updateModelChoice(){
  const profile=retrievalProfile($('#embedding-model').value),info=MODEL_CATALOG[profile.model];
  $('#model-description').textContent=(profile.kind==='hybrid'?`Merges up to ${CANDIDATE_DEPTH} BM25 and ${CANDIDATE_DEPTH} semantic candidates with RRF (constant ${RRF_CONSTANT}). No additional model. `:'')+(info?`${info.description} ${info.size}; 384 dimensions; ${info.license}. Up to 200 chunks. Inputs are limited to ${info.tokens} tokens; longer chunks are truncated. Similarity cutoff ${info.cutoff} is a heuristic, not confidence.`:'Instant lexical search. No weights, download, or inference required.');
  $('#activate-model').textContent=info?'Download & activate locally':'Activate BM25';
  for(const id of ['model-card','model-download'])$('#'+id).hidden=!info;
  if(info){$('#model-card').href=`https://huggingface.co/${info.id}`;$('#model-download').href=`https://huggingface.co/${info.id}/resolve/main/onnx/model_quantized.onnx?download=true`;}
}
function showActive(){
  const profile=retrievalProfile(activeModel);
  $('#model-status').textContent=`Active: ${profile.label} · vectors rebuild automatically after document/chunk changes`;
  $('#retrieval-mode').textContent=`LOCAL RETRIEVAL / ${profile.label.toUpperCase()}`;
}
$('#embedding-model').onchange=updateModelChoice;
$('#cancel-model').onclick=()=>{comparisonAbort?.abort();embeddings.cancel();};
$('#activate-model').onclick=async()=>{
  const choice=$('#embedding-model').value,profile=retrievalProfile(choice);clearResults();
  if(choice==='bm25'){embeddings.cancel();activeModel='bm25';showActive();return;}
  setBusy(true,true);
  try{
    if(index.chunks.length>MAX_SEMANTIC_CHUNKS)throw new Error('Local embeddings support up to 200 chunks. Reduce your corpus or use BM25.');
    const result=await embeddings.request({action:'activate',model:profile.model,chunks:index.chunks.map(chunk=>chunk.text)},message=>$('#model-status').textContent=message);
    activeModel=choice;showActive();$('#status').textContent=`${profile.label} ready. ${result.chunks} passages embedded locally. Model files may be cached; documents are not persisted.`;
  }catch(error){embeddings.cancel();activeModel='bm25';showActive();$('#status').textContent=`${error.message} BM25 remains available.`;}
  finally{setBusy(false);}
};
$('#clear-models').onclick=async()=>{
  if(uploading)return;embeddings.cancel();activeModel='bm25';showActive();clearResults();
  try{if('caches' in window)await caches.delete(MODEL_CACHE);$('#status').textContent='Embedding model cache cleared and active vectors released. BM25 is active.';}
  catch{$('#status').textContent='BM25 is active. Your browser did not allow clearing the model cache.';}
};
$('#compare-methods').onclick=async()=>{
  if(uploading)return;clearResults();$('#comparison').replaceChildren();setBusy(true,true);comparisonAbort=new AbortController();
  try{
    const report=await runComparison(embeddings,message=>$('#status').textContent=message,comparisonAbort.signal);
    $('#status').textContent='Comparison complete. These are measured results on a small synthetic test set, not a general model ranking.';
    renderComparison(report);
  }catch(error){$('#status').textContent='Comparison did not complete.';$('#comparison').append(el('p','eval-note',`${error.message} No partial scores are reported. Your documents and chosen retrieval mode are preserved.`));}
  finally{comparisonAbort=null;setBusy(false);showActive();}
};
function renderComparison(report){
  const panel=$('#comparison'),percentage=value=>value===null?'—':`${(value*100).toFixed(1)}%`;
  panel.append(el('h4','',`Retrieval comparison · ${report.dataset}`),el('p','eval-note',`${report.documents.length} synthetic source documents · ${report.queries.filter(query=>query.relevant.length).length} answerable questions (including a multiple-source question) · ${report.queries.filter(query=>!query.relevant.length).length} no-answer questions · top 3 results. Runs independently of your uploads, selected model and chunk settings. Higher Hit@1, Recall@3 and MRR@3 are better; lower false evidence is better. This set was authored for the app and is not a held-out benchmark.`));
  const scroll=el('div','comparison-scroll'),table=el('table','comparison-table'),caption=el('caption','sr-only','Measured retrieval comparison results'),thead=el('thead'),headers=el('tr');
  for(const text of ['Method','Hit@1 ↑','Recall@3 ↑','MRR@3 ↑','False evidence ↓']){const th=el('th','',text);th.scope='col';headers.append(th);}thead.append(headers);table.append(caption,thead);
  const tbody=el('tbody');
  for(const method of report.methods){const row=el('tr'),name=el('th','',method.label);name.scope='row';row.append(name,el('td','',percentage(method.metrics.hitAt1)),el('td','',percentage(method.metrics.recallAt3)),el('td','',method.metrics.mrrAt3.toFixed(3)),el('td','',percentage(method.metrics.falseEvidenceRate)));tbody.append(row);}table.append(tbody);scroll.append(table);panel.append(scroll);
  panel.append(el('p','eval-note',`RRF constant ${report.settings.rrfConstant}; up to ${report.settings.candidateDepth} candidates per retriever. Semantic cutoffs: MiniLM 0.25, BGE 0.5. False evidence means any returned passage on a question labeled unanswerable; it is not an LLM hallucination rate. No latency comparison or generated-answer evaluation is performed.`));
  const download=el('button','quiet','Download comparison JSON ↓');download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,(key,value)=>['freq','terms'].includes(key)?undefined:value,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='retrieval-comparison.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};panel.append(download);
  const details=el('details','comparison-details');details.append(el('summary','','Inspect all labeled questions and rankings'));
  for(const query of report.queries){const section=el('section','comparison-query');section.append(el('h5','',`${query.category}: ${query.question}`),el('p','eval-note',`Relevant sources: ${query.relevant.length?query.relevant.join(', '):'none (unanswerable)'}`));for(const method of report.methods){const row=method.rows.find(row=>row.queryId===query.id);section.append(el('p','eval-note',`${method.label}: ${row.results.length?row.results.map((hit,i)=>`${i+1}. ${hit.name}${query.relevant.includes(hit.docId)?' [relevant]':''}`).join(' · '):'no evidence'}`));}details.append(section);}panel.append(details);
}
for(const [key,info] of Object.entries(LLM_MODELS)){const option=el('option','',`${info.label} · ~${weightSize(info)} · ${info.tier}`);option.value=key;$('#answer-model').append(option);}
updateLLMChoice();updateModelChoice();showActive();
switchMode('simple');
