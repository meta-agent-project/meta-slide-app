import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,renameSync,existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Long-running verification requested by the user. No production files or source fixtures are modified.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const until=Date.parse(arg('--until','')),interval=Number(arg('--interval-ms','120000'));
if(!Number.isFinite(until)||until<=Date.now())throw Error('Supply a future --until ISO timestamp.');
const directory=path.join(root,'.local','runtime-soak');mkdirSync(directory,{recursive:true});
const stateFile=path.join(directory,'state.json');
const state={pid:process.pid,startedAt:new Date().toISOString(),deadline:new Date(until).toISOString(),status:'running',runs:[],checkpoint:'5d55cce'};
const save=()=>{state.updatedAt=new Date().toISOString();writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2));renameSync(stateFile+'.tmp',stateFile);};
if(!existsSync('C:/Users/ssarm/Documents/Spec에서 Wiki까지.html'))throw Error('Required user fixture is missing.');
if(existsSync(stateFile)){
 const previous=JSON.parse(readFileSync(stateFile,'utf8'));
 if(previous.status==='running')try{process.kill(previous.pid,0);throw Error('Another soak process is still running.');}catch(e){if(e.code!=='ESRCH')throw e;}
 const archive=path.join(directory,`session-${previous.startedAt.replaceAll(':','-')}.json`);
 writeFileSync(archive,JSON.stringify(previous,null,2));
 state.previousSession=archive;
}
save();
async function run(number){
 const started=Date.now(),log=path.join(directory,`run-${Date.now()}.log`);let output='';
 const specs=number%5===0?[]:['tests/browser/react-text.spec.js','tests/browser/runtime-failure.spec.js'];
 const args=[path.join(root,'node_modules','@playwright','test','cli.js'),'test',...specs,'--output',path.join(directory,'artifacts-'+started),'--reporter=line'];
 const result=await new Promise(resolve=>{
  const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>{output+=d;writeFileSync(log,output);});child.stderr.on('data',d=>{output+=d;writeFileSync(log,output);});
  child.on('error',error=>resolve({code:-1,error:error.message}));child.on('exit',(code,signal)=>resolve({code,signal}));
 });
 state.runs.push({number,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,...result,log});save();return result.code===0;
}
try{
 let number=0;
 do{
  if(!await run(++number)){state.status='failed';state.reason='A regression check failed. Inspect the last run log before continuing.';break;}
  if(Date.now()<until)await new Promise(resolve=>setTimeout(resolve,Math.min(interval,until-Date.now())));
 }while(Date.now()<until);
 if(state.status==='running'){
  // Run one final full suite after the minimum duration has elapsed.
  if(await run(Math.ceil((number+1)/5)*5))state.status='passed';else{state.status='failed';state.reason='Final full suite failed.';}
 }
}catch(error){state.status='failed';state.reason=error.stack;}
state.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(state));
