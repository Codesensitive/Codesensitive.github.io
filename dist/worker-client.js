// Late events from a terminated worker cannot affect its replacement.
export class WorkerClient{
  constructor(workerFactory,{label='Model',timeout=()=>300000}={}){this.workerFactory=workerFactory;this.label=label;this.timeout=timeout;this.worker=null;this.sequence=0;this.pending=new Map();}
  request(payload,onProgress=()=>{}){
    if(this.pending.size)return Promise.reject(new Error(`${this.label} operation is already running.`));
    try{
      if(!this.worker){
        const worker=this.workerFactory();this.worker=worker;
        worker.onmessage=({data})=>{
          if(worker!==this.worker)return;
          const job=this.pending.get(data?.id);if(!job)return;
          if(data.type==='progress'){job.onProgress(data.message);return;}
          clearTimeout(job.timer);this.pending.delete(data.id);
          data.type==='error'?job.reject(new Error(data.message)):job.resolve(data.value);
        };
        worker.onerror=event=>{if(worker===this.worker)this.cancel(`${this.label} worker failed${event?.message?`: ${event.message}`:'.'} Retry the operation.`);};
        worker.onmessageerror=()=>{if(worker===this.worker)this.cancel(`${this.label} worker returned an unreadable message. Retry the operation.`);};
      }
    }catch(error){this.worker=null;return Promise.reject(new Error(`${this.label} worker could not start: ${error.message}`));}
    return new Promise((resolve,reject)=>{
      const id=++this.sequence,timer=setTimeout(()=>this.cancel(`${this.label} operation timed out. Try a smaller model or retry.`),this.timeout(payload));
      this.pending.set(id,{resolve,reject,timer,onProgress});
      try{this.worker.postMessage({id,...payload});}catch(error){this.cancel(`${this.label} request could not be sent: ${error.message}`);}
    });
  }
  cancel(message=`${this.label} operation cancelled.`){
    const worker=this.worker;this.worker=null;
    try{worker?.terminate();}catch{/* Already stopped. */}
    for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(new Error(message));}this.pending.clear();
  }
}
