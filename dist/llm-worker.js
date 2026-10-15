import {MLCEngine,prebuiltAppConfig,deleteModelAllInfoInCache} from './vendor/webllm/webllm.js';
import {LLM_MODELS,GENERATION_OPTIONS} from './llm-models.js?v=20261015-webllm';
let engine=null,loaded=null;
self.onmessage=async({data:{id,action,model,messages}})=>{
  const send=(type,value)=>self.postMessage({id,type,...value});
  try{
    const info=LLM_MODELS[model];if(!info)throw new Error('Unknown answer model.');
    if(action==='clear'){
      if(engine)await engine.unload();engine=null;loaded=null;
      await deleteModelAllInfoInCache(info.id);send('result',{value:{cleared:true}});return;
    }
    if(action==='load'){
      if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use a WebGPU-enabled browser and compatible GPU.');
      const adapter=await navigator.gpu.requestAdapter();
      if(!adapter)throw new Error('No compatible WebGPU adapter was found. Evidence-only search remains available.');
      if(info.f16&&!adapter.features.has('shader-f16'))throw new Error('This model needs shader-f16. Try Qwen2.5 0.5B instead.');
      if(engine)await engine.unload();engine=null;loaded=null;
      const record=prebuiltAppConfig.model_list.find(item=>item.model_id===info.id);
      if(!record)throw new Error('Model is missing from the pinned WebLLM runtime.');
      engine=new MLCEngine({appConfig:{...prebuiltAppConfig,model_list:[record]},initProgressCallback:progress=>send('progress',{message:progress.text})});
      await engine.reload(info.id,{context_window_size:4096});loaded=model;
      send('result',{value:{model:info.id}});return;
    }
    if(action!=='generate'||!engine||loaded!==model)throw new Error('Load the selected answer model first.');
    await engine.resetChat();
    const stream=await engine.chat.completions.create({messages,...GENERATION_OPTIONS,stream:true,stream_options:{include_usage:true}});
    let answer='',usage=null,finishReason=null;
    for await(const chunk of stream){answer+=chunk.choices[0]?.delta.content||'';usage=chunk.usage||usage;finishReason=chunk.choices[0]?.finish_reason||finishReason;send('progress',{message:answer});}
    send('result',{value:{answer,usage,finishReason}});
  }catch(error){send('error',{message:error.message||String(error)});}
};
