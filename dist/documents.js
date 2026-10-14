export const MAX_FILE_BYTES=2*1024*1024;
export const MAX_CORPUS_BYTES=8*1024*1024;
export const MAX_DOCUMENTS=20;
export const MAX_PDF_PAGES=100;
const bytes=text=>new TextEncoder().encode(text).length;
let pdfRuntime;
async function getPdfRuntime(){
  if(!pdfRuntime)pdfRuntime=import('./vendor/pdfjs/pdf.mjs').then(pdf=>{
    pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
    return pdf;
  }).catch(error=>{pdfRuntime=null;throw error;});
  return pdfRuntime;
}
export function validateFile(file){
  if(!/\.(txt|md|pdf|png|jpe?g)$/i.test(file.name))throw new Error('Use a .pdf, .txt, .md, .png, or .jpg file.');
  if(file.size>MAX_FILE_BYTES)throw new Error('File exceeds the 2 MB limit.');
  if(!file.size)throw new Error('The file is empty.');
}
export function corpusBytes(docs){return docs.reduce((sum,doc)=>sum+bytes(doc.text),0);}
export async function readDocument(file,onProgress=()=>{},options={}){
  validateFile(file);
  const buffer=await file.arrayBuffer();
  const recognize=async image=>{
    const {recognizeImage}=await import('./ocr.js?v=20261015-ai');
    return recognizeImage(image,onProgress);
  };
  if(/\.(png|jpe?g)$/i.test(file.name)){
    if(!options.ocr)throw new Error('Enable English OCR before adding images.');
    const bitmap=await createImageBitmap(file);
    try{
      if(bitmap.width*bitmap.height>16000000)throw new Error('Image exceeds the 16-megapixel limit.');
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      const result=await recognize(canvas);
      if(!result.text)throw new Error('OCR found no readable text. Try a clearer image.');
      return {text:result.text,kind:'image',ocrPages:1,textBytes:bytes(result.text)};
    }finally{bitmap.close();}
  }
  if(!/\.pdf$/i.test(file.name)){
    let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw new Error('Could not read UTF-8 text.');}
    if(!text.trim())throw new Error('The document contains no text.');
    if(text.includes('\0'))throw new Error('Binary content is unsupported.');
    return {text,kind:'text',textBytes:bytes(text)};
  }
  if(!new TextDecoder().decode(buffer.slice(0,1024)).includes('%PDF-'))throw new Error('This file is not a valid PDF.');
  const pdf=await getPdfRuntime();
  const base=new URL('./vendor/pdfjs/',import.meta.url);
  const resource=path=>{const url=new URL(path,base);return url.protocol==='file:'?decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/,'$1'):url.href;};
  const task=pdf.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,stopAtErrors:true,cMapUrl:resource('cmaps/'),cMapPacked:true,standardFontDataUrl:resource('standard_fonts/'),wasmUrl:resource('wasm/')});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;void task.destroy();},options.ocr?180000:30000);
  try{
    const document=await task.promise;
    if(document.numPages>MAX_PDF_PAGES)throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page limit.`);
    const pages=[];let textBytes=0,ocrPages=0;
    for(let n=1;n<=document.numPages;n++){
      onProgress(`Reading page ${n} of ${document.numPages}…`);
      const page=await document.getPage(n);
      const content=await page.getTextContent();
      let text=content.items.filter(item=>typeof item.str==='string').map(item=>item.str+(item.hasEOL?'\n':' ')).join('').trim();
      let ocr=false;
      if(!text&&options.ocr){
        if(ocrPages>=10)throw new Error('OCR is limited to 10 scanned pages per PDF. Split this PDF into smaller files.');
        const viewport=page.getViewport({scale:1}),scale=Math.min(2,2400/Math.max(viewport.width,viewport.height));
        const rendered=page.getViewport({scale}),canvas=globalThis.document.createElement('canvas');
        canvas.width=Math.ceil(rendered.width);canvas.height=Math.ceil(rendered.height);
        try{await page.render({canvasContext:canvas.getContext('2d'),viewport:rendered}).promise;const result=await recognize(canvas);text=result.text;ocr=true;ocrPages++;}
        finally{canvas.width=canvas.height=0;}
      }
      if(timedOut)throw new Error('PDF processing timed out.');
      textBytes+=bytes(text)+1;
      if(textBytes>MAX_CORPUS_BYTES)throw new Error('Extracted text exceeds the 8 MB session limit.');
      pages.push({page:n,text,ocr});page.cleanup();
    }
    const text=pages.map(page=>page.text).join('\n');
    if(!text.trim())throw new Error(options.ocr?'OCR found no readable text. Try a clearer scan.':'No selectable text found. Enable English OCR and re-add this scanned PDF.');
    return {text,pages,pageCount:document.numPages,emptyPages:pages.filter(page=>!page.text.trim()).length,ocrPages,kind:'pdf',textBytes:bytes(text)};
  }catch(error){
    if(timedOut)throw new Error('PDF processing timed out. Try a smaller PDF.');
    if(error.name==='PasswordException')throw new Error('Password-protected PDFs are not supported. Upload an unlocked copy.');
    if(['InvalidPDFException','FormatError','UnknownErrorException'].includes(error.name))throw new Error('Could not read this PDF. It may be damaged or unsupported.');
    throw error;
  }finally{clearTimeout(timer);await task.destroy();}
}
