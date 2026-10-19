import {test,expect} from '@playwright/test';
test('new page and direct shape dragging persist',async({page})=>{
 await page.goto('/');await page.locator('#fileMenu summary').click();await page.locator('#newBtn').click();
 const f=page.frameLocator('#canvas');await expect(f.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.locator('[data-add=rect]').click();const shape=f.locator('[data-kind=rect]');await shape.click();
 const before=await shape.boundingBox();const handle=await page.locator('#rotationHandle').boundingBox();expect(handle.x+handle.width/2).toBeGreaterThan(before.x+before.width-3);expect(handle.y+handle.height/2).toBeLessThan(before.y);const x=before.x+before.width/2,y=before.y+before.height/2;
 await page.keyboard.down('Alt');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+90,y+60,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
 const after=await shape.boundingBox();expect(after.x-before.x).toBeCloseTo(90,0);expect(after.y-before.y).toBeCloseTo(60,0);
 await page.reload();await expect(shape).toBeVisible();const restored=await shape.boundingBox();expect(restored.x).toBeCloseTo(after.x,0);expect(restored.y).toBeCloseTo(after.y,0);
});
