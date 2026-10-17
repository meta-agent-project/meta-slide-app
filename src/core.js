export const clone = value => structuredClone(value);
export class History {
  constructor(initial, limit=80) { this.states=[clone(initial)]; this.index=0; this.limit=limit; }
  get current() { return clone(this.states[this.index]); }
  get canUndo() { return this.index>0; }
  get canRedo() { return this.index<this.states.length-1; }
  push(state) {
    if(JSON.stringify(state)===JSON.stringify(this.states[this.index])) return;
    this.states.splice(this.index+1); this.states.push(clone(state));
    if(this.states.length>this.limit) this.states.shift();
    this.index=this.states.length-1;
  }
  undo() { if(this.canUndo) this.index--; return this.current; }
  redo() { if(this.canRedo) this.index++; return this.current; }
}
const cell = (r,c) => ({r,c,rowspan:1,colspan:1,text:'',style:''});
export function makeTable(rows,cols) {
  if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>50||cols>30) throw Error('표 크기는 1~50행, 1~30열입니다.');
  return {rows,cols,cells:Array.from({length:rows*cols},(_,i)=>cell(Math.floor(i/cols),i%cols))};
}
export function tableGrid(t) {
  const grid=Array.from({length:t.rows},()=>Array(t.cols).fill(null));
  for(const s of t.cells) for(let r=s.r;r<s.r+s.rowspan;r++) for(let c=s.c;c<s.c+s.colspan;c++) {
    if(!grid[r] || c>=t.cols || grid[r][c]) throw Error('유효하지 않은 표 구조');
    grid[r][c]=s;
  }
  if(grid.some(row=>row.some(s=>!s))) throw Error('빈 표 좌표');
  return grid;
}
export function mergeCells(table,a,b) {
  const t=clone(table), r0=Math.min(a.r,b.r),c0=Math.min(a.c,b.c),r1=Math.max(a.r,b.r),c1=Math.max(a.c,b.c);
  const selected=t.cells.filter(s=>s.r<=r1&&s.r+s.rowspan>r0&&s.c<=c1&&s.c+s.colspan>c0);
  if(selected.some(s=>s.r<r0||s.c<c0||s.r+s.rowspan-1>r1||s.c+s.colspan-1>c1)) throw Error('병합된 셀 전체를 선택하세요.');
  if(!selected.length) throw Error('셀을 선택하세요.');
  const merged={...selected[0],r:r0,c:c0,rowspan:r1-r0+1,colspan:c1-c0+1,text:selected.map(s=>s.text).filter(Boolean).join('\n')};
  t.cells=t.cells.filter(s=>!selected.includes(s)); t.cells.push(merged); tableGrid(t); return t;
}
export function splitCell(table,r,c) {
  const t=clone(table), s=tableGrid(t)[r]?.[c]; if(!s) throw Error('셀을 선택하세요.');
  t.cells=t.cells.filter(x=>x!==s);
  for(let y=s.r;y<s.r+s.rowspan;y++) for(let x=s.c;x<s.c+s.colspan;x++) t.cells.push({...cell(y,x),text:y===s.r&&x===s.c?s.text:'',style:s.style});
  return t;
}
function insertAxis(table,at,row) {
  const t=clone(table),pos=row?'r':'c',span=row?'rowspan':'colspan',count=row?'rows':'cols';
  if(at<0||at>t[count]) throw Error('삽입 위치 오류');
  for(const s of t.cells) { if(s[pos]>=at)s[pos]++; else if(s[pos]+s[span]>at)s[span]++; }
  t[count]++;
  for(let n=0;n<(row?t.cols:t.rows);n++) {
    const r=row?at:n,c=row?n:at;
    if(!t.cells.some(s=>r>=s.r&&r<s.r+s.rowspan&&c>=s.c&&c<s.c+s.colspan))t.cells.push(cell(r,c));
  }
  tableGrid(t); return t;
}
function deleteAxis(table,at,row) {
  const t=clone(table),pos=row?'r':'c',span=row?'rowspan':'colspan',count=row?'rows':'cols';
  if(t[count]===1)throw Error('마지막 행 또는 열은 삭제할 수 없습니다.');
  if(at<0||at>=t[count])throw Error('삭제 위치 오류');
  t.cells=t.cells.filter(s=>!(s[pos]===at&&s[span]===1));
  for(const s of t.cells) { if(s[pos]>at)s[pos]--; else if(s[pos]+s[span]>at)s[span]--; }
  t[count]--; tableGrid(t); return t;
}
export const insertRow=(t,i)=>insertAxis(t,i,true);
export const insertColumn=(t,i)=>insertAxis(t,i,false);
export const deleteRow=(t,i)=>deleteAxis(t,i,true);
export const deleteColumn=(t,i)=>deleteAxis(t,i,false);
