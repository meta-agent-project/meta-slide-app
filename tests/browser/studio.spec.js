import {test,expect} from '@playwright/test';
const fixture='<html><body style="margin:0"><div data-kind="rect" id="a" style="position:absolute;left:100px;top:100px;width:80px;height:80px;background:red"></div><div data-kind="rect" id="b" style="position:absolute;left:310px;top:150px;width:80px;height:80px;background:blue"></div><div data-kind="rect" id="c" style="position:absolute;left:600px;top:230px;width:80px;height:80px;background:green"></div></body></html>';
async function load(page){await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'objects.html',mimeType:'text/html',buffer:Buffer.from(fixture)});await expect(page.frameLocator('#canvas').locator('#a')).toBeVisible();}
const rect=(page,id)=>page.frameLocator('#canvas').locator(id).evaluate(el=>el.getBoundingClientRect().toJSON());
async function selectThree(page){const f=page.frameLocator('#canvas');await f.locator('#a').click();await f.locator('#b').click({modifiers:['Shift']});await f.locator('#c').click({modifiers:['Shift']});await expect(page.locator('#selectionName')).toHaveText('3개 선택');}

test('align, distribute, group, duplicate, lock, and undo operate on a selection',async({page})=>{
 await load(page);await selectThree(page);await page.locator('[data-arrange=top]').click();expect((await rect(page,'#b')).y).toBeCloseTo(100);expect((await rect(page,'#c')).y).toBeCloseTo(100);
 await page.locator('[data-arrange=horizontal]').click();expect((await rect(page,'#b')).x).toBeCloseTo(350);await page.locator('#groupBtn').click();
 await page.keyboard.press('Escape');await page.frameLocator('#canvas').locator('#a').click();await expect(page.locator('#selectionName')).toHaveText('3개 선택');
 await page.keyboard.press('ArrowRight');expect((await rect(page,'#a')).x).toBeCloseTo(101);expect((await rect(page,'#b')).x).toBeCloseTo(351);
 await page.locator('#duplicateBtn').click();await expect(page.frameLocator('#canvas').locator('[data-kind=rect]')).toHaveCount(6);await page.locator('#undoBtn').click();await expect(page.frameLocator('#canvas').locator('[data-kind=rect]')).toHaveCount(3);
 await page.frameLocator('#canvas').locator('#a').click();await page.locator('#lockBtn').click();await expect(page.frameLocator('#canvas').locator('[data-sr-locked]')).toHaveCount(3);await page.frameLocator('#canvas').locator('#a').click();await expect(page.locator('#selectionBox')).toBeHidden();
 await page.locator('#layersTab').click();await expect(page.locator('#layers .layer-lock')).toHaveCount(3);await page.locator('#layers .layer-lock').first().click();await expect(page.frameLocator('#canvas').locator('[data-sr-locked]')).toHaveCount(2);
});

test('smart guides snap to center, Alt bypasses, and guides never persist',async({page})=>{
 await load(page);await page.frameLocator('#canvas').locator('#a').click();const f=await page.locator('#canvas').boundingBox(),s=f.width/1280,a=await page.frameLocator('#canvas').locator('#a').boundingBox();
 await page.mouse.move(a.x+20*s,a.y+20*s);await page.mouse.down();await page.mouse.move(a.x+20*s+497*s,a.y+20*s);await expect(page.frameLocator('#canvas').locator('[data-sr-guide]')).not.toHaveCount(0);await page.mouse.up();expect((await rect(page,'#a')).x).toBeCloseTo(600,0);await expect(page.frameLocator('#canvas').locator('[data-sr-guide]')).toHaveCount(0);
 const dl=page.waitForEvent('download');await page.locator('#fileMenu summary').click();await page.locator('#saveBtn').click();const path=await(await dl).path();const {readFile}=await import('node:fs/promises');const p=JSON.parse(await readFile(path,'utf8'));expect(p.slides[0].html).not.toContain('data-sr-guide');
});

