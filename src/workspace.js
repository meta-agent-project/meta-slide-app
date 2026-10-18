import {setupRotation} from './rotation.js';
import {setupClipart} from './clipart.js';
import {editorHTML,parse,serialize} from './document.js';
import {setupThemes} from './themes.js';
import {setupArrange,isLocked} from './arrange.js';

// Runs inside the sandbox and uses the imported deck's own navigation controls.
function runtimePresenterBridge(initial,channel){
 let target=initial,seeking=true,ready=false,last=-1,scheduled=false;
 const position=()=>Number(document.querySelector('.stage')?.getAttribute('aria-label')?.match(/^\s*(\d+)\s*\//)?.[1])-1;
 const send=data=>parent.postMessage({type:'slide-room-presenter',...data},'*');
 const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(tick);}};
 function tick(){
  scheduled=false;const index=position();
  if(!Number.isInteger(index)){schedule();return;}
  if(seeking&&index!==target){document.querySelector(index<target?'#next':'#prev')?.click();schedule();return;}
  const commanded=seeking;seeking=false;
  if(!ready){ready=true;requestAnimationFrame(()=>send({ready:true}));}
  else if(!commanded&&index!==last)send({index});
  last=index;
 }
 window.addEventListener('message',e=>{if(e.data?.channel!==channel||e.data?.type!=='slide-room-presenter-goto'||!Number.isInteger(e.data.index))return;target=e.data.index;seeking=true;schedule();});
 document.addEventListener('click',e=>{const b=e.target.closest('#next,#prev');if(!e.isTrusted||!b||b.disabled)return;e.preventDefault();e.stopImmediatePropagation();send({direction:b.id==='next'?1:-1});},true);
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-label']});
 schedule();
}

