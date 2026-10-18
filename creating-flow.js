/* Creating Flow UI: one active batch, sequential generations and durable file numbering. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), core = globalThis.CreatingFlowCore;
  const STORE = 'babylon_creating_flow_v1';
  let directory=null, running=false, controller=null, queue=[], owner='', tabId=null, projectUrl='', lastSnapshot=null, ready;
  const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
  const status = (text,error=false) => { $('cfStatus').textContent=text; $('cfStatus').dataset.error=String(error); };
  const draft = () => ({startNumber:$('cfStartNumber').value,prompts:$('cfPrompts').value,mode:$('cfMode').value,timeout:$('cfTimeout').value,tab:$('cfTab').value});
  const persist = () => chrome.storage.local.set({[STORE]:{...draft(),queue,lastSnapshot}}).catch(()=>{});
  function controls() {
    for(const id of ['cfStartNumber','cfMode','cfTimeout','cfTab','cfRefresh','cfPrompts','cfFolder','cfStart','cfWindow']) $(id).disabled=running;
    $('cfStop').disabled=!running;
  }
  function render() {
    $('cfQueue').replaceChildren();
    for(const [i,item] of queue.entries()) {
      const li=document.createElement('li');li.dataset.state=item.state;
      const head=document.createElement('strong');head.textContent=`Prompt ${i+1} · ${item.label}`;
      const text=document.createElement('p');text.textContent=item.prompt;
      const detail=document.createElement('small');detail.textContent=[item.files.length?'Đã lưu: '+item.files.join(', '):'',item.detail||''].filter(Boolean).join(' · ');
      li.append(head,text,detail);$('cfQueue').append(li);
    }
    const complete=queue.filter(q=>q.state==='done').length, files=queue.reduce((n,q)=>n+q.files.length,0);
    $('cfSummary').textContent=queue.length?`${complete}/${queue.length} prompt hoàn tất · ${files} file đã lưu`:'Chưa có đợt chạy';
  }
  async function tabs() {
    const old=$('cfTab').value;
    const list=(await chrome.tabs.query({})).filter(t=>core.isFlowProject(t.url));
    $('cfTab').replaceChildren();
    for(const t of list) { const option=document.createElement('option');option.value=String(t.id);option.textContent=t.title||t.url;option.title=t.url;$('cfTab').append(option); }
    if(list.some(t=>String(t.id)===old)) $('cfTab').value=old;
    if(!list.length) { const o=document.createElement('option');o.value='';o.textContent='Mở một dự án Google Flow trước';$('cfTab').append(o); }
  }
  async function page(action, more={}) {
    if(action!=='release'&&action!=='close') {
      const tab=await chrome.tabs.get(tabId);
      if(tab.url!==projectUrl||!core.isFlowProject(tab.url)) throw Error('Tab Flow đã chuyển dự án. Đã dừng để tránh tải nhầm.');
    }
    const rows=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:creatingFlowPage,args:[action,{owner,...more}]});
    const value=rows?.[0]?.result;
    if(!value) throw Error(rows?.[0]?.error?.message||'Flow không trả phản hồi. Kiểm tra tab dự án.');
    if(value.driverError) throw Error('Flow ['+action+']: '+value.error);
    return value;
  }
  async function chooseFolder() {
    try {
      if(!window.showDirectoryPicker) throw Error('Trình duyệt chưa hỗ trợ chọn thư mục. Hãy dùng Chrome/Cốc Cốc bản hỗ trợ và mở cửa sổ chạy riêng.');
      const selected=await showDirectoryPicker({id:'babylon-creating-flow',mode:'readwrite'});
      if(await selected.queryPermission({mode:'readwrite'})!=='granted') throw Error('Chưa có quyền ghi vào thư mục.');
      const number=core.startNumber($('cfStartNumber').value);
      directory=selected;$('cfFolderName').textContent=`${selected.name} · bắt đầu từ ${number}`;
      status('Đã chọn thư mục. Mỗi file hoàn tất sẽ được lưu tự động vào đây.');
    } catch(e) { if(e.name!=='AbortError')status(e.message,true); }
  }
  async function sourceFor(item, signal) {
    // Extension host permissions allow direct signed media URLs without buffering the video.
    if(item.src.startsWith('https:')) {
      try {
        const response=await fetch(item.src,{credentials:'omit',signal});
        if(response.ok&&response.body) {
          try { core.extensionFor(response.headers.get('content-type'),$('cfMode').value); }
          catch(e) { await response.body.cancel();throw e; }
          const reader=response.body.getReader();
          return {type:response.headers.get('content-type'),read:()=>reader.read(),close:()=>reader.cancel().catch(()=>{})};
        }
        await response.body?.cancel();
      } catch(e) { signal.throwIfAborted(); }
    }
    signal.throwIfAborted();
    const info=await page('open',{src:item.src});
    try { core.extensionFor(info.type,$('cfMode').value); } catch(e) {await page('close');throw e;}
    return {type:info.type,read:async()=>{signal.throwIfAborted();const c=await page('read');return {done:c.done,value:c.value?new Uint8Array(c.value):undefined};},close:()=>page('close').catch(()=>{})};
  }
  async function nativeSubmit(signal) {
    if(!chrome.debugger)throw Error('Trình duyệt chưa cấp quyền điều khiển nút gửi. Tải lại tiện ích BaByLon.');
    const target={tabId};let attached=false,pressed=false;
    try {
      signal.throwIfAborted();
      const targets=await chrome.debugger.getTargets();
      if(targets.some(t=>t.tabId===tabId&&t.attached))throw Error('Tab Flow đang được công cụ khác điều khiển. Đóng DevTools/công cụ đó rồi chạy lại.');
      await chrome.debugger.attach(target,'1.3');attached=true;
      signal.throwIfAborted();
      for(let stage=0;stage<2;stage++) {
      const input=await page('nativePrepare');
      signal.throwIfAborted();
      await chrome.debugger.sendCommand(target,'Input.insertText',{text:input.text});
      await sleep(250);signal.throwIfAborted();
      let point=await page('nativeReady');
      if(point.confirmed)return;
      signal.throwIfAborted();
      await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
      await sleep(150);signal.throwIfAborted();
      point=await page('nativeReady',{remeasure:true});
      if(point.confirmed)return;
      signal.throwIfAborted();
      await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});pressed=true;
      await sleep(80);
      await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});pressed=false;
      signal.throwIfAborted();
      const confirmation=await page('nativeConfirm');
      if(confirmation.confirmed)return;
      if(!confirmation.needsTrustedClick)throw Error('Flow chưa xác nhận gửi.');
      }
      throw Error('Khung Flow thay đổi nhiều lần; đã dừng gửi.');
    } finally {
      if(attached) {
        if(pressed)await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x:0,y:0,button:'left',clickCount:1}).catch(()=>{});
        await chrome.debugger.detach(target).catch(()=>{});
      }
    }
  }
  async function download2K(result, signal) {
    const target={tabId};let attached=false;
    try {
      signal.throwIfAborted();
      if(!chrome.debugger)throw Error('Thiếu quyền điều khiển chuột Chrome để mở menu tải.');
      const targets=await chrome.debugger.getTargets();
      if(targets.some(t=>t.tabId===tabId&&t.attached))throw Error('Tab Flow đang được công cụ khác điều khiển. Đóng công cụ đó trước khi tải.');
      await chrome.debugger.attach(target,'1.3');attached=true;
      let step=await page('downloadStart',{key:result.key});
      const deadline=Date.now()+195000;
      while(Date.now()<deadline){
        signal.throwIfAborted();
        if(step.done)return step;
        if(step.stage)status(step.stage+'…');
        const point=step.click||step.move;
        if(point){
          await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
          if(step.click){
            signal.throwIfAborted();
            await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
            await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
          }
        }
        await sleep(250);signal.throwIfAborted();step=await page('downloadStep');
      }
      throw Error('Hết thời gian chờ tải 2K.');
    }finally{
      await page('downloadCancel').catch(()=>{});
      if(attached)await chrome.debugger.detach(target).catch(()=>{});
    }
  }
  async function perform(prompts, signal) {
    const selected=await chrome.tabs.get(Number($('cfTab').value));
    if(!core.isFlowProject(selected.url)) throw Error('Hãy chọn một dự án Flow hợp lệ.');
    tabId=selected.id;projectUrl=selected.url;owner=crypto.randomUUID();
    await page('claim');
    queue=prompts.map(prompt=>({prompt,state:'waiting',label:'Chờ',files:[],detail:''}));render();
    let fileNumber=core.startNumber($('cfStartNumber').value);
    const mode=$('cfMode').value, timeout=Number($('cfTimeout').value)*1000;
    for(const item of queue) {
      signal.throwIfAborted();item.state='running';item.label='Đang gửi';render();await persist();
      try {
        status(`Đang gửi prompt ${queue.indexOf(item)+1}/${queue.length}…`);
        const submitted=await page('submit',{prompt:item.prompt,mode,nativeFirst:true});
        if(submitted.needsTrustedClick){status('Đang bấm nút gửi của prompt hiện tại…');await nativeSubmit(signal);}
        item.label='Đang chờ Flow';render();status('Flow đã nhận prompt. Đang chờ kết quả mới…');
        let deadline=Date.now()+timeout;let lastResult=0,settled=false;
        while(Date.now()<deadline) {
          signal.throwIfAborted();await sleep(1200);signal.throwIfAborted();
          const poll=await page('poll');
          if(poll.error) throw Error('Flow: '+poll.error);
          for(const result of poll.results||[]) {
            signal.throwIfAborted();item.label='Đang mở ⋮ → Tải xuống';render();status('Đã có kết quả. Đang mở menu Tải xuống…');
            const downloadable=await download2K(result,signal);
            signal.throwIfAborted();item.label='Đang lưu file';render();
            const transfer=AbortSignal.any([signal,AbortSignal.timeout(10*60*1000)]);
            const source=await sourceFor(downloadable,transfer);
            const saved=await core.saveStream(directory,source,mode,transfer,bytes=>status(`Đang lưu kết quả · ${(bytes/1048576).toFixed(1)} MB`),fileNumber);
            fileNumber=saved.number+1;
            item.files.push(saved.name);await page('saved',{key:result.key});lastResult=Date.now();deadline=Math.max(deadline,lastResult+15000);render();await persist();
          }
          // Allow multiple outputs from one prompt to settle before submitting the next prompt.
          if(item.files.length&&!poll.busy&&Date.now()-lastResult>=12000) {settled=true;break;}
        }
        if(!item.files.length) throw Error('Hết thời gian chờ kết quả mới. Đã dừng; kiểm tra Flow trước khi chạy lại để tránh tạo trùng.');
        if(!settled) throw Error('Đã lưu một phần kết quả nhưng Flow chưa hoàn tất trong thời gian chờ. Đã dừng để tránh lẫn kết quả prompt tiếp theo.');
        await page('complete');
        item.state='done';item.label='Hoàn tất';render();await persist();
      } catch(e) {
        item.state='error';item.label=signal.aborted?'Đã dừng':'Lỗi';item.detail=e.message;render();await persist();throw e;
      }
    }
    status(`Hoàn tất · ${queue.reduce((n,q)=>n+q.files.length,0)} file đã lưu vào ${directory.name}.`);
  }
  async function start() {
    if(running)return;
    try {
      await ready;
      core.startNumber($('cfStartNumber').value);
      const prompts=core.parsePrompts($('cfPrompts').value);
      if(!directory) throw Error('Chọn thư mục lưu trước khi bắt đầu.');
      if(await directory.queryPermission({mode:'readwrite'})!=='granted') throw Error('Quyền thư mục đã hết. Bấm Chọn thư mục để cấp lại.');
      await tabs();
      if(!$('cfTab').value) throw Error('Không tìm thấy dự án Flow. Mở Flow trong cùng trình duyệt và hồ sơ đang chạy BaByLon.');
      if(!navigator.locks)throw Error('Trình duyệt thiếu khóa phiên. Hãy cập nhật Chrome/Cốc Cốc.');
      await navigator.locks.request('babylon-creating-flow-batch',{ifAvailable:true},async lock=>{
        if(!lock)throw Error('Creating Flow đang chạy trong cửa sổ khác.');
        running=true;controller=new AbortController();controls();lastSnapshot=null;
        try { await perform(prompts,controller.signal); }
        finally {
          if(tabId&&owner)await page('release').catch(()=>{});
          for(const item of queue) if(item.state==='waiting'){item.state='stopped';item.label='Chưa chạy';}
          lastSnapshot=new Date().toLocaleString('vi-VN');running=false;controller=null;controls();render();await persist();
        }
      });
    } catch(e) {status(e.name==='AbortError'?'Đã dừng. Tác vụ đã gửi vẫn có thể tiếp tục trên Flow.':e.message,true);}
  }
  async function openWindow() {
    await persist();await chrome.windows.create({url:chrome.runtime.getURL('creating-flow.html'),type:'popup',width:860,height:900});
  }
  async function restore() {
    try {
      const saved=(await chrome.storage.local.get(STORE))[STORE];
      if(saved) {
        $('cfStartNumber').value=saved.startNumber||'1';
        $('cfPrompts').value=saved.prompts||'';$('cfMode').value=saved.mode==='video'?'video':'image';
        $('cfTimeout').value=['60','120','180'].includes(saved.timeout)?saved.timeout:'180';
        queue=Array.isArray(saved.queue)?saved.queue.map(q=>({...q,state:q.state==='running'?'stopped':q.state,label:q.state==='running'?'Phiên trước đã đóng':q.label})):[];
        lastSnapshot=saved.lastSnapshot;render();
      }
      await tabs();
      if(saved?.tab && [...$('cfTab').options].some(o=>o.value===saved.tab))$('cfTab').value=saved.tab;
    } catch(e) {status('Không khôi phục được bản nháp: '+e.message,true);}
    $('cfCount').textContent=$('cfPrompts').value.split(/\r\n?|\n/).filter(s=>s.trim()).length+' prompt';
  }
  function init() {
    if(!$('cfStart'))return;
    ready=restore();controls();
    $('cfFolder').addEventListener('click',chooseFolder);
    $('cfRefresh').addEventListener('click',()=>tabs().catch(e=>status(e.message,true)));
    $('cfStart').addEventListener('click',start);
    $('cfStop').addEventListener('click',()=>{controller?.abort();status('Đang dừng, không gửi thêm prompt…');if(tabId&&owner)page('release').catch(()=>{});});
    $('cfWindow').addEventListener('click',()=>openWindow().catch(e=>status(e.message,true)));
    for(const id of ['cfStartNumber','cfPrompts','cfMode','cfTimeout','cfTab'])$(id).addEventListener('input',()=>{
      if(directory)$('cfFolderName').textContent=directory.name+' · bắt đầu từ '+$('cfStartNumber').value;
      $('cfCount').textContent=$('cfPrompts').value.split(/\r\n?|\n/).filter(s=>s.trim()).length+' prompt';persist();
    });
    $('flowBatchAiPromptBtn')?.addEventListener('click',()=>{$('tabCreatingFlow')?.click();});
    window.addEventListener('beforeunload',e=>{if(running){e.preventDefault();e.returnValue='';}});
  }
  window.BaByLonCreatingFlow={onOpen:async()=>{await ready;if(!running)await tabs();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();