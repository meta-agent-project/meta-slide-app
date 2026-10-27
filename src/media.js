import {uid} from './document.js';
export function setup(editor) {
 const $=s=>document.querySelector(s);
 $('#imageBtn').onclick=()=>{$('#imageFile').dataset.replace='false';$('#imageFile').click();};
 $('#elementProps').insertAdjacentHTML('beforeend','<section id="imageProps" hidden><h3>이미지 배치</h3><select id="cropMode" aria-label="이미지 채우기"><option value="contain">Contain · 전체 보이기</option><option value="cover">Cover · 영역 채우기</option><option value="fill">Fill · 늘려 채우기</option></select><label class="range-label">가로 위치 <input id="cropX" type="range" min="0" max="100" value="50"></label><label class="range-label">세로 위치 <input id="cropY" type="range" min="0" max="100" value="50"></label><button id="replaceImage">이미지 교체</button><label class="range-label">설명 <input id="imageAlt" aria-label="이미지 설명"></label></section><section id="embeddedProps" hidden><h3>외부 콘텐츠</h3><p class="muted">내부 편집은 잠겨 있습니다. 전체를 드래그해 이동하거나 애니메이션 실행에서 동작을 조작하세요.</p></section>');
 $('#elementProps').prepend($('#imageProps'));
 $('#imageProps').insertAdjacentHTML('beforeend','<p class="muted">좌우 핸들: 가로 · 위아래 핸들: 세로 · 모서리: 대각선 크기 조절</p>');
 const dataURL=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
 async function upload(file,replace){
  await editor.ready;if(editor.runtimeLimited)return;
  if(!file)return;if(!file.type.startsWith('image/'))throw Error('이미지 파일을 선택하세요.');
  editor.finishEdit();const src=await dataURL(file);let el=replace&&editor.selected?.tagName==='IMG'?editor.selected:null;
  if(!el){el=editor.document.createElement('img');el.dataset.srId=uid();el.dataset.kind='image';el.style.cssText='position:absolute;left:180px;top:150px;width:480px;height:300px;object-fit:contain;object-position:50% 50%;';el.style.objectFit='cover';(editor.document.querySelector('[data-sr-page]')||editor.document.body).append(el);}
  el.src=src;el.alt=file.name;
  editor.select(el);editor.commit();editor.toast('이미지를 추가했습니다.');
 }
 $('#imageFile').onchange=async e=>{try{await upload(e.target.files[0],e.target.dataset.replace==='true');}catch(err){editor.toast(err.message);}finally{e.target.value='';}};
 $('#replaceImage').onclick=()=>{$('#imageFile').dataset.replace='true';$('#imageFile').click();};
 document.addEventListener('object-selected',({detail:el})=>{
  $('#imageProps').hidden=el?.tagName!=='IMG';$('#embeddedProps').hidden=!['IFRAME','CANVAS'].includes(el?.tagName);
  if(el?.tagName==='IMG'){const cs=editor.document.defaultView.getComputedStyle(el);$('#cropMode').value=cs.objectFit;const p=cs.objectPosition.split(' ');$('#cropX').value=parseFloat(p[0]);$('#cropY').value=parseFloat(p[1]);$('#imageAlt').value=el.alt;}
 });
 $('#cropMode').onchange=e=>{if(editor.selected?.tagName==='IMG'){editor.selected.style.objectFit=e.target.value;editor.commit();}};
 for(const id of ['cropX','cropY'])$('#'+id).onchange=()=>{if(editor.selected?.tagName==='IMG'){editor.selected.style.objectPosition=`${$('#cropX').value}% ${$('#cropY').value}%`;editor.commit();}};
 $('#imageAlt').onchange=e=>{if(editor.selected?.tagName==='IMG'){editor.selected.alt=e.target.value;editor.commit();}};
}
