import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
const fixture='C:/Users/ssarm/Documents/Spec에서 Wiki까지.html';

async function load(page){await page.goto('/');await page.locator('#projectFile').setInputFiles(fixture);await expect(page.locator('.slide-item')).toHaveCount(41,{timeout:120000});await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);}

test('actual 41-page React deck: source-bound text survives original runtime navigation and export',async({page})=>{
 test.skip(!existsSync(fixture),'User fixture unavailable');test.setTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.locator('#projectFile').setInputFiles(fixture);
 await expect(page.locator('.slide-item')).toHaveCount(41,{timeout:120000});
 await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
 const f=page.frameLocator('#canvas');const title=f.locator('h1,h2').first();
 await expect(title).toBeVisible();await title.dblclick();
 await expect(f.locator('[contenteditable=true]')).toHaveCount(1);
 const changed='사람이 고친 제목 "인용" & <b>글자</b> ${값} `테스트`';
 await f.locator('[contenteditable=true]').fill(changed);await page.locator('#finishTextBtn').click();
 await page.locator('.slide-item').nth(1).click();await page.locator('.slide-item').first().click();await expect(title).toHaveText(changed);
 await page.locator('#previewBtn').click();
 const live=page.frameLocator('#previewFrame');await expect(live.locator('.stage h1,.stage h2').first()).toHaveText(changed,{timeout:20000});
 await live.locator('#next').click();await expect(live.locator('.count')).toHaveText('2 / 41');await live.locator('#prev').click();
 await expect(live.locator('.stage h1,.stage h2').first()).toHaveText(changed);
 expect(await live.locator('.stage').evaluate(el=>el.getAnimations({subtree:true}).length)).toBeGreaterThan(0);
 await page.locator('#closePreview').click();
 const download=page.waitForEvent('download');await page.locator('#exportBtn').click();let html='';for await(const chunk of await (await download).createReadStream())html+=chunk;
 const standalone=await page.context().newPage();await standalone.setContent(html);
 await expect(standalone.locator('.stage h1,.stage h2').first()).toHaveText(changed,{timeout:20000});
 await standalone.locator('#next').click();await expect(standalone.locator('.count')).toHaveText('2 / 41');await standalone.locator('#prev').click();
 await expect(standalone.locator('.stage h1,.stage h2').first()).toHaveText(changed);await standalone.close();
 await page.locator('#projectFile').setInputFiles({name:'edited.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.slide-item')).toHaveCount(41);await expect(title).toHaveText(changed);
 expect(errors).toEqual([]);
});

test('runtime imports allow only text content and shape movement/resizing, with geometry surviving playback',async({page})=>{
 test.skip(!existsSync(fixture));test.setTimeout(180000);await load(page);
 const f=page.frameLocator('#canvas');
 for(const id of ['duplicateBtn','deleteBtn','imageBtn','videoBtn','tableBtn','fontSize','colorInput','addSlide','removeSlide'])await expect(page.locator('#'+id)).toBeDisabled();
 const heading=f.locator('h1');await heading.click();await expect(page.locator('#propX')).toBeDisabled();await expect(page.locator('#resizeHandle')).toBeHidden();
 await heading.press('Delete');await expect(heading).toHaveCount(1);await heading.press('Control+d');await expect(f.locator('h1')).toHaveCount(1);
 const shape=f.locator('svg[data-sr-geometry]').first();await expect(shape).toBeVisible();await shape.click({position:{x:20,y:20}});
 await expect(page.locator('#propX')).toBeEnabled();
 const initial=await shape.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,path:el.dataset.srGeometry};});
 await page.locator('#propX').fill(String(Math.round(initial.x)+40));await page.locator('#propX').press('Enter');
 await page.locator('#propW').fill(String(Math.round(initial.width*.8)));await page.locator('#propW').press('Enter');
 const edited=await shape.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
 expect(edited.x-initial.x).toBeCloseTo(40,0);expect(edited.width).toBeCloseTo(Math.round(initial.width*.8),0);
 await page.locator('#previewBtn').click();const live=page.frameLocator('#previewFrame');
 await expect(live.locator('.stage svg').first()).toBeVisible();
 const expected=await live.locator('.stage>'+initial.path).evaluate(el=>({translate:getComputedStyle(el).translate,width:parseFloat(getComputedStyle(el).width)}));
 expect(expected.translate).not.toBe('none');expect(expected.width).toBeCloseTo(edited.width,0);
 await live.locator('#next').click();await live.locator('#prev').click();
 expect(await live.locator('.stage>'+initial.path).evaluate(el=>parseFloat(getComputedStyle(el).width))).toBeCloseTo(edited.width,0);
 await page.locator('#closePreview').click();await page.locator('#undoBtn').click();
 expect(await shape.evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(initial.width,0);
 await page.locator('#redoBtn').click();expect(await shape.evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(edited.width,0);
});

test('all 41 headings remain source-editable and changes apply to the correct original page',async({page})=>{
 test.skip(!existsSync(fixture));test.setTimeout(180000);await load(page);
 const f=page.frameLocator('#canvas');
 for(let i=0;i<41;i++){
  await page.locator('.slide-item').nth(i).click();await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
  const heading=f.locator('h1,h2').first();await expect(heading).toHaveAttribute('data-sr-source',/s\d+/);
  await heading.dblclick();await f.locator('[contenteditable=true]').fill(`검증 ${i+1} · 수정한 제목`);await page.locator('#finishTextBtn').click();
 }
 await page.locator('#previewBtn').click();const live=page.frameLocator('#previewFrame');
 for(let i=0;i<41;i++){
  await expect(live.locator('.stage h1,.stage h2').first()).toHaveText(`검증 ${i+1} · 수정한 제목`);
  if(i<40)await live.locator('#next').click();
 }
 await expect(live.locator('#next')).toBeDisabled();
});
