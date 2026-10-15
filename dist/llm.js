export class LLMClient{
  constructor(workerFactory=()=>new Worker(new URL('./llm-worker.js?v=20261015-webllm',import.meta.url),{type:'module'})){this.workerFactory=workerFactory;this.worker=null;this.sequence=0;this.pending=new Map();}
  request(payload,onProgress=()=>{}){
    if(this.pending.size)return Promise.reject(new Error('An answer model operation is already running.'));
    if(!this.worker){
      this.worker=this.workerFactory();
      this.worker.onmessage=({data})=>{const pending=this.pending.get(data.id);if(!pending)return;if(data.type==='progress'){pending.onProgress(data.message);return;}clearTimeout(pending.timer);this.pending.delete(data.id);data.type==='error'?pending.reject(new Error(data.message)):pending.resolve(data.value);};
      this.worker.onerror=()=>this.cancel('Answer model worker failed. Reload the model to retry.');
    }
    return new Promise((resolve,reject)=>{
      const id=++this.sequence,timer=setTimeout(()=>this.cancel('Answer model operation timed out. Try a smaller model or reload.'),payload.action==='generate'?180000:900000);
      this.pending.set(id,{resolve,reject,timer,onProgress});this.worker.postMessage({id,...payload});
    });
  }
  cancel(message='Answer model operation cancelled. Reload the model to use it again.'){
    this.worker?.terminate();this.worker=null;
    for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(message));}this.pending.clear();
  }
}
