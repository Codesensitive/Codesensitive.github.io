import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),origin='https://codesensitive.github.io';
const read=file=>readFileSync(path.join(root,file),'utf8');
const pages=['index.html','evidence-lab.html'];
test('public landing pages provide consistent indexable metadata and real identity schema',()=>{
 for(const file of pages){
  const doc=new JSDOM(read(file)).window.document,url=origin+(file==='index.html'?'/':'/'+file);
  assert.equal(doc.documentElement.lang,'en');assert.equal(doc.querySelectorAll('h1').length,1);
  assert.match(doc.title,/Anuj Yadav/);assert.ok(doc.querySelector('meta[name="description"]').content.length>=100);
  assert.equal(doc.querySelector('link[rel="canonical"]').href,url);assert.equal(doc.querySelector('meta[property="og:url"]').content,url);
  assert.doesNotMatch(doc.querySelector('meta[name="robots"]').content,/noindex|nofollow/);
  const graph=JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
  const person=graph.find(item=>item['@type']==='Person');assert.equal(person.name,'Anuj Yadav');assert.deepEqual(person.sameAs,['https://github.com/Codesensitive']);
  assert.ok(doc.querySelector('main').textContent.length>1500);assert.ok(doc.querySelector('a[href="/evidence-lab.html"]')||file==='evidence-lab.html');
  for(const element of doc.querySelectorAll('a[href],link[href],script[src]')){
   const raw=element.getAttribute('href')??element.getAttribute('src');if(!raw||/^https?:|^mailto:/.test(raw))continue;
   const target=new URL(raw,url),filename=target.pathname==='/'?'index.html':target.pathname.slice(1);
   assert.ok(existsSync(path.join(root,filename)),`${file}: missing ${raw}`);
   if(target.hash){const targetDoc=new JSDOM(read(filename)).window.document;assert.ok(targetDoc.getElementById(decodeURIComponent(target.hash.slice(1))),`${file}: missing anchor ${raw}`);}
  }
 }
});
test('sitemap advertises canonical pages only, robots permits resources, and missing pages are noindex',()=>{
 const xml=new JSDOM(read('sitemap.xml'),{contentType:'application/xml'}).window.document;
 assert.deepEqual([...xml.querySelectorAll('loc')].map(x=>x.textContent),[origin+'/',origin+'/evidence-lab.html']);
 assert.match(read('robots.txt'),/Allow: \/\s+Sitemap: https:\/\/codesensitive\.github\.io\/sitemap\.xml/);
 assert.doesNotMatch(read('robots.txt'),/Disallow:\s*\//);
 const missing=new JSDOM(read('404.html')).window.document;assert.equal(missing.querySelector('meta[name="robots"]').content,'noindex');
 const image=readFileSync(path.join(root,'social-preview.png'));assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
});
