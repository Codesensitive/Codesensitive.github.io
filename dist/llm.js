import {WorkerClient} from './worker-client.js';
export class LLMClient extends WorkerClient{
  constructor(workerFactory=()=>new Worker(new URL('./llm-worker.js',import.meta.url),{type:'module'})){
    super(workerFactory,{label:'Answer model',timeout:payload=>payload.action==='generate'?180000:900000});
  }
}
