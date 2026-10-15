import {pipeline,env} from './vendor/transformers/transformers.js';
import {modelInfo,rankVectors,MODEL_CACHE,MAX_SEMANTIC_CHUNKS} from './models.js?v=20261015-webllm';
env.allowLocalModels=false;env.useBrowserCache=true;env.cacheKey=MODEL_CACHE;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
env.backends.onnx.wasm.wasmPaths={mjs:new URL('./vendor/ort/ort-wasm-simd-threaded.asyncify.mjs',import.meta.url).href,wasm:new URL('./vendor/ort/ort-wasm-simd-threaded.asyncify.wasm',import.meta.url).href};
let extractor,loadedModel,corpusKey='',vectors=[];
self.onmessage=async({data})=>{
  const {id,action,model,chunks=[],question,k=3}=data;
  const progress=message=>self.postMessage({id,type:'progress',message});
  try{
    const info=modelInfo(model);
    if(chunks.length>MAX_SEMANTIC_CHUNKS)throw new Error('Local embeddings support up to 200 chunks. Remove documents or use larger chunks, or switch to BM25.');
    if(loadedModel!==model){
      if(extractor)await extractor.dispose();extractor=null;loadedModel=null;corpusKey='';vectors=[];
      progress(`Downloading/loading ${info.label} (${info.size}, plus runtime)…`);
      extractor=await pipeline('feature-extraction',info.id,{device:'wasm',dtype:'q8',progress_callback:event=>{
        if(event.status==='progress')progress(`${info.label}: ${event.file} ${Number(event.progress||0).toFixed(0)}%`);
      }});
      loadedModel=model;
    }
    const key=JSON.stringify(chunks);
    if(corpusKey!==key){
      const next=[];
      for(let i=0;i<chunks.length;i+=4){
        progress(`Embedding passages ${i+1}–${Math.min(i+4,chunks.length)} of ${chunks.length}…`);
        const output=await extractor(chunks.slice(i,i+4),{pooling:info.pooling,normalize:true,truncation:true,max_length:info.tokens});
        next.push(...output.tolist());
      }
      vectors=next;corpusKey=key;
    }
    if(action==='activate'){self.postMessage({id,type:'result',value:{model,dimensions:vectors[0]?.length||384,chunks:chunks.length}});return;}
    const output=await extractor(info.prefix+question,{pooling:info.pooling,normalize:true,truncation:true,max_length:info.tokens});
    self.postMessage({id,type:'result',value:rankVectors(vectors,output.tolist()[0],k,info.cutoff)});
  }catch(error){self.postMessage({id,type:'error',message:error.message||'Local embedding inference failed.'});}
};
