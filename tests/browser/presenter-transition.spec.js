import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
const fixture='C:/Users/ssarm/Documents/Spec에서 Wiki까지.html';
test('runtime presenter keeps the full deck counter and the same document while navigating',async({page})=>{
 test.skip(!existsSync(fixture));test.setTimeout(180000);
 await page.goto('/');await page.locator('#projectFile').setInputFiles(fixture);await expect(page.locator('.slide-item')).toHaveCount(41,{timeout:60000});
 await page.locator('.slide-item').nth(27).click();await page.locator('#presenterBtn').click();
 const current=page.frameLocator('#presenterCurrent');await expect(current.locator('.count')).toHaveText('28 / 41',{timeout:30000});
 await expect(current.locator('.pageno')).toHaveText('28 / 41');
 const identity=await current.locator('body').evaluate(el=>{el.dataset.testIdentity='unchanged';return el.dataset.testIdentity;});
 await current.locator('#next').click();await expect(page.locator('#presenterCounter')).toHaveText('29 / 41');await expect(current.locator('.count')).toHaveText('29 / 41');
 await expect(current.locator('body')).toHaveAttribute('data-test-identity',identity);
 const opened=page.waitForEvent('popup');await page.locator('#audienceBtn').click();const popup=await opened;
 const audience=popup.frameLocator('iframe:not([data-pending])');await expect(audience.locator('.count')).toHaveText('29 / 41',{timeout:30000});
 await audience.locator('body').press('ArrowLeft');await expect(current.locator('.count')).toHaveText('28 / 41');await expect(audience.locator('.count')).toHaveText('28 / 41');
 await audience.locator('body').press('ArrowRight');await expect(audience.locator('.count')).toHaveText('29 / 41');
 await page.locator('#presenterNext').click({clickCount:3});await expect(current.locator('.count')).toHaveText('32 / 41');await expect(audience.locator('.count')).toHaveText('32 / 41');
 await expect(current.locator('body')).toHaveAttribute('data-test-identity',identity);
 await page.screenshot({path:'validation/presenter-runtime-counter.png'});
 await page.locator('[data-close=presenterDialog]').click();await expect.poll(()=>popup.isClosed()).toBe(true);
});
test('presentation keeps the painted slide while the next document loads, including audience keyboard navigation',async({page,context})=>{
 let release;const gate=new Promise(r=>release=r);let requests=0;
 await context.route('**/delayed-slide.js',async route=>{requests++;await gate;await route.fulfill({contentType:'text/javascript',body:'document.body.dataset.loaded="yes";'});});
 await page.goto('/');
 const html='<html><body><section class="slide" style="background:#123;color:white;height:720px"><h1>First slide</h1></section><section class="slide" style="background:#234;color:white;height:720px"><h1>Second slide</h1></section></body></html>';
 await page.locator('#projectFile').setInputFiles({name:'deck.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.slide-item')).toHaveCount(2);
 // Delay only the presentation document, without delaying the editor import.
 await page.evaluate(async()=>{const {editor}=await import('/app.js');const original=editor.presentationPage;editor.presentationPage=i=>original(i)+(i===1?'<script src="http://127.0.0.1:4175/delayed-slide.js"></script>':'');});
 await page.locator('#presenterBtn').click();await expect(page.frameLocator('#presenterCurrent').locator('h1')).toHaveText('First slide');
 const opened=page.waitForEvent('popup');await page.locator('#audienceBtn').click();const popup=await opened;
 await expect(popup.frameLocator('iframe:not([data-pending])').locator('h1')).toHaveText('First slide');
 await popup.frameLocator('iframe:not([data-pending])').locator('body').press('ArrowRight');
 await expect.poll(()=>requests).toBeGreaterThan(0);
 await expect(page.frameLocator('#presenterCurrent').locator('h1')).toHaveText('First slide');
 await expect(popup.frameLocator('iframe:not([data-pending])').locator('h1')).toHaveText('First slide');
 // A quick reversal must cancel the stale, still-loading second page.
 await popup.frameLocator('iframe:not([data-pending])').locator('body').press('ArrowLeft');
 await expect(page.locator('#presenterCounter')).toHaveText('1 / 2');
 await expect(page.locator('.presenter-canvas [data-pending]')).toHaveCount(0);
 await popup.frameLocator('iframe:not([data-pending])').locator('body').press('ArrowRight');
 await expect(page.locator('#presenterCounter')).toHaveText('2 / 2');
 release();
 await expect(page.frameLocator('#presenterCurrent').locator('h1')).toHaveText('Second slide');
 await expect(popup.frameLocator('iframe:not([data-pending])').locator('h1')).toHaveText('Second slide');
 await page.locator('[data-close=presenterDialog]').click();await expect.poll(()=>popup.isClosed()).toBe(true);
});
