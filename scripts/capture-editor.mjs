import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:4173');await page.locator('#auditBtn').waitFor();await mkdir('validation',{recursive:true});await page.screenshot({path:'validation/editor.png',fullPage:true});}finally{await browser.close();}