test('twenty themed pages are editable, theme updates persist, and personal pages survive reload',async({page})=>{
 await page.goto('/');await page.locator('#themeLibraryBtn').click();await expect(page.locator('#themePages .page-card')).toHaveCount(20);await page.locator('#insertThemeAll').click();await expect(page.locator('.slide-item')).toHaveCount(21);
 const f=page.frameLocator('#canvas');await expect(f.locator('[data-kind=text]')).not.toHaveCount(0);await page.locator('#themeLibraryBtn').click();await page.locator('#themeAccent').fill('#225588');await page.locator('#themeAccent').dispatchEvent('change');await page.locator('#applyTheme').click();await expect(page.locator('#libraryStatus')).toContainText('20개');await page.locator('[data-close=themeDialog]').click();await expect(f.locator('body')).toHaveCSS('--sr-accent','#225588');
 await page.locator('#themeLibraryBtn').click();await page.locator('#saveLibraryPage').click();await expect(page.locator('#savedPages .page-card')).toHaveCount(1);await page.locator('[data-close=themeDialog]').click();await page.reload();await expect(page.locator('.slide-item')).toHaveCount(21);await page.locator('#themeLibraryBtn').click();await expect(page.locator('#savedPages .page-card')).toHaveCount(1);await page.locator('#savedPages button').filter({hasText:'가져오기'}).click();await expect(page.locator('.slide-item')).toHaveCount(22);
 const dl=page.waitForEvent('download');await page.locator('#exportBtn').click();const path=await(await dl).path();await page.locator('#projectFile').setInputFiles(path);await expect(page.locator('.slide-item')).toHaveCount(22);await page.locator('.slide-item').nth(2).click();await expect(f.locator('body')).toHaveCSS('--sr-accent','#225588');
});

test('format painter copies appearance without moving target',async({page})=>{
 await load(page);const f=page.frameLocator('#canvas');await f.locator('#a').click();await page.locator('#copyFormatBtn').click();const before=await rect(page,'#b');await f.locator('#b').click();await page.locator('#pasteFormatBtn').click();await expect(f.locator('#b')).toHaveCSS('background-color','rgb(255, 0, 0)');expect((await rect(page,'#b')).x).toBeCloseTo(before.x);await page.locator('#undoBtn').click();await expect(f.locator('#b')).toHaveCSS('background-color','rgb(0, 0, 255)');
});

test('notes, sorter sections, presenter navigation and audience screen stay in sync',async({page})=>{
 await page.goto('/');await page.locator('#themeLibraryBtn').click();await page.locator('#insertThemeAll').click();await page.locator('#notesBtn').click();await page.locator('#speakerNotes').fill('학생들에게 먼저 질문하기');await page.locator('#speakerNotes').blur();await page.locator('#sorterBtn').click();await page.getByRole('textbox',{name:'2번 섹션',exact:true}).fill('도입');await page.getByRole('textbox',{name:'2번 섹션',exact:true}).blur();await page.getByRole('button',{name:'2번 앞으로 이동',exact:true}).click();await page.locator('[data-close=sorterDialog]').click();await page.locator('#presenterBtn').click();await expect(page.locator('#presenterNotes')).toHaveText('학생들에게 먼저 질문하기');await expect(page.locator('#presenterCounter')).toHaveText('1 / 21');
 const popupPromise=page.waitForEvent('popup');await page.locator('#audienceBtn').click();const popup=await popupPromise;await expect(popup.frameLocator('iframe:not([data-pending])').locator('body')).toContainText('스킬은 작게 만들어');await page.locator('#presenterNext').click();await expect(page.locator('#presenterCounter')).toHaveText('2 / 21');await expect(popup.frameLocator('iframe:not([data-pending])').locator('body')).toContainText('아이디어가');await expect(popup.locator('body')).not.toContainText('학생들에게');await page.locator('[data-close=presenterDialog]').click();await expect.poll(()=>popup.isClosed()).toBe(true);
 await page.reload();await page.locator('.slide-item').first().click();await page.locator('#notesBtn').click();await expect(page.locator('#speakerNotes')).toHaveValue('학생들에게 먼저 질문하기');
});

