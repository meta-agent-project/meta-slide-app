import {test,expect} from '@playwright/test';
test('root grid layout stays intact and dragging uses slide coordinates at reduced zoom',async({page})=>{
 await page.goto('/');
 const html='<style>body{margin:0}.slide{width:1280px;height:720px;display:grid;grid-template-columns:600px 600px;gap:20px}h1{margin:0}</style><section class="slide"><h1>첫 번째 열</h1><div id="box" style="width:150px;height:150px;background:red">두 번째 열</div></section>';
 await page.locator('#projectFile').setInputFiles({name:'grid.html',mimeType:'text/html',buffer:Buffer.from(html)});
 const f=page.frameLocator('#canvas');await expect(f.locator('.slide')).toHaveCSS('display','grid');
 const el=f.locator('#box'),before=await el.evaluate(e=>e.getBoundingClientRect().x),bounds=await el.boundingBox();
 const scale=await page.locator('#stage').evaluate(e=>e.getBoundingClientRect().width/1280);
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+60,bounds.y+bounds.height/2+30,{steps:5});await page.mouse.up();
 expect(Math.abs((await el.evaluate(e=>e.getBoundingClientRect().x))-before-60/scale)).toBeLessThan(3);
 const oldWidth=await el.evaluate(e=>e.getBoundingClientRect().width);const handle=await page.locator('#resizeHandle').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+30,handle.y+handle.height/2+15,{steps:5});await page.mouse.up();
 expect(await el.evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(oldWidth+20);
});
test('asset folder resolves relative image and stylesheet references into portable data',async({page})=>{
 await page.goto('/');
 await page.locator('#projectFile').setInputFiles({name:'external.html',mimeType:'text/html',buffer:Buffer.from('<link rel="stylesheet" href="theme.css"><h1>에셋 연결</h1><img src="photo.svg" width="400" height="200">')});
 await page.locator('#assetFiles').setInputFiles([{name:'theme.css',mimeType:'text/css',buffer:Buffer.from('h1 { color: rgb(10, 80, 100); }')},{name:'photo.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="teal"/></svg>')}]);
 const f=page.frameLocator('#canvas');await expect(f.locator('h1')).toHaveCSS('color','rgb(10, 80, 100)');await expect(f.locator('img')).toHaveAttribute('src',/^data:/);
 expect(await f.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
});
test('iframe editor does not run event attributes and preview cannot access parent DOM',async({page})=>{
 await page.goto('/');
 await page.locator('#projectFile').setInputFiles({name:'scripts.html',mimeType:'text/html',buffer:Buffer.from('<h1 onclick="parent.document.body.dataset.compromised=1">제목</h1><script>try { parent.document.body.dataset.compromised=1 } catch(e) { document.body.dataset.isolated="yes" }</script>')});
 await page.frameLocator('#canvas').locator('h1').click();expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();
 await page.locator('#previewBtn').click();
 const content=page.frameLocator('#previewFrame').frameLocator('#deck iframe');
 await expect(content.locator('body')).toHaveAttribute('data-isolated','yes');expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();
});
test('1920 by 1080 slides fit the canvas without losing visual edit coordinates',async({page})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'large.html',mimeType:'text/html',buffer:Buffer.from('<style>body{margin:0}.slide{position:relative;width:1920px;height:1080px;background:beige}</style><section class="slide"><h1 style="position:absolute;left:150px;top:150px;width:600px;height:100px;margin:0">큰 슬라이드</h1></section>')});
 const f=page.frameLocator('#canvas');const bounds=await f.locator('.slide').evaluate(e=>e.getBoundingClientRect().toJSON());expect(Math.round(bounds.width)).toBe(1280);expect(Math.round(bounds.height)).toBe(720);
 await f.locator('h1').click();await page.locator('#propX').fill('200');await page.locator('#propX').press('Enter');expect(Math.round(await f.locator('h1').evaluate(e=>e.getBoundingClientRect().x))).toBe(200);
 await page.locator('#propW').fill('500');await page.locator('#propW').press('Enter');expect(Math.round(await f.locator('h1').evaluate(e=>e.getBoundingClientRect().width))).toBe(500);
});
