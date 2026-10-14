export class EmbeddingClient{
  constructor(){this.worker=null;this.sequence=0;this.pending=new Map();}
  request(payload,onProgress=()=>{}){
    if(!this.worker){
      this.worker=new Worker(new URL('./embedding-worker.js?v=20261015-ai',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{
        const job=this.pending.get(data.id);if(!job)return;
        if(data.type==='progress'){job.progress(data.message);return;}
        clearTimeout(job.timer);this.pending.delete(data.id);
        if(data.type==='error')job.reject(new Error(data.message));else job.resolve(data.value);
      };
      this.worker.onerror=event=>this.cancel(`Embedding runtime could not start: ${event.message||'check your connection and browser support'}. Retry or use BM25.`);
    }
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.cancel('Model operation timed out. Try again on a faster connection or use BM25.'),300000);
      this.pending.set(id,{resolve,reject,progress:onProgress,timer});this.worker.postMessage({id,...payload});
    });
  }
  cancel(message='Model operation cancelled.'){
    this.worker?.terminate();this.worker=null;
    for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(new Error(message));}this.pending.clear();
  }
}
