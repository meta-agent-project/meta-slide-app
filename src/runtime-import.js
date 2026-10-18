import {analyzeScript,findTextBinding,findTextBindings,applyTextEdits,composeRuntimePages} from './runtime-source.js';

const parse=html=>new DOMParser().parseFromString(html,'text/html');
const serialize=d=>'<!doctype html>\n'+d.documentElement.outerHTML;
const uid=()=>crypto.randomUUID();

function captureBridge(channel){
 // This function is serialized into an opaque-origin iframe. No host DOM access.
 const send=(type,data={})=>parent.postMessage({channel,type,...data},'*');
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(fn,timeout=20000)=>{const until=Date.now()+timeout;while(Date.now()<until){const value=fn();if(value)return value;await delay(30);}throw Error('원본 슬라이드 실행 대기 시간이 초과되었습니다.');};
 async function run(){
  try{
   await wait(()=>document.querySelector('.stage .slide'));
   const total=SLIDES.length;
   if(total<1||total>300)throw Error('지원 가능한 페이지 수를 벗어났습니다.');
   // Use the app's own controls, preserving hooks and component context.
   const position=()=>Number(document.querySelector('.stage')?.getAttribute('aria-label')?.match(/^\s*(\d+)\s*\//)?.[1])-1;
   if(!Number.isInteger(position()))throw Error('원본 페이지 위치를 확인할 수 없습니다.');
   while(position()>0){const before=position();document.querySelector('#prev')?.click();await wait(()=>position()<before);}
   await Promise.race([document.fonts.ready,delay(4000)]);
   for(let index=0;index<total;index++){
    await wait(()=>position()===index);
    const root=document.querySelector('.stage');
    for(const animation of root.getAnimations({subtree:true})){try{if(Number.isFinite(animation.effect.getComputedTiming().endTime))animation.finish();else{animation.currentTime=1000;animation.pause();}}catch{}}
    const copy=root.cloneNode(true),originals=[root,...root.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
    originals.forEach((el,i)=>{
     const cs=getComputedStyle(el);
     for(const animation of el.getAnimations())for(const keyframe of animation.effect?.getKeyframes()||[])for(const key of Object.keys(keyframe)){
      if(['offset','easing','composite','computedOffset'].includes(key))continue;
      const property=key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
      copies[i].style.setProperty(property,cs.getPropertyValue(property));
     }
     if(el===root||el.matches('.slide')||el.closest('svg')&&el.tagName.toLowerCase()!=='svg')return;
     const shape=el.tagName.toLowerCase()==='svg'||el.tagName==='DIV'&&(cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent'||parseFloat(cs.borderTopWidth)>0);
     if(shape){
      const path=[];let node=el;
      while(node!==root){path.unshift(':nth-child('+([...node.parentElement.children].indexOf(node)+1)+')');node=node.parentElement;}
      copies[i].dataset.srGeometry=path.join('>');
     }
    });
    copy.style.setProperty('--s','1');copy.style.setProperty('transform','none','important');copy.style.setProperty('position','relative','important');copy.style.setProperty('left','0','important');copy.style.setProperty('top','0','important');
    copy.querySelectorAll('script').forEach(el=>el.remove());
    // Exported HTML often has a second title/style block inside body. Those styles still apply.
    const head=[...document.querySelectorAll('style,link[rel="stylesheet"]')].map(el=>el.outerHTML).join('');
    send('page',{index,id:SLIDES[index].id,html:'<!doctype html><html><head><meta charset="utf-8">'+head+'<style>html,body{width:1280px;height:720px;margin:0!important;overflow:hidden!important}.stage{width:1280px!important;height:720px!important;border:0!important;box-shadow:none!important}sr-text{display:inline} [data-sr-source]{cursor:text}</style></head><body>'+copy.outerHTML+'</body></html>'});
    if(index+1<total){const next=document.querySelector('#next');if(!next||next.disabled)throw Error('다음 페이지로 이동할 수 없습니다.');next.click();}
   }
   send('done');
  }catch(error){send('error',{message:error.message});}
 }
 run();
}

async function capturePages(d,model,onProgress,signal){
 const channel=uid(),frame=document.createElement('iframe'),pages=[];
 frame.setAttribute('sandbox','allow-scripts');frame.title='원본 슬라이드 분석';frame.style.cssText='position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0;';
 const bridge=d.createElement('script');bridge.textContent='('+captureBridge.toString()+')('+JSON.stringify(channel)+');';d.body.append(bridge);
 await new Promise((resolve,reject)=>{
  let timeout;const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);frame.remove();};
  const fail=error=>{cleanup();reject(error);};
  const arm=()=>{clearTimeout(timeout);timeout=setTimeout(()=>fail(Error('원본 실행에 실패했습니다. 외부 라이브러리 로딩과 파일 형식을 확인하세요.')),30000);};
  const abort=()=>fail(Error('불러오기를 취소했습니다.'));
  const receive=event=>{
   if(event.source!==frame.contentWindow||event.data?.channel!==channel)return;
   const m=event.data;
   if(m.type==='error')return fail(Error(m.message));
   if(m.type==='page'){
    if(m.index!==pages.length||m.id!==model.slides[m.index]?.id||typeof m.html!=='string')return fail(Error('페이지 순서 검증에 실패했습니다.'));
    pages.push(m.html);
    onProgress({current:pages.length,total:model.slides.length});arm();
   }
   if(m.type==='done'){
    if(pages.length!==model.slides.length)return fail(Error('전체 페이지를 불러오지 못했습니다.'));
    cleanup();resolve();
   }
  };
  window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});arm();document.body.append(frame);frame.srcdoc=serialize(d);if(signal?.aborted)abort();
 });
 return pages;
}

