import {History,clone} from './src/core.js';
import {uid,parse,serialize,markElements,importHTML,editorHTML,blankSlide,initialProject,exportHTML} from './src/document.js';
import {importRuntimeHTML,captureRuntimeEdits,captureRuntimeGeometry} from './src/runtime-import.js';
import {setup as setupMedia} from './src/media.js';
import {setup as setupTables} from './src/tables.js';
import {setup as setupAssets} from './src/assets.js';
import {setup as setupAudit} from './src/audit.js';
import {objectGeometry} from './src/rotation.js';
import {setupWorkspace} from './src/workspace.js';
import {isLocked,groupMembers,bounds,snapMove,clearGuides,reorderLayers} from './src/arrange.js';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let project=initialProject(),history=new History(project),index=0,selected=null,scale=1,zoom=1,editing=null,loadVersion=0;
let originalInput='',dirty=false,runtimeObjects=[],runtimeInteractive=false;
let editingBefore='';
let selectedItems=[],slideClipboard=null,slideFocus=false;
$('#previewBtn').insertAdjacentHTML('beforebegin','<button id="runtimeModeBtn" hidden title="애니메이션 내부는 수정하지 않고 버튼과 재생을 조작합니다">애니메이션 실행</button>');
$('#runtimeModeBtn').onclick=()=>{finishEdit();runtimeInteractive=!runtimeInteractive;$('#stage').classList.toggle('runtime-interactive',runtimeInteractive);$('#runtimeModeBtn').textContent=runtimeInteractive?'편집으로 돌아가기':'애니메이션 실행';updateBox();};
$('#stage').innerHTML='<iframe id="canvas" title="슬라이드 편집 화면" sandbox="allow-same-origin"></iframe><div id="selectionBox" hidden><button id="resizeHandle" aria-label="크기 조절"></button><button id="objectBadge" aria-label="선택한 오브젝트 이동" title="드래그하여 오브젝트 이동"></button></div>';
$('.canvas-help').innerHTML='<span id="interactionHint" role="status">손바닥 커서로 드래그 · 더블클릭으로 글자 편집</span><button id="editTextBtn" disabled>글자 편집</button><button id="finishTextBtn" hidden>편집 완료 · Esc</button>';
const canvas=$('#canvas');
for(const direction of ['n','ne','e','s','sw','w','nw']){const handle=document.createElement('button');handle.className='resize-handle handle-'+direction;handle.dataset.direction=direction;handle.setAttribute('aria-label',direction+' 크기 조절');handle.title=direction.length===2?'대각선 크기 조절':(direction==='e'||direction==='w'?'가로 크기 조절':'세로 크기 조절');$('#selectionBox').append(handle);handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);if(selected)startMove(e,selected,direction);};}
$('#openBtn').insertAdjacentHTML('afterend','<button id="saveBtn">저장</button>');
$('#openBtn').insertAdjacentHTML('beforebegin','<button id="newBtn">새 작업</button>');
$('#addSlide').insertAdjacentHTML('afterend','<div class="slide-actions"><button id="duplicateSlide" title="슬라이드 복제">복제</button><button id="slideUp" title="슬라이드 위로">↑</button><button id="slideDown" title="슬라이드 아래로">↓</button></div>');
$('#elementProps').insertAdjacentHTML('beforeend','<section><h3>테두리</h3><div class="text-tools"><input type="number" id="borderWidth" min="0" max="30" aria-label="테두리 두께"><input type="color" id="borderColor" aria-label="테두리 색상" value="#253f38"></div></section><button id="parentBtn">상위 묶음 선택 ↑</button>');
$('#removeSlide').insertAdjacentHTML('beforebegin','<section><h3>오브젝트 <span class="muted">내부 요소도 선택 가능</span></h3><div id="layers"></div></section>');
$('#removeSlide').insertAdjacentHTML('beforebegin','<button id="opaqueBtn" title="복잡한 HTML을 원형 그대로 하나의 오브젝트로 다룹니다. 실행 취소로 되돌릴 수 있습니다.">페이지 통째로 묶기</button>');
$('.toolbar>span')?.remove();
$('#stageArea').insertAdjacentHTML('beforebegin','<div id="importNotice" hidden></div>');
function toast(msg){$('#toast').textContent=msg;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,4000);}
const current=()=>project.slides[index];
const runtimeLimited=()=>!!project.runtime&&Number.isInteger(current()?.runtimePage);
const doc=()=>canvas.contentDocument;
function nodeName(el){if(el?.dataset.srRole)return ({chapter:"대제목(장 제목)",section:"중제목(절 제목)",body:"본문"}[el.dataset.srRole]||el.dataset.srRole);return ({text:'텍스트',image:'이미지',video:'영상',rect:'사각형',rounded:'둥근 사각형',circle:'원',line:'선',arrow:'화살표',table:'표',group:'묶음'}[el?.dataset.kind])||({svg:'SVG · 묶음',IMG:'이미지',VIDEO:'영상',CANVAS:'동적 그림',IFRAME:'외부 콘텐츠',TABLE:'표',TD:'표 셀',TH:'표 셀',DIV:'묶음',SECTION:'묶음',H1:'제목',H2:'제목',H3:'제목',P:'본문',SPAN:'글자'}[el?.tagName])||el?.tagName?.toLowerCase()||'슬라이드 배경';}
function isShapeText(el){return ['rect','rounded','circle'].includes(el?.dataset.kind);}
function isText(el){if(!runtimeLimited()&&isShapeText(el))return true;if(runtimeLimited())return !!el?.hasAttribute('data-sr-source');return el && !el.closest('svg')&&!['IMG','VIDEO','IFRAME','CANVAS','TABLE'].includes(el.tagName)&&(!el.children.length||/^(H[1-6]|P|SPAN|LI|TD|TH|BLOCKQUOTE)$/.test(el.tagName))&&!['rect','rounded','circle','line','arrow'].includes(el.dataset.kind);}
function takeSnapshot(){
 if(!doc()?.body)return;
 captureRuntimeEdits(project,doc(),current());
 const d=parse(serialize(doc()));
 d.querySelectorAll('[data-editor-only],meta[http-equiv="Content-Security-Policy"]').forEach(e=>e.remove());
 d.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
 d.querySelectorAll('[data-cell-selected]').forEach(e=>e.removeAttribute('data-cell-selected'));
 const old=parse(current().html);
 for(const tag of ['html','body'])for(const attr of old.querySelector(tag).attributes)if(/^on/i.test(attr.name))d.querySelector(tag).setAttribute(attr.name,attr.value);
 old.querySelectorAll('script').forEach(s=>d.body.append(d.importNode(s,true)));
 const priorElements=new Map([...old.querySelectorAll('[data-sr-id]')].map(el=>[el.dataset.srId,el]));
 for(const el of d.querySelectorAll('[data-sr-id]')){
  const prior=priorElements.get(el.dataset.srId);
  if(prior){for(const a of prior.attributes)if(/^on/i.test(a.name))el.setAttribute(a.name,a.value);
   if(['OBJECT','EMBED'].includes(prior.tagName)){const restored=d.importNode(prior,true);restored.style.cssText=el.style.cssText;el.replaceWith(restored);}
   if(el.tagName==='IFRAME'){if(prior.hasAttribute('sandbox'))el.setAttribute('sandbox',prior.getAttribute('sandbox'));else el.removeAttribute('sandbox');}
  }
 }
 current().html=serialize(d);
}
function commit({capture=true}={}){if(capture)takeSnapshot();history.push(project);dirty=true;updateHistory();renderSlides();renderLayers();syncRuntime();saveLocal();}
function updateHistory(){$('#undoBtn').disabled=!history.canUndo;$('#redoBtn').disabled=!history.canRedo;}
async function render(){
 $('#stage').classList.add('stage-loading');
 runtimeInteractive=false;$('#stage').classList.remove('runtime-interactive');$('#runtimeModeBtn').textContent='애니메이션 실행';
 const version=++loadVersion;selected=null;selectedItems=[];editing=null;$('#selectionBox').hidden=true;$('#projectName').value=project.title;renderSlides();updateHistory();
 await new Promise(resolve=>{
  // A stylesheet/image can hold iframe load open indefinitely after its DOM is ready.
  // The token prevents an old document (or an earlier rapid click) satisfying this wait.
  let timer;const done=()=>{clearInterval(timer);if(canvas.onload===done)canvas.onload=null;resolve();};
  canvas.onload=done;canvas.srcdoc=editorHTML(current().html,String(version));
  timer=setInterval(()=>{
   if(version!==loadVersion)return done();
   const d=canvas.contentDocument;
   if(d?.querySelector('meta[name="slide-room-load"]')?.content===String(version)&&d.readyState!=='loading')done();
  },25);
 });
 if(version!==loadVersion)return;
 const pageRoot=doc().querySelector('[data-sr-fit-page]')||doc().querySelector('[data-sr-page]');
 if(pageRoot&&doc().defaultView.getComputedStyle(pageRoot).display==='none')pageRoot.style.setProperty('display','block','important');
 if(pageRoot&&!pageRoot.hasAttribute('data-sr-fitted')){
  const r=getRect(pageRoot),ratio=r.width/r.height;
  if(r.width>0&&r.height>0&&(pageRoot.hasAttribute('data-sr-fit-page')||Math.abs(ratio-16/9)<.12)){const factor=Math.min(1280/r.width,720/r.height);if(Math.abs(factor-1)>.01){if(pageRoot.hasAttribute('data-sr-fit-page')){pageRoot.style.transform='scale('+factor+')';pageRoot.style.transformOrigin='top left';}else doc().documentElement.style.zoom=String(factor);pageRoot.dataset.srFitted='';takeSnapshot();renderSlides();}}
 }
 bindDocument();fit();select(null);renderLayers();syncRuntime();updateRuntimePermissions();$('#stage').classList.remove('stage-loading');
 document.dispatchEvent(new Event('slide-ready'));
}
const slidePreviews=new Map();
function renderSlides(){
 const list=$('#slides'),ids=new Set(project.slides.map(s=>s.id));
 for(const [id,entry]of slidePreviews)if(!ids.has(id)){entry.item.remove();slidePreviews.delete(id);}
 project.slides.forEach((s,i)=>{
  let entry=slidePreviews.get(s.id);
  if(!entry){
   const item=document.createElement('button'),num=document.createElement('span'),frame=document.createElement('div'),preview=document.createElement('iframe');
   num.className='slide-number';frame.className='thumb-frame';preview.className='thumb';preview.tabIndex=-1;preview.loading='lazy';preview.setAttribute('sandbox','');
   frame.append(preview);item.append(num,frame);entry={item,num,preview,html:null};slidePreviews.set(s.id,entry);
  }
  const {item,num,preview}=entry;
  item.className='slide-item'+(i===index?' active':'');item.title=s.name;item.setAttribute('aria-label',`슬라이드 ${i+1}: ${s.name}`);num.textContent=String(i+1).padStart(2,'0');preview.title=s.name;
  if(entry.html!==s.html){preview.srcdoc=editorHTML(s.html);entry.html=s.html;}
  item.onclick=()=>{finishEdit();slideFocus=true;index=i;render();};
  // Moving a connected iframe reloads it; leave unchanged positions untouched.
  if(list.children[i]!==item)list.insertBefore(item,list.children[i]||null);
 });
 $('#slideCount').textContent=String(project.slides.length).padStart(2,'0');$('#slideLabel').textContent=`SLIDE ${String(index+1).padStart(2,'0')}`;
 $('#slideUp').disabled=index===0;$('#slideDown').disabled=index===project.slides.length-1;
 $('#removeSlide').disabled=project.slides.length===1;
}
function fit(){const area=$('#stageArea');scale=Math.min((area.clientWidth-70)/1280,(area.clientHeight-50)/720)*zoom;scale=Math.max(.15,scale);$('#stage').style.transform=`scale(${scale})`;$('#stageWrap').style.width=1280*scale+'px';$('#stageWrap').style.height=720*scale+'px';$('#zoomLabel').textContent=Math.round(scale*100)+'%';updateBox();}
function getRect(el){return el.getBoundingClientRect();}
function select(el){
 if(runtimeLimited()&&el&&!el.matches('[data-sr-source],[data-sr-geometry]'))el=null;
 if(el===doc()?.body||el===doc()?.documentElement)el=null;
 selectedItems=el?[el]:[];selected=el;$('#selectionName').textContent=nodeName(el);$('#elementProps').hidden=!el;$('#textProps').hidden=!isText(el);
 $('#duplicateBtn').disabled=!el;$('#deleteBtn').disabled=!el;$('#editTextBtn').disabled=!isText(el);
 if(el){const r=getRect(el),s=doc().defaultView.getComputedStyle(el);for(const [id,v]of Object.entries({propX:r.x,propY:r.y,propW:r.width,propH:r.height,fontSize:parseFloat(s.fontSize),borderWidth:parseFloat(s.borderWidth)||0}))$('#'+id).value=Math.round(v);
  const polygon=el.dataset.kind==='arrow'&&el.querySelector('polygon'),stroke=polygon?doc().defaultView.getComputedStyle(polygon):null,border=(stroke?.stroke||s.borderTopColor).match(/\d+/g);if(border?.length>=3)$('#borderColor').value='#'+border.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');if(stroke)$('#borderWidth').value=parseFloat(stroke.strokeWidth)||0;
  $('#boldBtn').classList.toggle('active',Number(s.fontWeight)>=600);$('#fontFamily').value=['serif','monospace'].find(x=>s.fontFamily===x)||'sans-serif';
  $('#boldBtn').setAttribute('aria-pressed',String(Number(s.fontWeight)>=600));$('#alignBtn').textContent=({center:'가운데',right:'오른쪽',end:'오른쪽',justify:'양쪽'}[s.textAlign]||'왼쪽')+' 정렬';
 }
 const target=el||doc().querySelector('[data-sr-page]')||doc().body,cs=doc().defaultView.getComputedStyle(target),raw=el?.dataset.kind==='arrow'&&el.querySelector('polygon')?doc().defaultView.getComputedStyle(el.querySelector('polygon')).fill:isText(el)&&!isShapeText(el)?cs.color:cs.backgroundColor;const rgb=raw.match(/[\d.]+/g),transparent=rgb?.length===4&&Number(rgb[3])===0;const color=rgb&&!transparent?'#'+rgb.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join(''):'#ffffff';$('#colorInput').value=color;$('#colorHex').value=transparent?'투명':color.toUpperCase();$('#colorLabel').textContent=isText(el)&&!isShapeText(el)?'글자색':'배경색';
 updateBox();updateRuntimePermissions();document.dispatchEvent(new CustomEvent('object-selected',{detail:el}));
}
function updateRuntimePermissions(){
 const limited=runtimeLimited(),shape=!!selected?.hasAttribute('data-sr-geometry');
 document.body.classList.toggle('runtime-source-mode',limited);
 for(const el of $$('[data-add],#imageBtn,#tableBtn,#assetsBtn,#duplicateBtn,#deleteBtn,#opaqueBtn,#parentBtn,#fontFamily,#fontSize,#boldBtn,#alignBtn,#colorInput,#borderWidth,#borderColor,#backBtn,#frontBtn,#swatches button,#tableProps button,#tableProps input')){
  if(limited){if(!el.hasAttribute('data-runtime-disabled'))el.dataset.runtimeDisabled=String(el.disabled);el.disabled=true;}
  else if(el.hasAttribute('data-runtime-disabled')){el.disabled=el.dataset.runtimeDisabled==='true';delete el.dataset.runtimeDisabled;}
 }
 for(const el of $$('#propX,#propY,#propW,#propH'))el.disabled=limited&&!shape;
 $('#objectBadge').hidden=limited&&!shape;$('#resizeHandle').hidden=limited&&!shape;
 if(limited)$('#interactionHint').textContent=editing?'글자 수정 중 · Esc로 완료':'글자 내용 수정 · 도형 이동과 크기 조절만 가능 · 원본 애니메이션 유지';
}
function selectionRect(){return bounds(selectedItems.filter(el=>el.isConnected));}
function selectMany(items){items=[...new Set(items)].filter(el=>el.isConnected&&!isLocked(el)&&!items.some(parent=>parent!==el&&parent.contains(el)));select(items[0]||null);selectedItems=items;if(items.length>1){$('#selectionName').textContent=items.length+'개 선택';$('#elementProps').hidden=true;$('#editTextBtn').disabled=true;$('#resizeHandle').hidden=true;}updateBox();document.dispatchEvent(new Event('selection-changed'));}
function updateBox(){$('#stage').style.setProperty('--ui-scale',String(1/scale));updateRuntimePositions();const box=$('#selectionBox');if(runtimeInteractive||editing||!selected||!selected.isConnected||isLocked(selected)){box.hidden=true;return;}const r=selectedItems.length===1?objectGeometry(selected):selectionRect();box.hidden=false;box.classList.toggle('multiple',selectedItems.length>1);box.classList.toggle('no-resize',runtimeLimited()&&!selected.hasAttribute('data-sr-geometry'));Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',transformOrigin:'0 0',transform:r.a===undefined?'none':`matrix(${r.a},${r.b},${r.c},${r.d},0,0)`});for(const handle of box.querySelectorAll('.resize-handle,#resizeHandle')){const dir=handle.dataset.direction||'se',x=dir.includes('e')?1:dir.includes('w')?-1:0,y=dir.includes('s')?1:dir.includes('n')?-1:0,a=r.a??1,b=r.b??0,c=r.c??0,d=r.d??1;const sector=(Math.round(Math.atan2(b*x+d*y,a*x+c*y)/(Math.PI/4))+8)%4;handle.style.cursor=['ew-resize','nwse-resize','ns-resize','nesw-resize'][sector];}$('#objectBadge').textContent=(selectedItems.length>1?selectedItems.length+'개':nodeName(selected))+' · 이동';const nearTop=r.y*scale<40;$('#objectBadge').style.top=nearTop?(r.height+10)+'px':'';$('#objectBadge').style.transformOrigin=nearTop?'left top':'left bottom';}
function runtimeBounds(el){const bounds=getRect(el),rotation=el.ownerDocument.defaultView.getComputedStyle(el).rotate,style=el.style.cssText;el.style.setProperty('rotate','none','important');const local=getRect(el);el.style.cssText=style;return {x:bounds.x+(bounds.width-local.width)/2,y:bounds.y+(bounds.height-local.height)/2,width:local.width,height:local.height,rotation,local};}
function updateRuntimePositions(){for(const {el,wrapper,frame,rect}of runtimeObjects){if(!el.isConnected)continue;const r=runtimeBounds(el);Object.assign(wrapper.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',rotate:r.rotation});frame.style.transform=`scale(${r.width/rect.width},${r.height/rect.height})`;}}
function syncRuntime(){
 runtimeObjects.forEach(x=>x.wrapper.remove());runtimeObjects=[];if(!doc()?.body)return;
 if(runtimeLimited()){$('#runtimeModeBtn').hidden=true;return;}
 const original=parse(current().html);
 for(const source of original.body.querySelectorAll('canvas,iframe,object,embed,[data-sr-opaque]')){
  if(source.parentElement.closest('canvas,iframe,object,embed,[data-sr-opaque]'))continue;
  const el=doc().querySelector(`[data-sr-id="${source.dataset.srId}"]`);if(!el)continue;const r=runtimeBounds(el).local;if(!r.width||!r.height)continue;
  const wrapper=document.createElement('div');wrapper.className='runtime-object';const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.title='동적 오브젝트 미리보기';
  wrapper.onpointerdown=e=>{if(runtimeInteractive||e.button!==0)return;finishEdit();select(el);e.preventDefault();wrapper.setPointerCapture(e.pointerId);startMove(e,el,false);};
  let rect=r;
  if(source.tagName==='IFRAME'&&source.hasAttribute('srcdoc')){
   // Render an embedded app directly: a second copy of the whole slide causes
   // duplicate layout, font timing drift, and incorrect nested pointer coordinates.
   rect={width:el.clientWidth||r.width,height:el.clientHeight||r.height};frame.srcdoc=source.getAttribute('srcdoc');
   frame.style.cssText=`position:absolute;left:0;top:0;width:${rect.width}px;height:${rect.height}px;border:0;transform-origin:top left;`;
  }else{const saved=source.style.cssText;source.style.setProperty('rotate','none','important');frame.srcdoc='<!doctype html>'+original.documentElement.outerHTML;source.style.cssText=saved;frame.style.cssText=`position:absolute;left:${-r.x}px;top:${-r.y}px;width:1280px;height:720px;border:0;transform-origin:${r.x}px ${r.y}px;`;}
  wrapper.append(frame);$('#selectionBox').before(wrapper);runtimeObjects.push({el,wrapper,frame,rect});
 }$('#runtimeModeBtn').hidden=!runtimeObjects.length;updateRuntimePositions();
}
function renderLayers(){
 const layer=$('#layers');layer.replaceChildren();if(!doc()?.body)return;
 for(const el of doc().body.querySelectorAll('[data-sr-id]')){
  if(runtimeLimited()&&!el.matches('[data-sr-source],[data-sr-geometry]'))continue;
  if(!getRect(el).width||!getRect(el).height)continue;
  const button=document.createElement('button');button.dataset.objectId=el.dataset.srId;button.textContent=nodeName(el)+' · '+(el.getAttribute('alt')||el.textContent.trim()).slice(0,20);button.title='이 요소 선택 · 더블클릭으로 이름 변경';
  let depth=0,p=el.parentElement;while(p&&p!==doc().body){depth++;p=p.parentElement;}button.style.paddingLeft=8+Math.min(depth,4)*10+'px';button.onclick=()=>{finishEdit();select(el);};layer.append(button);
 }
 document.dispatchEvent(new Event('layers-rendered'));
}
function targetAt(e){const raw=e.target;if(!raw.closest)return null;if(runtimeLimited())return raw.closest('[data-sr-source],[data-sr-geometry]');return raw.closest('[data-kind=arrow]')||raw.closest('svg,video,iframe,canvas,table')||raw.closest('[data-sr-id]');}
function bindDocument(){
 const d=doc();d.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});d.addEventListener('submit',e=>e.preventDefault());
 d.addEventListener('pointerdown',e=>{
  if(editing?.contains(e.target))return;
  slideFocus=false;finishEdit();const el=targetAt(e);
  if(e.button!==0)return;
  if(!el||el.matches('[data-sr-page],body,html')){startMarquee(e);return;}
  if(isLocked(el)){select(null);return;}
  if(e.shiftKey&&el.tagName==='TABLE'&&e.target.closest('td,th')){e.preventDefault();select(el);return;}
  const members=groupMembers(el);
  if(e.shiftKey){e.preventDefault();selectMany(selectedItems.includes(el)?selectedItems.filter(x=>!members.includes(x)):[...selectedItems,...members]);return;}
  if(!selectedItems.includes(el))selectMany(members);
  if(e.button!==0)return;
  e.preventDefault();e.target.setPointerCapture?.(e.pointerId);
  startMove(e,el,false);
 });
 d.addEventListener('dblclick',e=>{if(editing?.contains(e.target))return;e.preventDefault();const el=runtimeLimited()?targetAt(e):e.target.closest('td,th')||targetAt(e);if(isText(el))beginEdit(el,{x:e.clientX,y:e.clientY});else if(el?.tagName==='IMG'){select(el);$('#imageFile').dataset.replace='true';$('#imageFile').click();}});
 d.addEventListener('keydown',keyboard);
 d.addEventListener('paste',e=>{if(!editing)return;e.preventDefault();d.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
 new ResizeObserver(updateBox).observe(d.body);
}
function startMarquee(e){
 e.preventDefault();$('#canvas').focus({preventScroll:true});select(null);e.target.setPointerCapture?.(e.pointerId);
 const d=doc(),start={x:e.clientX,y:e.clientY},box=d.createElement('div');box.dataset.editorOnly='';box.style.cssText='position:fixed;pointer-events:none;border:1px solid #5865e8;background:#5865e822;z-index:2147483647';d.body.append(box);
 let hits=[];
 const move=ev=>{const x=Math.min(start.x,ev.clientX),y=Math.min(start.y,ev.clientY),right=Math.max(start.x,ev.clientX),bottom=Math.max(start.y,ev.clientY);Object.assign(box.style,{left:x+'px',top:y+'px',width:right-x+'px',height:bottom-y+'px'});
  hits=[...d.querySelectorAll(runtimeLimited()?'[data-sr-source],[data-sr-geometry]':'[data-sr-id]')].filter(el=>{const r=getRect(el);return !el.matches('[data-sr-page]')&&r.width>0&&r.height>0&&r.x>=x&&r.y>=y&&r.right<=right&&r.bottom<=bottom;});};
 const end=ev=>{d.removeEventListener('pointermove',move);d.removeEventListener('pointerup',end);d.removeEventListener('pointercancel',end);box.remove();selectMany(ev.type==='pointercancel'?[]:hits);};
 d.addEventListener('pointermove',move);d.addEventListener('pointerup',end);d.addEventListener('pointercancel',end);
}
function beginEdit(el,point){
 if(isLocked(el))return;
 if(runtimeLimited()&&!isText(el))return;
 finishEdit();if(isShapeText(el)){el.dataset.srShapeText='true';Object.assign(el.style,{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'12px'});if(!el.style.fontSize)el.style.fontSize='28px';}select(el);editing=el;editingBefore=el.innerHTML;el.contentEditable='true';el.focus({preventScroll:true});$('#selectionBox').hidden=true;
 updateEditMode();
 if(point){
  const d=el.ownerDocument;let range;
  // Pointer coordinates belong to the iframe viewport, including at editor zoom.
  if(d.caretPositionFromPoint){const caret=d.caretPositionFromPoint(point.x,point.y);if(caret){range=d.createRange();range.setStart(caret.offsetNode,caret.offset);}}
  else range=d.caretRangeFromPoint?.(point.x,point.y);
  if(range&&el.contains(range.startContainer)){range.collapse(true);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);}
 }
 el.addEventListener('blur',()=>{if(editing===el)finishEdit();},{once:true});
}
function updateEditMode(){$('#finishTextBtn').hidden=!editing;$('#editTextBtn').hidden=!!editing;$('#interactionHint').textContent=editing?'글자 편집 중 · Esc 또는 편집 완료를 누르면 이동할 수 있습니다.':'손바닥 커서로 드래그 · 더블클릭으로 글자 편집';}
function finishEdit(){if(!editing)return;if(runtimeLimited()&&editing.innerHTML!==editingBefore){const text=editing.innerText;editing.textContent=text;editing.style.whiteSpace='pre-wrap';}if(editing.dataset.srShapeText==='true')editing.textContent=editing.innerText;editing.removeAttribute('contenteditable');editing=null;updateEditMode();commit();updateBox();}
$('#editTextBtn').onclick=()=>{if(isText(selected))beginEdit(selected);};
// Keep focus in the text until the explicit finish action runs.
$('#finishTextBtn').onpointerdown=e=>e.preventDefault();$('#finishTextBtn').onclick=finishEdit;
function translate(el,dx,dy){
 const cs=el.ownerDocument.defaultView.getComputedStyle(el),tokens=(cs.translate==='none'?'0px 0px':cs.translate).match(/calc\([^)]*\)|[^\s]+/g),x=tokens[0]||'0px',y=tokens[1]||'0px',z=tokens[2]?' '+tokens[2]:'';
 const apply=(a,b)=>el.style.setProperty('translate',`calc(${x} + ${a}px) calc(${y} + ${b}px)${z}`,'important');
 // Measure the parent transform basis, so screen-coordinate movement also works
 // inside scaled/rotated groups and preserves pre-existing percentage translates.
 const origin=getRect(el);apply(64,0);const px=getRect(el);apply(0,64);const py=getRect(el);
 const ax=(px.x-origin.x)/64,ay=(px.y-origin.y)/64,bx=(py.x-origin.x)/64,by=(py.y-origin.y)/64,det=ax*by-ay*bx;
 if(Math.abs(det)>.00001)apply((dx*by-dy*bx)/det,(dy*ax-dx*ay)/det);else apply(dx,dy);
}
function resizeTo(el,width,height){
 const cs=el.ownerDocument.defaultView.getComputedStyle(el),border=cs.boxSizing==='border-box';
 const w=(parseFloat(cs.width)||el.offsetWidth||getRect(el).width)+(border?0:(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0)+(parseFloat(cs.borderLeftWidth)||0)+(parseFloat(cs.borderRightWidth)||0));
 const h=(parseFloat(cs.height)||el.offsetHeight||getRect(el).height)+(border?0:(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)+(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0));
 const apply=(a,b)=>{el.style.boxSizing='border-box';el.style.setProperty('width',Math.max(1,a)+'px','important');el.style.setProperty('height',Math.max(1,b)+'px','important');};
 apply(w,h);const r=getRect(el);apply(w+64,h);const rw=getRect(el);apply(w,h+64);const rh=getRect(el);
 const ax=(rw.width-r.width)/64,ay=(rw.height-r.height)/64,bx=(rh.width-r.width)/64,by=(rh.height-r.height)/64,det=ax*by-ay*bx,dx=width-r.width,dy=height-r.height;
 if(Math.abs(det)>.00001)apply(w+(dx*by-dy*bx)/det,h+(dy*ax-dx*ay)/det);else apply(w*width/Math.max(1,r.width),h*height/Math.max(1,r.height));
}
function startMove(e,el,resize){
 if(isLocked(el))return;
 if(!resize&&selectedItems.length>1){startGroupMove(e);return;}
 if(runtimeLimited()&&!el.hasAttribute('data-sr-geometry'))return;
 const start={x:e.clientX,y:e.clientY},r=getRect(el),geometry=resize?objectGeometry(el):null,style=el.style.cssText;
 const inside=e.target.ownerDocument===doc();let moved=false;
 const surface=inside?doc():document;
 const move=ev=>{
  let dx=(ev.clientX-start.x)/(inside?1:scale),dy=(ev.clientY-start.y)/(inside?1:scale);
  if(Math.abs(dx)+Math.abs(dy)<3&&!moved)return;
  moved=true;ev.preventDefault();el.style.cssText=style;
  doc().documentElement.dataset.srDragging=resize?'resize':'move';document.body.classList.add(resize?'object-resizing':'object-dragging');
  if(resize){
   const dir=resize===true?'se':resize,g=geometry,det=g.a*g.d-g.b*g.c;
   const localX=(g.d*dx-g.c*dy)/det,localY=(-g.b*dx+g.a*dy)/det;
   let w=Math.max(20,g.width+(dir.includes('e')?localX:dir.includes('w')?-localX:0)),h=Math.max(20,g.height+(dir.includes('s')?localY:dir.includes('n')?-localY:0));
   if((el.tagName==='IMG'&&el.dataset.srKeepRatio!=='false'&&dir.length===2)||ev.shiftKey){const ratio=g.width/g.height;if(dir==='n'||dir==='s')w=h*ratio;else h=w/ratio;}
   el.style.setProperty('box-sizing','border-box','important');el.style.setProperty('width',w+'px','important');el.style.setProperty('height',h+'px','important');
   const x=dir.includes('w')?-(w-g.width)/2:dir.includes('e')?(w-g.width)/2:0,y=dir.includes('n')?-(h-g.height)/2:dir.includes('s')?(h-g.height)/2:0,now=getRect(el);
   translate(el,g.cx+g.a*x+g.c*y-(now.x+now.width/2),g.cy+g.b*x+g.d*y-(now.y+now.height/2));
  }
  else {({dx,dy}=snapMove(doc(),[el],r,dx,dy,$('#smartGuides')?.checked&&!ev.altKey&&!runtimeLimited()));translate(el,dx,dy);}
  select(el);
 };
 const end=ev=>{surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',end);surface.removeEventListener('pointercancel',end);clearGuides(doc());delete doc().documentElement.dataset.srDragging;document.body.classList.remove('object-dragging','object-resizing');if(ev.type==='pointercancel'){el.style.cssText=style;select(el);}else if(moved){captureRuntimeGeometry(project,current(),el);commit();}};
 surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',end,{once:true});surface.addEventListener('pointercancel',end,{once:true});
}
function startGroupMove(e){
 const items=selectedItems.filter(el=>!isLocked(el)&&(!runtimeLimited()||el.hasAttribute('data-sr-geometry')));if(!items.length)return;
 if(runtimeLimited()&&items.length!==selectedItems.length){toast('원본 글자는 이동할 수 없습니다. 도형만 함께 선택하세요.');return;}
 const styles=items.map(el=>el.style.cssText),inside=e.target.ownerDocument===doc(),surface=inside?doc():document,start={x:e.clientX,y:e.clientY};let moved=false;
 const r=bounds(items);
 const move=ev=>{let dx=(ev.clientX-start.x)/(inside?1:scale),dy=(ev.clientY-start.y)/(inside?1:scale);if(!moved&&Math.abs(dx)+Math.abs(dy)<3)return;moved=true;({dx,dy}=snapMove(doc(),items,r,dx,dy,$('#smartGuides')?.checked&&!ev.altKey&&!runtimeLimited()));items.forEach((el,i)=>{el.style.cssText=styles[i];translate(el,dx,dy);});doc().documentElement.dataset.srDragging='move';updateBox();};
 const end=ev=>{surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',end);surface.removeEventListener('pointercancel',end);clearGuides(doc());delete doc().documentElement.dataset.srDragging;if(ev.type==='pointercancel')items.forEach((el,i)=>el.style.cssText=styles[i]);else if(moved){items.forEach(el=>captureRuntimeGeometry(project,current(),el));commit();}updateBox();};
 surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',end);surface.addEventListener('pointercancel',end);
}
$('#resizeHandle').onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);if(selected)startMove(e,selected,true);};
$('#objectBadge').onpointerdown=e=>{if(e.button!==0||!selected)return;e.preventDefault();e.target.setPointerCapture(e.pointerId);startMove(e,selected,false);};
function changeStyle(property,value){if(runtimeLimited()||!selected||isLocked(selected))return;const polygon=selected.dataset.kind==='arrow'&&selected.querySelector('polygon');if(polygon&&['border-width','border-color'].includes(property)){selected.style.border='0';polygon.style.setProperty(property==='border-width'?'stroke-width':'stroke',value,'important');}else selected.style.setProperty(property,value,'important');commit();select(selected);}
function add(kind){
 if(runtimeLimited())return;
 finishEdit();const d=doc(),el=d.createElement(kind==='text'?'p':'div');el.dataset.srId=uid();el.dataset.kind=kind;el.style.cssText='position:absolute;left:120px;top:120px;width:320px;height:160px;box-sizing:border-box;';
 if(kind==='text'){el.textContent='텍스트를 입력하세요';el.style.cssText+='font-size:36px;line-height:1.4;color:#000000;margin:0;height:110px;white-space:pre-wrap;overflow-wrap:anywhere;';}
 else {el.style.background='#ffffff';el.style.border='1px solid #000000';el.style.color='#000000';el.style.fontSize='28px';if(kind==='circle')el.style.borderRadius='50%';if(kind==='rounded')el.style.borderRadius='28px';if(kind==='line'){el.style.height='1px';el.style.border='0';el.style.background='#000000';}if(kind==='arrow'){el.style.height='90px';el.style.border='0';el.style.background='transparent';el.innerHTML='<svg viewBox="0 0 320 90" preserveAspectRatio="none" style="width:100%;height:100%;display:block;pointer-events:none"><polygon points="1,32 207,32 207,1 319,45 207,89 207,58 1,58" fill="white" stroke="black" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';}}
 (d.querySelector('[data-sr-page]')||d.body).append(el);select(el);commit();
}
function duplicate(){if(runtimeLimited()||!selected)return;finishEdit();const groups=new Map(),copies=[];for(const source of selectedItems.filter(el=>!isLocked(el))){const copy=source.cloneNode(true);[copy,...copy.querySelectorAll('[data-sr-id]')].forEach(el=>{el.dataset.srId=uid();if(el.dataset.srGroup){if(!groups.has(el.dataset.srGroup))groups.set(el.dataset.srGroup,uid());el.dataset.srGroup=groups.get(el.dataset.srGroup);}});source.after(copy);translate(copy,24,24);copies.push(copy);}selectMany(copies);commit();}
function remove(){if(runtimeLimited()||!selected)return;selectedItems.filter(el=>!isLocked(el)).forEach(el=>el.remove());select(null);commit();}
function undo(redo=false){finishEdit();project=redo?history.redo():history.undo();index=Math.min(index,project.slides.length-1);render();saveLocal();}
function keyboard(e){
 if(document.querySelector('dialog[open]'))return;
 const input=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
 if(e.key==='Escape'){finishEdit();select(null);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();return;}
 if(input)return;
 if(slideFocus&&(e.ctrlKey||e.metaKey)&&['c','v'].includes(e.key.toLowerCase())){e.preventDefault();if(e.key.toLowerCase()==='c')copySlide();else pasteSlide();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='g'){e.preventDefault();$(e.shiftKey?'#ungroupBtn':'#groupBtn').click();}
 else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&['c','v'].includes(e.key.toLowerCase())){e.preventDefault();$(e.key.toLowerCase()==='c'?'#copyFormatBtn':'#pasteFormatBtn').click();}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
 else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
 else if(selected&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(runtimeLimited()&&selectedItems.some(el=>!el.hasAttribute('data-sr-geometry')))return;const n=e.shiftKey?10:1;for(const el of selectedItems.filter(el=>!isLocked(el))){translate(el,e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0,e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0);captureRuntimeGeometry(project,current(),el);}commit();selectMany(selectedItems);}
}
document.addEventListener('keydown',keyboard);
$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));
$('#duplicateBtn').onclick=duplicate;$('#deleteBtn').onclick=remove;$('#undoBtn').onclick=()=>undo();$('#redoBtn').onclick=()=>undo(true);
for(const [id,axis]of [['propX','x'],['propY','y']])$('#'+id).onchange=e=>{if(!selected||runtimeLimited()&&!selected.hasAttribute('data-sr-geometry'))return;const n=Number(e.target.value);if(!Number.isFinite(n))return;const r=getRect(selected);translate(selected,axis==='x'?n-r.x:0,axis==='y'?n-r.y:0);captureRuntimeGeometry(project,current(),selected);commit();select(selected);};
for(const [id,prop]of [['propW','width'],['propH','height']])$('#'+id).onchange=e=>{if(!selected||isLocked(selected)||runtimeLimited()&&!selected.hasAttribute('data-sr-geometry'))return;const r=getRect(selected),value=Math.max(20,Number(e.target.value)||20),ratio=selected.tagName==='IMG'&&selected.dataset.srKeepRatio!=='false';resizeTo(selected,prop==='width'?value:ratio?r.width*value/r.height:r.width,prop==='height'?value:ratio?r.height*value/r.width:r.height);captureRuntimeGeometry(project,current(),selected);commit();select(selected);};
$('#fontSize').onchange=e=>changeStyle('font-size',Math.max(8,Math.min(200,+e.target.value))+'px');$('#fontFamily').onchange=e=>changeStyle('font-family',e.target.value);$('#boldBtn').onclick=()=>changeStyle('font-weight',Number(doc().defaultView.getComputedStyle(selected).fontWeight)>=600?'400':'700');
$('#alignBtn').onclick=()=>{if(selected){const a=doc().defaultView.getComputedStyle(selected).textAlign;changeStyle('text-align',a==='center'?'right':a==='right'?'left':'center');}};
function color(value){if(runtimeLimited()||isLocked(selected))return;const targets=selectedItems.length?selectedItems:[doc().querySelector('[data-sr-page]')||doc().body];for(const target of targets.filter(el=>!isLocked(el))){const polygon=target.dataset.kind==='arrow'&&target.querySelector('polygon');if(polygon)polygon.style.setProperty('fill',value,'important');else target.style.setProperty(isText(target)&&!isShapeText(target)?'color':'background-color',value,'important');}commit();selectMany(selectedItems);}
$('#colorInput').onchange=e=>color(e.target.value);
['#253f38','#8da994','#eab285','#5865e8','#f8f6f0','#ffffff','#252932'].forEach(c=>{const b=document.createElement('button');b.style.background=c;b.title=c;b.onclick=()=>color(c);$('#swatches').append(b);});
$('#borderWidth').onchange=e=>{if(selected){selected.style.borderStyle='solid';changeStyle('border-width',Math.max(0,+e.target.value)+'px');}};$('#borderColor').onchange=e=>changeStyle('border-color',e.target.value);
for(const [id,direction] of [['frontBtn',1],['backBtn',-1]])$('#'+id).onclick=()=>{if(!selected||runtimeLimited())return;const items=selectedItems.filter(el=>!isLocked(el));if(!items.length)return;reorderLayers(items,direction);commit();selectMany(items);};
$('#parentBtn').onclick=()=>select(selected?.parentElement?.closest('[data-sr-id]')||null);
$('#addSlide').onclick=()=>{finishEdit();project.slides.splice(index+1,0,blankSlide());index++;commit({capture:false});render();};
$('#removeSlide').onclick=()=>{if(project.slides.length===1){toast('마지막 슬라이드는 삭제할 수 없습니다.');return;}project.slides.splice(index,1);index=Math.min(index,project.slides.length-1);commit({capture:false});render();};
function copySlide(){finishEdit();takeSnapshot();const s=clone(current());if(runtimeLimited()){s.runtimeEdits=clone(s.runtimeEdits??Object.fromEntries(Object.entries(project.runtime.edits).filter(([id])=>project.runtime.bindings[id].slideIndex===s.runtimePage)));s.runtimeGeometry=clone(s.runtimeGeometry??Object.fromEntries(Object.entries(project.runtime.geometry||{}).filter(([,g])=>g.page===s.runtimePage)));}slideClipboard={slide:s,source:Number.isInteger(s.runtimePage)?project.runtime.source:null};toast('슬라이드를 복사했습니다. 왼쪽 목록에서 Ctrl+V로 붙여넣으세요.');}
function pasteSlide(){if(!slideClipboard)return;if(slideClipboard.source&&slideClipboard.source!==project.runtime?.source){toast('원본 실행 슬라이드는 같은 프로젝트 안에 붙여넣을 수 있습니다.');return;}finishEdit();takeSnapshot();const s=clone(slideClipboard.slide);s.id=uid();s.name+=' 복사';project.slides.splice(++index,0,s);commit({capture:false});render();slideFocus=true;}
$('#duplicateSlide').onclick=()=>{copySlide();pasteSlide();};
document.addEventListener('pointerdown',e=>{if(e.target.closest('#slides'))slideFocus=true;else if(!e.target.closest('.slide-actions'))slideFocus=false;});
document.addEventListener('copy',e=>{if(!slideFocus||e.target.closest?.('input,textarea,[contenteditable=true]'))return;e.preventDefault();copySlide();e.clipboardData?.setData('text/plain','슬라이드룸 슬라이드');});
document.addEventListener('paste',e=>{if(!slideFocus||!slideClipboard||e.target.closest?.('input,textarea,[contenteditable=true]'))return;e.preventDefault();pasteSlide();});
for(const [id,d]of [['slideUp',-1],['slideDown',1]])$('#'+id).onclick=()=>{finishEdit();const other=index+d;if(other<0||other>=project.slides.length)return;[project.slides[index],project.slides[other]]=[project.slides[other],project.slides[index]];index=other;commit({capture:false});render();};
$('#projectName').onchange=e=>{project.title=e.target.value.trim()||'새 강의';commit();};
$('#zoomIn').onclick=()=>{zoom=Math.min(3,zoom+.15);fit();};$('#zoomOut').onclick=()=>{zoom=Math.max(.3,zoom-.15);fit();};$('#fitBtn').onclick=()=>{zoom=1;fit();};new ResizeObserver(fit).observe($('#stageArea'));
$('#openBtn').onclick=()=>$('#projectFile').click();
$('#newBtn').onclick=()=>{finishEdit();project={version:1,title:'새 강의',slides:[blankSlide()]};index=0;originalInput='';$('#importNotice').hidden=true;commit({capture:false});render();};
$('#opaqueBtn').onclick=()=>{finishEdit();takeSnapshot();const source=current().html,d=parse(blankSlide().html),frame=d.createElement('iframe');frame.dataset.srId=uid();frame.dataset.kind='group';frame.title=current().name;frame.setAttribute('sandbox','allow-scripts');frame.srcdoc=source;frame.style.cssText='position:absolute;left:0;top:0;width:1280px;height:720px;border:0;';d.body.append(frame);current().html=serialize(d);commit({capture:false});render();toast('페이지를 하나의 오브젝트로 묶었습니다. 실행 취소로 되돌릴 수 있습니다.');};
$('#projectFile').onchange=async e=>{
 try{
  const file=e.target.files[0];if(!file)return;finishEdit();originalInput=await file.text();$('#openBtn').disabled=true;
  toast('원본 파일을 분석하고 있습니다…');
  const dynamic=await importRuntimeHTML(originalInput,file.name,{onProgress:p=>toast(`${p.phase==='text-map'?'반복 글자의 원본 위치 확인 중':'원본 페이지 확인 중'} · ${p.current} / ${p.total}`)});
  const next=dynamic||importHTML(originalInput,file.name);
  if(dynamic)for(const s of next.slides){const d=parse(s.html);markElements(d);s.html=serialize(d);}
  project=next;history=new History(project);index=0;await render();saveLocal();toast(`${project.slides.length}개 슬라이드를 불러왔습니다.`);$('#importNotice').hidden=false;
  if(runtimeLimited()){$('#importNotice').textContent=`${project.slides.length}장 · 원본 실행 유지 · 글자 수정 / 도형 이동 / 크기 조절 · 재생은 미리보기`;}
  else{
   $('#importNotice').innerHTML='<span>원본 HTML을 유지하며 편집합니다. 페이지 구분이 다르면 선택자를 지정하세요.</span> <button id="pageSelectorBtn">페이지 구분</button>';
   $('#pageSelectorBtn').onclick=()=>{const selector=prompt('페이지 요소의 CSS 선택자 (예: .slide 또는 section)');if(selector){try{project=importHTML(originalInput,file.name,selector);history=new History(project);index=0;render();saveLocal();}catch(err){toast(err.message);}}};
  }
 }catch(err){toast('불러오기 실패: '+err.message);}finally{e.target.value='';$('#openBtn').disabled=false;}
};
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function saveProject(){finishEdit();takeSnapshot();download(JSON.stringify(project,null,2),project.title+'.slide.json','application/json');saveLocal();toast('편집용 프로젝트를 저장했습니다.');}
$('#saveBtn').onclick=saveProject;
$('#exportBtn').onclick=()=>{finishEdit();takeSnapshot();download(exportHTML(project),project.title+'.html','text/html');toast('HTML을 내려받았습니다. 다시 열어 편집할 수 있습니다.');};
$('#previewBtn').onclick=()=>{finishEdit();takeSnapshot();const html=exportHTML(project);$('#preview').showModal();void $('#previewFrame').offsetHeight;$('#previewFrame').srcdoc=html;};$('#closePreview').onclick=()=>{$('#preview').close();$('#previewFrame').srcdoc='';};
// Project saves use IndexedDB so uploaded images do not hit localStorage's small quota.
let dbPromise;
function database(){return dbPromise||=new Promise((resolve,reject)=>{const r=indexedDB.open('slide-room',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
let saveSequence=0;
async function saveLocal(){const sequence=++saveSequence;$('#saveState').textContent='브라우저에 저장 중…';try{const snapshot=clone(project),db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});if(sequence===saveSequence){$('#saveState').textContent='이 브라우저에 저장됨 · 방금';dirty=false;}}catch(err){$('#saveState').textContent='저장 실패 · 파일로 저장하세요';toast('자동 저장 실패: 저장 버튼으로 프로젝트를 내려받으세요.');}}
async function restore(){try{const db=await database(),p=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(p?.version===1&&p.slides?.length){project=p;history=new History(p);}}catch{toast('자동 저장소를 열 수 없습니다. 파일 저장을 이용하세요.');}await render();}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
// Feature modules share the selection and commit boundary, not duplicate editor state.
export const editor={get document(){return doc();},get selected(){return selected;},get selectedItems(){return selectedItems;},get project(){return project;},get index(){return index;},get runtimeLimited(){return runtimeLimited();},get limited(){return runtimeLimited();},select,selectMany,commit,toast,finishEdit,beginEdit,render,download,add,isText,translate,resizeTo,changeStyle,fit,saveLocal,snapshot:takeSnapshot,
 refreshSelection:updateBox,captureGeometry(el){captureRuntimeGeometry(project,current(),el);},
 setScale(value){zoom=1;fit();zoom=value/scale;fit();},
 insertSlides(slides){finishEdit();takeSnapshot();project.slides.splice(index+1,0,...slides);index++;commit({capture:false});return render();},
 goTo(i){finishEdit();takeSnapshot();index=Math.max(0,Math.min(project.slides.length-1,i));return render();},
 moveSlide(from,to){if(to<0||to>=project.slides.length)return;finishEdit();takeSnapshot();const active=current().id;const [s]=project.slides.splice(from,1);project.slides.splice(to,0,s);index=project.slides.findIndex(s=>s.id===active);commit({capture:false});},
 presentationDeck(){return exportHTML(project);},
 presentationPage(i){const slide=project.slides[i];if(project.runtime&&Number.isInteger(slide.runtimePage))return exportHTML({...project,slides:[slide]});return slide.html;}
};
setupMedia(editor);setupTables(editor);setupAssets(editor);setupAudit(editor);
setupWorkspace(editor);
editor.ready=restore();await editor.ready;
updateRuntimePermissions();
