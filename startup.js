// A module dependency can fail before app.js gets a chance to show an error.
// Retry the whole module graph once; a rejected module remains cached in this document.
(() => {
 const key='slide-room-startup-retry';
 document.addEventListener('slide-ready',()=>{try{sessionStorage.removeItem(key);}catch{}},{once:true});
 document.addEventListener('error',event=>{
  if(event.target?.id!=='appEntry')return;
  let retry=false;
  try{if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');retry=true;}}catch{}
  if(retry){location.reload();return;}
  if(document.getElementById('startupError'))return;
  const panel=document.createElement('div');panel.id='startupError';panel.setAttribute('role','alert');
  panel.style.cssText='position:fixed;inset:30% 20% auto;z-index:9999;padding:32px;background:white;border:2px solid #5865e8;border-radius:16px;box-shadow:0 12px 60px #0003';
  const message=document.createElement('p');message.textContent='편집기 파일을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요. 저장된 작업은 유지됩니다.';
  const button=document.createElement('button');button.id='startupRetry';button.textContent='다시 불러오기';
  button.onclick=()=>{try{sessionStorage.removeItem(key);}catch{}location.reload();};
  panel.append(message,button);document.body.append(panel);
 },true);
})();
