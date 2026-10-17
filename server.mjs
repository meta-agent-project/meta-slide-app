import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm'};
export const server=http.createServer(async(req,res)=>{
 try {
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(relative==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({app:'slide-room',version:'0.1.0'}));return;}
  const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)||relative.split('/').some(p=>p.startsWith('.')||p==='node_modules')) {res.writeHead(403);res.end();return;}
  if(!(await stat(file)).isFile())throw Error('not a file');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
 }catch {res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('슬라이드룸 http://127.0.0.1:'+(process.env.PORT||4173)));
