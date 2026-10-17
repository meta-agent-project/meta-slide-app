import {cp,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','html-lecture-slides');
let exists=false;try{await access(target);exists=true;}catch{}
if(exists&&!process.argv.includes('--replace')){console.error('이미 설치되어 있습니다. 업데이트하려면 --replace를 사용하세요: '+target);process.exitCode=1;}
else {await cp(path.join(root,'skills','html-lecture-slides'),target,{recursive:true});console.log('설치 완료: '+target);}
