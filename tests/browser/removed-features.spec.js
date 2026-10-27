import {test,expect} from '@playwright/test';
test('temporary running assets and video insertion are removed without breaking other tools',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('#tableBtn')).toBeVisible();await expect(page.locator('#videoBtn,#videoFile,#videoProps,#replaceVideo')).toHaveCount(0);
 await page.locator('#clipartBtn').click();await expect(page.locator('#clipartCategories')).not.toContainText('러닝');
 await page.locator('#clipartSearch').fill('부산');await expect(page.locator('.asset-card')).toHaveCount(0);
 await page.locator('#clipartSearch').fill('');await expect(page.locator('.asset-card').first()).toBeVisible();await page.locator('#closeClipart').click();
 await page.locator('#tableBtn').click();await expect(page.frameLocator('#canvas').locator('table')).toHaveCount(1);
 await page.locator('#imageFile').setInputFiles({name:'picture.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>')});
 await expect(page.frameLocator('#canvas').locator('img')).toHaveCount(1);await expect(page.locator('#imageProps')).toBeVisible();
 await page.reload();await expect(page.locator('#videoBtn,#videoFile')).toHaveCount(0);await expect(page.frameLocator('#canvas').locator('img')).toHaveCount(1);expect(errors).toEqual([]);
});