const textNodes=page=>{
 const nodes=[],walker=page.createTreeWalker(page.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue.trim()&&!n.parentElement.closest('script,style,svg,button,.pageno,.brand,[data-sr-source]'))nodes.push(n);}
 return nodes;
};
const nodePath=node=>{const path=[];while(node.parentNode&&node.parentNode.nodeType!==9){path.unshift([...node.parentNode.childNodes].indexOf(node));node=node.parentNode;}return path;};
const atPath=(doc,path)=>path.reduce((node,i)=>node?.childNodes[i],doc.documentElement);
const elementPath=el=>{const path=[];while(el&&!el.matches('.stage')){path.unshift(':nth-child('+([...el.parentElement.children].indexOf(el)+1)+')');el=el.parentElement;}return path.join('>');};

export async function importRuntimeHTML(source,name,{onProgress=()=>{},signal}={}){
 if(/^\s*\{/.test(source))return null;
 const d=parse(source);if(d.getElementById('slide-room-project'))return null;
 let model,scriptIndex=-1;const scripts=[...d.querySelectorAll('script')];
 for(let i=0;i<scripts.length;i++){
  if(scripts[i].src||scripts[i].type==='module'||!scripts[i].textContent.includes('SLIDES'))continue;
  try{const candidate=analyzeScript(scripts[i].textContent);if(candidate){model=candidate;scriptIndex=i;break;}}catch{}
 }
 if(!model)return null;
 if(!d.querySelector('#root:empty')||!model.source.includes('aria-label')||!model.source.includes('stage'))throw Error('슬라이드 정의는 찾았지만 페이지 이동 방식은 아직 지원하지 않습니다. 원본은 변경하지 않았습니다.');
 const rawPages=await capturePages(d,model,onProgress,signal),documents=rawPages.map(parse),bindings={},candidates=new Map(),verified=new Map();
 // Resolve repeated words by running an isolated, marked copy. DOM/source order is not assumed.
 documents.forEach((page,index)=>{for(const node of textNodes(page)){
  const matches=findTextBindings(model,index,node.nodeValue.trim());
  if(matches.length>1)for(const b of matches)candidates.set(b.start,{...b,slideIndex:index});
 }});
 if(candidates.size){
  const marker='SR'+uid().replaceAll('-','')+'_',probe=parse(source),edits=[...candidates.values()].map(b=>({...b,text:marker+b.start}));
  probe.querySelectorAll('script')[scriptIndex].textContent=applyTextEdits(model.source,edits);
  const marked=await capturePages(probe,model,p=>onProgress({...p,phase:'text-map'}),signal);
  marked.forEach((html,index)=>{
   const page=parse(html),hits=new Map();
   for(const n of textNodes(page)){
    const value=n.nodeValue.trim();if(!value.startsWith(marker))continue;
    const start=Number(value.slice(marker.length)),binding=candidates.get(start);if(!binding||binding.slideIndex!==index)continue;
    const original=atPath(documents[index],nodePath(n));
    if(!original||original.nodeType!==3||original.nodeValue.trim()!==binding.text||original.parentElement.tagName!==n.parentElement.tagName)continue;
    const all=hits.get(start)||[];all.push(original);hits.set(start,all);
   }
   for(const [start,nodes]of hits)if(nodes.length===1)verified.set(nodes[0],candidates.get(start));
  });
 }
 const pages=documents.map((page,index)=>{
  page.body.dataset.srRuntimeSnapshot='';
  for(const block of page.querySelectorAll('pre')){
   const binding=findTextBinding(model,index,block.textContent.trim());if(!binding)continue;
   const id='s'+binding.start;bindings[id]={...binding,displayText:block.textContent,slideIndex:index,path:elementPath(block)};block.dataset.srSource=id;block.dataset.kind='text';
  }
  const nodes=textNodes(page),paths=new Map(nodes.map(n=>[n,elementPath(n.parentElement)]));
  for(const node of nodes){
   const text=node.nodeValue,binding=verified.get(node)||findTextBinding(model,index,text.trim());if(!binding)continue;
   const id='s'+binding.start;bindings[id]={...binding,displayText:text,slideIndex:index,path:paths.get(node)};
   const parent=node.parentElement,el=parent.childNodes.length===1?parent:page.createElement('sr-text');
   if(el!==parent){node.replaceWith(el);el.append(node);}
   el.dataset.srSource=id;el.dataset.kind='text';
  }
  const title=page.querySelector('h1,h2,h3')?.textContent||`슬라이드 ${index+1}`;
  return {id:uid(),name:title.slice(0,45),html:serialize(page),runtimePage:index,editableTexts:page.querySelectorAll('[data-sr-source]').length};
 });
 return {version:1,title:name.replace(/\.(html?|json)$/i,''),slides:pages,runtime:{version:1,kind:'react-slides-source',source,scriptIndex,bindings,edits:{},geometry:{}}};
}

export function captureRuntimeEdits(project,doc,slide){
 if(!project.runtime)return;
 const edits=slide?.runtimeEdits??project.runtime.edits;
 for(const el of doc.querySelectorAll('[data-sr-source]')){
  const id=el.dataset.srSource,binding=project.runtime.bindings[id];if(!binding)throw Error('글자의 원본 연결 정보가 없습니다.');
  const text=el.textContent;
  if(text===(binding.displayText??binding.text))delete edits[id];else edits[id]=text;
 }
}

export function captureRuntimeGeometry(project,slide,el){
 if(!project.runtime||!el.hasAttribute('data-sr-geometry'))return;
 const path=el.dataset.srGeometry,key=slide.runtimePage+':'+path;
 project.runtime.geometry||={};
 const geometry=slide.runtimeGeometry??project.runtime.geometry;
 geometry[key]={page:slide.runtimePage,path,styles:Object.fromEntries(['translate','width','height','box-sizing','rotate','display'].map(p=>[p,el.style.getPropertyValue(p)]).filter(([,v])=>v))};
}

export function exportRuntimeHTML(project,{embed=true}={}){
 const runtime=project.runtime;if(runtime?.kind!=='react-slides-source')throw Error('지원하지 않는 원본 실행 형식입니다.');
 const d=parse(runtime.source),script=d.querySelectorAll('script')[runtime.scriptIndex];if(!script||script.src)throw Error('원본 스크립트를 찾지 못했습니다.');
 const edits=Object.entries(runtime.edits).map(([id,text])=>{const binding=runtime.bindings[id];if(!binding)throw Error('수정 위치를 찾지 못했습니다.');return {...binding,text};});
 const model=analyzeScript(script.textContent),changed=project.slides.length!==model.slides.length||project.slides.some((s,i)=>s.runtimePage!==i||s.runtimeEdits);
 if(changed)script.textContent=composeRuntimePages(script.textContent,project.slides.map(s=>Number.isInteger(s.runtimePage)?{page:s.runtimePage,id:s.runtimeEdits?'sr-'+s.id:undefined,edits:Object.entries(s.runtimeEdits??runtime.edits).filter(([id])=>runtime.bindings[id]?.slideIndex===s.runtimePage).map(([id,text])=>({...runtime.bindings[id],text}))}:{id:'sr-'+s.id,name:s.name,html:s.html}));
 else script.textContent=applyTextEdits(script.textContent,edits);
 const mappedGeometry=project.slides.flatMap((s,page)=>Object.values(s.runtimeGeometry??runtime.geometry??{}).filter(g=>g.page===s.runtimePage).map(g=>({...g,page})));
 const rules=mappedGeometry.map(g=>{
  if(!Number.isInteger(g.page)||g.page<0||!/^:nth-child\(\d+\)(>:nth-child\(\d+\))*$/.test(g.path))throw Error('도형 위치 정보가 올바르지 않습니다.');
  const styles=Object.entries(g.styles).map(([p,v])=>{
   if(!['translate','width','height','box-sizing','rotate','display'].includes(p)||!CSS.supports(p,v)||/[{};]/.test(v))throw Error('도형 크기 정보가 올바르지 않습니다.');
   return p+':'+v+'!important';
  }).join(';');
  return '.stage[aria-label^="'+(g.page+1)+' /"]>'+g.path+'{'+styles+'}';
 });
 for(const [page,slide]of project.slides.entries())for(const [id,text]of Object.entries(slide.runtimeEdits??runtime.edits))if(text.includes('\n')){
  const b=runtime.bindings[id];
  if(b.slideIndex===slide.runtimePage&&/^:nth-child\(\d+\)(>:nth-child\(\d+\))*$/.test(b.path))rules.push('.stage[aria-label^="'+(page+1)+' /"]>'+b.path+'{white-space:pre-wrap!important}');
 }
 if(rules.length){const style=d.createElement('style');style.dataset.srRuntimeGeometry='';style.textContent=rules.join('\n');d.head.append(style);}
 if(embed){const data=d.createElement('script');data.id='slide-room-project';data.type='application/json';data.textContent=JSON.stringify(project).replaceAll('<','\\u003c');d.body.append(data);}
 return serialize(d);
}
