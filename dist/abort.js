export function abortable(work,signal){
  if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Operation cancelled.','AbortError'));
  if(!signal)return Promise.resolve().then(work);
  return new Promise((resolve,reject)=>{
    const abort=()=>finish(reject,signal.reason||new DOMException('Operation cancelled.','AbortError'));
    const finish=(settle,value)=>{signal.removeEventListener('abort',abort);settle(value);};
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{signal.throwIfAborted();return work();}).then(value=>finish(resolve,value),error=>finish(reject,error));
  });
}
