/* BaByLon 1.43.15 · Compact YouTube tools + run all three, preserving fast Gemini and exports */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { isYouTube:false, sourceHost:'', videoId:'', captions:[], comments:[], title:'', language:'', tab:'srt', busy:false, aiMode:'quick', summaries:{quick:'',detail:''}, summaryMeta:{quick:'',detail:''} };
  const pad = n => String(n).padStart(2, '0');
  const clock = sec => { const s=Math.max(0,Math.floor(Number(sec)||0));return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`; };
  const srtTime = sec => { const ms=Math.max(0,Math.round((Number(sec)||0)*1000));return `${clock(Math.floor(ms/1000))},${String(ms%1000).padStart(3,'0')}`; };
  const status = (message, kind='ok') => {
    const box=$('byvStatus');const text=$('byvStatusText');
    if(box)box.dataset.kind=kind;
    if(text)text.textContent=message;
  };
  const empty = (symbol,title,subtitle) => {
    const wrapper=document.createElement('div');wrapper.className='byv-empty';
    const icon=document.createElement('span');icon.textContent=symbol;
    const heading=document.createElement('strong');heading.textContent=title;
    const note=document.createElement('small');note.textContent=subtitle;
    wrapper.append(icon,heading,note);return wrapper;
  };
  const clear = (id, symbol, title, hint) => {const el=$(id);if(el)el.replaceChildren(empty(symbol,title,hint));};
  function resetVideo(id,title) {
    if(state.videoId===id)return;
    state.videoId=id;state.title=title||'';state.captions=[];state.comments=[];state.language='';state.summaries={quick:'',detail:''};state.summaryMeta={quick:'',detail:''};
    if($('byvSrtCount'))$('byvSrtCount').textContent='Chưa đọc';
    if($('byvSrtLang'))$('byvSrtLang').textContent='Bản gốc';
    if($('byvCommentsCount'))$('byvCommentsCount').textContent='0 / 50';
    resetAllProgress();
    if($('byvSmartResults'))$('byvSmartResults').replaceChildren();
    clear('byvTranscript','▤','Chưa có phụ đề','Nhấn “Đọc phụ đề video” để bắt đầu.');
    clear('byvAnalysis','✧','Chưa có bản tóm tắt','Chọn Tóm tắt nhanh hoặc Phân tích chi tiết để bắt đầu.');
    updateAiMode();
    clear('byvComments','♡','Chưa có bình luận','Nhấn “Thu thập Top 50 bình luận” để bắt đầu.');
  }
  function isYouTubeUrl(url){
    try {const u=new URL(url);return /^(?:www\.|m\.)?youtube\.com$/i.test(u.hostname)&&u.pathname==='/watch'&&!!u.searchParams.get('v');}
    catch{return false;}
  }
  async function getTab() {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab||!/^https?:\/\//i.test(tab.url||''))throw Error('Hãy mở một trang web có video (http/https).');
    const youtube=isYouTubeUrl(tab.url);
    const id=youtube?new URL(tab.url).searchParams.get('v'):`site:${tab.id}:${tab.url}`;
    const title=(tab.title||'').replace(/\s*-\s*YouTube\s*$/i,'').trim()||'Video trên trang';
    resetVideo(id,title);
    state.isYouTube=youtube;
    state.sourceHost=new URL(tab.url).hostname;
    return {tab,id,title,youtube};
  }
  async function refreshVideo() {
    const context=$('byvVideoContext'), title=$('byvVideoTitle'), tag=$('byvVideoTag');
    try {
      const current=await getTab();
      if(context)context.classList.remove('is-missing');
      if(title)title.textContent=current.title;
      if(tag)tag.textContent=current.youtube?'YT':'WEB';
      const commentsTab=$('byvTabComments');
      if(commentsTab)commentsTab.hidden=!current.youtube;
      if(state.tab==='comments'&&!current.youtube)choosePane('srt');
      const all=$('byvRunAll');
      if(all)all.textContent=current.youtube?'⚡ CHẠY CẢ 3 · PHỤ ĐỀ + AI + BÌNH LUẬN':'⚡ ĐỌC PHỤ ĐỀ + SMART AI';
      status(current.youtube?'Đã nhận diện video YouTube.':'Đã nhận diện trang web. BaByLon sẽ tìm phụ đề từ trình phát và các khung nhúng.');
    } catch(e) {
      if(context)context.classList.add('is-missing');
      if(title)title.textContent='Chưa nhận diện trang video';
      if(tag)tag.textContent='!';
      status(e.message,'error');
    }
  }
  function choosePane(name) {
    if(!['srt','ai','comments'].includes(name)||(name==='comments'&&!state.isYouTube))return;
    state.tab=name;
    document.querySelectorAll('#youtubeVideoPage [data-byv-tab]').forEach(button=>{
      const selected=button.dataset.byvTab===name;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    });
    for(const [key,id] of Object.entries({srt:'byvPaneSrt',ai:'byvPaneAi',comments:'byvPaneComments'})) {
      const el=$(id);if(!el)continue;
      el.hidden=key!==name;el.classList.toggle('is-active',key===name);
    }
  }
  async function loadCaptions() {
    const {tab,id,youtube}=await getTab();
    status(youtube?'Đang đọc phụ đề YouTube…':'Đang tìm phụ đề SRT/VTT trên website và các khung nhúng…','busy');
    let result;
    if(youtube){
      await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['youtube-caption-reader.js']});
      const results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async()=>{
        if(typeof window.BaByLonReadYouTubeCaptions!=='function')return {error:'Không khởi tạo được bộ đọc phụ đề.'};
        return await window.BaByLonReadYouTubeCaptions();
      }});
      result=results?.[0]?.result;
    }else{
      result=await window.BaByLonUniversalCaptions.read(tab.id);
    }
    if(result?.error)throw Error(result.error);
    if(!result?.events?.length)throw Error('Chưa tìm thấy phụ đề có thể truy cập. Hãy nhập tệp SRT/VTT hoặc chọn tệp âm thanh để Groq Whisper chép lời. Video DRM/khung bị hạn chế có thể không đọc được.');
    if(state.videoId!==id)throw Error('Trang video đã thay đổi. Hãy đọc lại phụ đề.');
    state.captions=result.events;state.language=result.language||'';state.title=result.title||state.title;
    await saveCaptionCache(id,result.events,state.language);
    renderCaptions(result.events);
    status(`Đã đọc ${result.events.length} đoạn phụ đề từ ${result.source||'trình phát'} (${result.language||'gốc'}).`);
  }
  async function importSubtitle(){
    const file=$('byvSubtitleFile')?.files?.[0];
    if(!file)throw Error('Hãy chọn tệp .srt hoặc .vtt.');
    if(file.size>5*1024*1024)throw Error('Tệp phụ đề quá lớn (giới hạn 5 MB).');
    const {id}=await getTab();
    const events=window.BaByLonUniversalCaptions.parse(await file.text());
    if(!events.length)throw Error('Không tìm thấy mốc thời gian hợp lệ trong tệp SRT/VTT.');
    if(state.videoId!==id)throw Error('Trang đã thay đổi.');
    state.captions=events;state.language='Tệp nhập';renderCaptions(events);
    await saveCaptionCache(id,events,'Tệp nhập');
    status(`Đã nhập ${events.length} đoạn phụ đề từ ${file.name}.`);
  }
  async function transcribeAudio(){
    const file=$('byvAudioFile')?.files?.[0];
    if(!file)throw Error('Hãy chọn tệp âm thanh hoặc video có âm thanh (tối đa 20 MB).');
    const {id}=await getTab();
    status('Đang gửi tệp tới Groq Whisper để chép lời (cần API key Groq)…','busy');
    const result=await window.BaByLonAIHub.transcribeTimed(file);
    if(state.videoId!==id)throw Error('Trang đã thay đổi.');
    if(!result.events.length)throw Error('Whisper không trả mốc thời gian, chưa thể xuất SRT. Hãy thử tệp khác.');
    state.captions=result.events;state.language=result.language||'Whisper';renderCaptions(result.events);
    await saveCaptionCache(id,result.events,state.language);
    status(`Groq Whisper đã chép lời ${result.events.length} đoạn có mốc thời gian. Tệp được gửi tới Groq bằng API key của bạn.`);
  }
  let tabRecording=null;
  function recordingButtons(active){
    const start=$('byvRecordStart'),stop=$('byvRecordStop');
    if(start)start.disabled=active;
    if(stop)stop.disabled=!active;
  }
  async function startTabRecording(){
    if(tabRecording)throw Error('Tab đang được ghi âm.');
    if(!chrome.tabCapture?.capture)throw Error('Trình duyệt không hỗ trợ chrome.tabCapture trong giao diện này.');
    // Invoke capture synchronously from the click handler to preserve the user gesture.
    const stream=await new Promise((resolve,reject)=>{
      chrome.tabCapture.capture({audio:true,video:false},media=>{
        const error=chrome.runtime.lastError;
        if(error||!media)reject(Error(error?.message||'Không được phép ghi âm tab.'));
        else resolve(media);
      });
    });
    let context,recorder;
    try{
      if(typeof MediaRecorder==='undefined')throw Error('Trình duyệt không hỗ trợ MediaRecorder.');
      const chunks=[];
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
      recorder=new MediaRecorder(stream,{mimeType:mime});
      // Chrome mutes tab playback during capture; route it back to the speakers.
      context=new AudioContext();
      const source=context.createMediaStreamSource(stream);source.connect(context.destination);
      await context.resume().catch(()=>{});
      const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
      const tabId=tab?.id;
      tabRecording={stream,context,recorder,chunks,tabId};
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      recorder.onerror=e=>status('Lỗi ghi âm tab: '+(e.error?.message||'MediaRecorder'),'error');
      recorder.start(1000);
      recordingButtons(true);
      status('Đang ghi âm thanh của tab. Hãy phát video và giữ bảng BaByLon mở. Nhấn DỪNG để chuyển thành SRT.','busy');
    }catch(e){stream.getTracks().forEach(t=>t.stop());await context?.close().catch(()=>{});throw e;}
  }
  async function stopTabRecording(){
    const capture=tabRecording;
    if(!capture)throw Error('Chưa bắt đầu ghi âm tab.');
    tabRecording=null;recordingButtons(false);
    const {recorder,stream,context,chunks,tabId}=capture;
    await new Promise(resolve=>{
      recorder.addEventListener('stop',resolve,{once:true});
      if(recorder.state==='inactive')resolve();else recorder.stop();
    });
    stream.getTracks().forEach(t=>t.stop());
    await context?.close().catch(()=>{});
    const blob=new Blob(chunks,{type:'audio/webm'});
    if(!blob.size)throw Error('Không ghi được âm thanh. Video có thể không phát tiếng hoặc bị hạn chế.');
    if(blob.size>20*1024*1024)throw Error('Bản ghi vượt 20 MB. Hãy ghi từng đoạn ngắn hơn.');
    const current=await chrome.tabs.query({active:true,currentWindow:true});
    if(current[0]?.id!==tabId)throw Error('Bạn đã chuyển tab. Hãy quay lại tab video và thử lại.');
    const {id}=await getTab();
    status('Đang chuyển âm thanh tab thành phụ đề bằng Groq Whisper…','busy');
    const result=await window.BaByLonAIHub.transcribeTimed(new File([blob],'babylon-tab.webm',{type:'audio/webm'}));
    if(state.videoId!==id)throw Error('Trang đã thay đổi trong lúc chép lời.');
    if(!result.events.length)throw Error('Whisper không trả mốc thời gian cho bản ghi.');
    state.captions=result.events;state.language=result.language||'Whisper';renderCaptions(result.events);
    await saveCaptionCache(id,result.events,state.language);
    status(`Đã chép lời ${result.events.length} đoạn từ âm thanh tab. Chỉ bao gồm phần video đã phát trong lúc ghi.`);
  }
  function renderCaptions(events) {
    const target=$('byvTranscript');if(target){
      target.replaceChildren();
      for(const row of events){
        const item=document.createElement('div');item.className='byv-caption-row';
        const time=document.createElement('button');time.type='button';time.className='byv-timestamp';time.textContent=clock(row.start);time.title='Tua video đến '+clock(row.start);
        time.addEventListener('click',()=>task(()=>seekVideo(row.start)));
        const text=document.createElement('div');text.className='byv-caption-text';text.textContent=row.text;
        item.append(time,text);target.append(item);
      }
    }
    if($('byvSrtCount'))$('byvSrtCount').textContent=`${events.length} đoạn`;
    if($('byvSrtLang'))$('byvSrtLang').textContent=(state.language||'').toUpperCase()||'Gốc';
  }
  async function seekVideo(seconds) {
    const {tab}=await getTab();
    const res=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(time)=>{
      const player=document.querySelector('video');if(!player)return false;
      player.currentTime=time;return true;
    },args:[seconds]});
    if(!res?.[0]?.result)throw Error('Không tìm thấy trình phát video để tua.');
    status(`Đã chuyển video đến ${clock(seconds)}.`);
  }
  function download(name,text,type) {
    const blob=new Blob(['\ufeff',text],{type});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  // Cache only public video captions, locally, with a short expiration. Never cache API keys.
  const CAPTION_CACHE_KEY='babylon_youtube_captions_v14314';
  const SUMMARY_CACHE_KEY='babylon_youtube_summaries_v14314';
  const MODEL_CACHE_KEY='babylon_youtube_models_v14314';
  const HOUR=60*60*1000;
  async function storageRead(key){try{return (await chrome.storage.local.get(key))[key]||{};}catch{return {};}}
  async function storageWrite(key,value){try{await chrome.storage.local.set({[key]:value});}catch{/* Local cache is optional. */}}
  async function saveCaptionCache(id,events,language){
    if(!id||!events?.length)return;
    const size=JSON.stringify(events).length;
    if(size>350000)return; // Avoid caching unusually large transcripts.
    const cache=await storageRead(CAPTION_CACHE_KEY);
    cache[id]={events,language,time:Date.now()};
    const valid=Object.entries(cache).filter(([,v])=>v?.time>Date.now()-24*HOUR).sort((a,b)=>b[1].time-a[1].time).slice(0,8);
    await storageWrite(CAPTION_CACHE_KEY,Object.fromEntries(valid));
  }
  async function ensureCaptions() {
    const {id}=await getTab();
    if(state.captions.length)return;
    const cache=await storageRead(CAPTION_CACHE_KEY);
    const saved=cache[id];
    if(saved?.time>Date.now()-24*HOUR&&Array.isArray(saved.events)&&saved.events.length){
      if(state.videoId!==id)throw Error('Video đã thay đổi.');
      state.captions=saved.events;state.language=saved.language||'';
      renderCaptions(state.captions);
      status(`Đã sử dụng ${state.captions.length} đoạn phụ đề lưu tạm trên máy.`);
      return;
    }
    await loadCaptions();
  }
  function safeFilename(){return (state.title||'video').replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,70)||'video';}
  async function downloadSrt() {
    await ensureCaptions();
    const lines=state.captions.map((row,i)=>`${i+1}\n${srtTime(row.start)} --> ${srtTime(row.start+Math.max(.5,row.duration))}\n${row.text}\n`).join('\n');
    download(`babylon-video-${safeFilename()}.srt`,lines,'text/plain;charset=utf-8');status('Đã xuất phụ đề SRT.');
  }
  async function downloadTxt() {
    await ensureCaptions();
    download(`babylon-video-${safeFilename()}.txt`,state.captions.map(x=>`[${clock(x.start)}] ${x.text}`).join('\n'),'text/plain;charset=utf-8');status('Đã xuất phụ đề TXT.');
  }
  async function copyTranscript() {
    await ensureCaptions();
    await navigator.clipboard.writeText(state.captions.map(x=>`[${clock(x.start)}] ${x.text}`).join('\n'));
    status('Đã sao chép toàn bộ phụ đề vào bộ nhớ tạm.');
  }
  function renderAnalysis(answer) {
    const container=$('byvAnalysis');if(!container)return;
    container.replaceChildren();
    for(const line of String(answer||'').split(/\n/)){
      if(!line.trim())continue;
      const raw=line.trim();
      const heading=/^(?:#{1,4}\s+|\*\*\s*(?:\d+[.)]|Tổng quan|Ý chính|Kết luận|Các luận điểm)|\d+[.)]\s+[^\n]{1,65}$)/i.test(raw);
      const block=document.createElement('div');block.className=heading?'byv-analysis-heading':'byv-analysis-block';
      const clean=line.replace(/^#{1,4}\s*/,'').replace(/\*\*/g,'');
      const timecode=/\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]/g;
      let last=0,match;
      while((match=timecode.exec(clean))!==null){
        block.append(document.createTextNode(clean.slice(last,match.index)));
        const time=match[1],parts=time.split(':').map(Number);
        const seconds=parts.reduce((total,n)=>total*60+n,0);
        const chip=document.createElement('button');chip.type='button';chip.className='byv-summary-timestamp';chip.textContent=`[${time}]`;chip.title='Tua video đến '+time;
        chip.addEventListener('click',()=>task(()=>seekVideo(seconds)));
        block.append(chip);last=timecode.lastIndex;
      }
      block.append(document.createTextNode(clean.slice(last)));
      container.append(block);
    }
    if(!container.children.length)container.append(empty('✧','Gemini chưa trả nội dung','Vui lòng thử lại.'));
  }
  function renderStreamPreview(text) {
    const container=$('byvAnalysis');if(!container)return;
    let preview=container.querySelector('.byv-stream-preview');
    if(!preview){container.replaceChildren();preview=document.createElement('div');preview.className='byv-stream-preview';container.append(preview);}
    preview.textContent=text;
  }
  function updateAiMode() {
    const quick=state.aiMode==='quick';
    for(const button of document.querySelectorAll('#youtubeVideoPage [data-byv-ai-mode]')){
      const active=button.dataset.byvAiMode===state.aiMode;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    }
    if($('byvAiModeDescription'))$('byvAiModeDescription').textContent=quick
      ?'Tóm tắt ngắn theo mốc thời gian, ưu tiên model Flash tốc độ cao.'
      :'Phân tích đầy đủ: tổng quan, luận điểm, chi tiết và kết luận.';
    if($('byvRunGemini'))$('byvRunGemini').textContent=quick?'✦ TÓM TẮT NHANH BẰNG AI':'✦ PHÂN TÍCH CHI TIẾT BẰNG AI';
    if($('byvAnalysisLabel'))$('byvAnalysisLabel').textContent=quick?'✦ Tóm tắt nhanh':'✦ Bản phân tích chi tiết';
    if($('byvAnalysisMeta'))$('byvAnalysisMeta').textContent=state.summaryMeta[state.aiMode]||'Tiếng Việt';
    const answer=state.summaries[state.aiMode];
    if(answer)renderAnalysis(answer);
    else clear('byvAnalysis','✧',quick?'Chưa có tóm tắt nhanh':'Chưa có phân tích chi tiết',quick?'Nhấn “Tóm tắt nhanh” để bắt đầu.':'Nhấn “Phân tích chi tiết” để bắt đầu.');
  }
  function setAiMode(mode){if(!['quick','detail'].includes(mode)||state.busy)return;state.aiMode=mode;updateAiMode();}
  async function hashText(text){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function getSummaryCacheKey(mode,transcript){const provider=window.BaByLonAIHub?.getProvider?.()||"gemini";return `${state.videoId}:${mode}:${provider}:p3:${await hashText(transcript)}`;}
  async function saveSummary(key,answer,model){
    const cache=await storageRead(SUMMARY_CACHE_KEY);
    cache[key]={answer,model,time:Date.now()};
    const entries=Object.entries(cache).filter(([,v])=>v?.time>Date.now()-7*24*HOUR).sort((a,b)=>b[1].time-a[1].time).slice(0,25);
    await storageWrite(SUMMARY_CACHE_KEY,Object.fromEntries(entries));
  }
  function selectTranscript(mode){
    const rows=state.captions;
    const max=mode==='quick'?85000:190000;
    const toText=r=>`[${clock(r.start)}] ${r.text}`;
    const full=rows.map(toText).join('\n');
    if(full.length<=max)return {text:full,sampled:false};
    // Keep coverage across the whole video instead of silently discarding its ending.
    const limit=Math.max(1,Math.floor(max/Math.max(1,full.length)*rows.length));
    const selected=[];const seen=new Set();
    for(let i=0;i<limit;i++){
      const index=Math.min(rows.length-1,Math.floor(i*(rows.length-1)/Math.max(1,limit-1)));
      if(!seen.has(index)){seen.add(index);selected.push(toText(rows[index]));}
    }
    return {text:selected.join('\n').slice(0,max),sampled:true};
  }
  function buildGeminiPrompt(mode,transcript,sampled){
    const warning=sampled?'LƯU Ý: phụ đề quá dài, các đoạn sau được lấy mẫu trải đều toàn video; không khẳng định đã đọc hết từng câu.\n':'';
    const instruction=mode==='quick'
      ?'Tóm tắt NHANH bằng tiếng Việt, súc tích theo phong cách bản tóm tắt video có mốc thời gian: 1 câu nêu ý chính, tiếp theo 5–8 gạch đầu dòng về diễn biến/luận điểm quan trọng, mỗi gạch đầu dòng kèm [mm:ss] hoặc [hh:mm:ss] từ phụ đề; cuối cùng 1–2 câu kết luận. Không thêm thông tin ngoài phụ đề. Ưu tiên trả lời ngắn, trực tiếp, không giới thiệu dài.'
      :'Phân tích CHI TIẾT bằng tiếng Việt. Trình bày (1) Tổng quan, (2) Các ý chính kèm [mm:ss] hoặc [hh:mm:ss] chính xác từ phụ đề, (3) Chi tiết và luận điểm nổi bật, (4) Kết luận. Nêu giới hạn nếu phụ đề không đủ thông tin.';
    return `${instruction}\nCHỈ dựa trên nội dung phụ đề video, KHÔNG dùng bình luận hoặc nguồn bên ngoài. Không tự tạo timestamp.\n${warning}Tiêu đề: ${state.title}\n\n${transcript}`;
  }
  // Discover actual available models for each key and remember a working fast model.
  const isGeminiTextModel=model=>/^gemini-/i.test(model)&&!/(?:image|tts|live|audio|embedding|robotics|transcribe|computer-use)/i.test(model);
  function sortModels(models,mode,preferred){
    const speedRank=name=>{
      if(/flash-lite/i.test(name))return 0;
      if(/flash/i.test(name))return 1;
      if(/pro/i.test(name))return 3;
      return 2;
    };
    return [...new Set(models)].sort((a,b)=>{
      if(preferred&&a===preferred)return -1;
      if(preferred&&b===preferred)return 1;
      if(mode==='quick'){
        const score=x=>speedRank(x)*10+(/preview|exp/i.test(x)?2:0);
        return score(a)-score(b)||b.localeCompare(a,undefined,{numeric:true});
      }
      const score=x=>(/pro/i.test(x)?0:/flash(?!-lite)/i.test(x)?1:2)*10+(/preview|exp/i.test(x)?2:0);
      return score(a)-score(b)||b.localeCompare(a,undefined,{numeric:true});
    });
  }
  async function availableGeminiModels(apiKey,mode,forceRefresh=false){
    const fingerprint=(await hashText(apiKey)).slice(0,24);
    const cache=await storageRead(MODEL_CACHE_KEY);
    const entry=cache[fingerprint];
    if(!forceRefresh&&entry?.time>Date.now()-24*HOUR&&entry.models?.length){
      return {models:sortModels(entry.models,mode,entry.preferred),fingerprint};
    }
    let token='',models=[];
    for(let page=0;page<3;page++){
      const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize','100');
      if(token)url.searchParams.set('pageToken',token);
      const res=await fetch(url.toString(),{headers:{'x-goog-api-key':apiKey},cache:'no-store',credentials:'omit'});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){const error=new Error(data?.error?.message||`Không thể lấy danh sách model (HTTP ${res.status}).`);error.httpStatus=res.status;throw error;}
      models.push(...(Array.isArray(data.models)?data.models:[])
        .filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent'))
        .map(m=>String(m.name||'').replace(/^models\//,''))
        .filter(isGeminiTextModel));
      token=data.nextPageToken||'';
      if(!token)break;
    }
    models=[...new Set(models)];
    if(!models.length)throw Error('API key này không có model Gemini tạo văn bản (generateContent).');
    cache[fingerprint]={models,preferred:entry?.preferred&&models.includes(entry.preferred)?entry.preferred:'',time:Date.now()};
    await storageWrite(MODEL_CACHE_KEY,Object.fromEntries(Object.entries(cache).sort((a,b)=>(b[1]?.time||0)-(a[1]?.time||0)).slice(0,12)));
    return {models:sortModels(models,mode,cache[fingerprint].preferred),fingerprint};
  }
  async function rememberModel(fingerprint,model){
    const cache=await storageRead(MODEL_CACHE_KEY);
    if(cache[fingerprint]){cache[fingerprint].preferred=model;await storageWrite(MODEL_CACHE_KEY,cache);}
  }
  function extractGeminiText(data){
    return (data?.candidates?.[0]?.content?.parts||[])
      .filter(part=>!part.thought&&typeof part.text==='string')
      .map(part=>part.text).join('');
  }
  function makeGeminiError(data,statusCode){
    const error=new Error(data?.error?.message||`Gemini HTTP ${statusCode}`);
    error.httpStatus=statusCode;return error;
  }
  async function requestGeminiSummary(apiKey,model,prompt,mode,onPartial){
    const config={temperature:mode==='quick'?.2:.3,maxOutputTokens:mode==='quick'?1200:3600};
    const options={method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},cache:'no-store',credentials:'omit',body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:config})};
    if(mode==='quick'){
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,options);
      if(response.ok&&response.body){
        const reader=response.body.getReader();const decoder=new TextDecoder();let pending='',answer='';
        const processEvent=event=>{
          const data=event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('');
          if(!data||data==='[DONE]')return;
          let obj;try{obj=JSON.parse(data);}catch{return;}
          if(obj.error)throw makeGeminiError(obj,500);
          const chunk=extractGeminiText(obj);
          if(chunk){answer+=chunk;onPartial(answer);}
        };
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          pending+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
          let boundary;
          while((boundary=pending.indexOf('\n\n'))!==-1){processEvent(pending.slice(0,boundary));pending=pending.slice(boundary+2);}
        }
        pending+=decoder.decode();if(pending.trim())processEvent(pending);
        if(answer.trim())return answer.trim();
      }else if(!response.ok){
        const data=await response.json().catch(()=>({}));
        if(![400,404,405].includes(response.status))throw makeGeminiError(data,response.status);
        // Older models might not support SSE: fall back to normal generation.
      }
    }
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,options);
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw makeGeminiError(data,response.status);
    const answer=extractGeminiText(data).trim();
    if(!answer)throw Error(`Model ${model} trả kết quả trống (${data?.candidates?.[0]?.finishReason||'không có nội dung'}).`);
    return answer;
  }
  async function runGemini(force=false) {
    const mode=state.aiMode;
    await ensureCaptions();
    const videoIdAtStart=state.videoId;
    const transcriptInfo=selectTranscript(mode);
    const cacheKey=await getSummaryCacheKey(mode,transcriptInfo.text);
    if(!force){
      const saved=(await storageRead(SUMMARY_CACHE_KEY))[cacheKey];
      if(saved?.answer&&saved.time>Date.now()-7*24*HOUR){
        state.summaries[mode]=saved.answer;state.summaryMeta[mode]='Đã lưu trên máy';
        updateAiMode();status('Đã hiển thị bản tóm tắt lưu trên máy, không cần gọi Gemini.');return;
      }
    }
    // AI Hub: selected provider or automatic free-tier preference.
    // The original Gemini engine remains available as an explicit option.
    const hub=window.BaByLonAIHub;
    if(hub && hub.getProvider()!=='gemini'){
      const prompt=buildGeminiPrompt(mode,transcriptInfo.text,transcriptInfo.sampled);
      const started=performance.now();
      status('Đang tóm tắt qua Trung tâm AI BaByLon…','busy');
      const result=await hub.run(prompt,{task:'youtube',maxTokens:mode==='quick'?1250:3500,onPartial:partial=>{
        if(state.videoId===videoIdAtStart&&state.aiMode===mode)renderStreamPreview(partial);
      }});
      const current=await getTab();if(current.id!==videoIdAtStart)throw Error('Video đã thay đổi trong lúc phân tích.');
      state.summaries[mode]=result.text;
      const elapsed=((performance.now()-started)/1000).toFixed(1);
      state.summaryMeta[mode]=`${elapsed}s · ${result.provider}/${result.model}`;
      await saveSummary(cacheKey,result.text,`${result.provider}/${result.model}`);
      if(state.aiMode===mode)updateAiMode();
      status(`Đã tóm tắt bằng ${result.provider}/${result.model} • ${elapsed}s.${transcriptInfo.sampled?' Phụ đề dài nên đã lấy mẫu.':''}`);
      return;
    }
    const pool=window.BaByLonGeminiPool;
    await pool?.load();
    const keys=pool?.getKeys()||[];
    if(!keys.length){pool?.openCenter();throw Error('Hãy thêm Gemini API Key tại Trung tâm Gemini API.');}
    const prompt=buildGeminiPrompt(mode,transcriptInfo.text,transcriptInfo.sampled);
    const order=pool?.getOrder?.()||keys.map((_,i)=>i);
    let lastError='',attempted=0;
    const started=performance.now();
    for(const i of order){
      const key=keys[i];if(!key)continue;
      let selection;
      status(`Đang chọn model Gemini ${mode==='quick'?'nhanh':'phân tích'} cho API ${i+1}/${keys.length}…`,'busy');
      try{selection=await availableGeminiModels(key,mode);}catch(e){lastError=`API ${i+1}: ${e.message||e}`;continue;}
      const {models,fingerprint}=selection;
      for(const model of models.slice(0,6)){
        attempted++;
        status(`Gemini ${mode==='quick'?'đang tóm tắt nhanh':'đang phân tích'} • ${model} • API ${i+1}/${keys.length}…`,'busy');
        try{
          const answer=await requestGeminiSummary(key,model,prompt,mode,partial=>{
            if(state.videoId===videoIdAtStart&&state.aiMode===mode)renderStreamPreview(partial);
          });
          const current=await getTab();
          if(current.id!==videoIdAtStart)throw Error('Video đã thay đổi trong lúc phân tích.');
          state.summaries[mode]=answer;
          const elapsed=((performance.now()-started)/1000).toFixed(1);
          state.summaryMeta[mode]=`${elapsed}s · ${model}`;
          await rememberModel(fingerprint,model);
          await saveSummary(cacheKey,answer,model);
          if(state.aiMode===mode)updateAiMode();
          status(`Đã ${mode==='quick'?'tóm tắt nhanh':'phân tích'} bằng ${model} • ${elapsed}s • API ${i+1}/${keys.length}.${transcriptInfo.sampled?' Phụ đề dài nên đã lấy mẫu trải đều.':''}`);
          return;
        }catch(e){
          lastError=`${model} (API ${i+1}): ${e.message||e}`;
          if(state.videoId!==videoIdAtStart)throw e;
          if([401,403,429].includes(e.httpStatus))break;
        }
      }
    }
    clear('byvAnalysis','✧','Chưa thể tóm tắt','Hãy kiểm tra thông báo lỗi và thử lại.');
    throw Error(`Gemini chưa trả kết quả sau ${attempted} lần thử. ${lastError} Kiểm tra API key/quota tại Trung tâm Gemini.`);
  }
  async function runSmartAi(force=false){
    await ensureCaptions();
    const id=state.videoId;
    const hub=window.BaByLonAIHub;
    if(!hub)throw Error('Chưa khởi tạo Trung tâm AI.');
    const panel=$('byvSmartResults');
    if(!panel)throw Error('Thiếu vùng hiển thị Smart AI.');
    panel.replaceChildren();
    const addCard=(heading)=>{
      const card=document.createElement('section');card.className='byv-smart-card';
      const title=document.createElement('strong');title.textContent=heading;
      const meta=document.createElement('small');meta.textContent='Đang phân tích…';
      const body=document.createElement('div');body.className='byv-smart-text';body.textContent='Đang chờ AI…';
      card.append(title,meta,body);panel.append(card);return {meta,body};
    };
    const quick=addCard('⚡ Tóm tắt nhanh');
    const detail=addCard('✦ Phân tích chuyên sâu');
    const errors=[];
    status('Smart AI đang phân tích nhanh và chuyên sâu song song…','busy');
    const runMode=async(mode,view)=>{
      const selected=selectTranscript(mode);
      const prompt=buildGeminiPrompt(mode,selected.text,selected.sampled);
      const cacheKey=await getSummaryCacheKey(mode,selected.text);
      if(!force){const saved=(await storageRead(SUMMARY_CACHE_KEY))[cacheKey];
        if(saved?.answer&&saved.time>Date.now()-7*24*HOUR){
          if(state.videoId!==id)return;
          state.summaries[mode]=saved.answer;state.summaryMeta[mode]='Đã lưu trên máy';
          view.body.textContent=saved.answer;view.meta.textContent='Bản lưu trên máy';return;
        }}
      const started=performance.now();
      try{
        const opts={task:'youtube',maxTokens:mode==='quick'?1250:3500,
          onPartial:text=>{if(state.videoId===id&&text)view.body.textContent=text;}};
        // Prefer Gemini for depth when configured, but fall back to the free multi-AI router.
        let answer;
        if(mode==='detail'&&hub.getProvider()==='auto'){
          try{answer=await hub.run(prompt,{...opts,provider:'gemini'});}catch{answer=await hub.run(prompt,opts);}
        }else answer=await hub.run(prompt,opts);
        if(state.videoId!==id)return;
        const elapsed=((performance.now()-started)/1000).toFixed(1);
        state.summaries[mode]=answer.text;
        state.summaryMeta[mode]=`${elapsed}s · ${answer.provider}/${answer.model}`;
        view.body.textContent=answer.text;
        view.meta.textContent=state.summaryMeta[mode]+(selected.sampled?' · phụ đề được lấy mẫu':'');
        await saveSummary(cacheKey,answer.text,`${answer.provider}/${answer.model}`);
      }catch(e){
        if(state.videoId!==id)return;
        view.body.textContent='Không thể hoàn tất: '+(e.message||e);
        view.meta.textContent='Lỗi API';errors.push(mode);
      }
    };
    await Promise.all([runMode('quick',quick),runMode('detail',detail)]);
    if(state.videoId!==id)return;
    updateAiMode();
    if(errors.length===2)throw Error('Cả hai AI đều không trả kết quả. Kiểm tra API key và hạn mức Free.');
    status(errors.length?'Đã có kết quả một chế độ; chế độ còn lại lỗi API.':'Đã có tóm tắt nhanh và phân tích chuyên sâu.');
  }
  async function copySummary(){
    const text=state.summaries[state.aiMode];
    if(!text)throw Error('Chưa có bản tóm tắt để sao chép.');
    await navigator.clipboard.writeText(text);status('Đã sao chép nội dung Gemini.');
  }
  async function loadComments() {
    const {tab,id,youtube}=await getTab();
    if(!youtube)throw Error('Top 50 bình luận hiện chỉ hỗ trợ YouTube.');
    status('Đang tải và đọc bình luận YouTube. Trang video có thể tự cuộn…','busy');
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const parseLikes=(value)=>{
        const raw=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
        const match=raw.match(/([\d.,]+)(k|m|b|nghìn|triệu|万)?/i);if(!match)return 0;
        const suffix=match[2]||'';let n=match[1];
        if(suffix){n=n.replace(',','.');}else{n=n.replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(',','.');}
        const factor={k:1000,m:1e6,b:1e9,'nghìn':1000,'triệu':1e6,'万':1e4}[suffix]||1;
        return Math.round((Number(n)||0)*factor);
      };
      const read=()=>Array.from(document.querySelectorAll('ytd-comment-thread-renderer')).map(el=>{
        const c=el.querySelector('ytd-comment-view-model')||el.querySelector('#comment')||el;
        const author=c.querySelector('#author-text')?.textContent?.trim()||'';
        const text=c.querySelector('#content-text')?.textContent?.trim()||'';
        const likes=c.querySelector('#vote-count-middle')?.textContent?.trim()||'';
        const time=c.querySelector('a[href*="lc="]')?.textContent?.trim()||c.querySelector('#published-time-text')?.textContent?.trim()||'';
        const link=c.querySelector('a[href*="lc="]')?.href||'';
        return {author,text,likes:parseLikes(likes),time,link};
      }).filter(x=>x.text);
      let previous=-1,stalled=0;
      for(let i=0;i<65;i++){
        const n=read().length;
        if(n===previous)stalled++;else stalled=0;
        if(stalled>=6)break;
        previous=n;
        const items=document.querySelectorAll('ytd-comment-thread-renderer');
        const last=items[items.length-1];
        if(last)last.scrollIntoView({block:'end'});else window.scrollBy(0,900);
        await wait(400);
      }
      const rows=read();const unique=[...new Map(rows.map(x=>[x.link||`${x.author}|${x.text}`,x])).values()];
      return {comments:unique,visibleCount:unique.length};
    }});
    const result=results?.[0]?.result;
    if(!result)throw Error('Không thể đọc bình luận trên trang YouTube.');
    if(state.videoId!==id)throw Error('Video đã thay đổi. Hãy thu thập lại bình luận.');
    state.comments=(result.comments||[]).sort((a,b)=>b.likes-a.likes).slice(0,50);
    if($('byvCommentsCount'))$('byvCommentsCount').textContent=`${state.comments.length} / 50`;
    const target=$('byvComments');if(target){
      target.replaceChildren();
      if(!state.comments.length)target.append(empty('♡','Chưa đọc được bình luận','Video có thể tắt bình luận hoặc YouTube chưa tải nội dung.'));
      for(const [index,comment] of state.comments.entries()){
        const card=document.createElement('article');card.className='byv-comment';
        const top=document.createElement('div');top.className='byv-comment-top';
        const rank=document.createElement('span');rank.className='byv-comment-rank';rank.textContent=String(index+1);
        const author=document.createElement('strong');author.className='byv-comment-author';author.textContent=comment.author||'Người dùng YouTube';
        const like=document.createElement('span');like.className='byv-comment-like';like.textContent=`♥ ${Number(comment.likes||0).toLocaleString('vi-VN')}`;
        top.append(rank,author,like);
        const body=document.createElement('p');body.textContent=comment.text;
        const meta=document.createElement('div');meta.className='byv-comment-meta';
        if(comment.time){const time=document.createElement('span');time.textContent=comment.time;meta.append(time);}
        if(comment.link&&/^https:\/\//.test(comment.link)){
          const link=document.createElement('a');link.href=comment.link;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Xem bình luận ↗';meta.append(link);
        }
        card.append(top,body,meta);target.append(card);
      }
    }
    status(`Đã đọc ${result.visibleCount} bình luận; hiển thị ${state.comments.length} bình luận nhiều like nhất trong dữ liệu đã tải. Không bảo đảm Top 50 toàn video.`);
  }
  async function ensureCommentsForExport() {
    await getTab();
    if(!state.comments.length)await loadComments();
    if(!state.comments.length)throw Error('Không có bình luận để xuất.');
  }
  // One comment per line, in the exact descending-like order shown in the UI.
  // Keep the comment body only; avoid leaking author/metadata into the requested format.
  function formatTopComments(comments) {
    return comments.map((comment,index)=>{
      const body=String(comment.text||'').replace(/\s+/g,' ').trim();
      return `Bình luận Top${index+1}: ${body}`;
    }).join('\r\n');
  }
  async function exportComments() {
    await ensureCommentsForExport();
    const text=formatTopComments(state.comments);
    download(`youtube-${state.videoId}-top-comments.txt`,text,'text/plain;charset=utf-8');
    status(`Đã tải TXT gồm ${state.comments.length} bình luận theo dạng “Bình luận Top1: …”.`);
  }
  async function exportCommentsCsv() {
    await ensureCommentsForExport();
    // Retain the detailed spreadsheet export as an optional secondary action.
    const safeCell=value=>{
      const raw=String(value??'');
      return /^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;
    };
    const rows=[['Hạng','Tác giả','Bình luận','Lượt thích','Thời gian','URL'],...state.comments.map((c,i)=>[i+1,c.author,c.text,c.likes,c.time,c.link])];
    const csv=rows.map(row=>row.map(value=>`"${safeCell(value).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    download(`youtube-${state.videoId}-top-comments.csv`,csv,'text/csv;charset=utf-8');
    status(`Đã xuất ${state.comments.length} bình luận ra CSV chi tiết (mở bằng Excel).`);
  }
  // Run all three independently: caption failure blocks Gemini only; comments still run.
  // Do not auto-download files; existing export buttons remain user-controlled.
  const ALL_STEP_IDS={srt:'byvAllStepSrt',ai:'byvAllStepAi',comments:'byvAllStepComments'};
  function resetAllProgress(){
    const panel=$('byvAllProgress');if(panel)panel.hidden=true;
    for(const id of Object.values(ALL_STEP_IDS)){
      const node=$(id);if(node){node.dataset.state='pending';node.removeAttribute('title');}
    }
    if($('byvAllSummary'))$('byvAllSummary').textContent='Đang chuẩn bị…';
    if($('byvRunAll'))$('byvRunAll').innerHTML='<span aria-hidden="true">⚡</span> CHẠY CẢ 3 · PHỤ ĐỀ + AI + BÌNH LUẬN';
  }
  function allStep(key,result,detail=''){
    const el=$(ALL_STEP_IDS[key]);if(!el)return;
    el.dataset.state=result;
    const label={srt:'Phụ đề',ai:'AI',comments:'Bình luận'}[key];
    const prefix={pending:'·',running:'◌',success:'✓',failed:'!',skipped:'–'}[result]||'·';
    el.textContent=`${prefix} ${label}`;
    if(detail)el.title=detail;
  }
  function allMessage(message){if($('byvAllSummary'))$('byvAllSummary').textContent=message;}
  async function runAllTools(){
    const {id,youtube}=await getTab();
    const panel=$('byvAllProgress');if(panel)panel.hidden=false;
    for(const key of Object.keys(ALL_STEP_IDS))allStep(key,'pending');
    const results={srt:'pending',ai:'pending',comments:'pending'};
    const errors=[];
    const progress=async(key,fn)=>{
      allStep(key,'running');
      allMessage({srt:'1/3 · Đang lấy phụ đề…',ai:'2/3 · Đang tóm tắt nhanh bằng AI…',comments:'3/3 · Đang thu thập bình luận…'}[key]);
      try{
        // Guard against navigation during the combined workflow.
        const current=await getTab();
        if(current.id!==id)throw Error('Video đã thay đổi trong lúc chạy.');
        await fn();
        if(state.videoId!==id)throw Error('Video đã thay đổi trong lúc chạy.');
        results[key]='success';allStep(key,'success');
      }catch(error){
        results[key]='failed';
        const detail=String(error?.message||error);
        errors.push(`${{srt:'Phụ đề',ai:'AI',comments:'Bình luận'}[key]}: ${detail}`);
        allStep(key,'failed',detail);
      }
    };
    await progress('srt',ensureCaptions);
    if(results.srt==='success'){
      await progress('ai',()=>runSmartAi(false));
    }else{
      results.ai='skipped';allStep('ai','skipped','Không có phụ đề để gửi AI.');
    }
    if(youtube)await progress('comments',loadComments);
    else {results.comments='skipped';allStep('comments','skipped','Bình luận chỉ hỗ trợ YouTube.');}
    const succeeded=Object.values(results).filter(x=>x==='success').length;
    const summary=`Hoàn tất ${succeeded}/${youtube?3:2}: ${results.srt==='success'?'✓':'✗'} Phụ đề · ${results.ai==='success'?'✓':results.ai==='skipped'?'–':'✗'} AI · ${results.comments==='success'?'✓':results.comments==='skipped'?'–':'✗'} Bình luận.`;
    allMessage(summary+(errors.length?' Chi tiết lỗi ở thông báo bên dưới.':''));
    if($('byvRunAll'))$('byvRunAll').textContent=youtube?'↻ CHẠY LẠI CẢ 3 CÔNG CỤ':'↻ ĐỌC PHỤ ĐỀ + SMART AI';
    // Show the most useful available result without discarding the other two.
    if(results.ai==='success')choosePane('ai');
    else if(results.srt==='success')choosePane('srt');
    else if(results.comments==='success')choosePane('comments');
    status(errors.length?`${summary} ${errors.join(' | ')}`:summary,errors.length?'error':'ok');
  }
  async function task(fn) {
    if(state.busy)return;
    state.busy=true;
    const buttons=['byvRecordStart','byvRecordStop','byvImportSubtitle','byvTranscribeAudio','byvRunSmart','byvRunAll','byvLoadSrt','byvDownloadSrt','byvDownloadTxt','byvCopyTranscript','byvRunGemini','byvRefreshGemini','byvCopyGemini','byvLoadComments','byvExportComments','byvExportCommentsCsv'];
    buttons.forEach(id=>{const el=$(id);if(el)el.disabled=true;});
    try{await fn();}catch(e){status(`Lỗi: ${e.message||e}`,'error');}
    finally{state.busy=false;buttons.forEach(id=>{const el=$(id);if(el)el.disabled=false;});recordingButtons(!!tabRecording);}
  }
  function init() {
    if(!$('byvTabSrt'))return;
    document.querySelectorAll('#youtubeVideoPage [data-byv-tab]').forEach(button=>{
      button.addEventListener('click',()=>choosePane(button.dataset.byvTab));
      button.addEventListener('keydown',e=>{
        if(!['ArrowRight','ArrowLeft'].includes(e.key))return;
        e.preventDefault();const tabs=['srt','ai','comments'];const next=tabs[(tabs.indexOf(state.tab)+(e.key==='ArrowRight'?1:2))%3];
        choosePane(next);document.querySelector(`#youtubeVideoPage [data-byv-tab="${next}"]`)?.focus();
      });
    });
    document.querySelectorAll('#youtubeVideoPage [data-byv-ai-mode]').forEach(button=>{
      button.addEventListener('click',()=>setAiMode(button.dataset.byvAiMode));
    });
    updateAiMode();recordingButtons(false);
    const actions={
      byvRecordStart:startTabRecording,byvRecordStop:stopTabRecording,byvRunSmart:()=>runSmartAi(false),byvImportSubtitle:importSubtitle,byvTranscribeAudio:transcribeAudio,byvRunAll:runAllTools,byvLoadSrt:loadCaptions,byvDownloadSrt:downloadSrt,byvDownloadTxt:downloadTxt,
      byvCopyTranscript:copyTranscript,byvRunGemini:()=>runGemini(false),byvRefreshGemini:()=>runGemini(true),byvCopyGemini:copySummary,
      byvLoadComments:loadComments,byvExportComments:exportComments,byvExportCommentsCsv:exportCommentsCsv
    };
    for(const [id,fn] of Object.entries(actions))$(id)?.addEventListener('click',()=>task(fn));
  }
  window.BaByLonYoutubeVideoTools={onOpen:refreshVideo};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
