import {mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function buildStatic(output=path.join(root,'dist')){
 const files=['index.html','style.css','studio.css','startup.js','app.js','src/core.js','src/document.js','src/import-adapters.js','src/runtime-import.js','src/runtime-source.js','src/vendor/acorn.js','src/vendor/ACORN-LICENSE','src/media.js','src/tables.js','src/assets.js','src/audit.js','src/arrange.js','src/themes.js','src/workspace.js'];
 for(const file of files){const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,file),target);}
 return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildStatic());

