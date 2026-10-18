/** Layout checks are heuristics; screenshots remain part of the final review. */
export function auditDocument(doc,width=1280,height=720) {
 const issues=[],objects=[];
 for(const el of doc.body.querySelectorAll('*')){
  if(el.closest('[data-decorative],[data-editor-only]')||['SCRIPT','STYLE','LINK','BR','SOURCE'].includes(el.tagName))continue;
  const rect=el.getBoundingClientRect(),s=doc.defaultView.getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
  const item={element:el.tagName.toLowerCase(),id:el.dataset.srId||el.id||'',text:el.textContent?.trim().slice(0,65)||el.getAttribute('alt')||'',rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
  if(el.tagName==='IMG'&&(!el.complete||!el.naturalWidth))issues.push({...item,type:'missing-image',severity:'error',message:'이미지를 불러오지 못했습니다.'});
  if(!rect.width||!rect.height)continue;
  if(rect.x< -2||rect.y< -2||rect.right>width+2||rect.bottom>height+2)issues.push({...item,type:'overflow',severity:'error',message:'슬라이드 경계 밖으로 나간 요소입니다.'});
  const text=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||/^(H[1-6]|P|LI|TD|TH)$/.test(el.tagName);
  if(text){
   if(el.scrollHeight>el.clientHeight+3||el.scrollWidth>el.clientWidth+3)issues.push({...item,type:'text-clipped',severity:'error',message:'텍스트가 요소 크기를 넘습니다. 높이나 구성을 확인하세요.'});
   if(parseFloat(s.fontSize)<18&&!el.hasAttribute('data-caption'))issues.push({...item,type:'small-text',severity:'warning',message:'18px 미만의 글자입니다. 강의 가독성을 확인하세요.'});
  }
  if((text||['IMG','VIDEO','TABLE','CANVAS','svg'].includes(el.tagName))&&!el.closest('[data-allow-overlap]'))objects.push({el,item,rect});
 }
 for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
  const a=objects[i],b=objects[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;
  const w=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left),h=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
  if(w>4&&h>4&&w*h>Math.min(a.rect.width*a.rect.height,b.rect.width*b.rect.height)*.12)issues.push({...a.item,type:'overlap',severity:'warning',message:`다른 콘텐츠와 겹칩니다: ${b.item.text||b.item.element}`,other:b.item.id});
 }
 for(const font of doc.fonts||[])if(font.status==='error')issues.push({type:'font-error',severity:'error',element:'font',text:font.family,message:'글꼴을 불러오지 못했습니다.'});
 return issues;
}
export function setup(editor){
 const $=s=>document.querySelector(s);$('#previewBtn').insertAdjacentHTML('beforebegin','<button id="auditBtn">검사</button>');
 document.body.insertAdjacentHTML('beforeend','<dialog id="auditDialog"><h2>슬라이드 검사</h2><p>경계·글자 크기·이미지·겹침을 확인합니다. 의도된 겹침은 직접 판단하세요.</p><div id="auditList"></div><button id="closeAudit">닫기</button></dialog>');
 $('#auditBtn').onclick=async()=>{editor.finishEdit();await editor.document.fonts.ready;const issues=auditDocument(editor.document),list=$('#auditList');list.replaceChildren();if(!issues.length)list.textContent='자동 검사에서 문제를 찾지 못했습니다. 최종 화면도 확인하세요.';
  for(const issue of issues){const row=document.createElement('div');row.className='audit-row';const message=document.createElement('p');message.textContent=(issue.severity==='error'?'확인 필요 · ':'권장 · ')+issue.message+' '+issue.text;row.append(message);
   const target=issue.id?editor.document.querySelector(`[data-sr-id="${CSS.escape(issue.id)}"],#${CSS.escape(issue.id)}`):null;
   const b=document.createElement('button');b.textContent='위치 보기';b.disabled=!target;b.onclick=()=>{if(target)editor.select(target);$('#auditDialog').close();};row.append(b);
   if(target&&!editor.runtimeLimited&&!target.closest('[data-sr-locked]')&&['overflow','text-clipped','small-text'].includes(issue.type)){
    const fix=document.createElement('button');fix.textContent=issue.type==='overflow'?'슬라이드 안으로 이동':issue.type==='text-clipped'?'글자 상자 늘리기':'글자 18px로 조정';fix.onclick=()=>{const before=target.style.cssText,r=target.getBoundingClientRect();if(issue.type==='overflow')editor.translate(target,r.width<=1280?Math.max(0,Math.min(1280-r.width,r.x))-r.x:-r.x,r.height<=720?Math.max(0,Math.min(720-r.height,r.y))-r.y:-r.y);else if(issue.type==='text-clipped'){const w=r.width*Math.max(1,target.scrollWidth/Math.max(1,target.clientWidth)),h=r.height*Math.max(1,target.scrollHeight/Math.max(1,target.clientHeight));editor.resizeTo(target,w,h);}else target.style.setProperty('font-size','18px','important');editor.select(target);$('#auditDialog').close();
     const after=target.style.cssText,html=editor.document.documentElement.outerHTML;target.style.cssText=before;editor.select(target);
     const preview=document.createElement('dialog');preview.className='studio-dialog audit-fix-dialog';preview.innerHTML='<h2>수정 결과 미리보기</h2><p>적용하면 실행 취소로 되돌릴 수 있습니다.</p><div class="audit-fix-frame"><iframe sandbox="" title="수정 결과"></iframe></div><div class="dialog-actions"><button data-cancel>취소</button><button data-accept class="primary">적용</button></div>';preview.querySelector('iframe').srcdoc=html;document.body.append(preview);preview.showModal();const frame=preview.querySelector('iframe');frame.style.transform=`scale(${frame.parentElement.clientWidth/1280})`;preview.querySelector('[data-accept]').onclick=()=>{target.style.cssText=after;editor.commit();editor.select(target);preview.close();};preview.querySelector('[data-cancel]').onclick=()=>preview.close();preview.addEventListener('close',()=>preview.remove(),{once:true});
    };row.append(fix);const hint=document.createElement('small');hint.textContent='결과를 확인한 뒤 적용하거나 취소할 수 있습니다.';row.append(hint);
   }list.append(row);
  }$('#auditDialog').showModal();};$('#closeAudit').onclick=()=>$('#auditDialog').close();
}
