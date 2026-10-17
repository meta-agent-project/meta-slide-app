import {test,expect} from '@playwright/test';
import path from 'node:path';
test('teaching example imports all layouts and passes automated layout checks',async({page})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles(path.resolve('examples/lecture.html'));
 await expect(page.locator('.slide-item')).toHaveCount(5);
 for(let i=0;i<5;i++){
  await page.locator('.slide-item').nth(i).click();
  await expect(page.frameLocator('#canvas').locator('[data-slide]')).toHaveAttribute('data-slide',String(i+1));
  const issues=await page.evaluate(async()=>{const {auditDocument}=await import('/src/audit.js');const doc=document.querySelector('#canvas').contentDocument;await doc.fonts.ready;return auditDocument(doc);});
  expect(issues.filter(x=>x.severity==='error'),JSON.stringify(issues)).toEqual([]);
 }
});
