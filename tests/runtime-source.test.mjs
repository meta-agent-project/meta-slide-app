import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeScript,findTextBinding,applyTextEdits} from '../src/runtime-source.js';

test('finds slide render ranges without confusing nested arrays and comments',()=>{
 const source='const SLIDES = [{id:"a",render:()=>html`<h2>같은 제목</h2><p>내용</p>`},{id:"b",render:()=>html`<h2>같은 제목</h2>`}];';
 const model=analyzeScript(source);assert.equal(model.slides.length,2);
 const a=findTextBinding(model,0,'같은 제목');const b=findTextBinding(model,1,'같은 제목');assert.notEqual(a.start,b.start);
 const edited=applyTextEdits(source,[{...b,text:'수정한 제목'}]);
 const output=Function('html',edited+';return SLIDES.map(s=>s.render());')((parts,...values)=>parts.map((p,i)=>p+(values[i]??'')).join(''));
 assert.deepEqual(output,['<h2>같은 제목</h2><p>내용</p>','<h2>수정한 제목</h2>']);
});

test('edits preserve JS syntax and treat hostile characters as literal displayed text',()=>{
 const source='const SLIDES = [{id:"a",render:()=>html`<${Slide} title="원래 제목"><p>원래 본문</p><//>`}];';
 const model=analyzeScript(source),title=findTextBinding(model,0,'원래 제목'),body=findTextBinding(model,0,'원래 본문');
 assert.ok(title);assert.ok(body);
 const edited=applyTextEdits(source,[{...title,text:'" ` ${danger} </script> & <b>제목</b>'},{...body,text:'첫 줄\n둘째 줄'}]);
 assert.equal(analyzeScript(edited).slides.length,1);assert.ok(!edited.includes('</script>'));assert.ok(!edited.includes('${danger}'));
});

test('ambiguous repeated text and code identifiers are not advertised as independently editable',()=>{
 const model=analyzeScript('const SLIDES=[{id:"a",render:()=>html`<div className="card"><p>반복</p><p>반복</p></div>`}];');
 assert.equal(findTextBinding(model,0,'반복'),null);assert.equal(findTextBinding(model,0,'card'),null);
});

test('refuses stale or overlapping source patches',()=>{
 const source='const SLIDES=[{id:"a",render:()=>html`<h2>제목</h2>`}];',binding=findTextBinding(analyzeScript(source),0,'제목');
 assert.throws(()=>applyTextEdits(source,[{...binding,original:'changed',text:'다른 제목'}]));
 assert.throws(()=>applyTextEdits(source,[{...binding,text:'하나'},{...binding,text:'둘'}]));
});

test('repeated author slide ids retain their distinct ordinal pages',()=>{
 const model=analyzeScript('const SLIDES=[{id:"same",render:()=>html`<p>첫째</p>`},{id:"same",render:()=>html`<p>둘째</p>`}];');
 assert.equal(model.slides.length,2);assert.ok(findTextBinding(model,1,'둘째'));
});

test('multiline code samples are editable data rather than executable source',()=>{
 const source='const SLIDES=[{id:"a",render:()=>html`<${Code} text=${`\nconst x = 1;\nconsole.log(x);\n`}/>`}];';
 const binding=findTextBinding(analyzeScript(source),0,'const x = 1;\nconsole.log(x);');assert.ok(binding);
 const updated=applyTextEdits(source,[{...binding,text:'const x = "</script>";\n새 줄'}]);assert.ok(analyzeScript(updated));assert.ok(!updated.includes('</script>'));
});
