import {test,expect} from '@playwright/test';

test('text movement shows grab/grabbing and editing has an explicit exit',async({page})=>{
 await page.goto('/');
 const title=page.frameLocator('#canvas').locator('h1');
 await expect(title).toHaveCSS('cursor','grab');
 await title.click();
 const box=await title.boundingBox();
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+60,box.y+40);
 await expect(title).toHaveCSS('cursor','grabbing');await page.mouse.up();
 await expect(title).toHaveCSS('cursor','grab');
 await page.locator('#editTextBtn').click();await expect(title).toHaveAttribute('contenteditable','true');
 await expect(title).toHaveCSS('cursor','text');await expect(page.locator('#interactionHint')).toContainText('편집 중');
 await page.locator('#finishTextBtn').click();await expect(title).not.toHaveAttribute('contenteditable','true');
 await expect(page.locator('#objectBadge')).toHaveCSS('cursor','grab');
 const before=await title.boundingBox(),handle=await page.locator('#objectBadge').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+40,handle.y+handle.height/2+30);await page.mouse.up();
 const after=await title.boundingBox();expect(after.x-before.x).toBeCloseTo(40,0);expect(after.y-before.y).toBeCloseTo(30,0);
});

test('unavailable commands are disabled and alignment reports its state',async({page})=>{
 await page.goto('/');await expect(page.locator('#deleteBtn')).toBeDisabled();await expect(page.locator('#duplicateBtn')).toBeDisabled();
 await expect(page.locator('#removeSlide')).toBeDisabled();
 await page.frameLocator('#canvas').locator('h1').click();await expect(page.locator('#deleteBtn')).toBeEnabled();
 await expect(page.locator('#alignBtn')).toContainText('왼쪽');await page.locator('#alignBtn').click();await expect(page.locator('#alignBtn')).toContainText('가운데');
 await page.locator('#parentBtn').click();await expect(page.locator('#deleteBtn')).toBeDisabled();
});

test('all primary controls fit an 860px app panel',async({page})=>{
 await page.setViewportSize({width:860,height:780});await page.goto('/');await page.locator('[data-add="text"]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(860);
 for(const selector of ['#exportBtn','#deleteBtn','#propW','#fitBtn']){
  const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(860);
 }
 await page.locator('#deleteBtn').click();await page.frameLocator('#canvas').locator('h1').click();
 expect((await page.locator('#objectBadge').boundingBox()).height).toBeGreaterThanOrEqual(29);
 expect((await page.locator('#resizeHandle').boundingBox()).width).toBeGreaterThanOrEqual(21);
 await page.screenshot({path:'validation/ux-editor.png'});
});
