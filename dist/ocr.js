import {abortable} from './abort.js';
export async function recognizeImage(image,onProgress=()=>{},options={}){
  const deadline=new AbortController(),signal=AbortSignal.any([deadline.signal,...(options.signal?[options.signal]:[])]);
  const timer=setTimeout(()=>deadline.abort(new Error('OCR timed out. Try a clearer or smaller image.')),options.timeoutMs??120000);
  const base=new URL('./vendor/ocr/',import.meta.url);let worker,stopped=false;
  const stop=()=>{if(!worker||stopped)return;stopped=true;return Promise.resolve(worker.terminate()).catch(()=>{});};
  signal.addEventListener('abort',stop,{once:true});
  try{
    onProgress('Loading English OCR (local runtime and ~3 MB language data)…');
    const createWorker=options.createWorker||(await abortable(()=>import('./vendor/ocr/tesseract.js'),signal)).default.createWorker;
    const initialization=Promise.resolve(createWorker('eng',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang/',base).href,workerBlobURL:false,logger:event=>{if(!signal.aborted)onProgress(`OCR: ${event.status} ${Math.round((event.progress||0)*100)}%`);}}));
    initialization.then(value=>{worker=value;if(signal.aborted)void stop();},()=>{});
    worker=await abortable(()=>initialization,signal);
    const result=await abortable(()=>worker.recognize(image),signal);
    return {text:result.data.text.trim(),confidence:result.data.confidence};
  }catch(error){if(signal.aborted)throw signal.reason;throw new Error(`OCR failed: ${error.message||String(error)}`);}
  finally{clearTimeout(timer);signal.removeEventListener('abort',stop);await stop();}
}
