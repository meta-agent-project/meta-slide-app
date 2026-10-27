import {makeTable,tableGrid,mergeCells,splitCell,insertRow,insertColumn,deleteRow,deleteColumn} from './core.js';
import {uid} from './document.js';
export function readTable(table) {
 const cells=[],occupied=[];let cols=0;
 [...table.rows].forEach((row,r)=>{occupied[r]||=[];let c=0;for(const td of row.cells){while(occupied[r][c])c++;const rowspan=Math.max(1,Math.min(td.rowSpan||table.rows.length-r,table.rows.length-r)),colspan=td.colSpan||1;
  cells.push({r,c,rowspan,colspan,text:td.innerText,style:td.style.cssText,tag:td.tagName.toLowerCase()});
  for(let y=r;y<r+rowspan;y++){occupied[y]||=[];for(let x=c;x<c+colspan;x++)occupied[y][x]=true;}c+=colspan;cols=Math.max(cols,c);
 }});
 const model={rows:table.rows.length,cols,cells};
 for(let r=0;r<model.rows;r++)for(let c=0;c<cols;c++)if(!occupied[r]?.[c])cells.push({r,c,rowspan:1,colspan:1,text:'',style:''});
 tableGrid(model);return model;
}
function writeTable(table,model) {
 const body=table.ownerDocument.createElement('tbody');
 for(let r=0;r<model.rows;r++){
  const tr=table.ownerDocument.createElement('tr');
  for(const s of model.cells.filter(x=>x.r===r).sort((a,b)=>a.c-b.c)){
   const td=table.ownerDocument.createElement(s.tag||'td');td.rowSpan=s.rowspan;td.colSpan=s.colspan;td.textContent=s.text;td.style.cssText=s.style||'border:1px solid #c5d1cb;padding:14px;min-width:70px;white-space:pre-wrap;';td.dataset.srId=uid();tr.append(td);
  }body.append(tr);
 }
 table.querySelectorAll('thead,tbody,tfoot,tr').forEach(el=>el.remove());table.append(body);
}
export function setup(editor) {
 const $=s=>document.querySelector(s);let active=null,anchor=null,end=null;
 $('#imageBtn').insertAdjacentHTML('afterend','<button id="tableBtn">▦ 표</button>');
 $('#elementProps').insertAdjacentHTML('beforeend','<section id="tableProps" hidden><h3>표 편집</h3><p class="muted">셀 클릭 → Shift+클릭으로 범위 선택<br>더블클릭으로 셀 내용 수정</p><div class="table-actions"><button id="mergeCells">셀 병합</button><button id="splitCell">셀 분할</button><button id="insertRow">행 추가</button><button id="deleteRow">행 삭제</button><button id="insertColumn">열 추가</button><button id="deleteColumn">열 삭제</button></div><label class="range-label">열 너비 <input id="columnWidth" type="number" min="30" value="160" aria-label="열 너비"></label><label class="range-label">셀 배경 <input id="cellColor" type="color" value="#ffffff" aria-label="셀 배경색"></label><label class="range-label">셀 테두리 <input id="cellBorder" type="color" value="#c5d1cb" aria-label="셀 테두리색"></label></section>');
 function coords(td){const m=readTable(td.closest('table'));const row=[...td.parentElement.cells].indexOf(td),r=[...td.closest('table').rows].indexOf(td.parentElement);return m.cells.filter(s=>s.r===r).sort((a,b)=>a.c-b.c)[row];}
 function highlight(){
  editor.document.querySelectorAll('[data-cell-selected]').forEach(e=>e.removeAttribute('data-cell-selected'));
  if(!active||!anchor||!end)return;
  for(const td of active.querySelectorAll('td,th')){const s=coords(td);if(s.r>=Math.min(anchor.r,end.r)&&s.r<=Math.max(anchor.r,end.r)&&s.c>=Math.min(anchor.c,end.c)&&s.c<=Math.max(anchor.c,end.c))td.dataset.cellSelected='';}
 }
 function bind(){
  if(editor.runtimeLimited)return;
  const style=editor.document.createElement('style');style.dataset.editorOnly='';style.textContent='[data-cell-selected]{outline:2px solid #6370ef;outline-offset:-3px}';editor.document.head.append(style);
  editor.document.addEventListener('pointerdown',e=>{const td=e.target.closest('td,th');if(!td)return;const table=td.closest('table'),s=coords(td);if(active!==table||!e.shiftKey||!anchor)anchor={r:s.r,c:s.c};active=table;end={r:s.r+s.rowspan-1,c:s.c+s.colspan-1};highlight();},true);
 }
 document.addEventListener('slide-ready',()=>{active=null;anchor=null;end=null;bind();});bind();
 document.addEventListener('object-selected',({detail:el})=>{const table=editor.runtimeLimited?null:el?.closest('table');$('#tableProps').hidden=!table;if(active!==table){active=table;anchor=null;end=null;}});
 $('#tableBtn').onclick=()=>{
  editor.finishEdit();const t=editor.document.createElement('table');t.dataset.srId=uid();t.dataset.kind='table';t.style.cssText='position:absolute;left:180px;top:180px;width:660px;height:240px;border-collapse:collapse;table-layout:fixed;font-size:24px;color:#253f38;background:white;';
  writeTable(t,makeTable(3,3));(editor.document.querySelector('[data-sr-page]')||editor.document.body).append(t);editor.select(t);active=t;anchor={r:0,c:0};end={r:0,c:0};editor.commit();highlight();
 };
 const operations={mergeCells:m=>mergeCells(m,anchor,end),splitCell:m=>splitCell(m,anchor.r,anchor.c),insertRow:m=>insertRow(m,Math.min(m.rows,anchor.r+1)),deleteRow:m=>deleteRow(m,anchor.r),insertColumn:m=>insertColumn(m,Math.min(m.cols,anchor.c+1)),deleteColumn:m=>deleteColumn(m,anchor.c)};
 for(const [id,operation]of Object.entries(operations))$('#'+id).onclick=()=>{
  try{editor.finishEdit();if(!active)throw Error('표를 선택하세요.');anchor||={r:0,c:0};end||=anchor;
   const model=operation(readTable(active));writeTable(active,model);anchor={r:Math.min(anchor.r,model.rows-1),c:Math.min(anchor.c,model.cols-1)};end=anchor;editor.select(active);editor.commit();highlight();
  }catch(err){editor.toast(err.message);}
 };
 $('#columnWidth').onchange=e=>{if(!active)return;const m=readTable(active);let group=active.querySelector('colgroup');if(!group){group=editor.document.createElement('colgroup');for(let i=0;i<m.cols;i++)group.append(editor.document.createElement('col'));active.prepend(group);}group.children[Math.min(anchor?.c||0,group.children.length-1)].style.width=Math.max(30,+e.target.value)+'px';editor.commit();};
 for(const [id,property]of [['cellColor','backgroundColor'],['cellBorder','borderColor']])$('#'+id).onchange=e=>{if(!active)return;const list=[...active.querySelectorAll('[data-cell-selected]')];for(const td of list.length?list:active.querySelectorAll('td,th'))td.style[property]=e.target.value;editor.commit();};
}
