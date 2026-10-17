import {test,expect} from '@playwright/test';

test('editing one slide retains other previews and switching retains every preview',async({page})=>{
 await page.goto('/');
 const html=Array.from({length:30},(_,i)=>`<section class="slide" style="width:1280px;height:720px"><h1>Slide ${i}</h1>${'<p>Lecture text</p>'.repeat(80)}</section>`).join('');
 await page.locator('#projectFile').setInputFiles({name:'large.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.slide-item')).toHaveCount(30);
 const result=await page.evaluate(async()=>{
  const {editor}=await import('/app.js');
  const before=[...document.querySelectorAll('.thumb')];
  let writes=0;const observer=new MutationObserver(records=>writes+=records.filter(r=>r.attributeName==='srcdoc').length);
  observer.observe(document.querySelector('#slides'),{subtree:true,attributes:true});
  const t=performance.now();editor.document.querySelector('h1').textContent='Edited title';editor.commit();
  const elapsed=performance.now()-t;await Promise.resolve();observer.disconnect();
  window.previewRefs=before;
  return {elapsed,retained:before.filter((el,i)=>el===document.querySelectorAll('.thumb')[i]).length,writes};
 });
 console.log('30-slide edit commit:',JSON.stringify(result));
 expect(result.retained).toBe(30);expect(result.writes).toBe(1);
 await page.locator('.slide-item').nth(1).click();
 await expect(page.frameLocator('#canvas').locator('h1')).toHaveText('Slide 1');
 expect(await page.evaluate(()=>window.previewRefs.every((el,i)=>el===document.querySelectorAll('.thumb')[i]))).toBe(true);
 await page.locator('#undoBtn').click();
 await page.locator('.slide-item').first().click();
 await expect(page.frameLocator('#canvas').locator('h1')).toHaveText('Slide 0');
});
