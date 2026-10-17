// Source scripts only run inside opaque, sandboxed media frames, never in the editable document.
const html=doc=>'<!doctype html>\n'+doc.documentElement.outerHTML;
function style(doc,text){const s=doc.createElement('style');s.dataset.srAdapter='';s.textContent=text;doc.head.append(s);}
function frame(doc,source,kind,height){const f=doc.createElement('iframe');f.setAttribute('sandbox','allow-scripts');f.dataset.kind=kind;f.title=kind==='simulation'?'시뮬레이터 · 실행 모드에서 조작':'애니메이션 · 내부 편집 잠금';f.srcdoc=source;f.style.cssText=`display:block;width:100%;height:${height}px;border:0;`;return f;}

export function prepareImport(doc){
 const panels=[...doc.querySelectorAll('.panel[data-panel]')];
 if(panels.length&&doc.querySelector('[data-tab]')&&panels.every(p=>p.querySelector(':scope > .grid2'))){
  const source=doc.cloneNode(true);
  panels.forEach((panel,i)=>{
   const runtime=source.cloneNode(true),all=[...runtime.querySelectorAll('.panel[data-panel]')];
   all.forEach((p,n)=>p.classList.toggle('active',n===i));all[i].dataset.srRuntimePanel='';
   style(runtime,`html,body{margin:0!important;overflow:auto!important} .wrap{padding:0!important;margin:0!important;max-width:none!important} body>button,.wrap>:not(.panel){display:none!important} .panel{display:none!important;animation:none!important} .panel[data-sr-runtime-panel]{display:block!important} .panel[data-sr-runtime-panel]>:not(.grid2){display:none!important}`);
   panel.querySelector(':scope > .grid2').replaceWith(frame(doc,html(runtime),'simulation',540));
  });
  doc.querySelectorAll('script,#tabbar,#fsBtn').forEach(el=>el.remove());
  const wrap=doc.querySelector('.wrap');if(wrap){wrap.dataset.srFitPage='';style(doc,'.wrap{width:1280px;max-width:none!important;margin:0!important;padding:24px 32px!important}.panel{animation:none!important}');}
  return {selector:'.panel[data-panel]',kind:'simulator'};
 }
 // Empty JS application mounts (including compiled React/Remotion players) are opaque objects.
 const mount=doc.querySelector('#root:empty,#app:empty');
 if(mount&&doc.querySelector('script')){
  const source=html(doc);mount.replaceWith(frame(doc,source,'animation',720));doc.querySelectorAll('script').forEach(el=>el.remove());
 }
 return {kind:doc.querySelector('.reveal .slides')?'reveal':'html'};
}

export function normalizeReveal(doc,source){
 if(!doc.querySelector('.reveal .slides [data-sr-page]'))return;
 const config=source.match(/Reveal\.initialize\s*\(\s*\{([\s\S]*?)\}\s*\)/)?.[1]||'';
 const size=(key,fallback)=>{const n=Number(config.match(new RegExp('\\b'+key+'\\s*:\\s*(\\d+)'))?.[1]);return n>=200&&n<=10000?n:fallback;};
 const width=size('width',960),height=size('height',700),scale=Math.min(1280/width,720/height);
 const page=doc.querySelector('[data-sr-page]');page.classList.add('present');
 if(page.dataset.background)page.style.background=page.dataset.background;
 style(doc,`html,body{width:1280px!important;height:720px!important;margin:0!important;overflow:hidden!important}.reveal{display:block!important;visibility:visible!important;position:relative!important;width:1280px!important;height:720px!important}.reveal .slides{display:block!important;position:absolute!important;left:${(1280-width*scale)/2}px!important;top:0!important;margin:0!important;width:${width}px!important;height:${height}px!important;transform:scale(${scale})!important;transform-origin:top left!important;perspective:none!important}.reveal .slides [data-sr-page]{display:block!important;visibility:visible!important;opacity:1!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;margin:0!important;transform:none!important;box-sizing:border-box!important}.reveal .fragment{opacity:1!important;visibility:visible!important}.reveal aside.notes,.reveal .controls,.reveal .progress,.reveal .slide-number,#fsToggle{display:none!important}`);
}
