export function modeSettings(mode,advanced){
  return mode==='simple'?{retrieval:'hybrid-minilm',chunkWords:120,topK:3,ocr:true,answerModel:'small'}:{...advanced};
}
