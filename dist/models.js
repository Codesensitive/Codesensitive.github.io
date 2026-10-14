export const MODEL_CATALOG={
  minilm:{id:'Xenova/all-MiniLM-L6-v2',label:'MiniLM L6 v2',size:'23 MB weights',pooling:'mean',tokens:256,cutoff:.25,prefix:'',license:'Apache 2.0',description:'Small, fast general-purpose English sentence embeddings.'},
  bge:{id:'Xenova/bge-small-en-v1.5',label:'BGE Small English v1.5',size:'34 MB weights',pooling:'cls',tokens:512,cutoff:.5,prefix:'Represent this sentence for searching relevant passages: ',license:'MIT',description:'English retrieval model with a longer input window.'}
};
export const MODEL_CACHE='evidence-lab-models-v1';
export const MAX_SEMANTIC_CHUNKS=200;
export function modelInfo(key){const model=MODEL_CATALOG[key];if(!model)throw new Error('Select a supported local embedding model.');return model;}
export function cosine(a,b){
  if(a.length!==b.length)throw new Error('Embedding dimensions do not match. Rebuild the index with one model.');
  let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2;}
  return aa&&bb?dot/Math.sqrt(aa*bb):0;
}
export function rankVectors(vectors,query,k=3,threshold=.25){return vectors.map((vector,i)=>({i,score:cosine(vector,query)})).filter(hit=>hit.score>=threshold).sort((a,b)=>b.score-a.score).slice(0,k);}
