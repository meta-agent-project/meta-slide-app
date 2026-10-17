import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
const fixture='C:/Users/ssarm/Documents/Spec에서 Wiki까지.html';

test('source import failure leaves the existing project intact and removes analysis frames',async({page})=>{
 test.skip(!existsSync(fixture));test.setTimeout(45000);await page.goto('/');
 const title=await page.frameLocator('#canvas').locator('h1').textContent();
 const html=readFileSync(fixture,'utf8').replace('const SLIDES = [','throw Error("test load failure"); const SLIDES = [');
 await page.locator('#projectFile').setInputFiles({name:'broken.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('#toast')).toContainText('불러오기 실패',{timeout:35000});
 await expect(page.locator('.slide-item')).toHaveCount(1);await expect(page.frameLocator('#canvas').locator('h1')).toHaveText(title);
 await expect(page.locator('iframe[title="원본 슬라이드 분석"]')).toHaveCount(0);await expect(page.locator('#openBtn')).toBeEnabled();
});

test('unchanged runtime export keeps the original script, and failed patches are rejected',async({page})=>{
 test.skip(!existsSync(fixture));test.setTimeout(120000);await page.goto('/');await page.locator('#projectFile').setInputFiles(fixture);await expect(page.locator('.slide-item')).toHaveCount(41,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const {editor}=await import('/app.js'),{exportHTML}=await import('/src/document.js');const p=editor.project;
  const d=new DOMParser().parseFromString(exportHTML(p),'text/html'),original=new DOMParser().parseFromString(p.runtime.source,'text/html');
  const unchanged=d.querySelectorAll('script')[p.runtime.scriptIndex].textContent===original.querySelectorAll('script')[p.runtime.scriptIndex].textContent;
  const copy=structuredClone(p),id=Object.keys(copy.runtime.bindings)[0];copy.runtime.bindings[id].original='wrong source';copy.runtime.edits[id]='test';
  let rejected=false;try{exportHTML(copy);}catch{rejected=true;}return {unchanged,rejected,edits:Object.keys(p.runtime.edits).length};
 });
 expect(result).toEqual({unchanged:true,rejected:true,edits:0});
});

test('direct DOM-only text changes disappear on React remount: rejected strategy evidence',async({page})=>{
 test.skip(!existsSync(fixture));await page.setContent(readFileSync(fixture,'utf8'));await expect(page.locator('.stage h1')).toBeVisible();
 const original=await page.locator('h1').textContent();await page.locator('h1').evaluate(el=>el.textContent='DOM-only temporary edit');
 await page.locator('#next').click();await expect(page.locator('.count')).toHaveText('2 / 41');await page.locator('#prev').click();
 await expect(page.locator('h1')).toHaveText(original);
});
