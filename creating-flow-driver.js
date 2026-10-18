/* Injected, self-contained adapter. No private Flow API, no duplicate submission retry. */
async function creatingFlowPage(action, args) {
  'use strict';
  args = args || {};
  try {
  const KEY = '__babylonCreatingFlowV1';
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return el.isConnected && r.width > 3 && r.height > 3 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const label = el => norm([el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-tooltip'),el.textContent].filter(Boolean).join(' '));
  const all = selector => {
    const roots = [document], found = [];
    for (const root of roots) { found.push(...root.querySelectorAll(selector)); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot); }
    return found;
  };
  const sourceKey = src => { try { const u = new URL(src); for (const k of ['w','h','width','height','sz']) u.searchParams.delete(k); u.hash = ''; return u.href; } catch { return src; } };
  const media = mode => all(mode === 'video' ? 'video' : 'img').map(el => {
    const src = el.currentSrc || el.src || el.querySelector?.('source[src]')?.src || '';
    const w = mode === 'video' ? el.videoWidth : el.naturalWidth, h = mode === 'video' ? el.videoHeight : el.naturalHeight;
    const ready = mode === 'video' ? el.readyState >= 1 && el.duration > 0 : el.complete;
    return {node:el,src,key:sourceKey(src),ready:!!ready && w >= 256 && h >= 144,width:w,height:h};
  }).filter(x => /^(https:|blob:)/.test(x.src));
  const errorText = () => all('[role="alert"],[role="alertdialog"],[aria-live="assertive"]')
    .filter(visible).map(el => norm(el.textContent)).filter(t => /failed|error|unable|quota|limit|captcha|verify|lỗi|thất bại|không thể|hạn mức|xác minh/.test(t)).join(' · ').slice(0,450);
  function composer() {
    const fields = all('textarea,[contenteditable="true"],[role="textbox"]').filter(visible).filter(el => !/search|tìm kiếm/.test(label(el) + ' ' + el.getAttribute('placeholder')));
    fields.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    const field = fields[0]; if (!field) throw Error('Không tìm thấy ô prompt Flow. Mở một dự án và giữ ô nhập hiển thị.');
    let area = field.parentElement;
    for (let i=0;area && i<7;i++,area=area.parentElement) {
      const r=area.getBoundingClientRect();
      if (area.querySelectorAll('button,[role="button"]').length >= 2 && r.height < Math.max(500, innerHeight * .98) && r.width >= 260) return {field,area};
    }
    throw Error('Không nhận diện được khung tạo của Flow. Không gửi prompt để tránh bấm nhầm.');
  }
  let state = window[KEY];
  if (action === 'inspect') { composer(); return {ok:true,title:document.title}; }
  if (action === 'release') {
    if (state?.owner === args.owner) { state.stopped=true; state.submitCleanup?.(); state.menuCleanup?.(); state.fetchController?.abort(); if (state.reader) await state.reader.cancel().catch(()=>{}); for(const url of state.downloadBlobs||[])URL.revokeObjectURL(url);delete window[KEY]; }
    return {ok:true};
  }
  if (action === 'claim') {
    if (state && state.owner !== args.owner && Date.now()-state.ping < 90000) throw Error('Creating Flow đang chạy trên trang này trong cửa sổ khác.');
    state = window[KEY] = {owner:args.owner,ping:Date.now(),stopped:false};
    composer(); return {ok:true};
  }
  if (!state || state.owner !== args.owner || state.stopped) throw Error('Phiên Flow đã thay đổi hoặc dừng.');
  state.ping = Date.now();
  if (action === 'submit') {
    if(state.awaitingResult)throw Error('Prompt trước chưa tạo và lưu xong. Chưa gửi prompt tiếp theo.');
    const initialError=errorText(); if (initialError) throw Error('Flow đang báo: '+initialError);
    let {field,area}=composer();
    const mode = args.mode;
    const controlText = el => norm(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent).replace(/\b(?:arrow_drop_down|expand_more|keyboard_arrow_down)\b/g, '').trim();
    const modePattern = mode === 'video' ? /^(?:text to video|video|videos|tạo video|văn bản thành video)$/ : /^(?:text to image|image|images|create image|create images|tạo ảnh|hình ảnh|ảnh)$/;
    const controls = [...area.querySelectorAll('button,[role="button"],[role="combobox"]')].filter(visible);
    const currentMode = controls.find(el => /text to video|text to image|create image|tạo ảnh|tạo video|văn bản thành|^(images?|videos?|hình ảnh)$/.test(label(el)));
    const agentMode = controls.some(el => /\bagent\b|tác nhân/.test(label(el))) || (!currentMode && state.agentMode===true);
    if (currentMode && !modePattern.test(controlText(currentMode))) {
      currentMode.click(); await wait(350);
      const choices = all('[role="option"],[role="menuitem"],[role="tab"],button').filter(visible).filter(el => modePattern.test(controlText(el)) && el !== currentMode);
      if (choices.length !== 1) throw Error('Không xác định được lựa chọn ảnh/video trong Flow. Chọn chế độ trên Flow rồi chạy lại.');
      choices[0].click(); await wait(350);
      ({field,area}=composer());
      if (![...area.querySelectorAll('button,[role="button"],[role="combobox"]')].some(el => modePattern.test(controlText(el)))) throw Error('Flow chưa xác nhận chế độ đã chọn.');
    } else if (!currentMode && !agentMode) throw Error('Chưa xác định chế độ tạo. Mở chế độ Ảnh/Video hoặc Tác nhân trong Flow.');
    const prompt = agentMode && !currentMode
      ? `${mode==='video'?'Generate exactly one video':'Generate exactly one image'}. Use this prompt:\n${args.prompt}` : args.prompt;
    const findSend = () => {
      const buttons = [...area.querySelectorAll('button,[role="button"]')].filter(visible);
      const excluded = el => /settings|tune|cài đặt|tác nhân|agent|attach|upload|add|plus|thêm|aspect|model|expand|close|cancel|hủy/.test(label(el));
      const named = buttons.filter(el => !excluded(el) && (el.type === 'submit' || /(?:^|\s)(?:arrow_forward|arrow_upward|send|generate|create|gửi|tạo)(?:\s|$)/.test(label(el))));
      if (named.length === 1) return named[0];
      if (named.length > 1) throw Error('Có nhiều nút Tạo trong khung Flow. Chưa gửi prompt.');
      // Flow also renders an unlabeled SVG arrow at the bottom-right of its composer.
      const box = area.getBoundingClientRect();
      const arrows = buttons.filter(el => {
        if (excluded(el) || !el.querySelector('svg')) return false;
        const r = el.getBoundingClientRect();
        return r.width >= 24 && r.width <= 80 && r.height >= 24 && r.height <= 80 &&
          r.right >= box.right - 32 && r.bottom >= box.bottom - 40 && !label(el);
      });
      if (arrows.length === 1) return arrows[0];
      throw Error('Không tìm thấy nút mũi tên Tạo trong khung prompt Flow.');
    };
    if (all('[role="progressbar"],[aria-busy="true"]') .some(visible)) throw Error('Flow đang xử lý tác vụ khác. Hãy chờ xong rồi bắt đầu.');
    state.beforeNodes = new Set(all(mode === 'video' ? 'video' : 'img'));
    state.before = new Set(media(mode).map(x => x.key)); state.stable = {}; state.seen = new Set(); state.mode=mode;
    field.focus();
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      const proto=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(field,prompt);
      field.dispatchEvent(new Event('input',{bubbles:true})); field.dispatchEvent(new Event('change',{bubbles:true}));
    } else {
      const range=document.createRange();range.selectNodeContents(field); const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
      if (!document.execCommand('insertText',false,prompt)) { field.textContent=prompt; field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:prompt})); }
    }
    await wait(300);
    if (window[KEY] !== state || state.stopped) throw Error('Đã dừng trước khi gửi.');
    if (norm(field.value ?? field.innerText ?? field.textContent) !== norm(prompt)) throw Error('Flow chưa nhận đủ prompt. Chưa gửi.');
    let send;
    for(let attempt=0;attempt<20;attempt++){
      ({field,area}=composer());send=findSend();
      if(!send.disabled && send.getAttribute('aria-disabled')!=='true')break;
      await wait(200);
      if(window[KEY]!==state || state.stopped)throw Error('Đã dừng trước khi gửi.');
    }
    if(!send || send.disabled || send.getAttribute('aria-disabled')==='true')throw Error('Flow đã nhận prompt nhưng nút Tạo vẫn chưa sẵn sàng.');
    if(args.nativeFirst) {
      state.nativePending={field,area,button:send,prompt:norm(prompt),rawPrompt:prompt,agentMode};
      return {ok:true,confirmed:false,needsTrustedClick:true};
    }
    // Opening the Agent panel is not submission. A relocated editor retaining the
    // complete prompt needs its own send click; never retry an unchanged editor.
    const read = el => norm(el?.value ?? el?.innerText ?? el?.textContent);
    let clickedField=field, clicks=0, confirmed=false;
    for (let stage=0;stage<2;stage++) {
      if(window[KEY]!==state || state.stopped)throw Error('Đã dừng trước khi gửi.');
      ({field,area}=composer());
      if(read(field)!==norm(prompt))throw Error('Nội dung ô Flow đã thay đổi trước khi gửi.');
      send=findSend();
      if(send.disabled||send.getAttribute('aria-disabled')==='true')throw Error('Nút Tạo chưa sẵn sàng.');
      clickedField=field;const clickedArea=area;send.click();clicks++;
      const deadline=Date.now()+8000;let relocated=false;
      while(Date.now()<deadline) {
        await wait(200);
        if(window[KEY]!==state || state.stopped)throw Error('Đã dừng khi đang xác nhận gửi.');
        const error=errorText();if(error)throw Error(error);
        let current;
        try{current=composer();}catch{}
        const newResult=media(mode).some(x=>x.ready&&!state.before.has(x.key)&&!state.beforeNodes.has(x.node));
        if(newResult || (current && read(current.field)==='')) {confirmed=true;break;}
        if(current && (current.field!==clickedField || current.area!==clickedArea) && read(current.field)===norm(prompt)) {
          ({field,area}=current);relocated=true;break;
        }
      }
      if(confirmed)break;
      if(!relocated)break;
    }
    if(!confirmed) {
      ({field,area}=composer());
      if(read(field)!==norm(prompt) || all('[role="progressbar"],[aria-busy="true"]').some(visible))
        throw Error('Flow có thể đang xử lý. Không bấm lại khi trạng thái chưa rõ.');
      state.nativePending={field,area,button:findSend(),prompt: norm(prompt),rawPrompt:prompt,agentMode};
      return {ok:true,confirmed:false,needsTrustedClick:true};
    }
    state.awaitingResult=true;state.savedKeys=new Set();
    state.agentMode=agentMode;state.submitted=Date.now();
    return {ok:true,agentMode,confirmed:true,clicks};
  }
  if(action==='nativePrepare') {
    const pending=state.nativePending;
    if(!pending || pending.used)throw Error('Không có prompt chờ nhập bằng trình duyệt.');
    const {field}=composer();
    const text=norm(field.value??field.innerText??field.textContent);
    if(field!==pending.field || text!==pending.prompt)throw Error('Ô prompt đã thay đổi trước khi đồng bộ nhập liệu.');
    if(all('[role="progressbar"],[aria-busy="true"]').some(visible))throw Error('Flow đang xử lý; dừng đồng bộ nhập liệu.');
    field.focus();
    if(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)field.select();
    else {
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(field);
      selection.removeAllRanges();selection.addRange(range);
    }
    if(document.activeElement!==field && !field.contains(document.activeElement))throw Error('Không thể đặt con trỏ vào ô prompt.');
    return {text:pending.rawPrompt};
  }
  if(action==='nativeReady') {
    const pending=state.nativePending;
    if(!pending||(pending.used && !args.remeasure))throw Error('Không có thao tác gửi đang chờ.');
    const error=errorText();if(error)throw Error(error);
    const {field}=composer();
    const text=norm(field.value??field.innerText??field.textContent);
    if(text==='' || media(state.mode).some(x=>x.ready&&!state.before.has(x.key)&&!state.beforeNodes.has(x.node))) {
      state.submitCleanup?.();state.nativePending=null;state.awaitingResult=true;state.savedKeys=new Set();state.agentMode=pending.agentMode;
      return {confirmed:true};
    }
    if(field!==pending.field || text!==pending.prompt)throw Error('Ô prompt đã thay đổi. Chưa bấm gửi.');
    if(all('[role="progressbar"],[aria-busy="true"]').some(visible))throw Error('Flow đang xử lý; không bấm gửi lặp.');
    const button=pending.button;
    if(!button.isConnected||button.disabled||button.getAttribute('aria-disabled')==='true')throw Error('Nút gửi đã thay đổi hoặc chưa sẵn sàng.');
    button.scrollIntoView({block:'nearest'});await wait(100);
    const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const hit=document.elementFromPoint(x,y);
    if(x<0||y<0||x>=innerWidth||y>=innerHeight||!(hit===button||button.contains(hit)))throw Error('Nút gửi đang bị che. Hãy giữ khung Flow hiển thị.');
    if(!pending.used) {
      pending.events={down:false,up:false,click:false};
      const observe=event=>{
        if(event.isTrusted && event.composedPath().includes(button)) {
          const key={pointerdown:'down',pointerup:'up',click:'click'}[event.type];
          pending.events[key]=true;
        }
      };
      for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,observe,true);
      state.submitCleanup=()=>{
        for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,observe,true);
        state.submitCleanup=null;
      };
    }
    pending.used=true;
    return {confirmed:false,x,y};
  }
  if(action==='nativeConfirm') {
    const pending=state.nativePending;if(!pending) return {confirmed:!!state.awaitingResult};
    const deadline=Date.now()+8000;
    while(Date.now()<deadline) {
      await wait(200);
      if(window[KEY]!==state||state.stopped)throw Error('Đã dừng xác nhận gửi.');
      const error=errorText();if(error)throw Error(error);
      let field,current;try{current=composer();field=current.field;}catch{}
      const text=field?norm(field.value??field.innerText??field.textContent):null;
      if(current && (field!==pending.field || current.area!==pending.area) && text===pending.prompt) {
        const buttons=[...current.area.querySelectorAll('button,[role="button"]')].filter(visible);
        const box=current.area.getBoundingClientRect();
        const candidates=buttons.filter(el=>{
          const r=el.getBoundingClientRect();
          return !el.disabled && el.getAttribute('aria-disabled')!=='true' &&
            r.width>=24 && r.width<=80 && r.height>=24 && r.height<=80 &&
            r.right>=box.right-32 && r.bottom>=box.bottom-40 &&
            (/(?:arrow_forward|arrow_upward|send|gửi)/.test(label(el)) || (!label(el)&&el.querySelector('svg')));
        });
        if(candidates.length!==1)throw Error('Khung Tác nhân đã mở nhưng chưa xác định được nút gửi.');
        state.submitCleanup?.();
        state.nativePending={...pending,field,area:current.area,button:candidates[0],used:false,events:null};
        return {confirmed:false,needsTrustedClick:true};
      }

      if(text==='' || media(state.mode).some(x=>x.ready&&!state.before.has(x.key)&&!state.beforeNodes.has(x.node))) {
        state.submitCleanup?.();state.nativePending=null;state.agentMode=pending.agentMode;state.awaitingResult=true;state.savedKeys=new Set();state.submitted=Date.now();
        return {confirmed:true};
      }
    }
    state.submitCleanup?.();state.nativePending=null;
    const events=pending.events||{};
    const detail=events.click
      ? 'Cú bấm thật đã trúng nút gửi nhưng Flow chưa xác nhận nhận prompt.'
      : 'Chưa ghi nhận cú bấm thật trên nút gửi; vị trí hoặc phần tử có thể đã thay đổi.';
    throw Error(detail+' [down='+!!events.down+', up='+!!events.up+', click='+!!events.click+'] Đã dừng ở prompt hiện tại.');
  }
  if(action==='saved') {
    if(!state.seen.has(args.key))throw Error('File không thuộc prompt hiện tại.');
    state.savedKeys ||= new Set();state.savedKeys.add(args.key);return {ok:true};
  }
  if(action==='complete') {
    if(!state.savedKeys?.size || [...state.seen].some(key=>!state.savedKeys.has(key)))throw Error('Kết quả chưa lưu đủ. Không chuyển prompt.');
    if(all('[role="progressbar"],[aria-busy="true"]').some(visible))throw Error('Flow vẫn đang tạo. Không chuyển prompt.');
    state.awaitingResult=false;return {ok:true};
  }
  if (action === 'poll') {
    const error=errorText(); if(error) return {error};
    const fresh=media(state.mode).filter(x=>{const r=x.node.getBoundingClientRect();return x.ready&&r.width>=200&&r.height>=120&&!state.before.has(x.key)&&!state.beforeNodes.has(x.node);});
    const present=new Set(fresh.map(x=>x.key));
    for (const key of Object.keys(state.stable)) if(!present.has(key)) delete state.stable[key];
    const results=[];
    for(const item of fresh) {
      state.stable[item.key]=(state.stable[item.key]||0)+1;
      if(state.stable[item.key]>=3&&!state.seen.has(item.key)) { state.seen.add(item.key);const {node,...output}=item;results.push(output); }
    }
    const busy=all('[role="progressbar"],[aria-busy="true"]').some(visible);
    return {results,busy};
  }
  if(action==='downloadStart' || action==='downloadStep') {
    const point=el=>{
      if(!el?.isConnected)throw Error('Phần tử tải xuống đã thay đổi.');
      const r=el.getBoundingClientRect();
      const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right);
      const top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
      // Menus can animate or have their center covered by the submenu. Use only
      // an exposed point belonging to this exact control; never click through overlays.
      for(const fx of [.5,.2,.8])for(const fy of [.5,.25,.75]) {
        const x=left+(right-left)*fx,y=top+(bottom-top)*fy;
        const hit=document.elementFromPoint(x,y);
        if(visible(el)&&right>left&&bottom>top&&(hit===el||el.contains(hit)))return {x,y};
      }
      throw Error('Ảnh hoặc menu đang bị che. Giữ thẻ kết quả Flow hiển thị.');
    };
    const menuPoint=el=>{
      try{return point(el);}catch(error){
        if(Date.now()-state.menu.phaseAt<3000)return null;
        throw error;
      }
    };
    if(action==='downloadStart') {
      if(!state.seen.has(args.key))throw Error('Kết quả không thuộc prompt hiện tại.');
      state.menuCleanup?.();
      const items=media(state.mode).filter(x=>x.key===args.key).sort((a,b)=>{
        const ar=a.node.getBoundingClientRect(),br=b.node.getBoundingClientRect();return br.width*br.height-ar.width*ar.height;
      });
      const item=items[0];if(!item)throw Error('Không tìm thấy thẻ kết quả mới.');
      item.node.scrollIntoView({block:'center'});await wait(150);
      state.menu={key:args.key,node:item.node,phase:'more',before:new Set(all('[role="menu"]').filter(visible)),captured:'',started:Date.now()};
      return {move:point(item.node),stage:'Rê lên ảnh'};
    }
    const menu=state.menu;if(!menu)throw Error('Phiên menu đã đóng.');
    if(menu.captured){
      state.downloads ||= new Set();state.downloads.add(menu.captured);
      const result={done:true,ok:true,src:menu.captured,key:menu.key,via:'Flow menu 2K'};
      state.menuCleanup?.();state.menu=null;return result;
    }
    if(menu.phase==='more') {
      let card=menu.node.parentElement,more;
      for(let depth=0;card&&depth<8;depth++,card=card.parentElement){
        const cards=media(state.mode).filter(x=>card.contains(x.node));
        if(new Set(cards.map(x=>x.key)).size>1)break;
        const options=[...card.querySelectorAll('button,[role="button"]')].filter(visible).filter(el=>{
          const text=label(el);
          if(/more_vert|more_horiz|more options|more actions|tùy chọn|tuỳ chọn|^⋮$|^\.\.\.$/.test(text))return true;
          if(el.getAttribute('aria-haspopup')==='menu'&&!/download|tải xuống/.test(text))return true;
          const dots=[...el.querySelectorAll('svg circle')];
          return dots.length===3&&(new Set(dots.map(d=>d.getAttribute('cx'))).size===1||new Set(dots.map(d=>d.getAttribute('cy'))).size===1);
        });
        if(options.length===1){more=options[0];break;}
        if(options.length>1)throw Error('Thẻ kết quả có nhiều nút menu, không bấm nhầm.');
      }
      if(!more){if(Date.now()-menu.started<3000)return {wait:true};throw Error('Đã rê lên ảnh nhưng chưa tìm thấy nút ⋮.');}
      menu.more=more;menu.phase='download';menu.phaseAt=Date.now();return {click:point(more),stage:'Bấm ⋮'};
    }
    if(menu.phase==='download') {
      const controlled=document.getElementById(menu.more.getAttribute('aria-controls'));
      const roots=all('[role="menu"]').filter(visible).filter(el=>!menu.before.has(el)||el===controlled);
      const downloads=roots.flatMap(root=>[...root.querySelectorAll('[role="menuitem"],button,a')].filter(visible).filter(el=>/download|tải xuống/.test(label(el))).map(el=>({root,el})));
      if(downloads.length!==1){if(Date.now()-menu.phaseAt<3000)return {wait:true};throw Error('Không tìm thấy duy nhất mục Tải xuống trong menu vừa mở.');}
      const target=menuPoint(downloads[0].el);if(!target)return {wait:true};
      menu.root=downloads[0].root;menu.phase='quality';menu.phaseAt=Date.now();
      return {move:target,stage:'Rê lên Tải xuống'};
    }
    if(menu.phase==='quality') {
      const submenus=all('[role="menu"]').filter(el=>visible(el)&&el!==menu.root&&!menu.before.has(el));
      const entries=[...new Set(submenus.flatMap(el=>[...el.querySelectorAll('[role="menuitem"],button,a')]))].filter(visible);
      const matches=entries.filter(el=>/(?:^|\s)2\s*k(?:\s|$)/i.test(label(el)) || [...el.querySelectorAll('span,strong,div')].some(part=>/^2\s*k$/i.test(norm(part.textContent))));
      if(matches.length!==1){if(Date.now()-menu.phaseAt<3000)return {wait:true};throw Error('Không tìm thấy lựa chọn 2K. Không tự chuyển sang 1K/4K.');}
      const choice=matches[0];
      if(choice.disabled||choice.getAttribute('aria-disabled')==='true')throw Error('Lựa chọn 2K đang bị khóa trên Flow.');
      const target=menuPoint(choice);if(!target)return {wait:true};
      // Capture the download emitted specifically after the requested 2K click.
      const originalClick=HTMLAnchorElement.prototype.click,originalOpen=window.open,originalRevoke=URL.revokeObjectURL;
      let cleaned=false;
      const take=url=>{
        if(window[KEY]!==state||state.stopped||menu.captured)return false;
        try{const u=new URL(url,location.href);if(!['https:','blob:'].includes(u.protocol))return false;menu.captured=u.href;
          if(u.protocol==='blob:'){state.downloadBlobs ||= new Set();state.downloadBlobs.add(u.href);}return true;
        }catch{return false;}
      };
      const click=function(){if(this.hasAttribute('download')&&take(this.href))return;return originalClick.apply(this,arguments);};
      const onClick=e=>{const a=e.composedPath().find(el=>el instanceof HTMLAnchorElement);if(a?.hasAttribute('download')&&take(a.href)){e.preventDefault();e.stopImmediatePropagation();}};
      const open=function(url){if((String(url).startsWith('blob:')||/download/i.test(String(url)))&&take(url))return null;return originalOpen.apply(this,arguments);};
      const revoke=function(url){if(state.downloadBlobs?.has(url))return;return originalRevoke.call(URL,url);};
      const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(menu.timer);
        if(HTMLAnchorElement.prototype.click===click)HTMLAnchorElement.prototype.click=originalClick;
        if(window.open===open)window.open=originalOpen;
        if(URL.revokeObjectURL===revoke)URL.revokeObjectURL=originalRevoke;
        document.removeEventListener('click',onClick,true);state.menuCleanup=null;
      };
      state.menuCleanup=cleanup;HTMLAnchorElement.prototype.click=click;window.open=open;URL.revokeObjectURL=revoke;document.addEventListener('click',onClick,true);
      menu.timer=setTimeout(cleanup,180000);menu.phase='capture';menu.phaseAt=Date.now();
      return {click:target,stage:'Bấm 2K'};
    }
    if(menu.phase==='capture') {
      const error=errorText();if(error)throw Error(error);
      if(Date.now()-menu.phaseAt>180000)throw Error('Đã bấm 2K nhưng chưa nhận được file sau 3 phút.');
      return {wait:true,stage:'Chờ Flow chuẩn bị file 2K'};
    }
  }
  if(action==='downloadCancel'){state.menuCleanup?.();state.menu=null;return {ok:true};}
  // Blob URLs belong to the Flow page. Read bounded chunks here, stream them to disk in the extension.
  if(action==='open') {
    if(!state.seen.has(sourceKey(args.src))&&!state.downloads?.has(args.src)) throw Error('Nguồn không thuộc kết quả mới của phiên này.');
    state.fetchController = new AbortController();
    const response=await fetch(args.src,{credentials:'include',signal:AbortSignal.any([state.fetchController.signal,AbortSignal.timeout(10*60*1000)])});
    if(!response.ok||!response.body) throw Error('Không tải được nguồn Flow: HTTP '+response.status);
    if (window[KEY] !== state || state.stopped) { await response.body.cancel(); throw Error('Đã dừng tải.'); }
    state.reader=response.body.getReader();state.pending=null;
    return {type:response.headers.get('content-type')||''};
  }
  if(action==='read') {
    if(!state.reader) throw Error('Luồng tải đã đóng.');
    const chunk=state.pending?{done:false,value:state.pending}:await state.reader.read();
    if(chunk.done) return {done:true};
    const cut=chunk.value.subarray(0,131072);state.pending=chunk.value.length>cut.length?chunk.value.subarray(cut.length):null;
    return {done:false,value:Array.from(cut)};
  }
  if(action==='close') { if(state.reader)await state.reader.cancel().catch(()=>{});state.reader=null;state.pending=null;for(const url of state.downloadBlobs||[])URL.revokeObjectURL(url);state.downloadBlobs?.clear();return {ok:true}; }
  throw Error('Thao tác không hỗ trợ.');
  } catch(error) {
    return {ok:false,driverError:true,action,error:String(error?.message || error)};
  }
}
if (typeof module !== 'undefined') module.exports = creatingFlowPage;