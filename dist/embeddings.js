import {WorkerClient} from './worker-client.js';
export class EmbeddingClient extends WorkerClient{
  constructor(workerFactory=()=>new Worker(new URL('./embedding-worker.js',import.meta.url),{type:'module'})){
    super(workerFactory,{label:'Embedding model'});
  }
}
