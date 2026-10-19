export function angle(el){const value=el.ownerDocument.defaultView.getComputedStyle(el).rotate;if(value==='none')return 0;const token=value.split(/\s+/).at(-1),n=parseFloat(token)||0;return token.endsWith('grad')?n*.9:token.endsWith('rad')?n*180/Math.PI:token.endsWith('turn')?n*360:n;}
// Recover the object's local border box and its axes in canvas coordinates.
// A boundingClientRect alone loses the orientation (and grows at 45 degrees).
export function objectGeometry(el){
 const win=el.ownerDocument.defaultView,cs=win.getComputedStyle(el),r=el.getBoundingClientRect();
 const px=v=>parseFloat(v)||0,border=cs.boxSizing==='border-box';
 const width=px(cs.width)+(border?0:px(cs.paddingLeft)+px(cs.paddingRight)+px(cs.borderLeftWidth)+px(cs.borderRightWidth));
 const height=px(cs.height)+(border?0:px(cs.paddingTop)+px(cs.paddingBottom)+px(cs.borderTopWidth)+px(cs.borderBottomWidth));
 let m=new win.DOMMatrix();
 for(let node=el;node;node=node.parentElement){
  const style=win.getComputedStyle(node),sc=style.scale==='none'?['1']:style.scale.split(/\s+/),number=v=>v.endsWith('%')?parseFloat(v)/100:parseFloat(v);
  const local=new win.DOMMatrix().rotate(angle(node)).scale(number(sc[0]),number(sc[1]||sc[0])).multiply(new win.DOMMatrix(style.transform==='none'?undefined:style.transform));
  m=local.multiply(m);
 }
 const cx=r.x+r.width/2,cy=r.y+r.height/2;
 if(!m.is2D||!width||!height||Math.abs(m.a*m.d-m.b*m.c)<.000001)return {x:r.x,y:r.y,width:r.width,height:r.height,cx,cy,a:1,b:0,c:0,d:1};
 return {x:cx-(m.a*width+m.c*height)/2,y:cy-(m.b*width+m.d*height)/2,width,height,cx,cy,a:m.a,b:m.b,c:m.c,d:m.d};
}
const center=el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
export function setupRotation(editor){
 const $=s=>document.querySelector(s);
 $('#elementProps').insertAdjacentHTML('afterbegin','<section id="rotationProps"><h3>회전</h3><label class="range-label">각도 <input id="rotationAngle" type="number" step="1" aria-label="회전 각도"> °</label><div class="rotation-actions"><button id="rotateLeft" title="왼쪽으로 90도 회전">↶ 90°</button><button id="rotateRight" title="오른쪽으로 90도 회전">↷ 90°</button><button id="resetRotation">0°</button></div><p class="muted">회전 핸들을 드래그하세요. Shift: 15° 간격</p></section>');
 $('#selectionBox').insertAdjacentHTML('beforeend','<button id="rotationHandle" aria-label="오브젝트 회전" title="드래그하여 회전 · Shift: 15도 간격">↻</button>');
 const items=()=>editor.selectedItems.filter(el=>!el.closest('[data-sr-locked]'));
 function prepare(el){if(editor.runtimeLimited&&!el.hasAttribute('data-sr-geometry')){const binding=editor.project.runtime.bindings[el.dataset.srSource];if(!binding?.path)return false;el.dataset.srGeometry=binding.path;}return true;}
 function rotate(el,value){if(!prepare(el))return;const before=center(el),cs=el.ownerDocument.defaultView.getComputedStyle(el);if(cs.display==='inline')el.style.setProperty('display','inline-block','important');el.style.setProperty('rotate',value+'deg','important');const after=center(el);editor.translate(el,before.x-after.x,before.y-after.y);}
 function refresh(){const selected=items();$('#rotationAngle').value=selected.length===1?Math.round(angle(selected[0])*10)/10:'';$('#rotationAngle').placeholder=selected.length>1?'여러 개':'';$('#rotationProps').hidden=!selected.length;$('#rotationHandle').hidden=!selected.length;}
 function commit(){for(const el of items())editor.captureGeometry(el);editor.commit();editor.refreshSelection();refresh();}
 function set(value,relative=false){if(!Number.isFinite(value))return;editor.finishEdit();for(const el of items())rotate(el,relative?angle(el)+value:value);commit();}
 $('#rotationAngle').onchange=e=>{if(e.target.value.trim())set(Number(e.target.value));};$('#rotateLeft').onclick=()=>set(-90,true);$('#rotateRight').onclick=()=>set(90,true);$('#resetRotation').onclick=()=>set(0);
 $('#rotationHandle').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();editor.finishEdit();const selected=items();if(!selected.length)return;const saved=selected.map(el=>({el,style:el.style.cssText,geometry:el.getAttribute('data-sr-geometry'),angle:angle(el),center:center(el)}));const frame=$('#canvas').getBoundingClientRect(),scale=frame.width/1280;const rs=selected.map(el=>el.getBoundingClientRect()),left=Math.min(...rs.map(r=>r.left)),right=Math.max(...rs.map(r=>r.right)),top=Math.min(...rs.map(r=>r.top)),bottom=Math.max(...rs.map(r=>r.bottom));const pivot={x:(left+right)/2,y:(top+bottom)/2},screen={x:frame.x+pivot.x*scale,y:frame.y+pivot.y*scale};let previous=Math.atan2(e.clientY-screen.y,e.clientX-screen.x),delta=0,moved=false;
 const handle=e.currentTarget;handle.setPointerCapture(e.pointerId);$('#selectionBox').classList.add('rotating');
 const move=ev=>{const next=Math.atan2(ev.clientY-screen.y,ev.clientX-screen.x);let step=next-previous;if(step>Math.PI)step-=2*Math.PI;if(step< -Math.PI)step+=2*Math.PI;delta+=step*180/Math.PI;previous=next;const degrees=ev.shiftKey?Math.round(delta/15)*15:delta;if(Math.abs(degrees)<.1&&!moved)return;moved=true;const radians=degrees*Math.PI/180;for(const s of saved){s.el.style.cssText=s.style;rotate(s.el,s.angle+degrees);if(saved.length>1){const x=s.center.x-pivot.x,y=s.center.y-pivot.y,c=center(s.el);editor.translate(s.el,pivot.x+x*Math.cos(radians)-y*Math.sin(radians)-c.x,pivot.y+x*Math.sin(radians)+y*Math.cos(radians)-c.y);}}editor.refreshSelection();refresh();};
 const cancel=()=>end({type:'pointercancel'});const key=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}};
 const end=ev=>{document.removeEventListener('keydown',key,true);handle.removeEventListener('lostpointercapture',cancel);$('#selectionBox').classList.remove('rotating');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);if(ev.type==='pointercancel'){for(const s of saved){s.el.style.cssText=s.style;if(s.geometry===null)s.el.removeAttribute('data-sr-geometry');else s.el.setAttribute('data-sr-geometry',s.geometry);}editor.refreshSelection();refresh();}else if(moved)commit();if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};document.addEventListener('keydown',key,true);handle.addEventListener('lostpointercapture',cancel);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 };
 document.addEventListener('object-selected',refresh);document.addEventListener('selection-changed',refresh);
}
