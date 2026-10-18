import {uid,parse} from './document.js';
export const runningAssets=[['run','달리는 사람'],['fall','넘어지는 사람'],['back','허리 다친 사람'],['ahead','혼자 앞서 달리는 사람'],['skip','혼자 준비운동 안 하는 사람'],['map','부산 러닝 코스 개념도'],['together','함께 속도를 맞추는 사람들'],['wait','뒤처진 사람을 기다리는 사람'],['tired','지쳐서 걷는 사람'],['water','물을 마시며 쉬는 사람']].map(([layout,name])=>({id:'running-'+layout,layout,name,kind:'running',category:'러닝 · 임시',tags:'러닝 달리기 운동 마라톤 '+name}));
const stroke='stroke="#293b49" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"';
function person(pose,color='#7faead'){
 const poses={run:{head:[118,37],body:'M108 67 91 123',arms:'M103 77 143 92 161 66 M101 79 65 99 39 78',legs:'M92 123 129 153 164 151 M92 123 64 161 30 171'},stand:{head:[100,37],body:'M100 68 100 127',arms:'M100 77 69 100 71 131 M100 77 131 101 127 129',legs:'M100 127 81 177 M100 127 119 177'},stretch:{head:[98,40],body:'M98 71 95 126',arms:'M98 77 60 49 71 14 M98 77 131 48 116 13',legs:'M95 126 56 176 M95 126 139 176'},back:{head:[137,61],body:'M121 85 93 117',arms:'M117 89 135 119 151 130 M112 91 82 85 77 108',legs:'M93 117 72 151 60 178 M93 117 121 148 133 177'},tired:{head:[122,52],body:'M111 82 95 126',arms:'M108 89 130 119 136 145 M105 87 76 115 65 143',legs:'M95 126 79 177 M95 126 124 170 142 174'},water:{head:[109,38],body:'M103 70 98 126',arms:'M103 80 137 87 139 43 M103 80 74 109 64 135',legs:'M98 126 74 177 M98 126 126 177'},fall:{head:[155,114],body:'M129 121 79 101',arms:'M123 123 140 149 170 162 M121 120 102 151 124 169',legs:'M79 101 46 124 19 111 M79 101 66 67 35 47'}};
 const q=poses[pose]||poses.run;
 return `<g ${stroke} fill="none"><ellipse cx="100" cy="190" rx="78" ry="6" fill="#dce4e9" stroke="none"/><path d="${q.legs}" stroke-width="16"/><path d="${q.body}" stroke="${color}" stroke-width="31"/><path d="${q.arms}" stroke="#e8ba94" stroke-width="13"/><circle cx="${q.head[0]}" cy="${q.head[1]}" r="20" fill="#efc6a5" stroke-width="3"/><path d="M${q.head[0]-19} ${q.head[1]-4}q3-28 32-14" stroke-width="9"/><circle cx="${q.head[0]+10}" cy="${q.head[1]}" r="2" fill="#293b49" stroke="none"/>${pose==='back'?'<path d="m66 77-12 8 13 6-13 10" stroke="#df725b" stroke-width="5"/>':''}${pose==='fall'?'<path d="m174 173 14 4m-25 3 5 12" stroke="#df725b" stroke-width="4"/>':''}${pose==='water'?'<path d="m137 43 18-14 9 12-19 13z" fill="#9ccbe1" stroke-width="3"/>':''}${pose==='run'?'<path d="M21 64h26M12 82h18" stroke="#9fb4bd" stroke-width="4"/>':''}</g>`;
}
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="210" viewBox="0 0 200 210">${body}</svg>`;
export function runningParts(layout){
 const actor=(pose,x,y,color)=>({x,y,w:200,h:210,html:svg(person(pose,color))});
 if(layout==='ahead')return [actor('run',70,160,'#9eb4c9'),actor('run',240,190,'#b5b9d1'),actor('run',570,90,'#eaa16d')];
 if(layout==='skip')return [actor('stretch',70,130),actor('stretch',290,130,'#9eb4c9'),actor('stand',560,130,'#eaa16d')];
 if(layout==='together')return [actor('run',70,130),actor('run',290,130,'#9eb4c9'),actor('run',510,130,'#eaa16d')];
 if(layout==='wait')return [actor('tired',100,150,'#9eb4c9'),actor('stand',520,130,'#eaa16d')];
 if(layout==='map')return [
  {x:80,y:80,w:640,h:320,html:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"><path d="M30 25H610V295H30Z" fill="#e6f2f6"/><path d="M30 25H610V84L552 100 518 137 453 149 412 196 346 193 319 241 263 257 227 226 176 240 140 211 91 231 30 198Z" fill="#e5eadc" stroke="#9cae9d" stroke-width="3"/><path d="M110 25 127 109 94 161 140 211M205 25 239 100 227 226M390 25 371 112 412 196M30 105 157 93 276 124 371 112 518 137" fill="none" stroke="white" stroke-width="9"/></svg>'},
  {x:225,y:210,w:340,h:100,html:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 100"><path d="M15 80Q70 12 125 55T230 38L320 15" fill="none" stroke="#da865e" stroke-width="7" stroke-dasharray="10 9"/><path d="m300 9 23 3-7 22" fill="none" stroke="#da865e" stroke-width="6"/></svg>'},
  {x:210,y:260,w:40,h:50,html:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50"><path d="M20 48S2 24 2 19a18 18 0 1 1 36 0c0 8-18 29-18 29" fill="#507f77"/><circle cx="20" cy="19" r="6" fill="white"/></svg>'},
  {x:535,y:180,w:40,h:50,html:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50"><path d="M20 48S2 24 2 19a18 18 0 1 1 36 0c0 8-18 29-18 29" fill="#d98560"/><circle cx="20" cy="19" r="6" fill="white"/></svg>'},
  {x:100,y:30,w:580,h:40,text:'부산 러닝 코스 · 개념도'},
  {x:155,y:320,w:150,h:34,text:'출발'}, {x:570,y:190,w:130,h:34,text:'도착'},
  {x:100,y:410,w:610,h:34,text:'발표용 비축척 도식 · 실제 지형·경로와 다릅니다'}
 ];
 return [actor(layout,300,110,layout==='fall'||layout==='back'?'#eaa16d':undefined)];
}
export function runningPreview(layout){return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${['run','fall','back','tired','water'].includes(layout)?'260 70 280 280':'0 0 800 480'}">${runningParts(layout).map(p=>p.text?`<text x="${p.x}" y="${p.y+28}" font-family="sans-serif" font-size="${p.y>400?17:24}" fill="#344b54">${p.text}</text>`:`<svg x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" viewBox="${layout==='map'?parse(p.html).querySelector('svg').getAttribute('viewBox'):'0 0 200 210'}">${p.html.replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>`).join('')}</svg>`);}
export function insertRunning(editor,asset){
 editor.finishEdit();const group=uid(),elements=[];
 for(const part of runningParts(asset.layout)){const el=part.text?editor.document.createElement('p'):editor.document.importNode(parse(part.html).querySelector('svg'),true);if(part.text)el.textContent=part.text;el.dataset.srId=uid();el.dataset.srGroup=group;el.dataset.srRunning=asset.layout;el.dataset.srName=asset.name;el.style.cssText=`position:absolute;left:${240+part.x}px;top:${100+part.y}px;width:${part.w}px;height:${part.h}px;margin:0;font: ${part.y>400?17:24}px/1.4 Arial,'Malgun Gothic',sans-serif;color:#344b54;`; (editor.document.querySelector('[data-sr-page]')||editor.document.body).append(el);elements.push(el);}
 editor.selectMany(elements);editor.commit();
}