export function setupWorkspace(editor){
 const $=s=>document.querySelector(s);
 setupThemes(editor);setupArrange(editor);setupClipart(editor);setupRotation(editor);
 const previewResize=new ResizeObserver(entries=>{for(const {target}of entries){const frame=target.querySelector('iframe');if(frame)frame.style.transform=`scale(${target.clientWidth/1280})`;}});
 const previewMutation=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('.page-preview'))previewResize.observe(node);node.querySelectorAll('.page-preview').forEach(el=>previewResize.observe(el));}for(const record of records)for(const node of record.removedNodes)if(node.nodeType===1){if(node.matches('.page-preview'))previewResize.unobserve(node);node.querySelectorAll('.page-preview').forEach(el=>previewResize.unobserve(el));}});previewMutation.observe(document.body,{childList:true,subtree:true});
 $('#saveBtn').textContent='프로젝트 저장';$('#saveBtn').title='편집용 .slide.json 파일 저장 · Ctrl+S';
 const fileMenu=document.createElement('details');fileMenu.id='fileMenu';fileMenu.className='command-menu';fileMenu.innerHTML='<summary>파일 ▾</summary><div class="command-menu-items"></div>';$('#projectName').before(fileMenu);for(const id of ['newBtn','openBtn','saveBtn'])fileMenu.querySelector('div').append($('#'+id));fileMenu.addEventListener('click',e=>{if(e.target.closest('button'))fileMenu.open=false;});document.addEventListener('pointerdown',e=>{if(!fileMenu.contains(e.target))fileMenu.open=false;});document.addEventListener('keydown',e=>{if(e.key==='Escape')fileMenu.open=false;});
 const insertion=$('[data-add="text"]').parentElement;insertion.classList.add('insert-tools');
 for(const [kind,label]of [['rect','□ 네모'],['circle','○ 원'],['rounded','▢ 둥근 네모'],['line','╱ 선'],['arrow','→ 화살표']]){let b=insertion.querySelector('[data-add="'+kind+'"]');if(!b){b=document.createElement('button');b.dataset.add=kind;insertion.append(b);}b.textContent=label;b.onclick=()=>editor.add(kind);}
 for(const selector of ['[data-add="text"]','#clipartBtn','#imageBtn','#videoBtn','#tableBtn','[data-add="rect"]','[data-add="circle"]','[data-add="rounded"]','[data-add="line"]','[data-add="arrow"]']){const b=insertion.querySelector(selector);if(b)insertion.append(b);}
 $('.brand small').textContent='HTML STUDIO';$('.sidebar-note').remove();$('.tip').remove();
 $('.workspace-heading').innerHTML='<div class="workspace-switches"><button id="toggleSlides" title="슬라이드 목록 접기" aria-pressed="false">☷</button><span id="slideLabel">SLIDE 01</span><button id="sorterBtn">전체 보기</button><button id="notesBtn" aria-pressed="false">발표 노트</button></div><div><span id="editCapability">자유 편집</span><button id="toggleProperties" title="속성 패널 접기" aria-pressed="false">☷</button></div>';
 $('.properties > .panel-heading').innerHTML='<div class="panel-tabs" role="tablist"><button id="designTab" role="tab" aria-selected="true" aria-controls="designPanel">속성</button><button id="layersTab" role="tab" aria-selected="false" aria-controls="layersPanel">레이어</button></div>';
 const properties=$('.properties'),design=document.createElement('div'),layers=document.createElement('div');design.id='designPanel';design.setAttribute('role','tabpanel');layers.id='layersPanel';layers.setAttribute('role','tabpanel');layers.hidden=true;
 const layerSection=$('#layers').closest('section');for(const el of [...properties.children])if(!el.classList.contains('panel-heading'))design.append(el);layers.append(layerSection);properties.append(design,layers);
 const tabs=(layer)=>{design.hidden=layer;layers.hidden=!layer;$('#designTab').setAttribute('aria-selected',String(!layer));$('#layersTab').setAttribute('aria-selected',String(layer));};$('#designTab').onclick=()=>tabs(false);$('#layersTab').onclick=()=>tabs(true);
 $('.panel-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const layer=$('#designTab').getAttribute('aria-selected')==='true';tabs(layer);$(layer?'#layersTab':'#designTab').focus();}});
 $('#opaqueBtn').textContent='원본 페이지를 하나로 묶기';$('#opaqueBtn').title='복잡한 원본을 통째로 이동합니다. 내부 요소 편집은 제한되며 실행 취소로 복구할 수 있습니다.';
 const settings=document.createElement('details');settings.className='document-settings';settings.innerHTML='<summary>문서 설정</summary>';settings.append($('#assetsBtn'),$('#opaqueBtn'));design.append(settings);
 $('#removeSlide').classList.add('danger-text');$('.slide-actions').after($('#removeSlide'));
 const arranger=$('#arrangeProps');design.append(arranger);
 for(const [id,cls]of [['toggleSlides','slides-collapsed'],['toggleProperties','properties-collapsed']])$('#'+id).onclick=()=>{const collapsed=document.body.classList.toggle(cls);$('#'+id).setAttribute('aria-pressed',String(collapsed));editor.fit();};
 // Adjustable sidebars retain a minimum canvas width on narrow windows.
 for(const [panel,side]of [[$('.slides-panel'),'left'],[properties,'right']]){const grip=document.createElement('div');grip.className='panel-grip '+side;grip.setAttribute('role','separator');grip.setAttribute('aria-label',side==='left'?'슬라이드 패널 너비':'속성 패널 너비');grip.setAttribute('aria-orientation','vertical');grip.tabIndex=0;panel.append(grip);const resize=value=>document.documentElement.style.setProperty(side==='left'?'--slides-width':'--properties-width',Math.max(side==='left'?150:240,Math.min(side==='left'?310:380,value))+'px');grip.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();resize(panel.offsetWidth+(e.key==='ArrowRight'?1:-1)*(side==='left'?16:-16));}};grip.onpointerdown=e=>{e.preventDefault();grip.setPointerCapture(e.pointerId);const start=e.clientX,width=panel.offsetWidth;grip.onpointermove=ev=>resize(width+(ev.clientX-start)*(side==='left'?1:-1));grip.onpointerup=grip.onpointercancel=()=>grip.onpointermove=null;};}
 $('#zoomLabel').outerHTML='<label class="zoom-field"><input id="zoomValue" type="number" min="10" max="300" step="5" aria-label="확대율"><span>%</span></label><span id="zoomLabel" hidden></span>';
 const zoomObserver=new MutationObserver(()=>$('#zoomValue').value=parseInt($('#zoomLabel').textContent)||100);zoomObserver.observe($('#zoomLabel'),{childList:true,subtree:true,characterData:true});$('#zoomValue').onchange=e=>editor.setScale(Math.max(.1,Math.min(3,Number(e.target.value)/100||1)));
 $('.canvas-help').classList.add('compact-help');$('footer > span').innerHTML='<em></em> 브라우저 자동 저장 · 파일 저장으로 백업';
 $('.toolbar').insertAdjacentHTML('afterbegin','<span class="toolbar-label">편집</span>');
 $('.canvas-help').insertAdjacentHTML('beforeend','<div id="selectionTools" hidden><button data-quick="duplicateBtn">복제</button><button data-quick="copyFormatBtn">서식 복사</button><button data-quick="lockBtn">잠금</button></div>');document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>$('#'+b.dataset.quick).click());const quickUpdate=()=>{const n=editor.selectedItems.length;$('#selectionTools').hidden=!n||editor.limited||isLocked(editor.selected);document.querySelectorAll('[data-quick]').forEach(b=>b.disabled=$('#'+b.dataset.quick).disabled);};document.addEventListener('object-selected',quickUpdate);document.addEventListener('selection-changed',quickUpdate);
 $('#duplicateBtn').title='선택 요소 복제 · Ctrl+D';$('#deleteBtn').title='선택 요소 삭제 · Delete';
 $('#previewBtn').insertAdjacentHTML('beforebegin','<button id="presenterBtn">발표 시작</button>');
 $('.canvas-help').insertAdjacentHTML('beforebegin','<section id="notesPanel" hidden><label for="speakerNotes">발표자 노트 <span>청중 화면에는 표시되지 않습니다.</span></label><textarea id="speakerNotes" placeholder="설명할 내용, 질문, 진행 순서를 적으세요."></textarea></section>');
 let notesSlide=null;
 $('#speakerNotes').oninput=()=>{if(notesSlide){notesSlide.notes=$('#speakerNotes').value;editor.saveLocal();}};
 $('#speakerNotes').onchange=()=>editor.commit({capture:false});
 $('#notesBtn').onclick=()=>{const open=$('#notesPanel').hidden;$('#notesPanel').hidden=!open;$('#notesBtn').setAttribute('aria-pressed',String(open));editor.fit();if(open)$('#speakerNotes').focus();};
 document.body.insertAdjacentHTML('beforeend','<dialog id="sorterDialog" class="studio-dialog"><div class="dialog-heading"><div><span class="eyebrow">STORY OVERVIEW</span><h2>슬라이드 전체 보기</h2></div><button data-close="sorterDialog" aria-label="전체 보기 닫기">✕</button></div><p>카드를 끌어 순서를 바꾸거나 이동 버튼을 사용하세요. 섹션 이름은 각 페이지에 저장됩니다.</p><div id="sorterGrid" class="page-gallery"></div></dialog>');
 function renderSorter(){const grid=$('#sorterGrid');grid.replaceChildren();editor.project.slides.forEach((s,i)=>{const card=document.createElement('article');card.className='page-card sorter-card'+(i===editor.index?' current':'');card.draggable=true;card.dataset.slideId=s.id;const preview=document.createElement('div');preview.className='page-preview';const frame=document.createElement('iframe');frame.srcdoc=editorHTML(s.html);frame.sandbox='';frame.title=s.name;frame.tabIndex=-1;preview.append(frame);const title=document.createElement('input');title.value=s.name;title.setAttribute('aria-label',`${i+1}번 슬라이드 이름`);title.onchange=()=>{s.name=title.value.trim()||'슬라이드';editor.commit({capture:false});};const section=document.createElement('input');section.placeholder='섹션 이름 (예: 도입)';section.value=s.section||'';section.setAttribute('aria-label',`${i+1}번 섹션`);section.onchange=()=>{s.section=section.value.trim();editor.commit({capture:false});};const actions=document.createElement('div');actions.className='card-actions';for(const [label,fn,disabled]of [['←',()=>moveSlide(i,i-1),i===0],['편집',()=>{editor.goTo(i);$('#sorterDialog').close();},false],['→',()=>moveSlide(i,i+1),i===editor.project.slides.length-1]]){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-label',`${i+1}번 ${label==='←'?'앞으로 이동':label==='→'?'뒤로 이동':'편집'}`);b.onclick=fn;actions.append(b);}const badge=document.createElement('span');badge.className='eyebrow';badge.textContent=String(i+1).padStart(2,'0');card.append(badge,preview,title,section,actions);card.ondragstart=e=>{if(e.target.matches('input')){e.preventDefault();return;}e.dataTransfer.setData('text/plain',s.id);};card.ondragover=e=>e.preventDefault();card.ondrop=e=>{e.preventDefault();const from=editor.project.slides.findIndex(x=>x.id===e.dataTransfer.getData('text/plain'));if(from>=0)moveSlide(from,i);};grid.append(card);});}
 function moveSlide(from,to){editor.moveSlide(from,to);renderSorter();}
 $('#sorterBtn').onclick=()=>{editor.finishEdit();editor.snapshot();renderSorter();$('#sorterDialog').showModal();};
 document.addEventListener('click',e=>{const id=e.target.closest('[data-close]')?.dataset.close;if(id)$('#'+id).close();});
 // Keep the layer list in place so double-click rename and repeated selection work.
 document.addEventListener('slide-ready',()=>{notesSlide=editor.project.slides[editor.index];$('#speakerNotes').value=notesSlide.notes||'';updateCapability();});
 function updateCapability(){const limited=editor.limited,el=editor.selected;$('#editCapability').textContent=isLocked(el)?'잠긴 요소':limited?'원본 유지 · 글자 / 도형 위치 수정':el?.matches('canvas,iframe')?'묶음 · 위치와 크기 수정':'자유 편집';$('#editCapability').classList.toggle('limited',limited);}
 document.addEventListener('object-selected',updateCapability);
 document.addEventListener('object-selected',({detail:el})=>{const id=el?.closest('table')?'tableProps':el?.tagName==='IMG'?'imageProps':editor.isText(el)?'textProps':null;if(id)$('#elementProps').prepend($('#'+id));});
 setupPresenter(editor);
}

function setupPresenter(editor){
 const $=s=>document.querySelector(s);
 document.body.insertAdjacentHTML('beforeend','<dialog id="presenterDialog" class="studio-dialog presenter-dialog"><div class="dialog-heading"><div><span class="eyebrow">PRESENTER VIEW</span><h2>발표자 화면</h2></div><div><button id="audienceBtn">청중 화면 열기</button><button data-close="presenterDialog">발표 종료</button></div></div><div class="presenter-layout"><section><div class="presenter-canvas"><iframe id="presenterCurrent" sandbox="allow-scripts" title="현재 슬라이드"></iframe></div><div class="presenter-navigation"><button id="presenterPrev">← 이전</button><span id="presenterCounter"></span><button id="presenterNext">다음 →</button><time id="presenterClock">00:00</time><button id="resetClock">시간 초기화</button></div></section><aside><h3>다음 슬라이드</h3><div class="presenter-next"><iframe id="presenterNextFrame" sandbox="" title="다음 슬라이드"></iframe></div><h3>발표 노트</h3><p id="presenterNotes"></p></aside></div><p id="presenterStatus" role="status"></p></dialog>');
 let pageIndex=0,audience=null,started=0,timer=null,deckHTML=null;const channel=crypto.randomUUID();
 const transitions=new Map();
 function swapFrame(frame,html,runtime=false){
  const container=frame.parentElement;transitions.get(container)?.();
  const next=frame.cloneNode(false),id=frame.id;next.removeAttribute('id');next.dataset.pending='';next.style.opacity='0';next.style.pointerEvents='none';next.setAttribute('aria-hidden','true');next.tabIndex=-1;
  let cancelled=false,painting=false;const host=frame.ownerDocument.defaultView;next.dataset.runtime=String(runtime);
  const cancel=()=>{cancelled=true;next.onload=null;host.removeEventListener('message',readyMessage);next.remove();transitions.delete(container);};transitions.set(container,cancel);
  const paint=()=>{if(painting)return;painting=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(cancelled||!frame.isConnected)return;
   const focused=frame.ownerDocument.activeElement===frame;
   next.style.transform=frame.style.transform;next.style.opacity='';next.style.pointerEvents='';next.removeAttribute('aria-hidden');next.removeAttribute('tabindex');delete next.dataset.pending;
   if(id)next.id=id;frame.remove();host.removeEventListener('message',readyMessage);transitions.delete(container);if(focused)next.focus({preventScroll:true});
  }));};
  const readyMessage=e=>{if(e.source===next.contentWindow&&e.data?.type==='slide-room-presenter'&&e.data.ready)paint();};
  if(runtime)host.addEventListener('message',readyMessage);else next.onload=paint;
  next.srcdoc=html;container.append(next);
 }
 function cancelTransitions(){for(const cancel of [...transitions.values()])cancel();}

 function source(i){const d=parse(deckHTML??editor.presentationPage(i)),script=d.createElement('script');script.textContent=`window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='slide-room-presenter-step'&&[-1,1].includes(e.data.direction)){if(window.srChatStep?.(e.data.direction))return;parent.postMessage({type:'slide-room-presenter',direction:e.data.direction},'*');}});document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]'))return;let direction=['ArrowRight','PageDown',' '].includes(e.key)?1:['ArrowLeft','PageUp'].includes(e.key)?-1:0;if(direction){e.preventDefault();e.stopImmediatePropagation();if(window.srChatStep?.(direction))return;parent.postMessage({type:'slide-room-presenter',direction},'*');}},true);`;d.head.prepend(script);if(deckHTML){const bridge=d.createElement('script');bridge.textContent='('+runtimePresenterBridge.toString()+')('+i+','+JSON.stringify(channel)+');';d.head.append(bridge);}return serialize(d);}
 function renderFrame(frame){if(deckHTML&&frame.dataset.runtime==='true'){frame.contentWindow.postMessage({type:'slide-room-presenter-goto',channel,index:pageIndex},'*');return;}swapFrame(frame,source(pageIndex),!!deckHTML);}
 function syncAudience(){if(!audience||audience.closed)return;const frame=audience.document.querySelector('iframe:not([data-pending])');renderFrame(frame);audience.document.title=`${pageIndex+1} / ${editor.project.slides.length} · ${editor.project.title}`;}
 function show(i,force=false){const next=Math.max(0,Math.min(editor.project.slides.length-1,i));if(!force&&next===pageIndex)return;pageIndex=next;const s=editor.project.slides[pageIndex];renderFrame($('#presenterCurrent'));$('#presenterNextFrame').srcdoc=editor.project.slides[pageIndex+1]?editorHTML(editor.project.slides[pageIndex+1].html):'<p style="font:48px sans-serif;padding:80px">마지막 슬라이드입니다.</p>';$('#presenterNotes').textContent=s.notes||'이 페이지의 발표 노트가 없습니다.';$('#presenterCounter').textContent=`${pageIndex+1} / ${editor.project.slides.length}`;$('#presenterPrev').disabled=pageIndex===0;$('#presenterNext').disabled=pageIndex===editor.project.slides.length-1;syncAudience();}
 const fit=()=>{for(const id of ['presenterCurrent','presenterNextFrame']){const f=$('#'+id);for(const child of f.parentElement.querySelectorAll('iframe'))child.style.transform=`scale(${f.parentElement.clientWidth/1280})`;}};
 new ResizeObserver(fit).observe($('.presenter-canvas'));new ResizeObserver(fit).observe($('.presenter-next'));
 $('#presenterBtn').onclick=()=>{editor.finishEdit();editor.snapshot();deckHTML=editor.project.runtime?editor.presentationDeck():null;started=Date.now();$('#presenterStatus').textContent=editor.project.runtime?'원본 실행형 슬라이드는 원본 재생 화면을 유지합니다.':'청중 화면을 다른 모니터로 옮겨 발표할 수 있습니다.';$('#presenterDialog').showModal();show(editor.index,true);fit();clearInterval(timer);timer=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);$('#presenterClock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},1000);};
 $('#presenterPrev').onclick=()=>show(pageIndex-1);$('#presenterNext').onclick=()=>show(pageIndex+1);$('#resetClock').onclick=()=>{started=Date.now();$('#presenterClock').textContent='00:00';};
 window.addEventListener('message',e=>{if($('#presenterDialog').open&&e.source===$('#presenterCurrent').contentWindow&&e.data?.type==='slide-room-presenter'){if([-1,1].includes(e.data.direction))show(pageIndex+e.data.direction);else if(Number.isInteger(e.data.index))show(e.data.index);}});
 function step(direction){$('#presenterCurrent').contentWindow.postMessage({type:'slide-room-presenter-step',direction},'*');}
 window.addEventListener('message',e=>{if(e.source===$('#presenterCurrent').contentWindow&&e.data?.type==='slide-room-chat-state'&&audience&&!audience.closed)audience.document.querySelector('iframe:not([data-pending])')?.contentWindow.postMessage({type:'slide-room-chat-sync',counts:e.data.counts},'*');});
 $('#presenterDialog').addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();step(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();step(-1);}});
 $('#audienceBtn').onclick=()=>{audience=window.open('about:blank','slide-room-audience','popup,width=1280,height=800');if(!audience){$('#presenterStatus').textContent='팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 열어주세요.';return;}const d=audience.document;d.open();d.write('<!doctype html><html><head><title>청중 화면</title><style>body{margin:0;background:#111;display:grid;place-items:center;height:100vh;overflow:hidden}main{position:relative}iframe{position:absolute;inset:0;border:0;width:1280px;height:720px;transform-origin:top left}button{position:fixed;right:16px;bottom:16px;background:#222;color:white;border:1px solid #666;padding:10px;border-radius:6px}</style></head><body><main><iframe sandbox="allow-scripts" title="발표 슬라이드"></iframe></main><button>전체 화면</button></body></html>');d.close();audience.addEventListener('message',e=>{if(e.source===d.querySelector('iframe:not([data-pending])').contentWindow&&e.data?.type==='slide-room-presenter'){if([-1,1].includes(e.data.direction))show(pageIndex+e.data.direction);else if(Number.isInteger(e.data.index))show(e.data.index);}});const fitAudience=()=>{if(audience.closed)return;const s=Math.min(audience.innerWidth/1280,audience.innerHeight/720),main=d.querySelector('main');main.style.width=1280*s+'px';main.style.height=720*s+'px';for(const frame of d.querySelectorAll('iframe'))frame.style.transform=`scale(${s})`;};audience.addEventListener('resize',fitAudience);d.querySelector('button').onclick=()=>d.documentElement.requestFullscreen?.();audience.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(pageIndex+1);if(e.key==='ArrowLeft')show(pageIndex-1);});fitAudience();syncAudience();};
 $('#presenterDialog').addEventListener('close',()=>{cancelTransitions();clearInterval(timer);$('#presenterCurrent').srcdoc='';delete $('#presenterCurrent').dataset.runtime;$('#presenterNextFrame').srcdoc='';if(audience&&!audience.closed)audience.close();audience=null;});
}

