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
  if(!/\.(txt|md|pdf)$/i.test(file.name))throw new Error('Use a .pdf, .txt, or .md file.');
  if(file.size>MAX_FILE_BYTES)throw new Error('File exceeds the 2 MB limit.');
  if(!file.size)throw new Error('The file is empty.');
}
export function corpusBytes(docs){return docs.reduce((sum,doc)=>sum+bytes(doc.text),0);}
export async function readDocument(file,onProgress=()=>{}){
  validateFile(file);
  const buffer=await file.arrayBuffer();
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
  const timer=setTimeout(()=>{timedOut=true;void task.destroy();},30000);
  try{
    const document=await task.promise;
    if(document.numPages>MAX_PDF_PAGES)throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page limit.`);
    const pages=[];let textBytes=0;
    for(let n=1;n<=document.numPages;n++){
      onProgress(`Reading page ${n} of ${document.numPages}…`);
      const page=await document.getPage(n);
      const content=await page.getTextContent();
      const text=content.items.filter(item=>typeof item.str==='string').map(item=>item.str+(item.hasEOL?'\n':' ')).join('').trim();
      textBytes+=bytes(text)+1;
      if(textBytes>MAX_CORPUS_BYTES)throw new Error('Extracted text exceeds the 8 MB session limit.');
      pages.push({page:n,text});page.cleanup();
    }
    const text=pages.map(page=>page.text).join('\n');
    if(!text.trim())throw new Error('No selectable text found. Scanned or image-only PDFs need OCR, which is not supported yet.');
    return {text,pages,pageCount:document.numPages,emptyPages:pages.filter(page=>!page.text.trim()).length,kind:'pdf',textBytes:bytes(text)};
  }catch(error){
    if(timedOut)throw new Error('PDF processing timed out. Try a smaller PDF.');
    if(error.name==='PasswordException')throw new Error('Password-protected PDFs are not supported. Upload an unlocked copy.');
    if(['InvalidPDFException','FormatError','UnknownErrorException'].includes(error.name))throw new Error('Could not read this PDF. It may be damaged or unsupported.');
    throw error;
  }finally{clearTimeout(timer);await task.destroy();}
}
