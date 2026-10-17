import test from 'node:test';
import assert from 'node:assert/strict';
import { History, makeTable, mergeCells, splitCell, insertRow, deleteRow, insertColumn, deleteColumn, tableGrid } from '../src/core.js';

test('history restores independent snapshots and discards redo after a new change', () => {
  const h = new History({title:'A',slides:[1]});
  const b = {title:'B',slides:[1,2]}; h.push(b); b.slides.push(3);
  assert.deepEqual(h.undo(), {title:'A',slides:[1]});
  assert.deepEqual(h.redo(), {title:'B',slides:[1,2]});
  h.undo(); h.push({title:'C',slides:[]});
  assert.equal(h.canRedo, false);
  assert.equal(h.current.title, 'C');
});

test('table merge preserves content and split restores valid rectangular grid', () => {
  let t = makeTable(3,3); t.cells[0].text='첫째'; t.cells[1].text='둘째';
  t = mergeCells(t, {r:0,c:0}, {r:1,c:1});
  const grid = tableGrid(t);
  assert.equal(grid[0][0].rowspan,2); assert.equal(grid[1][1],grid[0][0]);
  assert.match(grid[0][0].text,/첫째/); assert.match(grid[0][0].text,/둘째/);
  t = splitCell(t,0,0);
  assert.equal(t.cells.length,9); assert.equal(tableGrid(t)[1][1].colspan,1);
});

test('merge cannot partially overlap an existing merged cell', () => {
  const t=mergeCells(makeTable(3,3),{r:0,c:0},{r:1,c:1});
  assert.throws(()=>mergeCells(t,{r:1,c:1},{r:2,c:2}),/전체/);
});

test('insert and delete through merged cells preserve a complete non-overlapping grid', () => {
  let t=mergeCells(makeTable(3,3),{r:0,c:0},{r:1,c:1});
  t=insertRow(t,1); t=insertColumn(t,1);
  assert.equal(tableGrid(t)[0][0].rowspan,3); assert.equal(tableGrid(t)[0][0].colspan,3);
  t=deleteRow(t,0); t=deleteColumn(t,0);
  assert.equal(t.rows,3); assert.equal(t.cols,3);
  for(const row of tableGrid(t)) assert.equal(row.filter(Boolean).length,3);
  assert.equal(tableGrid(t)[0][0].rowspan,2);
  assert.throws(()=>deleteRow(makeTable(1,1),0),/마지막/);
});
