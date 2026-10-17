import {History,clone} from './src/core.js';
import {uid,parse,serialize,markElements,importHTML,editorHTML,blankSlide,initialProject,exportHTML} from './src/document.js';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let project=initialProject(),history=new History(project),index=0,selected=null,scale=1,zoom=1,editing=null,loadVersion=0;
let originalInput='',dirty=false;
$('#stage').innerHTML='<iframe id="canvas" title="슬라이드 편집 화면" sandbox="allow-same-origin"></iframe><div id="selectionBox" hidden><button id="resizeHandle" aria-label="크기 조절"></button><span id="objectBadge"></span></div>';
const canvas=$('#canvas');
$('#openBtn').insertAdjacentHTML('afterend','<button id="saveBtn">저장</button>');
$('#addSlide').insertAdjacentHTML('afterend','<div class="slide-actions"><button id="duplicateSlide" title="슬라이드 복제">복제</button><button id="slideUp" title="슬라이드 위로">↑</button><button id="slideDown" title="슬라이드 아래로">↓</button></div>');
$('#elementProps').insertAdjacentHTML('beforeend','<section><h3>테두리</h3><div class="text-tools"><input type="number" id="borderWidth" min="0" max="30" aria-label="테두리 두께"><input type="color" id="borderColor" aria-label="테두리 색상" value="#253f38"></div></section><button id="parentBtn">상위 묶음 선택 ↑</button>');
$('#removeSlide').insertAdjacentHTML('beforebegin','<section><h3>오브젝트 <span class="muted">내부 요소도 선택 가능</span></h3><div id="layers"></div></section>');
$('#imageBtn').insertAdjacentHTML('afterend','<select id="shapeSelect" aria-label="추가 도형"><option value="">도형 더보기</option value="rounded">둥근 사각형</option><option value="line">선</option><option value="arrow">화살표</option></select>');
$('.toolbar>span')?.remove();
$('#stageArea').insertAdjacentHTML('beforebegin','<div id="importNotice" hidden></div>');
function toast(msg){$('#toast').textContent=msg;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,4000);}
const current=()=>project.slides[index];
const doc=()=>canvas.contentDocument;
function nodeName(el){return el?.dataset.kind||({svg:'SVG · 묶음',IMG:'이미지',VIDEO:'영상',IFRAME:'외부 콘텐츠',TABLE:'표',TD:'표 셀',TH:'표 셀',DIV:'묶음',SECTION:'묶음'}[el?.tagName])||el?.tagName?.toLowerCase()||'슬라이드 배경';}
function isText(el){return el && !el.closest('svg')&&!['IMG','VIDEO','IFRAME','CANVAS','TABLE'].includes(el.tagName)&&(!el.children.length||/^(H[1-6]|P|SPAN|LI|TD|TH|BLOCKQUOTE)$/.test(el.tagName))&&!['rect','rounded','circle','line','arrow'].includes(el.dataset.kind);}
function takeSnapshot(){
 if(!doc()?.body)return;
 const d=parse(serialize(doc()));
 d.querySelectorAll('[data-editor-only],meta[http-equiv="Content-Security-Policy"]').forEach(e=>e.remove());
 d.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
 d.querySelectorAll('[data-cell-selected]').forEach(e=>e.removeAttribute('data-cell-selected'));
 const old=parse(current().html);
 old.querySelectorAll('script').forEach(s=>d.body.append(d.importNode(s,true)));
 for(const el of d.querySelectorAll('[data-sr-id]')){
  const prior=old.querySelector(`[data-sr-id="${el.dataset.srId}"]`);
  if(prior){for(const a of prior.attributes)if(/^on/i.test(a.name))el.setAttribute(a.name,a.value);
   if(el.tagName==='IFRAME'){if(prior.hasAttribute('sandbox'))el.setAttribute('sandbox',prior.getAttribute('sandbox'));else el.removeAttribute('sandbox');}
  }
 }
 current().html=serialize(d);
}
function commit({capture=true}={}){if(capture)takeSnapshot();history.push(project);dirty=true;updateHistory();renderSlides();renderLayers();saveLocal();}
function updateHistory(){$('#undoBtn').disabled=!history.canUndo;$('#redoBtn').disabled=!history.canRedo;}
async function render(){
 const version=++loadVersion;selected=null;editing=null;$('#selectionBox').hidden=true;$('#projectName').value=project.title;renderSlides();updateHistory();
 await new Promise(resolve=>{canvas.onload=resolve;canvas.srcdoc=editorHTML(current().html);});
 if(version!==loadVersion)return;
 const pageRoot=doc().querySelector('[data-sr-page]');
 if(pageRoot&&doc().defaultView.getComputedStyle(pageRoot).display==='none')pageRoot.style.setProperty('display','block','important');
 bindDocument();fit();select(null);renderLayers();
 document.dispatchEvent(new Event('slide-ready'));
}
function renderSlides(){
 const list=$('#slides');list.replaceChildren();
 project.slides.forEach((s,i)=>{
  const item=document.createElement('button');item.className='slide-item'+(i===index?' active':'');item.title=s.name;item.setAttribute('aria-label',`슬라이드 ${i+1}: ${s.name}`);
  const num=document.createElement('span');num.className='slide-number';num.textContent=String(i+1).padStart(2,'0');
  const frame=document.createElement('div');frame.className='thumb-frame';
  const preview=document.createElement('iframe');preview.className='thumb';preview.tabIndex=-1;preview.setAttribute('sandbox','');preview.srcdoc=editorHTML(s.html);preview.title=s.name;frame.append(preview);
  item.append(num,frame);item.onclick=()=>{finishEdit();index=i;render();};list.append(item);
 });
 $('#slideCount').textContent=String(project.slides.length).padStart(2,'0');$('#slideLabel').textContent=`SLIDE ${String(index+1).padStart(2,'0')}`;
 $('#slideUp').disabled=index===0;$('#slideDown').disabled=index===project.slides.length-1;
}
function fit(){const area=$('#stageArea');scale=Math.min((area.clientWidth-70)/1280,(area.clientHeight-50)/720)*zoom;scale=Math.max(.15,scale);$('#stage').style.transform=`scale(${scale})`;$('#stageWrap').style.width=1280*scale+'px';$('#stageWrap').style.height=720*scale+'px';$('#zoomLabel').textContent=Math.round(scale*100)+'%';updateBox();}
function getRect(el){return el.getBoundingClientRect();}
function select(el){
 if(el===doc()?.body||el===doc()?.documentElement)el=null;
 selected=el;$('#selectionName').textContent=nodeName(el);$('#elementProps').hidden=!el;$('#textProps').hidden=!isText(el);
 if(el){const r=getRect(el),s=doc().defaultView.getComputedStyle(el);for(const [id,v]of Object.entries({propX:r.x,propY:r.y,propW:r.width,propH:r.height,fontSize:parseFloat(s.fontSize),borderWidth:parseFloat(s.borderWidth)||0}))$('#'+id).value=Math.round(v);
  $('#boldBtn').classList.toggle('active',Number(s.fontWeight)>=600);$('#fontFamily').value=['serif','monospace'].find(x=>s.fontFamily===x)||'sans-serif';
 }
 const target=el||doc().body,cs=doc().defaultView.getComputedStyle(target);const rgb=(isText(el)?cs.color:cs.backgroundColor).match(/\d+/g);const color=rgb?'#'+rgb.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#ffffff';$('#colorInput').value=color;$('#colorHex').value=color.toUpperCase();$('#colorLabel').textContent=isText(el)?'글자색':'배경색';
 updateBox();document.dispatchEvent(new CustomEvent('object-selected',{detail:el}));
}
function updateBox(){const box=$('#selectionBox');if(!selected||!selected.isConnected){box.hidden=true;return;}const r=getRect(selected);box.hidden=false;Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});$('#objectBadge').textContent=nodeName(selected);}
function renderLayers(){
 const layer=$('#layers');layer.replaceChildren();if(!doc()?.body)return;
 for(const el of doc().body.querySelectorAll('[data-sr-id]')){
  if(!getRect(el).width||!getRect(el).height)continue;
  const button=document.createElement('button');button.textContent=nodeName(el)+' · '+(el.getAttribute('alt')||el.textContent.trim()).slice(0,20);button.title='이 요소 선택';
  let depth=0,p=el.parentElement;while(p&&p!==doc().body){depth++;p=p.parentElement;}button.style.paddingLeft=8+Math.min(depth,4)*10+'px';button.onclick=()=>{finishEdit();select(el);};layer.append(button);
 }
}
function targetAt(e){const raw=e.target;if(!raw.closest)return null;return raw.closest('svg,video,iframe,canvas,table')||raw.closest('[data-sr-id]');}
function bindDocument(){
 const d=doc();d.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});d.addEventListener('submit',e=>e.preventDefault());
 d.addEventListener('pointerdown',e=>{
  if(editing?.contains(e.target))return;
  finishEdit();const el=targetAt(e);select(el);if(!el)return;
  if(e.button!==0)return;
  e.preventDefault();el.setPointerCapture?.(e.pointerId);
  startMove(e,el,false);
 });
 d.addEventListener('dblclick',e=>{e.preventDefault();const el=e.target.closest('td,th')||targetAt(e);if(isText(el))beginEdit(el);else if(el?.tagName==='IMG'){$('#imageFile').dataset.replace='true';$('#imageFile').click();}});
 d.addEventListener('keydown',keyboard);
 d.addEventListener('paste',e=>{if(!editing)return;e.preventDefault();d.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
 new ResizeObserver(updateBox).observe(d.body);
}
function beginEdit(el){finishEdit();select(el);editing=el;el.contentEditable='true';el.focus();$('#selectionBox').hidden=true;el.addEventListener('blur',()=>{if(editing===el)finishEdit();},{once:true});}
function finishEdit(){if(!editing)return;editing.removeAttribute('contenteditable');editing=null;commit();updateBox();}
function translate(el,dx,dy){const values=(el.style.translate||'0px 0px').split(' ');el.style.translate=`${(parseFloat(values[0])||0)+dx}px ${(parseFloat(values[1])||0)+dy}px`;}
function startMove(e,el,resize){
 const start={x:e.clientX,y:e.clientY},r=getRect(el),style=el.style.cssText;
 const inside=e.view===doc().defaultView;let moved=false;
 const surface=inside?doc():document;
 const move=ev=>{
  const dx=(ev.clientX-start.x)/(inside?1:scale),dy=(ev.clientY-start.y)/(inside?1:scale);
  if(Math.abs(dx)+Math.abs(dy)<3&&!moved)return;
  moved=true;ev.preventDefault();el.style.cssText=style;
  if(resize){el.style.setProperty('box-sizing','border-box');el.style.setProperty('width',Math.max(20,r.width+dx)+'px','important');el.style.setProperty('height',Math.max(20,r.height+dy)+'px','important');}
  else translate(el,dx,dy);
  select(el);
 };
 const end=()=>{surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',end);if(moved)commit();};
 surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',end,{once:true});
}
$('#resizeHandle').onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);if(selected)startMove(e,selected,true);};
function changeStyle(property,value){if(!selected)return;selected.style.setProperty(property,value,'important');commit();select(selected);}
function add(kind){
 finishEdit();const d=doc(),el=d.createElement(kind==='text'?'p':'div');el.dataset.srId=uid();el.dataset.kind=kind;el.style.cssText='position:absolute;left:120px;top:120px;width:320px;height:160px;box-sizing:border-box;';
 if(kind==='text'){el.textContent='텍스트를 입력하세요';el.style.cssText+='font-size:36px;line-height:1.4;color:#253f38;margin:0;height:110px;white-space:pre-wrap;overflow-wrap:anywhere;';}
 else {el.style.background='#8da994';if(kind==='circle')el.style.borderRadius='50%';if(kind==='rounded')el.style.borderRadius='28px';if(kind==='line'){el.style.height='5px';}if(kind==='arrow'){el.style.clipPath='polygon(0 35%,65% 35%,65% 0,100% 50%,65% 100%,65% 65%,0 65%)';el.style.height='90px';}}
 (d.querySelector('[data-sr-page]')||d.body).append(el);select(el);commit();
}
function duplicate(){if(!selected)return;finishEdit();const copy=selected.cloneNode(true);[copy,...copy.querySelectorAll('[data-sr-id]')].forEach(el=>el.dataset.srId=uid());translate(copy,24,24);selected.after(copy);select(copy);commit();}
function remove(){if(!selected)return;selected.remove();select(null);commit();}
function undo(redo=false){finishEdit();project=redo?history.redo():history.undo();index=Math.min(index,project.slides.length-1);render();saveLocal();}
function keyboard(e){
 const input=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
 if(e.key==='Escape'){finishEdit();select(null);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();return;}
 if(input)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
 else if(selected&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const n=e.shiftKey?10:1;translate(selected,e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0,e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0);commit();select(selected);}
}
document.addEventListener('keydown',keyboard);
$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));$('#shapeSelect').onchange=e=>{if(e.target.value)add(e.target.value);e.target.value='';};
$('#duplicateBtn').onclick=duplicate;$('#deleteBtn').onclick=remove;$('#undoBtn').onclick=()=>undo();$('#redoBtn').onclick=()=>undo(true);
for(const [id,axis]of [['propX','x'],['propY','y']])$('#'+id).onchange=e=>{if(!selected)return;const n=Number(e.target.value);if(!Number.isFinite(n))return;const r=getRect(selected);translate(selected,axis==='x'?n-r.x:0,axis==='y'?n-r.y:0);commit();select(selected);};
for(const [id,prop]of [['propW','width'],['propH','height']])$('#'+id).onchange=e=>{if(!selected)return;selected.style.boxSizing='border-box';changeStyle(prop,Math.max(20,Number(e.target.value)||20)+'px');};
$('#fontSize').onchange=e=>changeStyle('font-size',Math.max(8,Math.min(200,+e.target.value))+'px');$('#fontFamily').onchange=e=>changeStyle('font-family',e.target.value);$('#boldBtn').onclick=()=>changeStyle('font-weight',Number(doc().defaultView.getComputedStyle(selected).fontWeight)>=600?'400':'700');
$('#alignBtn').onclick=()=>{if(selected){const a=doc().defaultView.getComputedStyle(selected).textAlign;changeStyle('text-align',a==='center'?'right':a==='right'?'left':'center');}};
function color(value){const target=selected||doc().querySelector('[data-sr-page]')||doc().body;target.style.setProperty(isText(selected)?'color':'background-color',value,'important');commit();select(selected);}
$('#colorInput').onchange=e=>color(e.target.value);
['#253f38','#8da994','#eab285','#5865e8','#f8f6f0','#ffffff','#252932'].forEach(c=>{const b=document.createElement('button');b.style.background=c;b.title=c;b.onclick=()=>color(c);$('#swatches').append(b);});
$('#borderWidth').onchange=e=>{if(selected){selected.style.borderStyle='solid';changeStyle('border-width',Math.max(0,+e.target.value)+'px');}};$('#borderColor').onchange=e=>changeStyle('border-color',e.target.value);
for(const [id,direction] of [['frontBtn',1],['backBtn',-1]])$('#'+id).onclick=()=>{if(!selected)return;if(doc().defaultView.getComputedStyle(selected).position==='static')selected.style.position='relative';const all=[...doc().body.querySelectorAll('[data-sr-id]')].map(el=>parseInt(doc().defaultView.getComputedStyle(el).zIndex)||0);changeStyle('z-index',String(direction>0?Math.max(...all)+1:Math.min(...all)-1));};
$('#parentBtn').onclick=()=>select(selected?.parentElement?.closest('[data-sr-id]')||null);
$('#addSlide').onclick=()=>{finishEdit();project.slides.splice(index+1,0,blankSlide());index++;commit({capture:false});render();};
$('#removeSlide').onclick=()=>{if(project.slides.length===1){toast('마지막 슬라이드는 삭제할 수 없습니다.');return;}project.slides.splice(index,1);index=Math.min(index,project.slides.length-1);commit({capture:false});render();};
$('#duplicateSlide').onclick=()=>{finishEdit();const s=clone(current());s.id=uid();s.name+=' 복사';project.slides.splice(++index,0,s);commit({capture:false});render();};
for(const [id,d]of [['slideUp',-1],['slideDown',1]])$('#'+id).onclick=()=>{finishEdit();const other=index+d;if(other<0||other>=project.slides.length)return;[project.slides[index],project.slides[other]]=[project.slides[other],project.slides[index]];index=other;commit({capture:false});render();};
$('#projectName').onchange=e=>{project.title=e.target.value.trim()||'새 강의';commit();};
$('#zoomIn').onclick=()=>{zoom=Math.min(3,zoom+.15);fit();};$('#zoomOut').onclick=()=>{zoom=Math.max(.3,zoom-.15);fit();};$('#fitBtn').onclick=()=>{zoom=1;fit();};new ResizeObserver(fit).observe($('#stageArea'));
$('#openBtn').onclick=()=>$('#projectFile').click();
$('#projectFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;finishEdit();originalInput=await file.text();const next=importHTML(originalInput,file.name);project=next;history=new History(project);index=0;await render();saveLocal();toast(`${project.slides.length}개 슬라이드를 불러왔습니다.`);$('#importNotice').hidden=false;$('#importNotice').innerHTML='<span>원본 HTML을 유지하며 편집합니다. 페이지 구분이 다르면 선택자를 지정하세요.</span> <button id="pageSelectorBtn">페이지 구분</button>';$('#pageSelectorBtn').onclick=()=>{const selector=prompt('페이지 요소의 CSS 선택자 (예: .slide 또는 section)');if(selector){try{project=importHTML(originalInput,file.name,selector);history=new History(project);index=0;render();saveLocal();}catch(err){toast(err.message);}}};}catch(err){toast('불러오기 실패: '+err.message);}finally{e.target.value='';}};
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function saveProject(){finishEdit();takeSnapshot();download(JSON.stringify(project,null,2),project.title+'.slide.json','application/json');saveLocal();toast('편집용 프로젝트를 저장했습니다.');}
$('#saveBtn').onclick=saveProject;
$('#exportBtn').onclick=()=>{finishEdit();takeSnapshot();download(exportHTML(project),project.title+'.html','text/html');toast('HTML을 내려받았습니다. 다시 열어 편집할 수 있습니다.');};
$('#previewBtn').onclick=()=>{finishEdit();takeSnapshot();$('#previewFrame').srcdoc=exportHTML(project);$('#preview').showModal();};$('#closePreview').onclick=()=>{$('#preview').close();$('#previewFrame').srcdoc='';};
// Project saves use IndexedDB so uploaded images do not hit localStorage's small quota.
let dbPromise;
function database(){return dbPromise||=new Promise((resolve,reject)=>{const r=indexedDB.open('slide-room',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
let saveSequence=0;
async function saveLocal(){const sequence=++saveSequence;$('#saveState').textContent='저장 중…';try{const snapshot=clone(project),db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});if(sequence===saveSequence){$('#saveState').textContent='자동 저장됨';dirty=false;}}catch(err){$('#saveState').textContent='저장 실패 · 파일로 저장하세요';toast('자동 저장 실패: 저장 버튼으로 프로젝트를 내려받으세요.');}}
async function restore(){try{const db=await database(),p=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(p?.version===1&&p.slides?.length){project=p;history=new History(p);}}catch{toast('자동 저장소를 열 수 없습니다. 파일 저장을 이용하세요.');}await render();}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
await restore();
// Feature modules share the selection and commit boundary, not duplicate editor state.
export const editor={get document(){return doc();},get selected(){return selected;},get project(){return project;},get index(){return index;},select,commit,toast,finishEdit,beginEdit,render,download,add};
(await import('./src/media.js')).setup(editor);
(await import('./src/tables.js')).setup(editor);
(await import('./src/assets.js')).setup(editor);