test('northwest resize anchors opposite corner; image aspect ratio remains constant',async({page})=>{
 await load(page);await page.frameLocator('#canvas').locator('#a').click();const before=await rect(page,'#a'),handle=await page.locator('.handle-nw').boundingBox(),f=await page.locator('#canvas').boundingBox(),s=f.width/1280;await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2-30*s,handle.y+handle.height/2-20*s);await page.mouse.up();const after=await rect(page,'#a');expect(after.right).toBeCloseTo(before.right,0);expect(after.bottom).toBeCloseTo(before.bottom,0);expect(after.width).toBeGreaterThan(before.width);
 await page.locator('#imageFile').setInputFiles({name:'ratio.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="teal"/></svg>')});const img=page.frameLocator('#canvas').locator('img'),r=await img.boundingBox(),h=await page.locator('#resizeHandle').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+50,h.y+h.height/2+10);await page.mouse.up();const resized=await img.boundingBox();expect(resized.width/resized.height).toBeCloseTo(r.width/r.height,2);
});

test('theme pages have no clipping or overflow and render at full size',async({page})=>{
 await page.goto('/');
 for(let i=0;i<4;i++){
  const issues=await page.evaluate(async i=>{const {themePages}=await import('/src/themes.js'),{auditDocument}=await import('/src/audit.js');document.querySelector('#themeValidation')?.remove();const f=document.createElement('iframe');f.id='themeValidation';f.style='position:fixed;left:0;top:0;width:1280px;height:720px;border:0;z-index:99999';document.body.append(f);await new Promise(resolve=>{f.onload=resolve;f.srcdoc=themePages()[i].html;});await f.contentDocument.fonts.ready;return auditDocument(f.contentDocument).filter(x=>x.severity==='error');},i);
  expect(issues).toEqual([]);await page.locator('#themeValidation').screenshot({path:`validation/studio-theme-${i+1}.png`});
 }
});

test('audit fixes preview without changing document, apply once, and undo',async({page})=>{
 await page.goto('/');await page.locator('#projectFile').setInputFiles({name:'overflow.html',mimeType:'text/html',buffer:Buffer.from('<h1 id="overflow" style="position:absolute;left:1200px;top:100px;width:300px;height:90px;margin:0">넘침 확인</h1>')});await expect(page.frameLocator('#canvas').locator('#overflow')).toBeVisible();await page.locator('#auditBtn').click();await page.getByRole('button',{name:'슬라이드 안으로 이동'}).click();await expect(page.locator('.audit-fix-dialog')).toBeVisible();expect((await rect(page,'#overflow')).x).toBe(1200);await page.locator('.audit-fix-dialog [data-cancel]').click();expect((await rect(page,'#overflow')).x).toBe(1200);
 await page.locator('#auditBtn').click();await page.getByRole('button',{name:'슬라이드 안으로 이동'}).click();await page.locator('.audit-fix-dialog [data-accept]').click();expect((await rect(page,'#overflow')).right).toBeCloseTo(1280);await page.locator('#undoBtn').click();await expect.poll(async()=>(await rect(page,'#overflow')).x).toBe(1200);
});

test('layer visibility and locks persist across reload, and small text remains editable',async({page})=>{
 await load(page);await page.locator('#layersTab').click();await page.getByRole('button',{name:/요소 숨기기 사각형/}).first().click();await expect(page.frameLocator('#canvas').locator('#a')).toHaveCSS('visibility','hidden');await page.reload();await page.locator('#layersTab').click();await page.getByRole('button',{name:/요소 보이기 사각형/}).first().click();await expect(page.frameLocator('#canvas').locator('#a')).toBeVisible();await page.locator('#designTab').click();await page.locator('[data-add=text]').click();await page.locator('#fontSize').fill('16');await page.locator('#fontSize').press('Enter');await page.locator('#propH').fill('24');await page.locator('#propH').press('Enter');await page.frameLocator('#canvas').locator('[data-kind=text]').dblclick();await expect(page.frameLocator('#canvas').locator('[contenteditable=true]')).toBeVisible();
});

test('send backward keeps a shape visible above the page background',async({page})=>{
 await page.goto('/');await page.locator('#shapeSelect').selectOption('rect');await page.locator('#backBtn').click();const result=await page.frameLocator('#canvas').locator('[data-kind=rect]').evaluate(el=>{const r=el.getBoundingClientRect();return {z:Number(getComputedStyle(el).zIndex),hit:el.ownerDocument.elementFromPoint(r.x+20,r.y+20)===el};});expect(result.z).toBeGreaterThanOrEqual(0);expect(result.hit).toBe(true);
});


