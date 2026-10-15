import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url);
let html=readFileSync(new URL('index.html',root),'utf8');
for(const [name,extension] of [['app','js'],['style','css']]){
  const data=readFileSync(new URL(`${name}.${extension}`,root));
  const hash=createHash('sha256').update(data).digest('hex').slice(0,12);
  const output=`${name}-${hash}.${extension}`;
  writeFileSync(new URL(output,root),data);
  html=html.replace(new RegExp(`${name}(?:-[a-f0-9]{12})?\\.${extension}(?:\\?[^"']*)?`,'g'),output);
}
writeFileSync(new URL('index.html',root),html);
console.log('Content-hashed page entry assets prepared.');
