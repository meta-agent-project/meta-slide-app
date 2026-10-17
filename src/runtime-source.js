import {parse} from './vendor/acorn.js';

function walk(node,visit,parent=null){
 if(!node||typeof node!=='object')return;
 if(node.type)visit(node,parent);
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,visit,node));else if(value&&typeof value==='object')walk(value,visit,node);
}
const key=p=>p?.key?.name??p?.key?.value;
const prop=(node,name)=>node.properties?.find(p=>key(p)===name)?.value;
const safeString=text=>JSON.stringify(String(text)).replaceAll('<','\\u003c').replaceAll('$','\\u0024').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');

// Parse only; source execution belongs to the isolated import frame.
export function analyzeScript(source){
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
 const declaration=ast.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(n=>n.id?.type==='Identifier'&&n.id.name==='SLIDES'&&n.init?.type==='ArrayExpression');
 if(!declaration)return null;
 const slides=declaration.init.elements.map(node=>{
  const id=prop(node,'id'),render=prop(node,'render');
  if(!id||typeof id.value!=='string'||!render||!['ArrowFunctionExpression','FunctionExpression'].includes(render.type))throw Error('지원하지 않는 슬라이드 정의입니다.');
  const tokens=[];
  walk(render,(n,parent)=>{
   if(n.type==='TemplateLiteral'&&parent?.type!=='TaggedTemplateExpression'&&n.expressions.length===0)tokens.push({start:n.start,end:n.end,value:n.quasis[0].value.cooked,mode:'literal',block:true});
   if(n.type==='Literal'&&typeof n.value==='string'&&!(parent?.type==='Property'&&(parent.key===n||['id','className','class','style','href','src'].includes(key(parent)))))tokens.push({start:n.start,end:n.end,value:n.value,mode:'literal'});
   if(n.type==='TaggedTemplateExpression'&&n.tag.type==='Identifier'&&n.tag.name==='html'){
    // Keep tag state across ${...} boundaries: text inside a class/style attribute is never a text binding.
    let inTag=false,quote='';
    for(const q of n.quasi.quasis){
     const raw=source.slice(q.start,q.end),states=[];
     for(let i=0;i<raw.length;i++){
      states.push({inTag,quote});const ch=raw[i];
      if(inTag){if(quote){if(ch===quote&&raw[i-1]!=='\\')quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='>')inTag=false;}
      else if(ch==='<')inTag=true;
     }
     tokens.push({start:q.start,end:q.end,raw,states,mode:'template'});
    }
   }
  });
  return {id:id.value,start:render.start,end:render.end,tokens};
 });
 if(!slides.length)return null;
 return {source,slides};
}

export function findTextBindings(model,index,text){
 const slide=model?.slides[index];if(!slide||!text.trim())return [];
 const candidates=[];
 for(const t of slide.tokens){
  if(t.mode==='literal'){
   if(t.value===text||t.block&&t.value?.trim()===text.trim())candidates.push({start:t.start,end:t.end,mode:'literal'});
   continue;
  }
  let at=-1;
  while((at=t.raw.indexOf(text,at+1))>=0){
   const state=t.states[at];if(!state)continue;
   let start=t.start+at,end=start+text.length;
   if(!state.inTag){
    // Never rewrite a substring of a larger visible text run.
    const before=t.raw.slice(0,at).split('>').at(-1),after=t.raw.slice(at+text.length).split('<')[0];
    if(before.trim()||after.trim())continue;
   }else{
    const before=t.raw.slice(0,at),after=t.raw.slice(at+text.length);
    if(!/(?:title|eyebrow|label|alt)\s*=\s*["']$/.test(before)||after[0]!==state.quote)continue;
    start--;end++;
   }
   candidates.push({start,end,mode:'expression'});
  }
 }
 return [...new Map(candidates.map(c=>[c.start,c])).values()].map(binding=>({...binding,original:model.source.slice(binding.start,binding.end),text}));
}

export function findTextBinding(model,index,text){const bindings=findTextBindings(model,index,text);return bindings.length===1?bindings[0]:null;}

export function applyTextEdits(source,edits){
 let result=source,last=source.length;
 for(const e of [...edits].sort((a,b)=>b.start-a.start)){
  if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<=e.start||e.end>last||source.slice(e.start,e.end)!==e.original||!['literal','expression'].includes(e.mode))throw Error('원본과 글자 수정 위치가 일치하지 않습니다.');
  const value=safeString(e.text),replacement=e.mode==='literal'?value:'${'+value+'}';
  result=result.slice(0,e.start)+replacement+result.slice(e.end);last=e.start;
 }
 // A bad patch must never turn a working source into an unparseable program.
 parse(result,{ecmaVersion:'latest',sourceType:'script'});return result;
}

