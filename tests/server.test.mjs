import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('local server identifies the app and does not expose repository internals',async()=>{
 const port=4187,base=`http://127.0.0.1:${port}`;
 const process=spawn(globalThis.process.execPath,['server.mjs'],{env:{...globalThis.process.env,PORT:String(port)},stdio:'ignore',windowsHide:true});
 try{
  for(let i=0;i<40;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const response=await fetch(base+'/healthz');assert.equal(response.status,200);assert.equal((await response.json()).app,'slide-room');
  assert.equal((await fetch(base+'/.git/config')).status,403);
  assert.equal((await fetch(base+'/node_modules/@playwright/test/package.json')).status,403);
  assert.match((await fetch(base+'/')).headers.get('content-type'),/text\/html/);
 }finally{process.kill();}
});
