import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=process.argv[2];if(!input){console.error('Usage: node scripts/validate-slides.mjs <slides.html> [output-dir]');process.exit(2);}
const output=path.resolve(process.argv[3]||'validation');await mkdir(output,{recursive:true});
const port=4175,url=`http://127.0.0.1:${port}`;let server;
try{await fetch(url);}catch{server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore',windowsHide:true});}
let browser;
try{
 for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1760,height:1120}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#projectFile').setInputFiles(path.resolve(input));await page.locator('#toast').filter({hasText:'불러왔습니다'}).waitFor();
 const count=await page.locator('.slide-item').count(),slides=[];
 for(let i=0;i<count;i++){
  await page.locator('.slide-item').nth(i).click();
  await page.waitForFunction(n=>document.querySelector('#slideLabel').textContent===`SLIDE ${String(n+1).padStart(2,'0')}`,i);
  await page.waitForFunction(()=>document.querySelector('#canvas').contentDocument?.readyState==='complete');
  await page.evaluate(async()=>{await document.querySelector('#canvas').contentDocument.fonts.ready;});
  // Give isolated animation surfaces time to render their first frames.
  await page.waitForTimeout(250);
  const issues=await page.evaluate(async()=>{const {auditDocument}=await import('/src/audit.js');return auditDocument(document.querySelector('#canvas').contentDocument);});
  const screenshot=`slide-${String(i+1).padStart(2,'0')}.png`;await page.locator('#stage').screenshot({path:path.join(output,screenshot)});slides.push({number:i+1,issues,screenshot});
 }
 const report={input:path.resolve(input),checkedAt:new Date().toISOString(),slides,scriptErrors:errors,errorCount:slides.flatMap(s=>s.issues).filter(i=>i.severity==='error').length+errors.length};
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pages:count,errors:report.errorCount,warnings:slides.flatMap(s=>s.issues).filter(i=>i.severity==='warning').length,report:path.join(output,'report.json')},null,2));process.exitCode=report.errorCount?1:0;
}finally{await browser?.close();server?.kill();}
