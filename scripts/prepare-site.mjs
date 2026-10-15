import {readFileSync,writeFileSync,readdirSync,mkdirSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function prepareSite(directory){
 const root=path.resolve(directory),output=path.join(root,'assets');mkdirSync(output,{recursive:true});
 // Remove only build-generated files within the explicit assets directory.
 for(const name of readdirSync(output))if(/^[\w-]+-[a-f0-9]{12}\.(js|css)$/.test(name))unlinkSync(path.join(output,name));
 for(const name of readdirSync(root))if(/^(app|style)-[a-f0-9]{12}\.(js|css)$/.test(name))unlinkSync(path.join(root,name));
 const names=readdirSync(root).filter(name=>name.endsWith('.js')),available=new Set(names),built=new Map(),visiting=new Set();
 const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
 function build(name){
  if(built.has(name))return built.get(name);
  if(visiting.has(name))throw new Error(`Circular module dependency: ${name}`);
  visiting.add(name);
  let source=readFileSync(path.join(root,name),'utf8');
  source=source.replace(/(['"])(\.\/([\w-]+\.js))(?:\?[^'"]*)?\1/g,(match,quote,relative,target)=>{
   if(!available.has(target))throw new Error(`Missing first-party module ${target} referenced by ${name}`);
   return `${quote}./${build(target)}${quote}`;
  }).replace(/(['"])\.\/vendor\//g,'$1../vendor/');
  const filename=`${name.slice(0,-3)}-${hash(source)}.js`;
  writeFileSync(path.join(output,filename),source);built.set(name,filename);visiting.delete(name);return filename;
 }
 for(const name of names)build(name);
 const css=readFileSync(path.join(root,'style.css'),'utf8'),stylesheet=`style-${hash(css)}.css`;
 writeFileSync(path.join(output,stylesheet),css);
 const styles=new Map([['style.css',stylesheet]]);
 if(readdirSync(root).includes('case-study.css')){
  const source=readFileSync(path.join(root,'case-study.css'),'utf8'),filename=`case-study-${hash(source)}.css`;
  writeFileSync(path.join(output,filename),source);styles.set('case-study.css',filename);
 }
 for(const name of readdirSync(root).filter(name=>name.endsWith('.html'))){
  let html=readFileSync(path.join(root,name),'utf8');
  html=html.replace(/(?:assets\/)?app(?:-[a-f0-9]{12})?\.js(?:\?[^"']*)?/g,`assets/${built.get('app.js')}`)
   .replace(/(?:assets\/)?(?<![\w-])style(?:-[a-f0-9]{12})?\.css(?:\?[^"']*)?/g,`assets/${stylesheet}`);
  if(styles.has('case-study.css'))html=html.replace(/(?:assets\/)?case-study(?:-[a-f0-9]{12})?\.css(?:\?[^"']*)?/g,`assets/${styles.get('case-study.css')}`);
  writeFileSync(path.join(root,name),html);
 }
 return Object.fromEntries([...built,...styles]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=prepareSite(fileURLToPath(new URL('../dist/',import.meta.url)));
 console.log(`Prepared ${Object.keys(manifest).length} content-hashed modules/styles, including workers.`);
}
