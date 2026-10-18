import {test,expect} from '@playwright/test';
test('marquee selects two objects, moves them together, and undoes in one step',async({page})=>{
 await page.goto('/');
 await page.locator('#projectFile').setInputFiles({name:'objects.html',mimeType:'text/html',buffer:Buffer.from('<html><body style="margin:0"><div data-kind="rect" id="a" style="position:absolute;left:100px;top:100px;width:80px;height:80px;background:red"></div><div data-kind="rect" id="b" style="position:absolute;left:230px;top:100px;width:80px;height:80px;background:blue"></div></body></html>')});
 const canvas=page.frameLocator('#canvas');await expect(canvas.locator('#a')).toBeVisible();
 const rect=await page.locator('#canvas').boundingBox(),scale=rect.width/1280;
 const point=(x,y)=>({x:rect.x+x*scale,y:rect.y+y*scale});
 let p=point(60,60);await page.mouse.move(p.x,p.y);await page.mouse.down();p=point(350,210);await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.up();
 await expect(page.locator('#selectionName')).toHaveText('2개 선택');
 const a=await canvas.locator('#a').boundingBox(),b=await canvas.locator('#b').boundingBox();
 await page.locator('#objectBadge').hover();await page.mouse.down();await page.mouse.move(a.x+100,a.y+100,{steps:8});await page.mouse.up();
 const movedA=await canvas.locator('#a').boundingBox(),movedB=await canvas.locator('#b').boundingBox();
 expect(Math.abs(movedA.x-a.x)).toBeGreaterThan(10);expect(movedB.x-b.x).toBeCloseTo(movedA.x-a.x,0);
 await page.locator('#undoBtn').click();expect((await canvas.locator('#a').boundingBox()).x).toBeCloseTo(a.x,0);expect((await canvas.locator('#b').boundingBox()).x).toBeCloseTo(b.x,0);
});
test('sidebar copy pastes immediately after the chosen destination, with independent content',async({page})=>{
 await page.goto('/');await expect(page.locator('.slide-item')).toHaveCount(1);
 await page.locator('.slide-item').first().click();await page.keyboard.press('Control+c');
 await page.locator('#addSlide').click();await page.locator('.slide-item').nth(1).click();await page.keyboard.press('Control+v');
 await expect(page.locator('.slide-item')).toHaveCount(3);await expect(page.locator('.slide-item').nth(2)).toHaveClass(/active/);
 const f=page.frameLocator('#canvas');await f.locator('h1').dblclick();await f.locator('[contenteditable=true]').fill('복사본 제목');await page.locator('#finishTextBtn').click();
 await page.locator('.slide-item').first().click();await expect(f.locator('h1')).not.toHaveText('복사본 제목');
});
