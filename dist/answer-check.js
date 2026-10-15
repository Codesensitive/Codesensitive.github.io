import {inspectCitations} from './llm-models.js';
import {excerpt} from './engine.js';
export function checkedAnswer(answer,sources,hits,question){
  const citations=inspectCitations(answer,sources);
  const refusal=/^the supplied evidence does not answer this question\.?$/i.test(answer.trim());
  const fallback=!refusal&&(citations.missing||citations.invalid.length>0);
  return {citations,fallback,text:fallback?hits.map((hit,i)=>`${excerpt(hit,question)} [${i+1}]`).join('\n\n'):answer};
}
