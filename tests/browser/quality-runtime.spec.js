import {test,expect} from '@playwright/test';
test('audit reports overflow, text clipping and missing image while accepting intentional decoration',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {auditDocument}=await import('/src/audit.js');
  const f=document.createElement('iframe');f.style='width:1280px;height:720px';document.body.append(f);
  await new Promise(r=>{f.onload=r;f.srcdoc='<body style="margin:0"><h1 style="position:absolute;left:1200px;top:10px;width:300px">넘침</h1><p style="position:absolute;top:150px;height:20px;width:200px;font-size:40px;overflow:hidden">긴 글자가 잘립니다 여러 줄입니다</p><img src="/missing-test.png"><div data-decorative style="position:absolute;left:-30px;width:50px;height:50px"></div></body>';});
  return auditDocument(f.contentDocument);
 });
 expect(result.some(x=>x.type==='overflow')).toBeTruthy();expect(result.some(x=>x.type==='text-clipped')).toBeTruthy();expect(result.some(x=>x.type==='missing-image')).toBeTruthy();expect(result.some(x=>x.element==='div')).toBeFalsy();
});
test('script-driven canvas has an isolated live object surface and remains movable',async({page})=>{
 await page.goto('/');
 const html='<body style="margin:0"><canvas id="art" width="400" height="240" style="position:absolute;left:100px;top:100px"></canvas><script>const c=document.getElementById("art");const ctx=c.getContext("2d");ctx.fillStyle="red";ctx.fillRect(0,0,400,240);document.body.dataset.rendered="yes";</script></body>';
 await page.locator('#projectFile').setInputFiles({name:'canvas.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.runtime-object')).toHaveCount(1);
 const live=page.frameLocator('.runtime-object iframe');await expect(live.locator('body')).toHaveAttribute('data-rendered','yes');
 const pixel=await live.locator('canvas').evaluate(c=>[...c.getContext('2d').getImageData(1,1,1,1).data]);expect(pixel).toEqual([255,0,0,255]);
 await page.frameLocator('#canvas').locator('canvas').click();await page.locator('#propX').fill('240');await page.locator('#propX').press('Enter');
 await expect(page.locator('.runtime-object')).toHaveCSS('left','240px');
});
test('uploaded video plays in preview and survives export',async({page})=>{
 await page.goto('/');
 const bytes=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d'),stream=c.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
  const done=new Promise(resolve=>recorder.onstop=async()=>resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]));recorder.start();
  for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#5566ee':'#ccddaa';ctx.fillRect(0,0,160,90);await new Promise(r=>setTimeout(r,100));}recorder.stop();stream.getTracks().forEach(t=>t.stop());return done;
 });
 await page.locator('#videoFile').setInputFiles({name:'lesson.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
 await expect(page.frameLocator('#canvas').locator('video')).toHaveAttribute('src',/^data:video/);
 await page.locator('#previewBtn').click();const v=page.frameLocator('#previewFrame').frameLocator('#deck iframe').locator('video');
 await v.evaluate(async el=>{el.muted=true;await el.play();});await expect.poll(()=>v.evaluate(el=>el.currentTime)).toBeGreaterThan(0);
 await page.locator('#closePreview').click();const promise=page.waitForEvent('download');await page.locator('#exportBtn').click();const dl=await promise;let html='';for await(const c of await dl.createReadStream())html+=c;expect(html).toContain('data:video/webm;base64,');
});
test('document load handlers remain inactive during editing and survive export',async({page,context})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'load.html',mimeType:'text/html',buffer:Buffer.from('<body onload="document.body.dataset.loaded=\'yes\'"><h1>로드 이벤트</h1></body>')});
 await expect(page.frameLocator('#canvas').locator('h1')).toHaveText('로드 이벤트');
 expect(await page.frameLocator('#canvas').locator('body').getAttribute('data-loaded')).toBeNull();
 const promise=page.waitForEvent('download');await page.locator('#exportBtn').click();const dl=await promise;let html='';for await(const c of await dl.createReadStream())html+=c;
 const preview=await context.newPage();await preview.setContent(html);await expect(preview.frameLocator('#deck iframe').locator('body')).toHaveAttribute('data-loaded','yes');
});
