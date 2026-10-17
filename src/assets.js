import {parse,serialize} from './document.js';
const local=url=>url&&!/^(data:|https?:|\/\/|#|mailto:|blob:)/i.test(url);
const normalize=path=>{const out=[];for(const part of path.replaceAll('\\','/').split('/')){if(part==='..')out.pop();else if(part&&part!=='.')out.push(part);}return out.join('/');};
export function dependencies(project){
 const urls=new Set();
 for(const slide of project.slides){const d=parse(slide.html);for(const el of d.querySelectorAll('[src],[poster],link[href]')){const url=el.getAttribute('src')||el.getAttribute('poster')||el.getAttribute('href');if(url&&!/^(data:|#)/.test(url))urls.add(url);}
  for(const m of slide.html.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g))if(!/^(data:|#)/.test(m[1]))urls.add(m[1]);
 }return [...urls];
}
export async function embedAssets(project,files){
 const list=[...files].map(file=>({file,path:normalize(file.webkitRelativePath||file.name)})),cache=new Map();
 function find(url,base='') {const clean=normalize(base+decodeURIComponent(url.split(/[?#]/)[0]));const candidates=list.filter(a=>a.path===clean||a.path.endsWith('/'+clean));return candidates.length===1?candidates[0]:null;}
 async function data(item){if(cache.has(item.path))return cache.get(item.path);const result=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(item.file);});cache.set(item.path,result);return result;}
 async function replaceAsync(value,re,fn){const matches=[...value.matchAll(re)];for(const m of matches.reverse())value=value.slice(0,m.index)+await fn(m)+value.slice(m.index+m[0].length);return value;}
 async function css(text,base='',seen=new Set()){
  text=await replaceAsync(text,/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*([^;]*);/g,async m=>{const item=find(m[1],base);if(!item||seen.has(item.path))return m[0];const next=new Set(seen);next.add(item.path);const content=await css(await item.file.text(),item.path.slice(0,item.path.lastIndexOf('/')+1),next);return m[2].trim()?`@media ${m[2]}{${content}}`:content;});
  return replaceAsync(text,/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g,async m=>{if(!local(m[1]))return m[0];const item=find(m[1],base);return item?`url("${await data(item)}")`:m[0];});
 }
 for(const slide of project.slides){const d=parse(slide.html);
  for(const el of d.querySelectorAll('link[rel="stylesheet"]')){const item=find(el.getAttribute('href'));if(item){const st=d.createElement('style');st.textContent=await css(await item.file.text(),item.path.slice(0,item.path.lastIndexOf('/')+1));el.replaceWith(st);}}
  for(const el of d.querySelectorAll('[src],[poster]'))for(const attr of ['src','poster']){const url=el.getAttribute(attr);if(local(url)){const item=find(url);if(item)el.setAttribute(attr,await data(item));}}
  for(const el of d.querySelectorAll('style'))el.textContent=await css(el.textContent);
  for(const el of d.querySelectorAll('[style]'))el.setAttribute('style',await css(el.getAttribute('style')));
  slide.html=serialize(d);
 }
 return dependencies(project);
}
export function setup(editor){
 const $=s=>document.querySelector(s);
 $('#openBtn').insertAdjacentHTML('afterend','<button id="assetsBtn" title="원본 HTML과 함께 받은 이미지·CSS·폰트 파일 연결">리소스</button>');
 document.body.insertAdjacentHTML('beforeend','<input id="assetFiles" type="file" multiple hidden><input id="assetFolder" type="file" webkitdirectory multiple hidden><dialog id="assetDialog"><h2>리소스 연결</h2><p>HTML과 함께 받은 이미지·CSS·폰트·영상 파일을 선택하면 HTML에 포함합니다.</p><p class="muted">폴더 구조가 있으면 폴더 전체를 선택하세요. 같은 이름의 파일이 여러 개면 경로를 유지해야 합니다.</p><button id="pickAssets">파일 선택</button> <button id="pickFolder">폴더 선택</button><h3>외부 또는 아직 연결되지 않은 리소스</h3><ul id="dependencyList"></ul><button id="closeAssets">닫기</button></dialog>');
 function show(){const ul=$('#dependencyList');ul.replaceChildren();const deps=dependencies(editor.project);for(const s of deps){const li=document.createElement('li');li.textContent=s;ul.append(li);}if(!deps.length)ul.textContent='모든 리소스가 포함되어 있습니다.';}
 $('#assetsBtn').onclick=()=>{editor.finishEdit();show();$('#assetDialog').showModal();};$('#closeAssets').onclick=()=>$('#assetDialog').close();$('#pickAssets').onclick=()=>$('#assetFiles').click();$('#pickFolder').onclick=()=>$('#assetFolder').click();
 for(const id of ['assetFiles','assetFolder'])$('#'+id).onchange=async e=>{try{editor.finishEdit();await embedAssets(editor.project,e.target.files);editor.commit({capture:false});await editor.render();show();editor.toast('리소스를 연결했습니다.');}catch(err){editor.toast('리소스 연결 실패: '+err.message);}finally{e.target.value='';}};
}
