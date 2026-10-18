import {test,expect} from '@playwright/test';
test('new project is undoable and slide ordering retains the right page',async({page})=>{
 await page.goto('/');await page.locator('#fileMenu summary').click();await page.locator('#newBtn').click();
 await expect(page.locator('.slide-item')).toHaveCount(1);await expect(page.frameLocator('#canvas').locator('[data-sr-id]')).toHaveCount(0);
 await page.locator('#undoBtn').click();await expect(page.frameLocator('#canvas').locator('h1')).toContainText('아이디어');
 await page.locator('#addSlide').click();await page.locator('[data-add="text"]').click();
 await page.locator('#slideUp').click();await expect(page.frameLocator('#canvas').locator('[data-kind="text"]')).toHaveCount(1);
 await page.locator('.slide-item').nth(1).click();await expect(page.frameLocator('#canvas').locator('h1')).toContainText('아이디어');
});
test('styles, shapes and replacing images persist through undo redo',async({page})=>{
 await page.goto('/');await page.locator('#shapeSelect').selectOption('arrow');
 const f=page.frameLocator('#canvas');await expect(f.locator('[data-kind=arrow]')).toHaveCount(1);
 await page.locator('#colorInput').fill('#112233');await page.locator('#colorInput').dispatchEvent('change');await expect(f.locator('[data-kind=arrow]')).toHaveCSS('background-color','rgb(17, 34, 51)');
 await page.locator('#undoBtn').click();await expect(f.locator('[data-kind=arrow]')).not.toHaveCSS('background-color','rgb(17, 34, 51)');
 await page.locator('#redoBtn').click();await expect(f.locator('[data-kind=arrow]')).toHaveCSS('background-color','rgb(17, 34, 51)');
 const img=color=>({name:'image.svg',mimeType:'image/svg+xml',buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="${color}"/></svg>`)});
 await page.locator('#imageFile').setInputFiles(img('red'));
 await page.locator('#imageFile').evaluate(el=>el.dataset.replace='true');await page.locator('#imageFile').setInputFiles(img('blue'));await expect(f.locator('img')).toHaveCount(1);await expect.poll(async()=>Buffer.from((await f.locator('img').getAttribute('src')).split(',')[1],'base64').toString()).toContain('fill="blue"');
});
test('autosave failure is visible and does not prevent file download',async({page})=>{
 await page.addInitScript(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
 await page.goto('/');await page.locator('[data-add="text"]').click();await expect(page.locator('#saveState')).toContainText('저장 실패');
 const promise=page.waitForEvent('download');await page.locator('#fileMenu summary').click();await page.locator('#saveBtn').click();const dl=await promise;expect(dl.suggestedFilename()).toMatch(/\.slide\.json$/);
});
test('external identifiers are normalized for safe selection',async({page})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'ids.html',mimeType:'text/html',buffer:Buffer.from('<h1 data-sr-id="bad&quot;value">선택 가능</h1><p data-sr-id="same">첫째</p><p data-sr-id="same">둘째</p>')});
 const f=page.frameLocator('#canvas');await f.locator('h1').click();await page.locator('#propX').fill('80');await page.locator('#propX').press('Enter');
 const ids=await f.locator('[data-sr-id]').evaluateAll(els=>els.map(e=>e.dataset.srId));expect(new Set(ids).size).toBe(ids.length);expect(ids.every(id=>/^[a-zA-Z0-9_-]+$/.test(id))).toBeTruthy();
});
test('moving an element inside scaled and rotated content uses visual coordinates',async({page})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'transforms.html',mimeType:'text/html',buffer:Buffer.from('<div style="position:absolute;left:300px;top:180px;transform:scale(.6) rotate(12deg)"><p id="target" style="translate:50% 20%;width:200px;height:100px;background:tan">복합 변환</p></div>')});
 const target=page.frameLocator('#canvas').locator('#target');await target.click();
 await page.locator('#propX').fill('500');await page.locator('#propX').press('Enter');
 expect(Math.abs((await target.evaluate(e=>e.getBoundingClientRect().x))-500)).toBeLessThan(1);
});
