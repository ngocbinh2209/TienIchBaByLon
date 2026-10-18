'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../creating-flow-core.js');
function directory(initial={}) {
  const files=new Map(Object.entries(initial)), staged=new Map();
  return {files,async *entries(){yield*files.entries();},async getFileHandle(name,options={}){
    if(!files.has(name)&&!options.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});
    if(!files.has(name))files.set(name,[]);
    return {async createWritable(){staged.set(name,[]);return {async write(v){staged.get(name).push(...v);},async close(){files.set(name,staged.get(name));},async abort(){staged.delete(name);}};}};
  },async removeEntry(name){files.delete(name);}};
}
function source(chunks,fail=false){let index=0;return {type:'image/png',closed:false,async read(){if(index<chunks.length)return {value:Uint8Array.from(chunks[index++]),done:false};if(fail)throw Error('network');return {done:true};},async close(){this.closed=true;}};}
test('newline prompts preserve duplicates and Unicode; reject empty and overflow',()=>{
 assert.deepEqual(core.parsePrompts(' Một cảnh\r\n\r\nHai cảnh\nMột cảnh '),['Một cảnh','Hai cảnh','Một cảnh']);
 assert.throws(()=>core.parsePrompts(' \n'));assert.throws(()=>core.parsePrompts(Array(101).fill('x').join('\n')));
});
test('only supported HTTPS Flow project URLs',()=>{
 assert.equal(core.isFlowProject('https://flow.google/project/123'),true);
 assert.equal(core.isFlowProject('https://flow.google.com/project/4f00e63a-46db-4355-b567-2de5b2eecd9a'),true);
 assert.equal(core.isFlowProject('https://flow.google.com.evil/project/123'),false);
 assert.equal(core.isFlowProject('https://labs.google/fx/tools/flow/project/123'),true);
 for(const url of ['https://flow.google.evil/project/x','http://flow.google/project/x','https://flow.google/','garbage'])assert.equal(core.isFlowProject(url),false);
});
test('numbers continue after all existing numeric files without overwrite',async()=>{
 const dir=directory({'1.png':[9],'3.mp4':[8],'notes.txt':[7]});const s=source([[1,2],[3,4]]);
 const r=await core.saveStream(dir,s,'image');assert.equal(r.name,'4.png');assert.deepEqual(dir.files.get('4.png'),[1,2,3,4]);assert.deepEqual(dir.files.get('1.png'),[9]);assert.equal(s.closed,true);
});
test('failed and empty downloads roll back own file; next success reuses number',async()=>{
 const dir=directory({'1.png':[9]});const s=source([[1]],true);
 await assert.rejects(core.saveStream(dir,s,'image'),/network/);assert.equal(dir.files.has('2.png'),false);assert.equal(s.closed,true);
 await assert.rejects(core.saveStream(dir,source([]),'image'),/rỗng/);
 const r=await core.saveStream(dir,source([[7]]),'image');assert.equal(r.name,'2.png');
});
test('abort during streaming does not leave completed-looking file',async()=>{
 const dir=directory(),abort=new AbortController();
 await assert.rejects(core.saveStream(dir,source([[1],[2]]),'image',abort.signal,()=>abort.abort()));
 assert.equal(dir.files.size,0);
});
test('wrong MIME cannot create a file; videos keep real extension',async()=>{
 const dir=directory();let s=source([[1]]);s.type='text/html';await assert.rejects(core.saveStream(dir,s,'video'));assert.equal(dir.files.size,0);
 s=source([[1]]);s.type='video/webm';assert.equal((await core.saveStream(dir,s,'video')).name,'1.webm');
});
test('files named by successful save order, not prompt index',async()=>{
 const dir=directory();const secondPrompt=await core.saveStream(dir,source([[2]]),'image');const firstPrompt=await core.saveStream(dir,source([[1]]),'image');
 assert.equal(secondPrompt.name,'1.png');assert.equal(firstPrompt.name,'2.png');
});
test('preflight failure and already-aborted signal close source without touching existing files',async()=>{
 const dir=directory({'1.png':[9]});const s=source([[1]]);s.type='text/html';
 await assert.rejects(core.saveStream(dir,s,'image'));assert.equal(s.closed,true);
 const abort=new AbortController();abort.abort();const s2=source([[1]]);
 await assert.rejects(core.saveStream(dir,s2,'image',abort.signal));assert.equal(s2.closed,true);
 assert.deepEqual([...dir.files.keys()],['1.png']);
});
test('explicit starting numbers ignore larger files and preserve collisions',async()=>{
 for(const start of [1,4]){
  const dir=directory({'99.png':[9]});
  for(let i=0;i<3;i++)assert.equal((await core.saveStream(dir,source([[i+1]]),'image',undefined,undefined,start+i)).name,`${start+i}.png`);
  const existing=dir.files.get(`${start}.png`);
  await assert.rejects(core.saveStream(dir,source([[8]]),'image',undefined,undefined,start));
  assert.deepEqual(dir.files.get(`${start}.png`),existing);
 }
 for(const value of ['',0,-1,1.5,'abc',Number.MAX_SAFE_INTEGER])assert.throws(()=>core.startNumber(value));
});