import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try {const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');const source=await readFile('examples/lecture-source.html','utf8');const output=await page.evaluate(async html=>{const {importHTML,exportHTML}=await import('/src/document.js');return exportHTML(importHTML(html,'좋은 질문으로 시작하는 수업'));},source);await writeFile('examples/lecture.html',output);console.log('examples/lecture.html created');}finally{await browser.close();}
