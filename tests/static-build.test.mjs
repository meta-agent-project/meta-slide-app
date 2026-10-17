import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildStatic} from '../scripts/build-static.mjs';
test('hosted bundle includes editor modules without server or local workspace data',async()=>{
 const out=await mkdtemp(path.join(os.tmpdir(),'slide-room-static-'));
 await buildStatic(out);
 const html=await readFile(path.join(out,'index.html'),'utf8');assert.match(html,/app\.js/);
 for(const file of ['app.js','style.css','src/document.js','src/core.js','src/media.js','src/tables.js','src/assets.js','src/audit.js'])assert.ok((await readFile(path.join(out,file))).length);
 const entries=await readdir(out);assert.ok(!entries.includes('server.mjs'));assert.ok(!entries.includes('.local'));assert.ok(!entries.includes('node_modules'));
});
