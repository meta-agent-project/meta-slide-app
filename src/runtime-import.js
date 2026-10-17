import {analyzeScript,findTextBinding,applyTextEdits} from './runtime-source.js';

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
     const cs=getComputedStyle(el);if(cs.animationName!=='none'){copies[i].style.opacity=cs.opacity;copies[i].style.transform=cs.transform;}
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
    const head=[...document.head.querySelectorAll('style,link[rel="stylesheet"]')].map(el=>el.outerHTML).join('');
    send('page',{index,id:SLIDES[index].id,html:'<!doctype html><html><head><meta charset="utf-8">'+head+'<style>html,body{width:1280px;height:720px;margin:0!important;overflow:hidden!important}.stage{width:1280px!important;height:720px!important;border:0!important;box-shadow:none!important}sr-text{display:inline} [data-sr-source]{cursor:text}</style></head><body>'+copy.outerHTML+'</body></html>'});
    if(index+1<total){const next=document.querySelector('#next');if(!next||next.disabled)throw Error('다음 페이지로 이동할 수 없습니다.');next.click();}
   }
   send('done');
  }catch(error){send('error',{message:error.message});}
 }
 run();
}

export async function importRuntimeHTML(source,name,{onProgress=()=>{},signal}={}){
 if(/^\s*\{/.test(source))return null;
 const d=parse(source);if(d.getElementById('slide-room-project'))return null;
 let model,scriptIndex=-1;const scripts=[...d.querySelectorAll('script')];
 for(let i=0;i<scripts.length;i++){
  if(scripts[i].src||scripts[i].type==='module'||!scripts[i].textContent.includes('SLIDES'))continue;
  try{const candidate=analyzeScript(scripts[i].textContent);if(candidate){model=candidate;scriptIndex=i;break;}}catch{}
 }
 if(!model)return null;
 // The first adapter deliberately requires verified navigation semantics.
 if(!d.querySelector('#root:empty')||!model.source.includes('aria-label')||!model.source.includes('stage'))throw Error('슬라이드 정의는 찾았지만 페이지 이동 방식은 아직 지원하지 않습니다. 원본은 변경하지 않았습니다.');
 const channel=uid(),frame=document.createElement('iframe'),pages=[],bindings={};
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
    const page=parse(m.html),texts=[],walker=page.createTreeWalker(page.body,NodeFilter.SHOW_TEXT);
    for(const block of page.querySelectorAll('pre')){
     const binding=findTextBinding(model,m.index,block.textContent.trim());if(!binding)continue;
     const bindingId='s'+binding.start;bindings[bindingId]={...binding,displayText:block.textContent,slideIndex:m.index};block.dataset.srSource=bindingId;block.dataset.kind='text';
    }
    while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue.trim()&&!n.parentElement.closest('script,style,svg,button,.pageno,.brand,[data-sr-source]'))texts.push(n);}
    let editable=page.querySelectorAll('[data-sr-source]').length;
    for(const node of texts){
     const text=node.nodeValue,binding=findTextBinding(model,m.index,text.trim());if(!binding)continue;
     const bindingId='s'+binding.start;bindings[bindingId]={...binding,displayText:text,slideIndex:m.index};
     const parent=node.parentElement;
     // Keep original element semantics where possible; isolate mixed inline runs only in the editor snapshot.
     const el=parent.childNodes.length===1?parent:page.createElement('sr-text');
     if(el!==parent){node.replaceWith(el);el.append(node);}
     el.dataset.srSource=bindingId;el.dataset.kind='text';editable++;
    }
    const title=page.querySelector('h1,h2,h3')?.textContent||`슬라이드 ${m.index+1}`;
    pages.push({id:uid(),name:title.slice(0,45),html:serialize(page),runtimePage:m.index,editableTexts:editable});
    onProgress({current:pages.length,total:model.slides.length});arm();
   }
   if(m.type==='done'){
    if(pages.length!==model.slides.length)return fail(Error('전체 페이지를 불러오지 못했습니다.'));
    cleanup();resolve();
   }
  };
  window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});arm();document.body.append(frame);frame.srcdoc=serialize(d);if(signal?.aborted)abort();
 });
 return {version:1,title:name.replace(/\.(html?|json)$/i,''),slides:pages,runtime:{version:1,kind:'react-slides-source',source,scriptIndex,bindings,edits:{},geometry:{}}};
}

export function captureRuntimeEdits(project,doc){
 if(!project.runtime)return;
 for(const el of doc.querySelectorAll('[data-sr-source]')){
  const id=el.dataset.srSource,binding=project.runtime.bindings[id];if(!binding)throw Error('글자의 원본 연결 정보가 없습니다.');
  const text=el.textContent;
  if(text===(binding.displayText??binding.text))delete project.runtime.edits[id];else project.runtime.edits[id]=text;
 }
}

export function captureRuntimeGeometry(project,slide,el){
 if(!project.runtime||!el.hasAttribute('data-sr-geometry'))return;
 const path=el.dataset.srGeometry,key=slide.runtimePage+':'+path;
 project.runtime.geometry||={};
 project.runtime.geometry[key]={page:slide.runtimePage,path,styles:Object.fromEntries(['translate','width','height','box-sizing'].map(p=>[p,el.style.getPropertyValue(p)]).filter(([,v])=>v))};
}

export function exportRuntimeHTML(project,{embed=true}={}){
 const runtime=project.runtime;if(runtime?.kind!=='react-slides-source')throw Error('지원하지 않는 원본 실행 형식입니다.');
 const d=parse(runtime.source),script=d.querySelectorAll('script')[runtime.scriptIndex];if(!script||script.src)throw Error('원본 스크립트를 찾지 못했습니다.');
 const edits=Object.entries(runtime.edits).map(([id,text])=>{const binding=runtime.bindings[id];if(!binding)throw Error('수정 위치를 찾지 못했습니다.');return {...binding,text};});
 script.textContent=applyTextEdits(script.textContent,edits);
 const rules=Object.values(runtime.geometry||{}).map(g=>{
  if(!Number.isInteger(g.page)||g.page<0||!/^:nth-child\(\d+\)(>:nth-child\(\d+\))*$/.test(g.path))throw Error('도형 위치 정보가 올바르지 않습니다.');
  const styles=Object.entries(g.styles).map(([p,v])=>{
   if(!['translate','width','height','box-sizing'].includes(p)||!CSS.supports(p,v)||/[{};]/.test(v))throw Error('도형 크기 정보가 올바르지 않습니다.');
   return p+':'+v+'!important';
  }).join(';');
  return '.stage[aria-label^="'+(g.page+1)+' /"]>'+g.path+'{'+styles+'}';
 }).join('\n');
 if(rules){const style=d.createElement('style');style.dataset.srRuntimeGeometry='';style.textContent=rules;d.head.append(style);}
 if(embed){const data=d.createElement('script');data.id='slide-room-project';data.type='application/json';data.textContent=JSON.stringify(project).replaceAll('<','\\u003c');d.body.append(data);}
 return serialize(d);
}
