import {buildIndex,search} from './engine.js?v=20261015-hybrid';
import {MODEL_CATALOG} from './models.js?v=20261015-hybrid';
import {fuseRankings,queryMetrics,aggregateMetrics,CANDIDATE_DEPTH,RRF_CONSTANT} from './retrieval.js?v=20261015-hybrid';
export const BENCHMARK_VERSION='engineering-v1';
export const benchmarkDocuments=[
  {id:'network',name:'network-runbook.txt',text:'Error ERR_CONNECTION_RESET indicates a connection was unexpectedly closed. Inspect the reverse proxy idle timeout and restart the local connection pool. Request identifier NET-042 belongs to the networking runbook.'},
  {id:'auth',name:'authentication.txt',text:'Error AUTH_403 means access is forbidden. A user must request the required role from the workspace administrator. Password recovery uses an email link so a person who cannot sign in can restore access.'},
  {id:'recovery',name:'backup-runbook.txt',text:'The database backup retention window is fourteen days. A snapshot is stored each night. To recover accidentally deleted records, restore an earlier snapshot into a separate database and copy the missing rows.'},
  {id:'vehicle',name:'vehicle-manual.txt',text:'A motor vehicle requires gasoline to operate. The automobile stores fuel in its tank. A mechanic repairs the engine and transmission. The maintenance interval is six months.'},
  {id:'privacy',name:'data-handling.txt',text:'Document contents remain in browser memory. No uploaded documents are sent to a server. Reloading clears the corpus. Cached model files can persist on the device, but cached model weights do not include uploaded documents.'},
  {id:'release',name:'release-plan.txt',text:'The project codename is Marigold. The release owner is Anuj Yadav. The launch date is 21 November 2026. A failed rollout should be reverted by restoring the previously deployed version.'},
  {id:'ocr',name:'scanning-guide.txt',text:'English optical character recognition reads text from pictures and scanned document pages. Recognition can misread letters and numbers. Check the extracted text against the original image, especially names and dates.'},
  {id:'retrieval',name:'retrieval-design.txt',text:'Hybrid retrieval merges keyword and vector candidate rankings using reciprocal rank fusion. Exact technical identifiers benefit from lexical matching. Paraphrased questions benefit from semantic embeddings. A similarity score is not confidence.'}
];
export const benchmarkQueries=[
  {id:'exact-code',category:'exact',question:'ERR_CONNECTION_RESET',relevant:['network']},
  {id:'exact-auth',category:'exact',question:'AUTH_403',relevant:['auth']},
  {id:'exact-id',category:'exact',question:'NET-042',relevant:['network']},
  {id:'exact-name',category:'exact',question:'Marigold release owner',relevant:['release']},
  {id:'vehicle-paraphrase',category:'paraphrase',question:'What powers the car?',relevant:['vehicle']},
  {id:'recovery-paraphrase',category:'paraphrase',question:'How can I get back rows I erased by mistake?',relevant:['recovery']},
  {id:'auth-paraphrase',category:'paraphrase',question:'I forgot my login credentials. How do I get into my account again?',relevant:['auth']},
  {id:'ocr-paraphrase',category:'paraphrase',question:'Can I turn a photo of printed words into searchable writing?',relevant:['ocr']},
  {id:'privacy-paraphrase',category:'paraphrase',question:'Does my uploaded content leave my computer?',relevant:['privacy']},
  {id:'rollback-paraphrase',category:'paraphrase',question:'How do I undo an unsuccessful software deployment?',relevant:['release']},
  {id:'retention',category:'factual',question:'How long are database backups retained?',relevant:['recovery']},
  {id:'two-sources',category:'multiple sources',question:'Which files explain restoring deleted records and reverting a failed rollout?',relevant:['recovery','release']},
  {id:'no-weather',category:'no answer',question:'What is the weather forecast for Tokyo tomorrow?',relevant:[]},
  {id:'no-recipe',category:'no answer',question:'How do I bake sourdough bread?',relevant:[]},
  {id:'no-number',category:'no answer',question:'What is the exact annual revenue of this business?',relevant:[]}
];
export async function runComparison(client,onProgress=()=>{},signal){
  const index=buildIndex(benchmarkDocuments,120),chunks=index.chunks.map(chunk=>chunk.text),k=3;
  const cancelled=()=>{if(signal?.aborted)throw new Error('Retrieval comparison cancelled.');};
  const lexical=benchmarkQueries.map(query=>search(index,query.question,CANDIDATE_DEPTH));
  const methods=[{id:'bm25',label:'BM25',rows:benchmarkQueries.map((query,i)=>({queryId:query.id,category:query.category,question:query.question,relevant:query.relevant,results:lexical[i].slice(0,k),metrics:queryMetrics(lexical[i],query.relevant,k)}))}];
  let bgeResults;
  for(const model of ['minilm','bge']){
    cancelled();onProgress(`Loading ${MODEL_CATALOG[model].label} for the comparison…`);
    await client.request({action:'activate',model,chunks},onProgress);cancelled();
    const rows=[],candidates=[];
    for(let i=0;i<benchmarkQueries.length;i++){
      cancelled();const query=benchmarkQueries[i];onProgress(`${MODEL_CATALOG[model].label}: query ${i+1}/${benchmarkQueries.length}`);
      const ranked=await client.request({action:'search',model,chunks,question:query.question,k:CANDIDATE_DEPTH});cancelled();
      const hits=ranked.map(hit=>({...index.chunks[hit.i],score:hit.score}));candidates.push(hits);
      rows.push({queryId:query.id,category:query.category,question:query.question,relevant:query.relevant,results:hits.slice(0,k),metrics:queryMetrics(hits,query.relevant,k)});
    }
    if(model==='bge')bgeResults=candidates;
    methods.push({id:model,label:MODEL_CATALOG[model].label,model:MODEL_CATALOG[model].id,cutoff:MODEL_CATALOG[model].cutoff,rows});
  }
  cancelled();
  methods.push({id:'hybrid-bge',label:'Hybrid · BM25 + BGE',rows:benchmarkQueries.map((query,i)=>{const hits=fuseRankings(lexical[i],bgeResults[i],k);return {queryId:query.id,category:query.category,question:query.question,relevant:query.relevant,results:hits,metrics:queryMetrics(hits,query.relevant,k)};})});
  return {dataset:BENCHMARK_VERSION,createdAt:new Date().toISOString(),settings:{k,chunkWords:120,candidateDepth:CANDIDATE_DEPTH,rrfConstant:RRF_CONSTANT},documents:benchmarkDocuments,queries:benchmarkQueries,methods:methods.map(method=>({...method,metrics:aggregateMetrics(method.rows)}))};
}
