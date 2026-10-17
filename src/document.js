import {prepareImport,normalizeReveal} from './import-adapters.js';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const uid=()=>crypto.randomUUID();
export const parse=html=>new DOMParser().parseFromString(html,'text/html');
export const serialize=doc=>'<!doctype html>\n'+doc.documentElement.outerHTML;
export function markElements(doc) {
 const seen=new Set();
 for(const el of doc.body.querySelectorAll('*')) {
  if(!['SCRIPT','STYLE','LINK','META','SOURCE','BR','PATH','RECT','CIRCLE','DEFS','STOP','LINE','POLYGON'].includes(el.tagName.toUpperCase()) && !el.closest('svg')?.isSameNode(el.parentElement?.closest('svg'))) {
   let id=el.getAttribute('data-sr-id');if(!id||!/^[-a-zA-Z0-9_]+$/.test(id)||seen.has(id)){id=uid();el.setAttribute('data-sr-id',id);}seen.add(id);
  }
 }
}
export function importHTML(html,name='새 강의',selector='') {
 if(/^\s*\{/.test(html)) {
  const p=JSON.parse(html);
  if(p.version!==1||!Array.isArray(p.slides)||!p.slides.length||p.slides.some(s=>typeof s.html!=='string'))throw Error('프로젝트 파일 형식이 올바르지 않습니다.');
  p.slides.forEach(s=>{s.id||=uid();const d=parse(s.html);markElements(d);s.html=serialize(d);});p.title=String(p.title||'새 강의'); return p;
 }
 const doc=parse(html), embedded=doc.getElementById('slide-room-project');
 if(embedded) {
  const p=JSON.parse(embedded.textContent);
  if(p.version!==1 || !Array.isArray(p.slides)||!p.slides.length||p.slides.some(s=>typeof s.html!=='string'))throw Error('지원하지 않는 프로젝트 형식입니다.');
  p.slides.forEach(s=>{s.id ||=uid();const d=parse(s.html);markElements(d);s.html=serialize(d);});p.title=String(p.title||'새 강의');return p;
 }
 doc.querySelectorAll('base,meta[http-equiv]').forEach(e=>e.remove());
 const adapter=prepareImport(doc);selector||=adapter.selector||'';
 markElements(doc);
 let roots=[];
 if(selector) roots=[...doc.querySelectorAll(selector)];
 else for(const s of ['[data-slide]','.slide','.reveal .slides > section','body > section']) {
  roots=[...doc.querySelectorAll(s)].filter(el=>!el.parentElement.closest(s)); if(roots.length)break;
 }
 if(selector&&!roots.length)throw Error('선택자와 일치하는 페이지가 없습니다.');
 const rootIds=roots.map(e=>e.getAttribute('data-sr-id'));
 const slides=(roots.length?roots:[doc.body]).map((root,i)=>{
  const d=parse(serialize(doc));
  if(root!==doc.body) {
   for(const id of rootIds)if(id!==rootIds[i])d.querySelector(`[data-sr-id="${id}"]`)?.remove();
   const active=d.querySelector(`[data-sr-id="${rootIds[i]}"]`);
   active.setAttribute('data-sr-page','');
   if(active.style.display==='none')active.style.removeProperty('display');
   active.removeAttribute('hidden');
   active.style.setProperty('visibility','visible','important');
   active.classList.add('active');
   // Existing deck containers may translate to another page. A single page is shown at its own origin.
   const st=d.createElement('style');st.setAttribute('data-sr-page-style','');st.textContent='html,body{margin:0!important;overflow:hidden!important} [data-sr-page]{margin:0!important;box-sizing:border-box}';d.head.append(st);
   if(adapter.kind==='reveal')normalizeReveal(d,html);
  }
  return {id:uid(),name:root.querySelector('h1,h2,h3')?.textContent?.slice(0,45)||`슬라이드 ${i+1}`,html:serialize(d)};
 });
 return {version:1,title:name.replace(/\.(html?|json)$/i,''),slides};
}
export function editorHTML(html) {
 const d=parse(html);
 d.querySelectorAll('script,base,meta[http-equiv],object,embed').forEach(el=>{
  if(['OBJECT','EMBED'].includes(el.tagName)){const p=d.createElement('div');p.style.cssText=el.getAttribute('style')||'width:320px;height:180px;background:#ddd';p.textContent='외부 미디어 · 미리보기에서 확인';p.dataset.srId=el.dataset.srId;el.replaceWith(p);}else el.remove();
 });
 for(const el of d.querySelectorAll('*'))for(const a of [...el.attributes])if(/^on/i.test(a.name)||(/^(href|src|action|formaction)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))el.removeAttribute(a.name);
 // Nested browsing contexts remain opaque and scriptless while editing.
 for(const el of d.querySelectorAll('iframe'))el.setAttribute('sandbox','');
 // With scripting disabled, canvas is fallback content rather than a replaced element.
 // Explicit dimensions keep its selectable footprint; a separate opaque iframe renders it live.
 for(const el of d.querySelectorAll('canvas')){el.style.display='block';if(!el.style.width)el.style.width=(el.getAttribute('width')||300)+'px';if(!el.style.height)el.style.height=(el.getAttribute('height')||150)+'px';}
 const csp=d.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";d.head.prepend(csp);
 const style=d.createElement('style');style.dataset.editorOnly='';style.textContent='html{scrollbar-width:none}body{overflow:hidden!important}*{animation:none!important;transition:none!important;caret-color:#5364e8}[contenteditable=true]{outline:2px solid #6370ef!important;cursor:text!important} [data-sr-id]{cursor:grab!important;user-select:none}[contenteditable=true],[contenteditable=true] *{cursor:text!important;user-select:text!important}html[data-sr-dragging] *{cursor:grabbing!important;user-select:none!important}html[data-sr-dragging=resize] *{cursor:nwse-resize!important}';d.head.append(style);
 return serialize(d);
}
export function blankSlide(name='빈 슬라이드') {
 return {id:uid(),name,html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>html,body{margin:0;width:1280px;height:720px;overflow:hidden}body{background:#f8f6f0;font-family:Arial,"Malgun Gothic",sans-serif}*{box-sizing:border-box}</style></head><body></body></html>`};
}
export function initialProject() {
 const slide=blankSlide('아이디어가 강의가 되는 순간');
 const d=parse(slide.html);d.body.innerHTML=`<div data-kind="text" style="position:absolute;left:84px;top:76px;color:#688377;font-size:16px;letter-spacing:4px;width:700px;height:28px">A SPACE FOR YOUR NEXT IDEA</div><h1 data-kind="text" style="position:absolute;left:80px;top:176px;width:860px;height:190px;font-size:72px;line-height:1.22;margin:0;font-weight:700;color:#253f38">아이디어가<br>강의가 되는 순간.</h1><p data-kind="text" style="position:absolute;left:84px;top:416px;width:700px;height:90px;font-size:23px;line-height:1.6;color:#7b857c;margin:0">AI가 만든 초안에 당신의 관점을 더하세요.<br>글자를 더블클릭하거나 HTML을 열어 시작합니다.</p><div data-kind="circle" style="position:absolute;left:1000px;top:242px;width:210px;height:210px;border-radius:50%;background:#dce4ce"></div><div data-kind="circle" style="position:absolute;left:1088px;top:347px;width:110px;height:110px;border-radius:50%;background:#f0b98a"></div><p data-kind="text" style="position:absolute;left:84px;top:631px;width:700px;height:30px;font-size:14px;letter-spacing:2px;color:#92968d">SLIDE ROOM  /  YOUR STORY STARTS HERE</p>`;
 markElements(d);slide.html=serialize(d);return {version:1,title:'나의 첫 번째 강의',slides:[slide]};
}
export function exportHTML(project) {
 const data=JSON.stringify(project).replaceAll('<','\\u003c');
 const frames=project.slides.map((s,i)=>`<iframe title="${esc(s.name)}" sandbox="allow-scripts" srcdoc="${esc(s.html)}" ${i?'hidden':''}></iframe>`).join('\n');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#171c27;color:white;font:14px sans-serif;display:grid;place-items:center;height:100vh;overflow:hidden}#deck{position:relative;width:1280px;height:720px;flex-shrink:0;transform-origin:center}iframe{border:0;width:1280px;height:720px;background:white;position:absolute;inset:0}[hidden]{display:none!important}nav{position:fixed;bottom:8px;left:50%;transform:translateX(-50%);background:#182231db;border-radius:9px;padding:8px;display:flex;gap:18px;align-items:center}button{border:0;border-radius:5px;background:#354057;color:white;padding:7px 16px;cursor:pointer}</style></head><body><main id="deck">${frames}</main><nav><button id="prev" aria-label="이전 슬라이드">←</button><span id="counter"></span><button id="next" aria-label="다음 슬라이드">→</button></nav><script id="slide-room-project" type="application/json">${data}</script><script>const frames=[...document.querySelectorAll('iframe')];let current=0;function show(n){current=Math.max(0,Math.min(frames.length-1,n));frames.forEach((f,i)=>f.hidden=i!==current);document.getElementById('counter').textContent=(current+1)+' / '+frames.length}document.getElementById('prev').onclick=()=>show(current-1);document.getElementById('next').onclick=()=>show(current+1);addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key))show(current+1);if(['ArrowLeft','PageUp'].includes(e.key))show(current-1)});function fit(){document.getElementById('deck').style.transform='scale('+Math.min(innerWidth/1280,(innerHeight-56)/720)+')'}addEventListener('resize',fit);fit();show(0);<\/script></body></html>`;
}
