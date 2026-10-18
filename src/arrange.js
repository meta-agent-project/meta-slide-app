import {uid} from './document.js';
export const isLocked=el=>!!el?.closest('[data-sr-locked]');
export function groupMembers(el){if(!el)return [];const id=el.dataset.srGroup;return id?[...el.ownerDocument.querySelectorAll('[data-sr-group]')].filter(n=>n.dataset.srGroup===id):[el];}
export function bounds(items){const rs=items.map(el=>el.getBoundingClientRect());if(!rs.length)return {x:0,y:0,width:0,height:0,right:0,bottom:0};const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y)),right=Math.max(...rs.map(r=>r.right)),bottom=Math.max(...rs.map(r=>r.bottom));return {x,y,right,bottom,width:right-x,height:bottom-y};}
export function clearGuides(doc){doc?.querySelectorAll('[data-sr-guide]').forEach(n=>n.remove());}
export function reorderLayers(items,direction){
 const selected=new Set(items.filter(el=>!isLocked(el)));
 for(const parent of new Set([...selected].map(el=>el.parentElement))){
  const siblings=[...parent.children].filter(el=>!el.matches('script,style,link,meta,[data-editor-only]'));
  const z=el=>Number.parseInt(el.ownerDocument.defaultView.getComputedStyle(el).zIndex)||0;
  siblings.sort((a,b)=>z(a)-z(b));const chosen=siblings.filter(el=>selected.has(el)),others=siblings.filter(el=>!selected.has(el));
  const order=direction>0?[...others,...chosen]:[...chosen,...others];
  // Nonnegative values keep objects above the page background when sent backward.
  order.forEach((el,i)=>{if(selected.has(el)&&el.ownerDocument.defaultView.getComputedStyle(el).position==='static')el.style.position='relative';el.style.setProperty('z-index',String(i+1),'important');});
 }
}
export function snapMove(doc,items,r,dx,dy,enabled=true){
 clearGuides(doc);if(!enabled)return {dx,dy};
 const candidates=[{x:0,y:0,width:1280,height:720}];
 for(const el of doc.querySelectorAll('[data-sr-id]')){if(el.matches('[data-sr-page]')||items.some(n=>n===el||n.contains(el)||el.contains(n)))continue;const box=el.getBoundingClientRect();if(box.width&&box.height&&doc.defaultView.getComputedStyle(el).visibility!=='hidden')candidates.push(box);}
 for(const [axis,size,delta]of [['x','width','dx'],['y','height','dy']]){
  const offset=delta==='dx'?dx:dy,edges=[r[axis]+offset,r[axis]+r[size]/2+offset,r[axis]+r[size]+offset];let best=6,line=null;
  for(const c of candidates)for(const target of [c[axis],c[axis]+c[size]/2,c[axis]+c[size]])for(const edge of edges){const gap=target-edge;if(Math.abs(gap)<Math.abs(best)){best=gap;line=target;}}
  if(line!==null){if(delta==='dx')dx+=best;else dy+=best;const guide=doc.createElement('div');guide.dataset.editorOnly='';guide.dataset.srGuide='';guide.style.cssText=`position:fixed;pointer-events:none;z-index:2147483647;background:#d34c93;${axis==='x'?`left:${line}px;top:0;width:1px;height:720px`:`top:${line}px;left:0;height:1px;width:1280px`}`;doc.body.append(guide);}
 }
 return {dx,dy};
}
export function setupArrange(editor){
 const $=s=>document.querySelector(s);let copied=null;
 $('#elementProps').insertAdjacentHTML('beforebegin',`<section id="arrangeProps"><h3>배치</h3><label class="range-label">정렬 기준<select id="alignReference"><option value="selection">선택한 요소</option><option value="slide">슬라이드</option></select></label><div class="arrange-grid">${[['left','왼쪽'],['center','가로 중앙'],['right','오른쪽'],['top','위쪽'],['middle','세로 중앙'],['bottom','아래쪽'],['horizontal','가로 간격'],['vertical','세로 간격']].map(([id,label])=>`<button data-arrange="${id}" title="${label}">${label}</button>`).join('')}</div><div class="arrange-grid"><button id="groupBtn">그룹 만들기</button><button id="ungroupBtn">그룹 해제</button><button id="lockBtn">잠금</button><button id="unlockAllBtn">전체 잠금 해제</button><button id="copyFormatBtn">서식 복사</button><button id="pasteFormatBtn">서식 적용</button></div><label class="check-label"><input type="checkbox" id="smartGuides" checked> 스마트 가이드 <small>Alt: 잠시 끄기</small></label></section>`);
 $('#textProps').insertAdjacentHTML('beforeend','<div class="text-align-buttons" aria-label="텍스트 정렬"><button data-text-align="left" title="왼쪽 정렬">왼쪽</button><button data-text-align="center" title="가운데 정렬">가운데</button><button data-text-align="right" title="오른쪽 정렬">오른쪽</button></div><label class="range-label">행간<input id="lineHeight" type="number" min="0.8" max="4" step="0.1" value="1.4"></label>');
 $('#imageProps').insertAdjacentHTML('beforeend','<label class="check-label"><input id="keepImageRatio" type="checkbox" checked> 크기 변경 시 비율 유지</label>');
 const items=()=>editor.selectedItems.filter(n=>!isLocked(n));
 const commit=()=>{editor.commit();editor.selectMany(editor.selectedItems);};
 function arrange(kind){if(editor.limited)return;const els=items();if(!els.length)return;editor.finishEdit();const ref=$('#alignReference').value==='slide'||els.length===1?{x:0,y:0,width:1280,height:720}:bounds(els);
  if(['horizontal','vertical'].includes(kind)){if(els.length<3)return;const axis=kind==='horizontal'?'x':'y',size=axis==='x'?'width':'height',sorted=els.map(el=>({el,r:el.getBoundingClientRect()})).sort((a,b)=>a.r[axis]-b.r[axis]);const total=sorted.reduce((sum,v)=>sum+v.r[size],0),gap=(ref[size]-total)/(els.length-1);let position=ref[axis];for(const {el,r}of sorted){editor.translate(el,axis==='x'?position-r.x:0,axis==='y'?position-r.y:0);position+=r[size]+gap;}}
  else for(const el of els){const r=el.getBoundingClientRect();const dx=kind==='left'?ref.x-r.x:kind==='center'?ref.x+(ref.width-r.width)/2-r.x:kind==='right'?ref.x+ref.width-r.width-r.x:0;const dy=kind==='top'?ref.y-r.y:kind==='middle'?ref.y+(ref.height-r.height)/2-r.y:kind==='bottom'?ref.y+ref.height-r.height-r.y:0;editor.translate(el,dx,dy);}commit();
 }
 document.querySelectorAll('[data-arrange]').forEach(b=>b.onclick=()=>arrange(b.dataset.arrange));
 $('#groupBtn').onclick=()=>{if(editor.limited||items().length<2)return;const id=uid();items().forEach(el=>el.dataset.srGroup=id);commit();};
 $('#ungroupBtn').onclick=()=>{if(editor.limited)return;items().forEach(el=>delete el.dataset.srGroup);commit();};
 $('#lockBtn').onclick=()=>{if(editor.limited)return;items().forEach(el=>el.dataset.srLocked='');editor.select(null);editor.commit();refresh();};
 $('#unlockAllBtn').onclick=()=>{editor.document.querySelectorAll('[data-sr-locked]').forEach(el=>delete el.dataset.srLocked);editor.commit();refresh();};
 const textProps=['font-family','font-size','font-weight','font-style','color','text-align','line-height','letter-spacing'];
 const shapeProps=['background-color','border-color','border-width','border-style','border-radius','opacity'];
 $('#copyFormatBtn').onclick=()=>{const el=editor.selected;if(!el||editor.limited)return;const type=editor.isText(el)?'text':'shape',s=editor.document.defaultView.getComputedStyle(el);copied={type,styles:Object.fromEntries((type==='text'?textProps:shapeProps).map(p=>[p,s.getPropertyValue(p)]))};refresh();editor.toast('서식을 복사했습니다. 대상을 선택한 뒤 서식 적용을 누르세요.');};
 $('#pasteFormatBtn').onclick=()=>{if(!copied||editor.limited)return;let count=0;for(const el of items()){if((editor.isText(el)?'text':'shape')!==copied.type)continue;for(const [p,v]of Object.entries(copied.styles))el.style.setProperty(p,v,'important');count++;}if(count)commit();else editor.toast('같은 종류의 요소를 선택하세요.');};
 document.querySelectorAll('[data-text-align]').forEach(b=>b.onclick=()=>{if(!editor.limited)editor.changeStyle('text-align',b.dataset.textAlign);});
 $('#lineHeight').onchange=e=>{if(!editor.limited)editor.changeStyle('line-height',String(Math.max(.8,Math.min(4,Number(e.target.value)||1.4))));};
 $('#keepImageRatio').onchange=e=>{if(editor.selected?.tagName==='IMG'){editor.selected.dataset.srKeepRatio=String(e.target.checked);editor.commit();}};
 function refresh(){const els=items(),limited=editor.limited,locked=isLocked(editor.selected),n=els.length;
  document.querySelectorAll('[data-text-align],#lineHeight').forEach(b=>b.disabled=limited||locked);
  document.querySelectorAll('[data-arrange]').forEach(b=>b.disabled=limited||!n||(['horizontal','vertical'].includes(b.dataset.arrange)&&n<3));
  $('#groupBtn').disabled=limited||n<2;$('#ungroupBtn').disabled=limited||!els.some(el=>el.dataset.srGroup);$('#lockBtn').disabled=limited||!n;$('#unlockAllBtn').disabled=limited||!editor.document?.querySelector('[data-sr-locked]');$('#copyFormatBtn').disabled=limited||n!==1;$('#pasteFormatBtn').disabled=limited||!n||!copied;
  $('#arrangeProps').hidden=!editor.selectedItems.length;
  if(editor.selected&&editor.isText(editor.selected)){const s=editor.document.defaultView.getComputedStyle(editor.selected);$('#lineHeight').value=(parseFloat(s.lineHeight)/parseFloat(s.fontSize)||1.4).toFixed(1);document.querySelectorAll('[data-text-align]').forEach(b=>b.setAttribute('aria-pressed',String(s.textAlign===b.dataset.textAlign)));}
  if(editor.selected?.tagName==='IMG')$('#keepImageRatio').checked=editor.selected.dataset.srKeepRatio!=='false';
  if(locked){$('#elementProps').hidden=true;$('#selectionBox').hidden=true;$('#deleteBtn').disabled=true;$('#duplicateBtn').disabled=true;$('#editTextBtn').disabled=true;}
 }
 function layerControls(){for(const b of document.querySelectorAll('#layers > button')){
  const el=editor.document.querySelector(`[data-sr-id="${CSS.escape(b.dataset.objectId||'')}"]`);if(!el)continue;const row=document.createElement('div');row.className='layer-row';b.before(row);row.append(b);const name=el.dataset.srName;if(name)b.textContent=name;
  const control=(label,text,fn,cls)=>{const button=document.createElement('button');button.className=cls||'layer-action';button.textContent=text;button.title=label;button.setAttribute('aria-label',label+' '+(name||b.textContent));button.disabled=editor.limited;button.onclick=fn;row.append(button);return button;};
  control(isLocked(el)?'잠금 해제':'요소 잠금',isLocked(el)?'🔒':'○',()=>{if(isLocked(el))delete (el.closest('[data-sr-locked]')).dataset.srLocked;else el.dataset.srLocked='';editor.select(null);editor.commit();},'layer-lock');
  control(el.hasAttribute('data-sr-hidden')?'요소 보이기':'요소 숨기기',el.hasAttribute('data-sr-hidden')?'◌':'●',()=>{if(el.hasAttribute('data-sr-hidden')){const old=JSON.parse(el.dataset.srHidden);if(old.value)el.style.setProperty('visibility',old.value,old.priority);else el.style.removeProperty('visibility');delete el.dataset.srHidden;}else{el.dataset.srHidden=JSON.stringify({value:el.style.getPropertyValue('visibility'),priority:el.style.getPropertyPriority('visibility')});el.style.setProperty('visibility','hidden','important');}editor.select(null);editor.commit();});
  for(const [label,arrow,direction]of [['앞으로','↑',1],['뒤로','↓',-1]])control(label,arrow,()=>{if(isLocked(el))return;reorderLayers([el],direction);editor.commit();});
  b.ondblclick=()=>{const value=prompt('오브젝트 이름',name||b.textContent);if(value?.trim()){el.dataset.srName=value.trim().slice(0,80);editor.commit();}};
 }}
 document.addEventListener('object-selected',refresh);document.addEventListener('selection-changed',refresh);document.addEventListener('slide-ready',()=>{refresh();layerControls();});document.addEventListener('layers-rendered',layerControls);
 const menu=document.createElement('div');menu.id='objectMenu';menu.className='context-menu';menu.hidden=true;menu.setAttribute('role','menu');for(const [id,label]of [['duplicateBtn','복제'],['deleteBtn','삭제'],['lockBtn','잠금'],['groupBtn','그룹 만들기'],['ungroupBtn','그룹 해제'],['frontBtn','맨 앞으로'],['backBtn','맨 뒤로']]){const b=document.createElement('button');b.textContent=label;b.dataset.command=id;b.onclick=()=>{$('#'+id).click();menu.hidden=true;};menu.append(b);}document.body.append(menu);
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.hidden=true;});document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.hidden=true;});
 document.addEventListener('slide-ready',()=>editor.document.addEventListener('contextmenu',e=>{e.preventDefault();const el=e.target.closest('[data-sr-id]');if(!el||el.matches('[data-sr-page]'))return;if(!editor.selectedItems.includes(el))editor.selectMany(groupMembers(el));const frame=$('#canvas').getBoundingClientRect(),s=frame.width/1280;menu.hidden=false;menu.style.left=Math.max(0,Math.min(innerWidth-180,frame.x+e.clientX*s))+'px';menu.style.top=Math.max(0,Math.min(innerHeight-menu.offsetHeight,frame.y+e.clientY*s))+'px';menu.querySelectorAll('button').forEach(b=>b.disabled=$('#'+b.dataset.command).disabled); }));
}
