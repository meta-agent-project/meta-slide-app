import {test,expect} from '@playwright/test';

for(const kind of ['paragraph','nested','table'])test(`double click places caret at clicked text: ${kind}`,async({page})=>{
 await page.goto('/');
 const content=kind==='table'?'<table><tr><td id="target">ABCDEFGHIJKLMN</td></tr></table>':kind==='nested'?'<p>첫 줄<br><strong id="target">ABCDEFGHIJKLMN</strong></p>':'<p id="target">ABCDEFGHIJKLMN</p>';
 await page.locator('#projectFile').setInputFiles({name:'caret.html',mimeType:'text/html',buffer:Buffer.from(`<section class="slide" style="width:1280px;height:720px;padding:80px;box-sizing:border-box;font:40px monospace">${content}</section>`)});
 if(kind==='nested')await page.locator('#zoomOut').click();
 const target=page.frameLocator('#canvas').locator('#target');
 await expect(target).toBeVisible();
 const point=await target.evaluate(el=>{
  const r=el.ownerDocument.createRange();r.setStart(el.firstChild,8);r.setEnd(el.firstChild,9);
  const rect=r.getBoundingClientRect();return {x:rect.x+rect.width*.15,y:rect.y+rect.height/2};
 });
 const frame=await page.locator('#canvas').boundingBox();
 const width=await page.locator('#canvas').evaluate(el=>el.clientWidth);
 await page.mouse.dblclick(frame.x+point.x*frame.width/width,frame.y+point.y*frame.width/width);
 await page.keyboard.type('X');
 await expect(target).toHaveText('ABCDEFGHXIJKLMN');
});
