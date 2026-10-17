import {uid} from './document.js';
export function setup(editor) {
 const $=s=>document.querySelector(s);
 $('#imageBtn').onclick=()=>{$('#imageFile').dataset.replace='false';$('#imageFile').click();};
 $('#imageBtn').insertAdjacentHTML('afterend','<button id="videoBtn">▷ 영상</button>');
 $('#elementProps').insertAdjacentHTML('beforeend','<section id="imageProps" hidden><h3>이미지 · 자르기</h3><select id="cropMode" aria-label="이미지 채우기"><option value="contain">전체 보이기</option><option value="cover">영역에 맞춰 자르기</option><option value="fill">늘려 채우기</option></select><label class="range-label">가로 위치 <input id="cropX" type="range" min="0" max="100" value="50"></label><label class="range-label">세로 위치 <input id="cropY" type="range" min="0" max="100" value="50"></label><button id="replaceImage">이미지 교체</button><label class="range-label">설명 <input id="imageAlt" aria-label="이미지 설명"></label></section><section id="videoProps" hidden><h3>미디어</h3><p class="muted">미리보기에서 재생합니다. 리모션은 완성한 MP4/WebM으로 넣어주세요.</p><button id="replaceVideo">영상 교체</button></section>');
 const videoFile=document.createElement('input');videoFile.type='file';videoFile.accept='video/*';videoFile.hidden=true;videoFile.id='videoFile';document.body.append(videoFile);
 const dataURL=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
 async function upload(file,type,replace){
  await editor.ready;if(editor.project.runtime)return;
  if(!file)return;if(!file.type.startsWith(type+'/'))throw Error('지원하는 '+type+' 파일을 선택하세요.');
  editor.finishEdit();const src=await dataURL(file);let el=replace&&editor.selected?.tagName===(type==='image'?'IMG':'VIDEO')?editor.selected:null;
  if(!el){el=editor.document.createElement(type==='image'?'img':'video');el.dataset.srId=uid();el.dataset.kind=type;el.style.cssText='position:absolute;left:180px;top:150px;width:480px;height:300px;object-fit:contain;object-position:50% 50%;';(editor.document.querySelector('[data-sr-page]')||editor.document.body).append(el);}
  el.src=src;if(type==='video'){el.controls=true;el.preload='metadata';el.playsInline=true;}else el.alt=file.name;
  editor.select(el);editor.commit();editor.toast(type==='image'?'이미지를 추가했습니다.':'영상을 추가했습니다. 미리보기에서 재생할 수 있습니다.');
 }
 $('#imageFile').onchange=async e=>{try{await upload(e.target.files[0],'image',e.target.dataset.replace==='true');}catch(err){editor.toast(err.message);}finally{e.target.value='';}};
 videoFile.onchange=async e=>{try{await upload(e.target.files[0],'video',e.target.dataset.replace==='true');}catch(err){editor.toast(err.message);}finally{e.target.value='';}};
 $('#videoBtn').onclick=()=>{videoFile.dataset.replace='false';videoFile.click();};$('#replaceVideo').onclick=()=>{videoFile.dataset.replace='true';videoFile.click();};
 $('#replaceImage').onclick=()=>{$('#imageFile').dataset.replace='true';$('#imageFile').click();};
 document.addEventListener('object-selected',({detail:el})=>{
  $('#imageProps').hidden=el?.tagName!=='IMG';$('#videoProps').hidden=!['VIDEO','IFRAME','CANVAS'].includes(el?.tagName);
  $('#replaceVideo').hidden=el?.tagName!=='VIDEO';$('#videoProps p').textContent=el?.tagName==='VIDEO'?'미리보기에서 재생합니다. 리모션은 완성한 MP4/WebM으로 넣을 수 있습니다.':'내부 편집은 잠겨 있습니다. 전체를 드래그해 이동하거나 애니메이션 실행에서 동작을 조작하세요.';
  if(el?.tagName==='IMG'){const cs=editor.document.defaultView.getComputedStyle(el);$('#cropMode').value=cs.objectFit;const p=cs.objectPosition.split(' ');$('#cropX').value=parseFloat(p[0]);$('#cropY').value=parseFloat(p[1]);$('#imageAlt').value=el.alt;}
 });
 $('#cropMode').onchange=e=>{if(editor.selected?.tagName==='IMG'){editor.selected.style.objectFit=e.target.value;editor.commit();}};
 for(const id of ['cropX','cropY'])$('#'+id).onchange=()=>{if(editor.selected?.tagName==='IMG'){editor.selected.style.objectPosition=`${$('#cropX').value}% ${$('#cropY').value}%`;editor.commit();}};
 $('#imageAlt').onchange=e=>{if(editor.selected?.tagName==='IMG'){editor.selected.alt=e.target.value;editor.commit();}};
}
