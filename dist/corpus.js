export function addSamples(documents,samples,limit=20,maxBytes=8*1024*1024){
  const known=new Set(documents.map(doc=>doc.id)),missing=samples.filter(doc=>!known.has(doc.id));
  if(documents.length+missing.length>limit)throw new Error('Not enough document slots for the sample corpus. Remove documents first.');
  if([...documents,...missing].reduce((total,doc)=>total+new TextEncoder().encode(doc.text).length,0)>maxBytes)throw new Error('Sample documents would exceed the 8 MB session limit. Remove documents first.');
  return [...documents,...structuredClone(missing)];
}
