export async function recognizeImage(image,onProgress=()=>{}){
  const {default:Tesseract}=await import('./vendor/ocr/tesseract.js');
  const {createWorker}=Tesseract;
  const base=new URL('./vendor/ocr/',import.meta.url);
  let worker,timer,timedOut=false;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;void worker?.terminate();reject(new Error('OCR timed out. Try a clearer or smaller image.'));},120000);});
  try{
    onProgress('Loading English OCR (local runtime and ~3 MB language data)…');
    const initialization=createWorker('eng',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('core/',base).href,langPath:new URL('lang/',base).href,workerBlobURL:false,logger:event=>onProgress(`OCR: ${event.status} ${Math.round((event.progress||0)*100)}%`)}).then(value=>{if(timedOut){void value.terminate();throw new Error('OCR initialization timed out.');}return value;});
    worker=await Promise.race([initialization,deadline]);
    const result=await Promise.race([worker.recognize(image),deadline]);
    return {text:result.data.text.trim(),confidence:result.data.confidence};
  }catch(error){throw new Error(timedOut?'OCR timed out. Try a clearer or smaller image.':`OCR failed: ${error.message||'Could not read this image.'}`);}
  finally{clearTimeout(timer);await worker?.terminate();}
}
