import {test,expect} from '@playwright/test';
test('text styles apply size and weight, undo and persist',async({page})=>{
 await page.goto('/');await page.locator('[data-add=text]').click();
 const text=page.frameLocator('#canvas').locator('[data-kind=text]').last();
 for(const [role,size,weight] of [['chapter','48','700'],['section','36','700'],['body','24','400']]){
  await page.locator('#textRole').selectOption(role);
  await expect(text).toHaveCSS('font-size',size+'px');await expect(text).toHaveCSS('font-weight',weight);
  await expect(page.locator('#fontSize')).toHaveValue(size);await expect(page.locator('#boldBtn')).toHaveAttribute('aria-pressed',String(weight==='700'));
 }
 await page.locator('#undoBtn').click();await expect(text).toHaveCSS('font-size','36px');await expect(text).toHaveCSS('font-weight','700');
 await page.locator('#redoBtn').click();await expect(text).toHaveCSS('font-size','24px');await expect(text).toHaveCSS('font-weight','400');
 await page.reload();await expect(text).toHaveCSS('font-size','24px');await expect(text).toHaveCSS('font-weight','400');await expect(text).toHaveAttribute('data-sr-role','body');
});
