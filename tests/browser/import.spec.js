import { test, expect } from '@playwright/test';
const html=`<!doctype html><html><head><style>body{margin:0}.slide{width:1280px;height:720px;background:#eee;padding:40px;box-sizing:border-box}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}h1{font:48px sans-serif;color:rgb(20, 60, 90)}.card{padding:30px;background:white}</style></head><body><section class="slide"><h1>원래 제목</h1><div class="grid"><div class="card"><p>한국어 본문</p></div><svg width="150" height="100"><rect width="150" height="100" fill="orange"/></svg></div></section><section class="slide"><h1>두 번째</h1></section><script>localStorage.setItem('unsafe','yes')</script></body></html>`;

test('imports freeform HTML with layout, selects nested content and moves opaque SVG', async ({page}) => {
 await page.goto('/');
 await page.locator('#projectFile').setInputFiles({name:'lecture.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.slide-item')).toHaveCount(2);
 const frame=page.frameLocator('#canvas');
 await expect(frame.locator('h1')).toHaveText('원래 제목');
 await expect(frame.locator('h1')).toHaveCSS('color','rgb(20, 60, 90)');
 await expect(frame.locator('.grid')).toHaveCSS('display','grid');
 expect(await page.evaluate(()=>localStorage.getItem('unsafe'))).toBeNull();
 await frame.locator('svg').click();
 await expect(page.locator('#selectionName')).toContainText('SVG');
 await page.locator('#propX').fill('400'); await page.locator('#propX').press('Enter');
 const x=await frame.locator('svg').evaluate(el=>el.getBoundingClientRect().x);
 expect(Math.round(x)).toBe(400);
 await page.locator('#undoBtn').click();
 expect(Math.round(await frame.locator('svg').evaluate(el=>el.getBoundingClientRect().x))).not.toBe(400);
});

test('inline text edit, adding shapes, history and slide operations', async ({page}) => {
 await page.goto('/');
 await page.locator('[data-add="text"]').click();
 const frame=page.frameLocator('#canvas');
 await frame.locator('[data-kind="text"]').last().dblclick();
 await frame.locator('[contenteditable="true"]').fill('사람이 완성한 강의');
 await page.locator('#selectionName').click();
 await expect(frame.locator('[data-kind="text"]').last()).toHaveText('사람이 완성한 강의');
 await page.locator('[data-add="rect"]').click();
 await expect(frame.locator('[data-kind="rect"]')).toHaveCount(1);
 await page.locator('#duplicateBtn').click();
 await expect(frame.locator('[data-kind="rect"]')).toHaveCount(2);
 await page.locator('#undoBtn').click();
 await expect(frame.locator('[data-kind="rect"]')).toHaveCount(1);
 await page.locator('#addSlide').click();
 await expect(page.locator('.slide-item')).toHaveCount(2);
 await page.locator('#removeSlide').click();
 await expect(page.locator('.slide-item')).toHaveCount(1);
});
