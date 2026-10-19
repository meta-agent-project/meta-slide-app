import {test,expect} from '@playwright/test';
async function load(page,transform=''){
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'shape.html',mimeType:'text/html',buffer:Buffer.from(`<html><body style="margin:0"><div style="${transform}"><div id="shape" data-kind="rect" style="position:absolute;left:400px;top:250px;width:320px;height:160px;box-sizing:border-box;border:1px solid black;background:white"></div></div></body></html>`)});
 const shape=page.frameLocator('#canvas').locator('#shape');await shape.click();return shape;
}
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
async function angle(page,n){await page.locator('#rotationAngle').fill(String(n));await page.locator('#rotationAngle').press('Tab');}
async function geometry(page){return page.evaluate(async()=>{const {objectGeometry}=await import('/src/rotation.js');return objectGeometry(document.querySelector('#canvas').contentDocument.querySelector('#shape'));});}
test('rotation keeps center and local dimensions; outline follows shape at 45, 90 and 180 degrees',async({page})=>{
 const shape=await load(page),original=center(await shape.boundingBox());
 for(const n of [45,90,180,0]){
  await angle(page,n);const g=await geometry(page),r=await shape.boundingBox(),box=await page.locator('#selectionBox').boundingBox();
  expect(center(r).x).toBeCloseTo(original.x,1);expect(center(r).y).toBeCloseTo(original.y,1);
  expect(g.width).toBe(320);expect(g.height).toBe(160);
  expect(box.x).toBeCloseTo(r.x,1);expect(box.y).toBeCloseTo(r.y,1);expect(box.width).toBeCloseTo(r.width,1);expect(box.height).toBeCloseTo(r.height,1);
  const m=await page.locator('#selectionBox').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {a:m.a,b:m.b};});expect(m.a).toBeCloseTo(Math.cos(n*Math.PI/180),5);expect(m.b).toBeCloseTo(Math.sin(n*Math.PI/180),5);if(n===45)await page.screenshot({path:'validation/oriented-rotation-45.png'});
 }
});
test('pointer rotation follows a fixed circular path and returns to the starting angle',async({page})=>{
 const shape=await load(page),c=center(await shape.boundingBox()),h=center(await page.locator('#rotationHandle').boundingBox()),vx=h.x-c.x,vy=h.y-c.y;
 await page.mouse.move(h.x,h.y);await page.mouse.down();
 for(const n of [45,90,180,90,0]){const rad=n*Math.PI/180;await page.mouse.move(c.x+vx*Math.cos(rad)-vy*Math.sin(rad),c.y+vx*Math.sin(rad)+vy*Math.cos(rad),{steps:8});await expect(page.locator('#selectionBox')).toHaveCSS('border-top-style','dashed');expect(parseFloat(await shape.evaluate(el=>getComputedStyle(el).rotate))).toBeCloseTo(n,0);const now=center(await page.locator('#rotationHandle').boundingBox());expect(now.x).toBeCloseTo(c.x+vx*Math.cos(rad)-vy*Math.sin(rad),0);expect(now.y).toBeCloseTo(c.y+vx*Math.sin(rad)+vy*Math.cos(rad),0);}
 await page.mouse.up();await expect(page.locator('#selectionBox')).toHaveCSS('border-top-style','solid');
});
test('rotated resize follows local axis and keeps opposite edge fixed, including transformed parents',async({page})=>{
 for(const parent of ['', 'transform:translate(60px,20px) rotate(12deg) scale(.8);transform-origin:0 0;width:1280px;height:720px']){
  const shape=await load(page,parent);await angle(page,45);const before=await geometry(page),h=center(await page.locator('.handle-e').boundingBox()),scale=await page.locator('#canvas').evaluate(el=>el.getBoundingClientRect().width/1280);
  await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+before.a*80*scale,h.y+before.b*80*scale,{steps:8});await page.mouse.up();const after=await geometry(page);
  expect(after.width-before.width).toBeCloseTo(80,0);expect(after.height).toBeCloseTo(before.height,1);expect(after.x).toBeCloseTo(before.x,1);expect(after.y).toBeCloseTo(before.y,1);
  await page.reload();await expect(shape).toHaveCSS('rotate','45deg');expect((await geometry(page)).width).toBeCloseTo(after.width,1);
 }
});

test('Escape cancels rotation without saving a changed angle',async({page})=>{
 const shape=await load(page);await angle(page,30);const before=await shape.boundingBox(),h=center(await page.locator('#rotationHandle').boundingBox());
 await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+80,h.y+90,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
 await expect(shape).toHaveCSS('rotate','30deg');await expect(page.locator('#selectionBox')).toHaveCSS('border-top-style','solid');const after=await shape.boundingBox();expect(after.x).toBeCloseTo(before.x,1);expect(after.y).toBeCloseTo(before.y,1);
 await page.reload();await expect(shape).toHaveCSS('rotate','30deg');
});
