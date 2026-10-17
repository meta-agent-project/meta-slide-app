import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
const base='C:/workspace/강의준비/AI-Native-강의/02강_하네스_메멘토/';
const lecture=base+'강의슬라이드_하네스_메멘토.html',simulator=base+'시뮬레이터_하네스_메멘토.html';

test('Reveal slides are visible without executing source scripts in the editor',async({page})=>{
 await page.goto('/');
 const html=`<style>.reveal{visibility:hidden}.reveal .slides{position:absolute;left:50%;top:50%;width:960px}.reveal section{display:none}.fragment{opacity:0;visibility:hidden}</style><div class="reveal"><div class="slides"><section><h1>첫 제목</h1><p class="fragment">나중에 나타나는 글</p></section><section><h2>두 번째 제목</h2></section></div></div><script>Reveal.initialize({width:1400,height:880});</script>`;
 await page.locator('#projectFile').setInputFiles({name:'reveal.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.locator('.slide-item')).toHaveCount(2);
 const f=page.frameLocator('#canvas');await expect(f.locator('h1')).toBeVisible();await expect(f.locator('.fragment')).toHaveCSS('opacity','1');
 await f.locator('h1').dblclick();await f.locator('h1').fill('수정한 제목');await page.locator('#finishTextBtn').click();
 await page.locator('#previewBtn').click();await expect(page.frameLocator('#previewFrame').frameLocator('#deck iframe').first().locator('h1')).toHaveText('수정한 제목');
});

test('actual lecture: every slide has visible editable content and survives export',async({page})=>{
 test.skip(!existsSync(lecture),'User-provided fixture is not installed');test.setTimeout(120000);
 await page.goto('/');await page.locator('#projectFile').setInputFiles(lecture);await expect(page.locator('.slide-item')).toHaveCount(15);
 for(let i=0;i<15;i++){
  await page.locator('.slide-item').nth(i).click();const heading=page.frameLocator('#canvas').locator('[data-sr-page] h1,[data-sr-page] h2,[data-sr-page] p').first();
  await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
  await expect(heading).toBeVisible();const b=await heading.boundingBox(),frame=await page.locator('#canvas').boundingBox();
  expect(b.width).toBeGreaterThan(20);expect(b.x).toBeGreaterThanOrEqual(frame.x-1);expect(b.y).toBeGreaterThanOrEqual(frame.y-1);expect(b.y+b.height).toBeLessThan(frame.y+frame.height+1);
  await page.screenshot({path:`validation/runtime/lecture-${i+1}.png`});
 }
 await page.locator('.slide-item').first().click();const heading=page.frameLocator('#canvas').locator('h1').first();await heading.dblclick();await heading.fill('편집한 메멘토 강의');await page.locator('#finishTextBtn').click();
 const download=page.waitForEvent('download');await page.locator('#exportBtn').click();const dl=await download;let html='';for await(const chunk of await dl.createReadStream())html+=chunk;
 await page.locator('#projectFile').setInputFiles({name:'roundtrip.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await expect(page.frameLocator('#canvas').locator('h1').first()).toHaveText('편집한 메멘토 강의');
 await page.locator('#previewBtn').click();await expect(page.frameLocator('#previewFrame').frameLocator('#deck iframe').first().locator('h1').first()).toBeVisible();
});

test('actual simulator: editable descriptions coexist with working isolated interactions',async({page})=>{
 test.skip(!existsSync(simulator),'User-provided fixture is not installed');test.setTimeout(120000);page.setDefaultTimeout(15000);
 await page.goto('/');await page.locator('#projectFile').setInputFiles(simulator);await expect(page.locator('.slide-item')).toHaveCount(5);
 const f=page.frameLocator('#canvas');await expect(f.locator('[data-sr-page] h2')).toBeVisible();
 await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
 await f.locator('[data-sr-page] h2').dblclick();
 await expect(f.locator('[data-sr-page] h2')).toHaveAttribute('contenteditable','true');await f.locator('[contenteditable="true"]').fill('수정한 시뮬레이터 설명');await page.locator('#finishTextBtn').click();
 await expect(f.locator('iframe[data-kind="simulation"]')).toHaveCount(1);
 await page.locator('#runtimeModeBtn').click();const live=page.frameLocator('.runtime-object iframe');
 await live.locator('#p0b1').click();await expect(live.locator('#p0chat')).toContainText('마케팅 전략');await expect(live.locator('#p0b2')).toBeEnabled({timeout:20000});
 await page.locator('#runtimeModeBtn').click();
 for(let i=1;i<5;i++){
  await page.locator('.slide-item').nth(i).click();await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);await expect(f.locator('[data-sr-page] h2')).toBeVisible();await expect(page.locator('.runtime-object')).toHaveCount(1);
  await page.locator('#runtimeModeBtn').click();
  if(i===1){await live.locator('#p1c0').click();await expect(live.locator('#p1bnote')).toContainText('1장');}
  if(i===2){await live.locator('#p2sw').click();await expect(live.locator('#p2hstate')).toHaveText('ON');}
  if(i===3){await live.locator('#p3shelf button').first().click();await expect(live.locator('#p3shelf')).toContainText('10대 학생');}
  if(i===4){await live.locator('#p4head').click();await expect(live.locator('#p4msg')).toContainText('6강');}
  await page.screenshot({path:`validation/runtime/simulator-${i+1}.png`});await page.locator('#runtimeModeBtn').click();
 }
 await page.locator('.slide-item').first().click();await expect(f.locator('[data-sr-page] h2')).toHaveText('수정한 시뮬레이터 설명');
 await page.locator('#previewBtn').click();const preview=page.frameLocator('#previewFrame').frameLocator('#deck iframe').first();await expect(preview.locator('h2')).toHaveText('수정한 시뮬레이터 설명');
 await preview.frameLocator('iframe[data-kind="simulation"]').locator('#p0b1').click();await expect(preview.frameLocator('iframe[data-kind="simulation"]').locator('#p0chat')).toContainText('마케팅 전략');
 await page.locator('#closePreview').click();const download=page.waitForEvent('download');await page.locator('#exportBtn').click();const dl=await download;let html='';for await(const chunk of await dl.createReadStream())html+=chunk;
 const standalone=await page.context().newPage();await standalone.setContent(html);
 const exported=standalone.frameLocator('#deck iframe').first();await expect(exported.locator('h2')).toHaveText('수정한 시뮬레이터 설명');await exported.frameLocator('iframe[data-kind="simulation"]').locator('#p0b1').click();await expect(exported.frameLocator('iframe[data-kind="simulation"]').locator('#p0chat')).toContainText('마케팅 전략');await standalone.close();
 await page.locator('#projectFile').setInputFiles({name:'simulator-roundtrip.html',mimeType:'text/html',buffer:Buffer.from(html)});await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
 await expect(f.locator('[data-sr-page] h2')).toHaveText('수정한 시뮬레이터 설명');await page.locator('#runtimeModeBtn').click();await live.locator('#p0b1').click();await expect(live.locator('#p0chat')).toContainText('마케팅 전략');
 await page.screenshot({path:'validation/runtime/simulator-1.png'});
});

test('script-generated players become locked live objects alongside static text',async({page})=>{
 await page.goto('/');const html='<h1>Editable heading</h1><div id="root"></div><script>document.querySelector("#root").innerHTML="<button id=play>Play</button><span id=count>0</span>";document.querySelector("#play").onclick=()=>document.querySelector("#count").textContent="1";</script>';
 await page.locator('#projectFile').setInputFiles({name:'player.html',mimeType:'text/html',buffer:Buffer.from(html)});await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
 const f=page.frameLocator('#canvas');await expect(f.locator('h1')).toBeVisible();await expect(f.locator('iframe[data-kind="animation"]')).toHaveCount(1);
 await expect(page.locator('.runtime-object')).toHaveCSS('pointer-events','auto');
 const surface=await page.locator('.runtime-object').boundingBox();await page.mouse.move(surface.x+50,surface.y+40);await page.mouse.down();await page.mouse.move(surface.x+80,surface.y+60);await page.mouse.up();
 const moved=await page.locator('.runtime-object').boundingBox();expect(moved.x-surface.x).toBeCloseTo(30,0);expect(moved.y-surface.y).toBeCloseTo(20,0);
 await expect(page.locator('#replaceVideo')).toBeHidden();
 await page.locator('#runtimeModeBtn').click();const live=page.frameLocator('.runtime-object iframe');await live.locator('#play').click();await expect(live.locator('#count')).toHaveText('1');
 await expect(f.locator('[contenteditable]')).toHaveCount(0);
});

test('tabbed simulations retain cross-panel script dependencies without unlocking their DOM',async({page})=>{
 await page.goto('/');const html=`<style>.panel{display:none}.panel.active{display:block;animation:fade 1s}@keyframes fade{from{opacity:0}to{opacity:1}}</style><div class="wrap"><h1>설명</h1><div id="tabbar"><button data-tab="0">one</button><button data-tab="1">two</button></div><section class="panel active" data-panel="0"><h2>first</h2><div class="grid2"><button id="one">run</button></div></section><section class="panel" data-panel="1"><h2>second</h2><div class="grid2"><button id="two">run</button><p id="status">waiting</p></div></section></div><script>document.getElementById('one').onclick=()=>{};document.getElementById('two').onclick=()=>document.getElementById('status').textContent='running';</script>`;
 await page.locator('#projectFile').setInputFiles({name:'simulation.html',mimeType:'text/html',buffer:Buffer.from(html)});await expect(page.locator('.slide-item')).toHaveCount(2);await page.locator('.slide-item').nth(1).click();await expect(page.locator('#stage')).not.toHaveClass(/stage-loading/);
 await expect(page.frameLocator('#canvas').locator('[data-sr-page]')).toHaveCSS('opacity','1');await page.locator('#runtimeModeBtn').click();
 const live=page.frameLocator('.runtime-object iframe');await live.locator('#two').click();await expect(live.locator('#status')).toHaveText('running');
 expect(await live.locator('body').evaluate(()=>{try{return !!parent.document.body;}catch{return false;}})).toBe(false);
});
