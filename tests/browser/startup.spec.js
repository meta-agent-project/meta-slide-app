import {test,expect} from '@playwright/test';

test('a transient local module download failure recovers without an inert editor',async({page})=>{
 let requests=0;
 await page.route('**/src/vendor/acorn.js',route=>++requests===1?route.abort('failed'):route.continue());
 await page.goto('/');
 await expect(page.locator('.slide-item')).toHaveCount(1,{timeout:15000});
 await expect(page.locator('#canvas')).toBeVisible();
 expect(requests).toBe(2);
});

test('a persistent module failure shows recovery and does not reload forever',async({page})=>{
 let requests=0;
 await page.route('**/src/vendor/acorn.js',route=>{requests++;return route.abort('failed');});
 await page.goto('/');
 await expect(page.locator('#startupError')).toBeVisible({timeout:15000});
 await expect(page.locator('#startupRetry')).toBeVisible();
 expect(requests).toBe(2);
 await page.unroute('**/src/vendor/acorn.js');
 await page.locator('#startupRetry').click();
 await expect(page.locator('.slide-item')).toHaveCount(1);
});
