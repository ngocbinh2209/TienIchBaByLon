'use strict';
// Run: node --experimental-websocket tests/creating-flow.browser.cjs
// Isolated Chrome profile, mocked Chrome extension transport and local Flow DOM; no Google requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),artifact=path.join(root,'.test-artifacts',String(Date.now()));fs.mkdirSync(artifact,{recursive:true});
const fixture=`<!doctype html><html><head><style>article .more{display:none}article:hover .more{display:block;position:absolute;right:8px;top:8px}article{position:relative}[role=menu]{position:fixed;left:340px;top:30px;background:white;padding:12px;z-index:10}[role=menu] button{display:block;min-width:110px;min-height:38px}</style></head><body><div id="gallery"></div><div id="composer" style="position:relative;width:600px;height:160px"><textarea id="prompt" style="width:500px;height:70px" placeholder="Prompt"></textarea><button type="button" id="mode">Tác nhân</button><button type="button" aria-label="Thêm">+</button><button type="button" id="send" disabled style="position:absolute;right:8px;bottom:8px;width:40px;height:40px"><svg width="24" height="24"><path d="M2 12h20" /></svg></button></div><script src="/creating-flow-driver.js"></script><script>
let prompt=document.getElementById('prompt'),send=document.getElementById('send');const gallery=document.getElementById('gallery');let sends=0,clicks=0,expanded=false;window.created=[];window.downloads=[];window.orderErrors=[];
async function imageBlob(color,width){const c=document.createElement('canvas');c.width=width;c.height=width*9/16;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,c.width,c.height);return new Promise(r=>c.toBlob(r));}
async function addImage(color){
 const b=await imageBlob(color,320),original=await imageBlob(color,2048);
 const card=document.createElement('article');card.style.cssText='width:320px;height:220px';
 const img=new Image();img.src=URL.createObjectURL(b);await img.decode();card.append(img);
 const more=document.createElement('button');more.type='button';more.className='more';more.innerHTML='<svg width=18 height=18><circle cx=9 cy=3 r=1 /><circle cx=9 cy=9 r=1 /><circle cx=9 cy=15 r=1 /></svg>';more.setAttribute('aria-haspopup','menu');card.append(more);gallery.append(card);
 more.onclick=()=>{
  document.querySelectorAll('[role=menu]').forEach(el=>el.remove());
  const menu=document.createElement('div');menu.setAttribute('role','menu');
  const download=document.createElement('button');download.setAttribute('role','menuitem');download.textContent='Tải xuống';download.setAttribute('aria-haspopup','menu');menu.append(download);document.body.append(menu);
  const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;z-index:100;background:transparent';document.body.append(cover);setTimeout(()=>cover.remove(),650);
  const center=document.createElement('div');const dr=download.getBoundingClientRect();center.style.cssText='position:fixed;z-index:20;width:12px;height:12px;left:'+(dr.left+dr.width/2-6)+'px;top:'+(dr.top+dr.height/2-6)+'px';document.body.append(center);
  setTimeout(()=>center.remove(),2000);

  download.onpointerenter=event=>{if(!event.isTrusted)return;
   const sub=document.createElement('div');sub.setAttribute('role','menu');sub.style.left='485px';const one=document.createElement('button');one.setAttribute('role','menuitem');one.textContent='1K Kích thước gốc';one.onclick=()=>{throw Error('Wrong quality: 1K');};sub.append(one);const choice=document.createElement('button');choice.setAttribute('role','menuitem');choice.textContent='2K Đã tăng độ phân giải';sub.append(choice);document.body.append(sub);
   choice.onclick=()=>{const url=URL.createObjectURL(original),a=document.createElement('a');a.href=url;a.download='original.png';a.click();URL.revokeObjectURL(url);window.downloads.push(color);menu.remove();sub.remove();};
  };
 };
 return img;
}
function bind(){prompt.addEventListener('input',()=>{send.disabled=!prompt.value;});send.addEventListener('click',async(event)=>{
 clicks++;
 if(window.noSubmit)return;
 if(!expanded){expanded=true;const replacement=prompt.cloneNode(true);replacement.value=prompt.value;prompt.replaceWith(replacement);prompt=replacement;const next=send.cloneNode(true);send.replaceWith(next);send=next;document.getElementById('mode').remove();bind();return;}
 if(window.requireTrusted && !event.isTrusted)return;
 if(sends && (parent.__savedCount||0)<sends)window.orderErrors.push('next prompt before file close');
 sends++;window.created.push(prompt.value);prompt.value='';await addImage(sends%2?'red':'blue');
});}
window.initial=addImage('gray');bind();window.testSends=()=>sends;window.testClicks=()=>clicks;
</script></body></html>`;
const mock=`<script>
window.__stored={};window.chrome={storage:{local:{get:async key=>({[key]:window.__stored[key]}),set:async obj=>Object.assign(window.__stored,obj)}},tabs:{query:async()=>[{id:1,url:'https://flow.google.com/project/test',title:'Flow fixture'}],get:async()=>({id:1,url:window.__changed?'https://flow.google.com/project/other':'https://flow.google.com/project/test'})},scripting:{executeScript:async spec=>[{result:await document.querySelector('#fixture').contentWindow.creatingFlowPage(...spec.args)}]},runtime:{getURL:x=>'/'+x},windows:{create:async()=>{}}};
window.__mousePending=new Map();let mouseId=0;chrome.debugger={getTargets:async()=>[],attach:async()=>{},detach:async()=>{},sendCommand:async(target,method,params)=>new Promise((resolve,reject)=>{const id=++mouseId;__mousePending.set(id,{resolve,reject});nativeCDP(JSON.stringify({id,method,params}));})};
window.showDirectoryPicker=async()=>{const d=await navigator.storage.getDirectory();window.__dir=d;d.queryPermission=async()=> 'granted';return d;};
</script>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;}
 const file=url.pathname==='/'?'creating-flow.html':url.pathname.slice(1);
 if(!/^creating-flow(?:-core|-driver)?\.(?:html|js|css)$/.test(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css');
 let body=fs.readFileSync(path.join(root,file));
 if(file.endsWith('.html'))body=body.toString().replace('<script src="creating-flow-core.js">',mock+'<iframe id="fixture" src="/fixture" style="width:650px;height:550px;position:fixed;left:0;top:0;border:0;z-index:10000"></iframe><script src="creating-flow-core.js">');
 res.end(body);
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 const chrome=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
 const child=spawn(chrome,['--headless=new','--window-size=1100,1000','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-component-update','--remote-debugging-port=0','--user-data-dir='+path.join(artifact,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let ws;
 try {
  const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);child.stderr.on('data',data=>{text+=data;const m=/DevTools listening on (ws:\/\/[^\s]+)/.exec(text);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
  ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map();
  ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},20000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});
  console.log('Chrome connected');
  const {targetId}=await send('Target.createTarget',{url:`http://127.0.0.1:${port}/`});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.addBinding',{name:'nativeCDP'},sessionId);
  ws.addEventListener('message',async e=>{
    const event=JSON.parse(e.data);if(event.method!=='Runtime.bindingCalled'||event.params.name!=='nativeCDP')return;
    const request=JSON.parse(event.params.payload);let failure='';
    try{await send(request.method,request.params,sessionId);}catch(error){failure=error.message;}
    await send('Runtime.evaluate',{expression:`{const p=window.__mousePending.get(${request.id});if(p){window.__mousePending.delete(${request.id});${failure?'p.reject(new Error('+JSON.stringify(failure)+'))':'p.resolve({})'};}}`},sessionId);
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  for(let i=0;i<50;i++){if(await evaluate(`!!document.querySelector('#fixture')?.contentWindow?.creatingFlowPage && !!window.BaByLonCreatingFlow`))break;await wait(200);}
  console.log('UI loaded');
  await send('Runtime.enable',{},sessionId);
  await send('Runtime.addBinding',{name:'nativeCDP'},sessionId);
  await evaluate(`document.querySelector('#fixture').contentWindow.initial`);
  await evaluate(`window.__savedCount=0;const save=CreatingFlowCore.saveStream;CreatingFlowCore.saveStream=async(...args)=>{const r=await save(...args);window.__savedCount++;return r;};`);
  await evaluate(`document.getElementById('cfPrompts').value='Cảnh thứ nhất\\nCảnh thứ hai'.replace(/\\\\n/g,'\\n');document.getElementById('cfPrompts').dispatchEvent(new Event('input'));document.getElementById('cfFolder').click()`);
  for(let i=0;i<30;i++){if(await evaluate(`!!window.__dir && document.getElementById('cfFolderName').textContent.includes('bắt đầu từ')`))break;await wait(100);}
  await evaluate(`document.getElementById('cfStart').click()`);
  let status='';
  for(let i=0;i<250;i++){await wait(200);status=await evaluate(`document.getElementById('cfStatus').textContent`);if(/^Hoàn tất/.test(status))break;if(await evaluate(`document.getElementById('cfStatus').dataset.error==='true'`))throw Error(status);}
  console.log('Batch status:',status);
  assert.match(status,/Hoàn tất · 2 file/);
  const names=await evaluate(`(async()=>{const out=[];for await(const [name,handle]of __dir.entries())out.push({name,size:(await handle.getFile()).size});return out.sort((a,b)=>a.name.localeCompare(b.name));})()`);
  assert.deepEqual(names.map(n=>n.name),['1.png','2.png']);assert.ok(names.every(n=>n.size>100));
  assert.equal(await evaluate(`document.querySelector('#fixture').contentWindow.testSends()`),2);
  assert.equal(await evaluate(`document.querySelector('#fixture').contentWindow.testClicks()`),3);
  assert.deepEqual(await evaluate(`document.querySelector('#fixture').contentWindow.downloads`),['red','blue']);
  assert.deepEqual(await evaluate(`document.querySelector('#fixture').contentWindow.orderErrors`),[]);
  assert.deepEqual(await evaluate(`(async()=>{const sizes=[];for(const name of ['1.png','2.png']){const file=await (await __dir.getFileHandle(name)).getFile();const bitmap=await createImageBitmap(file);sizes.push(bitmap.width);bitmap.close();}return sizes;})()`),[2048,2048]);
  // Completed UI screenshot and output evidence.
  await evaluate(`document.querySelector('#fixture').style.visibility='hidden'`);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);fs.writeFileSync(path.join(artifact,'creating-flow.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('#fixture').style.visibility='visible'`);
  // Driver isolation: old media excluded, foreign session rejected, new video accepted only after stable polls.
  const driverResults=await evaluate(`(async()=>{
   const w=document.querySelector('#fixture').contentWindow;
   const mode=w.document.createElement('button');mode.textContent='Tác nhân';w.document.getElementById('composer').append(mode);
   await w.creatingFlowPage('claim',{owner:'audit'});
   const rejected=await w.creatingFlowPage('claim',{owner:'other'});const blocked=rejected.driverError===true && /cửa sổ khác/.test(rejected.error);
   const button=w.document.getElementById('send');button.innerHTML='<svg width="24" height="24"><path d="M2 12h20" /></svg>';button.style.cssText='position:absolute;right:8px;bottom:8px;width:40px;height:40px';button.parentElement.style.position='relative';
   const submitted=await w.creatingFlowPage('submit',{owner:'audit',mode:'video',prompt:'video test'});
   if(!submitted.ok)throw Error(submitted.error);
   const v=w.document.createElement('video');v.src=w.URL.createObjectURL(new Blob([new Uint8Array(300000)],{type:'video/mp4'}));
   for(const [k,value] of Object.entries({readyState:2,duration:4,videoWidth:640,videoHeight:360}))Object.defineProperty(v,k,{value});
   w.document.getElementById('gallery').append(v);
   await w.creatingFlowPage('poll',{owner:'audit'});await w.creatingFlowPage('poll',{owner:'audit'});
   const found=await w.creatingFlowPage('poll',{owner:'audit'});
   const info=await w.creatingFlowPage('open',{owner:'audit',src:v.src});let bytes=0,max=0;
   for(;;){const c=await w.creatingFlowPage('read',{owner:'audit'});if(c.done)break;bytes+=c.value.length;max=Math.max(max,c.value.length);}
   await w.creatingFlowPage('release',{owner:'audit'});
   return {blocked,results:found.results.length,type:info.type,bytes,max};
  })()`);
  assert.deepEqual(driverResults,{blocked:true,results:1,type:'video/mp4',bytes:300000,max:131072});
  const rejectedSubmit=await evaluate(`(async()=>{
   const w=document.querySelector('#fixture').contentWindow;
   w.noSubmit=true;
   await w.creatingFlowPage('claim',{owner:'no-submit'});
   const before=w.testClicks();
   const result=await w.creatingFlowPage('submit',{owner:'no-submit',mode:'image',prompt:'must not report success'});
   await w.creatingFlowPage('release',{owner:'no-submit'});w.noSubmit=false;
   return {deferred:result.needsTrustedClick===true,confirmed:result.confirmed,clicks:w.testClicks()-before};
  })()`);
  assert.equal(rejectedSubmit.deferred,true);assert.equal(rejectedSubmit.confirmed,false);assert.equal(rejectedSubmit.clicks,1);
  // A separate visible top-level fixture rejects JS clicks and accepts actual CDP mouse input.
  const nativeTarget=await send('Target.createTarget',{url:`http://127.0.0.1:${port}/fixture`});
  const nativeSession=(await send('Target.attachToTarget',{targetId:nativeTarget.targetId,flatten:true})).sessionId;
  const nativeEval=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},nativeSession);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  for(let i=0;i<50;i++){if(await nativeEval('!!window.creatingFlowPage && !!window.initial'))break;await wait(100);}
  await nativeEval('window.initial');
  await nativeEval("window.requireTrusted=true;creatingFlowPage('claim',{owner:'native'})");
  const nativePending=await nativeEval("creatingFlowPage('submit',{owner:'native',mode:'image',prompt:'Trusted mouse fixture'})");
  assert.equal(nativePending.needsTrustedClick,true);assert.equal(await nativeEval('testSends()'),0);
  const input=await nativeEval("creatingFlowPage('nativePrepare',{owner:'native'})");
  assert.equal(input.driverError,undefined);assert.match(input.text,/Trusted mouse fixture/);
  await nativeEval("window.trustedInput=false;document.addEventListener('input',e=>{if(e.isTrusted)window.trustedInput=true;},true)");
  await send('Input.insertText',{text:input.text},nativeSession);
  assert.equal(await nativeEval('window.trustedInput'),true);
  let point=await nativeEval("creatingFlowPage('nativeReady',{owner:'native'})");
  await nativeEval("window.__babylonCreatingFlowV1.nativePending.button.style.transform='translateX(-30px)'");
  const oldX=point.x;
  point=await nativeEval("creatingFlowPage('nativeReady',{owner:'native',remeasure:true})");
  assert.ok(Math.abs(point.x-oldX+30)<1);

  assert.equal(point.driverError,undefined);assert.ok(Number.isFinite(point.x));
  for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})},nativeSession);
  assert.equal(await nativeEval('window.__babylonCreatingFlowV1.nativePending.events.click'),true);
  const nativeConfirmed=await nativeEval("creatingFlowPage('nativeConfirm',{owner:'native'})");assert.equal(nativeConfirmed.confirmed,true);
  assert.equal(await nativeEval('testSends()'),1);
  const tooEarly=await nativeEval("creatingFlowPage('submit',{owner:'native',mode:'image',prompt:'must wait'})");
  assert.equal(tooEarly.driverError,true);assert.match(tooEarly.error,/chưa tạo và lưu xong/);
  const earlyComplete=await nativeEval("creatingFlowPage('complete',{owner:'native'})");assert.equal(earlyComplete.driverError,true);
  await nativeEval("creatingFlowPage('release',{owner:'native'})");
  fs.writeFileSync(path.join(artifact,'results.json'),JSON.stringify({status,names,driverResults,rejectedSubmit,nativeConfirmed,tooEarly},null,2));
  console.log('Browser fixture PASS: Agent panel transition, confirmed submission, original-image menu download, save-before-next-prompt, video stream, lock, rejected unacknowledged submission.');console.log(artifact);
  await send('Browser.close').catch(()=>{});
 } finally {ws?.close();child.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});