import {MODEL_CATALOG} from './models.js?v=20261015-webllm';
export const RRF_CONSTANT=60;
export const CANDIDATE_DEPTH=20;
export function uniqueEvidence(hits,k=3){
  const seen=new Set(),results=[];
  for(const hit of hits){const text=hit.text.replace(/\s+/gu,' ').trim();if(!text||seen.has(text))continue;seen.add(text);results.push(hit);if(results.length>=k)break;}
  return results;
}
export function retrievalProfile(choice){
  if(choice==='bm25')return {kind:'bm25',model:null,label:'BM25'};
  const hybrid=choice.startsWith('hybrid-'),model=hybrid?choice.slice(7):choice,info=MODEL_CATALOG[model];
  if(!info)throw new Error('Unknown retrieval option.');
  return {kind:hybrid?'hybrid':'semantic',model,label:hybrid?`Hybrid · BM25 + ${info.label}`:info.label};
}
export function fuseRankings(lexical,semantic,k=3,constant=RRF_CONSTANT){
  if(!Number.isFinite(constant)||constant<0)throw new Error('RRF rank constant must be nonnegative.');
  const combined=new Map();let order=0;
  for(const [kind,list] of [['lexical',lexical],['semantic',semantic]]){
    const seen=new Set();
    list.forEach((hit,i)=>{
      if(seen.has(hit.id))return;seen.add(hit.id);
      if(!combined.has(hit.id))combined.set(hit.id,{...hit,score:0,lexicalRank:null,semanticRank:null,bm25Score:null,cosineScore:null,order:order++});
      const result=combined.get(hit.id);result.score+=1/(constant+i+1);
      if(kind==='lexical'){result.lexicalRank=i+1;result.bm25Score=hit.score;}
      else{result.semanticRank=i+1;result.cosineScore=hit.score;}
    });
  }
  return [...combined.values()].sort((a,b)=>b.score-a.score||a.order-b.order).slice(0,k).map(({order,...hit})=>hit);
}
export function queryMetrics(results,relevant,k=3){
  const wanted=new Set(relevant),top=results.slice(0,k),found=new Set(top.map(hit=>hit.docId).filter(id=>wanted.has(id)));
  const first=top.findIndex(hit=>wanted.has(hit.docId));
  return {answerable:wanted.size>0,hitAt1:wanted.size?Number(wanted.has(top[0]?.docId)):null,recallAtK:wanted.size?found.size/wanted.size:null,reciprocalRank:wanted.size?(first<0?0:1/(first+1)):null,falseEvidence:wanted.size?null:Number(top.length>0)};
}
export function aggregateMetrics(rows){
  const positives=rows.filter(row=>row.metrics.answerable),negatives=rows.filter(row=>!row.metrics.answerable);
  const mean=(items,key)=>items.length?items.reduce((sum,row)=>sum+row.metrics[key],0)/items.length:null;
  return {answerableQueries:positives.length,unanswerableQueries:negatives.length,hitAt1:mean(positives,'hitAt1'),recallAt3:mean(positives,'recallAtK'),mrrAt3:mean(positives,'reciprocalRank'),falseEvidenceRate:mean(negatives,'falseEvidence')};
}
