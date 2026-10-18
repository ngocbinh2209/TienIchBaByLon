(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("downloadUrlInput");
  const nameInput = $("downloadNameInput");
  const currentBtn = $("downloadCurrentBtn");
  const findBtn = $("downloadFindBtn");
  const detected = $("downloadDetected");
  const status = $("downloadStatus");
  const info = $("downloadInfo");
  const titleEl = $("downloadVideoTitle");
  const platformBadge = $("downloadPlatformBadge");
  const countEl = $("downloadCandidateCount");
  const videoSection = $("downloadVideoSection");
  const audioSection = $("downloadAudioSection");
  const subtitleSection = $("downloadSubtitleSection");
  const videoList = $("downloadVideoCandidates");
  const audioList = $("downloadAudioCandidates");
  const subtitleList = $("downloadSubtitleCandidates");
  const helperStatus = $("downloadHelperStatus");
  const liveBtn = $("downloadLiveBtn");
  const deepBtn = $("downloadDeepBtn");
  const folderBtn = $("downloadFolderBtn");
  const historyBtn = $("downloadHistoryBtn");
  const clearBtn = $("downloadClearBtn");
  const historyPanel = $("downloadHistoryPanel");
  const historyList = $("downloadHistoryList");
  const historyCloseBtn = $("downloadHistoryCloseBtn");
  const liveStatus = $("downloadLiveStatus");

  let initialized = false;
  let activeTabId = 0;
  let currentTitle = "";
  let currentPlatform = "";
  let lastScanItems = [];
  let lastSubtitles = [];
  let passiveTimer = 0;
  let passiveSignature = "";
  let liveEnabled = true;

  const YT_ITAG_META = {
    17:{q:"144p",ext:"3gp",kind:"video",hasAudio:true,hasVideo:true},
    18:{q:"360p",ext:"mp4",kind:"video",hasAudio:true,hasVideo:true},
    22:{q:"720p",ext:"mp4",kind:"video",hasAudio:true,hasVideo:true},
    37:{q:"1080p",ext:"mp4",kind:"video",hasAudio:true,hasVideo:true},
    160:{q:"144p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    133:{q:"240p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    134:{q:"360p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    135:{q:"480p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    136:{q:"720p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    137:{q:"1080p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    264:{q:"1440p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    266:{q:"2160p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    298:{q:"720p60",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    299:{q:"1080p60",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    394:{q:"144p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    395:{q:"240p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    396:{q:"360p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    397:{q:"480p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    398:{q:"720p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    399:{q:"1080p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    400:{q:"1440p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    401:{q:"2160p",ext:"mp4",kind:"video",hasAudio:false,hasVideo:true},
    278:{q:"144p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    242:{q:"240p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    243:{q:"360p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    244:{q:"480p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    247:{q:"720p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    248:{q:"1080p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    271:{q:"1440p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    313:{q:"2160p",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    302:{q:"720p60",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    303:{q:"1080p60",ext:"webm",kind:"video",hasAudio:false,hasVideo:true},
    139:{q:"48 kbps",ext:"m4a",kind:"audio",hasAudio:true,hasVideo:false},
    140:{q:"128 kbps",ext:"m4a",kind:"audio",hasAudio:true,hasVideo:false},
    141:{q:"256 kbps",ext:"m4a",kind:"audio",hasAudio:true,hasVideo:false},
    249:{q:"50 kbps",ext:"webm",kind:"audio",hasAudio:true,hasVideo:false},
    250:{q:"70 kbps",ext:"webm",kind:"audio",hasAudio:true,hasVideo:false},
    251:{q:"160 kbps",ext:"webm",kind:"audio",hasAudio:true,hasVideo:false},
  };

  function detectPlatform(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "YouTube";
      if (host.endsWith("facebook.com") || host === "fb.watch") return "Facebook";
      if (host.endsWith("tiktok.com")) return "TikTok";
      if (host.endsWith("douyin.com")) return "Douyin";
      if (host.endsWith("bilibili.com")) return "Bilibili";
    } catch {}
    return "Web";
  }

  function isSupportedVideoUrl(url) {
    const platform = detectPlatform(url);
    if (!platform) return false;
    try {
      const u = new URL(url);
      if (platform === "YouTube") return Boolean(u.searchParams.get("v") || /\/(?:shorts|live)\/[^/?#]+/.test(u.pathname) || u.hostname.replace(/^www\./, "") === "youtu.be");
      if (platform === "Facebook") return /\/reel\/|\/videos\/|\/watch/i.test(u.pathname) || u.searchParams.has("v") || u.hostname.includes("fb.watch");
      if (platform === "TikTok" || platform === "Douyin") return /\/video\/\d+/i.test(u.pathname) || platform === "Douyin";
      if (platform === "Bilibili") return /\/video\/(?:BV|av)/i.test(u.pathname);
      if (platform === "Web") return /^https?:$/i.test(u.protocol);
    } catch {}
    return false;
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    const saved = await chrome.storage.local.get(["babylonDownloadLastName"]);
    if (saved.babylonDownloadLastName) nameInput.value = saved.babylonDownloadLastName;
    currentBtn?.addEventListener("click", async () => { const ok = await readCurrentTab(true); if (ok) await analyze(false); });
    findBtn?.addEventListener("click", () => analyze(false));
    deepBtn?.addEventListener("click", () => analyze(true));
    liveBtn?.addEventListener("click", () => { liveEnabled = !liveEnabled; liveBtn.classList.toggle("active", liveEnabled); if (liveStatus) liveStatus.style.opacity = liveEnabled ? "1" : ".55"; if (liveEnabled) refreshPassive(true); });
    folderBtn?.addEventListener("click", () => chrome.downloads.showDefaultFolder());
    historyBtn?.addEventListener("click", toggleHistory);
    historyCloseBtn?.addEventListener("click", () => historyPanel?.classList.add("hidden"));
    clearBtn?.addEventListener("click", clearCompletedHistory);
    nameInput?.addEventListener("change", saveName);
    input?.addEventListener("change", recognizeTypedUrl);
    input?.addEventListener("paste", () => setTimeout(recognizeTypedUrl, 0));
    helperStatus.textContent = "Browser Downloader sẵn sàng • chạy hoàn toàn trong Chrome • không cần chương trình ngoài";
    helperStatus.className = "ok";
    startPassiveLoop();
  }

  async function onOpen() { await init(); await readCurrentTab(false); await refreshPassive(true); }

  async function readCurrentTab(showMessage) {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !tab?.url) { if (showMessage) setStatus("Không đọc được tab hiện tại.","error"); return false; }
    activeTabId = tab.id;
    const platform = detectPlatform(tab.url);
    if (!platform || !isSupportedVideoUrl(tab.url)) { if (showMessage) setStatus("Hãy mở một video được hỗ trợ.","warn"); return false; }
    currentPlatform = platform;
    currentTitle = cleanTitle(tab.title || `${platform} video`);
    input.value = canonicalPageUrl(tab.url);
    autoFillName(currentTitle);
    showRecognized(platform,"video hiện tại");
    if (showMessage) setStatus("Đã lấy link video hiện tại.","ok");
    return true;
  }

  function recognizeTypedUrl() {
    const url=input.value.trim(); const platform=detectPlatform(url);
    if (!platform || !isSupportedVideoUrl(url)) { detected.textContent="Link chưa đúng định dạng video được hỗ trợ."; detected.className="download-detected warn"; return false; }
    currentPlatform=platform; showRecognized(platform,"link đã dán"); return true;
  }
  function showRecognized(platform,suffix){ detected.textContent=`Đã nhận diện: ${platform} • ${suffix}`; detected.className="download-detected ok"; platformBadge.textContent=platform.toUpperCase(); }

  async function analyze(deep = false) {
    const url=input.value.trim(); const platform=detectPlatform(url);
    if (!platform || !isSupportedVideoUrl(url)) { setStatus("Link không hợp lệ.","error"); return; }
    currentPlatform=platform; showRecognized(platform, deep ? "đang quét sâu" : "đang làm mới"); setLoading(true);
    let targetTab=null, temporary=false, debuggerStarted=false;
    try {
      const active=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
      const scanUrl = platform === "YouTube" ? youtubeWatchUrl(url) : url;
      const canUseActive = active?.id && active?.url && sameVideoPage(scanUrl, active.url);
      if (canUseActive) { targetTab=active; activeTabId=active.id; }
      else {
        setStatus("Đang mở link ở tab nền để nhận media...","ok");
        targetTab=await chrome.tabs.create({url:scanUrl,active:false}); temporary=true;
        await waitTabReady(targetTab.id,16000);
        await sleep(650);
      }
      const tabId=targetTab.id; if (!tabId) throw new Error("Không tạo được tab phân tích.");

      // Fast path: passive WebRequest cache + player/DOM. Không ép đổi chất lượng.
      const passive1=await chrome.runtime.sendMessage({type:"BABYLON_PASSIVE_MEDIA_GET",tabId}).catch(()=>({items:[]}));
      let before=await extractPageFormats(tabId);
      let clientDirect={items:[],title:'',subtitles:[],attempts:[]};
      if(platform==='YouTube'){
        setStatus('Đang lấy danh sách chất lượng trực tiếp từ YouTube...','ok');
        clientDirect=await extractYouTubeClientFormats(tabId,url).catch(()=>({items:[],title:'',subtitles:[],attempts:[]}));
      }
      let after={title:clientDirect?.title||before?.title,items:[],subtitles:dedupeSubtitles([...(before?.subtitles||[]),...(clientDirect?.subtitles||[])])};

      if (platform === "YouTube") {
        // VDH-style workflow: bắt Network thật của player ngay cả ở quét nhanh.
        // Bản cũ chỉ attach debugger khi bấm QUÉT SÂU nên nếu streamingData không chứa URL
        // thì BaByLon chỉ nhìn thấy phụ đề. Quét nhanh giờ attach trong ~1-2 giây,
        // kích một burst media rất nhỏ rồi đọc URL googlevideo thực tế.
        const directSummary=summarizeYouTubeFormats(clientDirect?.items||[]);
        const enoughDirect=directSummary.videoHeights>=3 && directSummary.hasAudio;
        if(!enoughDirect || deep){
          await chrome.runtime.sendMessage({type:"BABYLON_MEDIA_STOP",tabId}).catch(()=>{});
          const startCapture=await chrome.runtime.sendMessage({type:"BABYLON_MEDIA_START",tabId}).catch(()=>null);
          debuggerStarted=Boolean(startCapture?.ok);
        }
        if (debuggerStarted) {
          if (deep) {
            setStatus("Quét sâu YouTube: đang bổ sung chất lượng còn thiếu...","ok");
            await captureYouTubeQualityMatrix(tabId);
          } else {
            setStatus("Đang bổ sung luồng player hiện tại...","ok");
            await captureYouTubeFastProbe(tabId);
          }
          const pageAfter=await extractPageFormats(tabId);
          after={title:pageAfter?.title||clientDirect?.title||before?.title,items:pageAfter?.items||[],subtitles:dedupeSubtitles([...(pageAfter?.subtitles||[]),...(clientDirect?.subtitles||[])])};
        } else if (deep && !enoughDirect) {
          setStatus("Không attach được bộ bắt Network; đang đọc player trực tiếp...","warn");
          after=await extractPageFormats(tabId);
        }
      } else if (platform !== "YouTube") {
        // Chỉ nudge ngắn cho site thường nếu chưa bắt được media.
        const fastItems=mergeItems([...(passive1?.items||[]),...(before?.items||[])]);
        if (!fastItems.some(x=>x.kind==='video'||x.kind==='audio')) {
          await nudgePlayback(tabId); await sleep(650); after=await extractPageFormats(tabId);
        }
      }

      let passive2=await chrome.runtime.sendMessage({type:"BABYLON_PASSIVE_MEDIA_GET",tabId}).catch(()=>({items:[]}));
      let debuggerNet=debuggerStarted ? await chrome.runtime.sendMessage({type:"BABYLON_MEDIA_GET",tabId}).catch(()=>({items:[]})) : {items:[]};
      let items=mergeItems([...(clientDirect?.items||[]),...(passive1?.items||[]),...(passive2?.items||[]),...(before?.items||[]),...(after?.items||[]),...(debuggerNet?.items||[])]).filter(x=>x.kind!=='manifest').map(x=>({...x,sourceTabId:tabId}));

      // Nếu quét nhanh vẫn chỉ thấy phụ đề/manifest, tự làm một probe khẩn cấp ~1.5s.
      // Người dùng không cần bấm QUÉT SÂU chỉ để có luồng video hiện tại.
      if(platform==='YouTube' && debuggerStarted && !deep && !items.some(x=>x.kind==='video'||x.kind==='audio')){
        setStatus('Chưa thấy video/audio • đang kích luồng hiện tại thêm một lần...','warn');
        await captureYouTubeEmergencyProbe(tabId);
        passive2=await chrome.runtime.sendMessage({type:"BABYLON_PASSIVE_MEDIA_GET",tabId}).catch(()=>({items:[]}));
        debuggerNet=await chrome.runtime.sendMessage({type:"BABYLON_MEDIA_GET",tabId}).catch(()=>({items:[]}));
        after=await extractPageFormats(tabId).catch(()=>after);
        items=mergeItems([...(clientDirect?.items||[]),...(passive1?.items||[]),...(passive2?.items||[]),...(before?.items||[]),...(after?.items||[]),...(debuggerNet?.items||[])]).filter(x=>x.kind!=='manifest').map(x=>({...x,sourceTabId:tabId}));
      }
      lastScanItems=items;
      lastSubtitles=dedupeSubtitles([...(before?.subtitles||[]),...(after?.subtitles||[])]);
      currentTitle=cleanTitle(after?.title||before?.title||targetTab.title||currentTitle||`${platform} video`);
      autoFillName(currentTitle); titleEl.textContent=currentTitle; platformBadge.textContent=platform.toUpperCase();
      renderItems(items,lastSubtitles);
      const stats=summarizeYouTubeFormats(items);
      if (platform==='YouTube' && !deep && stats.videoHeights < 2) {
        setStatus(`Quét nhanh xong. Đã thấy ${items.length} luồng. Nếu chưa đủ chất lượng, bấm “QUÉT SÂU YT”.`,'warn');
      }
      helperStatus.textContent=`Đã nhận ${items.length} luồng media • ${lastSubtitles.length} phụ đề`;
      helperStatus.className="ok";
      passiveSignature=signatureItems(items);
    } catch(e){ setStatus(`Không lấy được chất lượng: ${e?.message||e}`,"error"); }
    finally {
      setLoading(false);
      if (targetTab?.id) {
        try{await restorePlayback(targetTab.id);}catch{}
        if (debuggerStarted) try{await chrome.runtime.sendMessage({type:"BABYLON_MEDIA_STOP",tabId:targetTab.id});}catch{}
        if(temporary) try{await chrome.tabs.remove(targetTab.id);}catch{}
      }
    }
  }

  async function refreshPassive(force=false){
    if(!liveEnabled||!activeTabId)return;
    try{
      const res=await chrome.runtime.sendMessage({type:'BABYLON_PASSIVE_MEDIA_GET',tabId:activeTabId});
      if(!res?.ok)return;
      const page=await extractPageFormats(activeTabId).catch(()=>({items:[],subtitles:[]}));
      const items=mergeItems([...(res.items||[]),...(page?.items||[])]).filter(x=>x.kind!=='manifest');
      const sig=signatureItems(items);
      if(!force&&sig===passiveSignature)return;
      passiveSignature=sig;
      if(items.length){
        lastScanItems=items;
        lastSubtitles=dedupeSubtitles(page?.subtitles||lastSubtitles);
        if(page?.title){currentTitle=cleanTitle(page.title);autoFillName(currentTitle);titleEl.textContent=currentTitle;}
        platformBadge.textContent=(currentPlatform||'WEB').toUpperCase();
        renderItems(items,lastSubtitles);
        helperStatus.textContent=`Tự phát hiện • ${items.length} luồng media`;
        helperStatus.className='ok';
      }
    }catch{}
  }

  function startPassiveLoop(){
    if(passiveTimer)return;
    passiveTimer=setInterval(()=>refreshPassive(false),1100);
  }
  function signatureItems(items){return (items||[]).map(x=>`${x.itag||''}:${x.kind}:${x.height||0}:${x.ext}:${stripVolatile(x.url||'')}`).sort().join('|');}

  async function toggleHistory(){
    if(!historyPanel||!historyList)return;
    const opening=historyPanel.classList.contains('hidden');
    historyPanel.classList.toggle('hidden',!opening);
    if(!opening)return;
    historyList.innerHTML='<div class="empty">Đang đọc lịch sử...</div>';
    try{
      const rows=await chrome.downloads.search({limit:20,orderBy:['-startTime']});
      historyList.innerHTML='';
      if(!rows.length){historyList.innerHTML='<div class="empty">Chưa có file tải gần đây.</div>';return;}
      for(const d of rows){
        const row=document.createElement('div');row.className='download-history-row';
        const main=document.createElement('div');const title=document.createElement('strong');title.textContent=(d.filename||d.url||'Download').split(/[\\/]/).pop();
        const meta=document.createElement('small');meta.textContent=[d.totalBytes?humanSize(d.totalBytes):'',d.mime||'',d.startTime?new Date(d.startTime).toLocaleString('vi-VN'):''].filter(Boolean).join(' • ');
        main.append(title,meta);const st=document.createElement('span');st.className=`download-history-state${d.state==='interrupted'?' bad':''}`;st.textContent=d.state==='complete'?'Xong':d.state==='interrupted'?'Lỗi':'Đang tải';row.append(main,st);historyList.appendChild(row);
      }
    }catch(e){historyList.innerHTML=`<div class="empty">Không đọc được lịch sử: ${e?.message||e}</div>`;}
  }

  async function clearCompletedHistory(){
    try{
      const rows=await chrome.downloads.search({state:'complete',limit:1000});
      for(const d of rows) await chrome.downloads.erase({id:d.id}).catch(()=>{});
      setStatus(`Đã xóa ${rows.length} mục đã hoàn tất khỏi lịch sử Chrome. File đã tải vẫn được giữ.`,'ok');
      if(historyPanel&&!historyPanel.classList.contains('hidden')) await toggleHistory(),await toggleHistory();
    }catch(e){setStatus(`Không xóa được lịch sử: ${e?.message||e}`,'error');}
  }

  function youtubeVideoId(value){
    try{const u=new URL(value); if(u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0]||''; return u.searchParams.get('v')||u.pathname.match(/\/(?:shorts|live)\/([^/?#]+)/)?.[1]||'';}catch{return ''}
  }
  function youtubeWatchUrl(value){const id=youtubeVideoId(value); return id?`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`:value;}

  async function waitTabReady(tabId,timeoutMs){
    const existing=await chrome.tabs.get(tabId).catch(()=>null); if(existing?.status==='complete') return;
    await new Promise((resolve,reject)=>{let done=false; const timer=setTimeout(()=>finish(new Error('Trang tải quá lâu.')),timeoutMs); const listener=(id,change)=>{if(id===tabId&&change.status==='complete')finish();}; function finish(err){if(done)return;done=true;clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);err?reject(err):resolve();} chrome.tabs.onUpdated.addListener(listener);});
  }

  async function extractPageFormats(tabId){
    const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async()=>{
      const output=[], subtitles=[], seen=new Set();
      const add=(item)=>{const url=String(item?.url||''); if(!/^https?:\/\//i.test(url)||seen.has(url))return; seen.add(url); output.push(item);};
      const parseMime=(mimeType)=>{const text=String(mimeType||'');return{base:text.split(';')[0].trim().toLowerCase(),codecs:(text.match(/codecs="([^"]+)"/i)?.[1]||'').trim()};};
      const cipherUrl=(f)=>{
        if(f?.url)return{url:f.url,ciphered:false};
        const raw=f?.signatureCipher||f?.cipher||''; if(!raw)return{url:'',ciphered:false};
        try{
          const p=new URLSearchParams(raw); const base=p.get('url')||''; if(!base)return{url:'',ciphered:true};
          const sig=p.get('sig')||p.get('signature')||''; const s=p.get('s')||''; const sp=p.get('sp')||'signature';
          if(sig){const u=new URL(base);u.searchParams.set(sp,sig);return{url:u.toString(),ciphered:false};}
          // Có s nhưng chưa decipher: chỉ metadata, URL này thường sẽ 403 nếu tải trực tiếp.
          return{url:s?'':base,ciphered:Boolean(s)};
        }catch{return{url:'',ciphered:true};}
      };
      let player=null;
      try{const pe=document.getElementById('movie_player')||document.querySelector('ytd-reel-video-renderer[is-active] #movie_player');player=pe?.getPlayerResponse?.()||null;}catch{}
      if(!player) player=window.ytInitialPlayerResponse||null;
      if(!player){try{const raw=window.ytplayer?.config?.args?.player_response;if(raw)player=typeof raw==='string'?JSON.parse(raw):raw;}catch{}}

      // Fallback: hỏi chính Innertube context của trang. Không dùng API key ngoài.
      let apiPlayer=null;
      try{
        const videoId=player?.videoDetails?.videoId||new URL(location.href).searchParams.get('v')||location.pathname.match(/\/(?:shorts|live)\/([^/?#]+)/)?.[1]||'';
        const apiKey=window.ytcfg?.get?.('INNERTUBE_API_KEY')||'';
        const context=window.ytcfg?.get?.('INNERTUBE_CONTEXT')||null;
        if(videoId&&apiKey&&context){
          const r=await fetch(`/youtubei/v1/player?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,{
            method:'POST',credentials:'include',headers:{'content-type':'application/json'},
            body:JSON.stringify({context,videoId,contentCheckOk:true,racyCheckOk:true})
          });
          if(r.ok)apiPlayer=await r.json();
        }
      }catch{}

      const collectPlayer=(pr,source)=>{
        if(!pr?.streamingData)return;
        const collect=(list,adaptive)=>{for(const f of list||[]){
          const cu=cipherUrl(f); if(!cu.url)continue;
          const mm=parseMime(f.mimeType);const audio=mm.base.startsWith('audio/');const video=mm.base.startsWith('video/');
          add({source,url:cu.url,mime:mm.base,codec:mm.codecs,kind:audio?'audio':'video',quality:audio?`${Math.round((Number(f.bitrate)||0)/1000)||''} kbps`.trim():(f.qualityLabel||f.quality||'Video'),height:Number(f.height||0),fps:Number(f.fps||0),bitrate:Number(f.bitrate||0),itag:Number(f.itag||0),ext:mm.base.includes('webm')?'webm':audio?'m4a':'mp4',hasVideo:video,hasAudio:audio?true:!adaptive,sizeBytes:Number(f.contentLength||0),pageExtracted:true});
        }};
        collect(pr.streamingData.formats,false);collect(pr.streamingData.adaptiveFormats,true);
      };
      collectPlayer(player,'page');
      collectPlayer(apiPlayer,'innertube');

      for(const pr of [player,apiPlayer])for(const tr of pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks||[]){if(!tr?.baseUrl)continue;subtitles.push({url:tr.baseUrl,languageCode:tr.languageCode||'',name:tr.name?.simpleText||tr.name?.runs?.map(x=>x.text).join('')||tr.languageCode||'Subtitle',kind:tr.kind||''});}
      for(const media of document.querySelectorAll('video,audio,source')){const url=media.currentSrc||media.src||media.getAttribute?.('src')||'';if(!/^https?:\/\//i.test(url))continue;const isAudio=media.tagName==='AUDIO';add({source:'dom',url,kind:isAudio?'audio':'video',quality:'Đang phát',ext:isAudio?'m4a':'mp4',hasAudio:true,hasVideo:!isAudio});}
      for(const entry of performance.getEntriesByType('resource')){const url=String(entry.name||'');if(!/^https?:\/\//i.test(url))continue;if(!/googlevideo\.com|videoplayback|fbcdn\.net|tiktok|byteoversea|douyinvod|bilivideo|\.mp4(?:\?|$)|\.m4a(?:\?|$)|\.webm(?:\?|$)/i.test(url))continue;add({source:'performance',url,kind:/audio%2F|mime=audio|itag=(139|140|141|249|250|251)/i.test(url)?'audio':'video',quality:'Luồng trang',ext:/webm/i.test(url)?'webm':'mp4',hasAudio:null,hasVideo:true});}
      const title=player?.videoDetails?.title||apiPlayer?.videoDetails?.title||document.querySelector('h1')?.textContent?.trim()||document.title||'video';
      return{title,items:output,subtitles};
    }});
    return results?.[0]?.result||{items:[],subtitles:[]};
  }


  async function extractYouTubeClientFormats(tabId, pageUrl){
    const videoId=youtubeVideoId(pageUrl);
    if(!videoId)return{items:[],title:'',subtitles:[],attempts:[]};
    const results=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',args:[videoId],func:async(videoId)=>{
      const out=[],subs=[],attempts=[],seen=new Set();
      const parseMime=(mimeType)=>{const text=String(mimeType||'');return{base:text.split(';')[0].trim().toLowerCase(),codecs:(text.match(/codecs="([^"]+)"/i)?.[1]||'').trim()};};
      const add=(item)=>{const u=String(item?.url||'');if(!/^https?:\/\//i.test(u)||seen.has(`${item.itag}|${u}`))return;seen.add(`${item.itag}|${u}`);out.push(item);};
      const collect=(pr,clientName)=>{
        const sd=pr?.streamingData;if(!sd)return;
        const collectList=(list,adaptive)=>{for(const f of list||[]){
          if(!f?.url)continue; // Only trusted direct URLs. Never fabricate a URL from cipher text.
          const mm=parseMime(f.mimeType);const isAudio=mm.base.startsWith('audio/');const isVideo=mm.base.startsWith('video/');
          if(!isAudio&&!isVideo)continue;
          const hasAudio=isAudio?true:(!adaptive && /(?:mp4a|opus|vorbis)/i.test(mm.codecs));
          const hasVideo=isVideo;
          add({
            source:`yt-${clientName}`,url:f.url,mime:mm.base,codec:mm.codecs,
            kind:isAudio?'audio':'video',quality:isAudio?`${Math.round((Number(f.averageBitrate||f.bitrate)||0)/1000)||''} kbps`.trim():(f.qualityLabel||f.quality||'Video'),
            height:Number(f.height||0),width:Number(f.width||0),fps:Number(f.fps||0),bitrate:Number(f.averageBitrate||f.bitrate||0),itag:Number(f.itag||0),
            ext:mm.base.includes('webm')?'webm':isAudio?'m4a':'mp4',hasVideo,hasAudio,
            totalBytes:Number(f.contentLength||0),sizeBytes:Number(f.contentLength||0),pageExtracted:true,verifiedDirect:true,clientName
          });
        }};
        collectList(sd.formats,false);collectList(sd.adaptiveFormats,true);
        for(const tr of pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks||[]){if(!tr?.baseUrl)continue;subs.push({url:tr.baseUrl,languageCode:tr.languageCode||'',name:tr.name?.simpleText||tr.name?.runs?.map(x=>x.text).join('')||tr.languageCode||'Subtitle',kind:tr.kind||''});}
      };
      let cfg={};try{cfg=window.ytcfg?.data_||{};}catch{}
      const key=(()=>{try{return window.ytcfg?.get?.('INNERTUBE_API_KEY')||cfg?.INNERTUBE_API_KEY||''}catch{return''}})();
      const visitor=(()=>{try{return window.ytcfg?.get?.('VISITOR_DATA')||cfg?.VISITOR_DATA||''}catch{return''}})();
      const url=key?`/youtubei/v1/player?key=${encodeURIComponent(key)}&prettyPrint=false`:'/youtubei/v1/player?prettyPrint=false';
      const clients=[
        {name:'web',credentials:'include',client:{clientName:'WEB',clientVersion:(()=>{try{return window.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION')||'2.20260708.00.00'}catch{return'2.20260708.00.00'}})(),hl:'en',gl:'US',visitorData:visitor||undefined}},
        {name:'android_vr',credentials:'omit',client:{clientName:'ANDROID_VR',clientVersion:'1.65.10',androidSdkVersion:32,osName:'Android',osVersion:'12L',deviceMake:'Oculus',deviceModel:'Quest 3',hl:'en',gl:'US'}},
        {name:'web_embedded',credentials:'include',client:{clientName:'WEB_EMBEDDED_PLAYER',clientVersion:'2.20260708.00.00',hl:'en',gl:'US'},thirdParty:{embedUrl:'https://www.youtube.com/'}},
        {name:'ios',credentials:'omit',client:{clientName:'IOS',clientVersion:'21.26.4',deviceMake:'Apple',deviceModel:'iPhone16,2',osName:'iPhone',osVersion:'18.3.2.22D82',hl:'en',gl:'US'}},
        {name:'tv',credentials:'omit',client:{clientName:'TVHTML5',clientVersion:'5.20260707',hl:'en',gl:'US'}}
      ];
      for(const c of clients){
        try{
          const context={client:c.client};if(c.thirdParty)context.thirdParty=c.thirdParty;
          const r=await fetch(url,{method:'POST',credentials:c.credentials,headers:{'content-type':'application/json'},body:JSON.stringify({context,videoId,contentCheckOk:true,racyCheckOk:true,playbackContext:{contentPlaybackContext:{html5Preference:'HTML5_PREF_WANTS'}}})});
          if(!r.ok){attempts.push({client:c.name,status:r.status,count:0});continue;}
          const pr=await r.json();const before=out.length;collect(pr,c.name);attempts.push({client:c.name,status:200,count:out.length-before,playability:pr?.playabilityStatus?.status||''});
        }catch(e){attempts.push({client:c.name,status:0,count:0,error:String(e?.message||e)});}
        // Stop early once we have useful direct video + audio coverage.
        const heights=new Set(out.filter(x=>x.kind==='video').map(x=>Number(x.height||0)).filter(Boolean));
        const hasAudio=out.some(x=>x.kind==='audio');
        if(heights.size>=5&&hasAudio)break;
      }
      let title='';try{title=document.querySelector('h1 yt-formatted-string')?.textContent?.trim()||document.querySelector('h1')?.textContent?.trim()||document.title||'';}catch{}
      return{items:out,title,subtitles:subs,attempts};
    }}).catch(()=>[]);
    return results?.[0]?.result||{items:[],title:'',subtitles:[],attempts:[]};
  }

  function summarizeYouTubeFormats(items){
    const heights = new Set();
    let hasAudio = false;
    for (const raw of items || []) {
      const item = normalizeItem(raw);
      if (item.kind === 'audio' || item.hasVideo === false) hasAudio = true;
      if (item.kind === 'video' && Number(item.height || 0) > 0) heights.add(Number(item.height));
    }
    return {videoHeights: heights.size, hasAudio};
  }

  async function captureYouTubeFastProbe(tabId){
    const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const video=[...document.querySelectorAll('video')].find(v=>v.readyState>=1)||document.querySelector('video');
      const players=[document.getElementById('movie_player'),document.querySelector('ytd-reel-video-renderer[is-active] #movie_player'),...[...document.querySelectorAll('#movie_player')]].filter(Boolean);
      const player=players.find(p=>typeof p.getAvailableQualityLevels==='function')||players[0];
      if(!video)return{ok:false,levels:[],probes:0};

      if(!window.__BABYLON_MEDIA_RESTORE__)window.__BABYLON_MEDIA_RESTORE__={
        paused:video.paused,muted:video.muted,volume:video.volume,time:video.currentTime,
        quality:player?.getPlaybackQuality?.()||''
      };

      try{video.muted=true;await video.play();}catch{}
      let levels=[];
      try{levels=player?.getAvailableQualityLevels?.()||[];}catch{}
      try{const data=player?.getAvailableQualityData?.()||[];levels=[...levels,...data.map(x=>x.quality).filter(Boolean)];}catch{}
      const current=(()=>{try{return player?.getPlaybackQuality?.()||''}catch{return''}})();
      const duration=Number(video.duration||0);
      const rank=['highres','hd2160','hd1440','hd1080','hd720','large','medium','small','tiny'];
      const sorted=[...new Set(levels)].filter(Boolean).sort((a,b)=>{
        const ai=rank.indexOf(a),bi=rank.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi);
      });

      // 1.30 chỉ nhích +0.22s nên thường vẫn nằm trong buffer => không sinh request media mới.
      // 1.31 cố tình seek tới các vùng xa đang chưa buffer, đủ để Network nhìn thấy luồng thật.
      const seek=(t)=>{
        if(!Number.isFinite(t)||t<0)return;
        try{if(player?.seekTo)player.seekTo(t,true);else video.currentTime=t;}catch{try{video.currentTime=t;}catch{}}
      };
      const targets=[];
      if(Number.isFinite(duration)&&duration>8){
        const now=Math.max(0,Number(video.currentTime||0));
        for(const ratio of [.78,.24,.56]){
          const t=Math.max(.5,Math.min(duration-1.2,duration*ratio));
          if(Math.abs(t-now)>3)targets.push(t);
        }
      } else if(Number.isFinite(duration)&&duration>2){
        targets.push(Math.max(.2,Math.min(duration-.4,duration*.72)));
      }

      let probes=0;
      // Probe current stream at a clearly unbuffered position.
      if(targets.length){
        seek(targets[0]);
        await video.play().catch(()=>{});
        await sleep(760);
        probes++;
      } else {
        await video.play().catch(()=>{});
        await sleep(420);
      }

      // Probe highest available quality once, still keeping scan fast.
      const high=sorted.find(x=>x&&x!==current);
      if(high&&player){
        try{
          player.setPlaybackQualityRange?.(high,high);
          player.setPlaybackQuality?.(high);
          if(targets[1]!=null)seek(targets[1]);
          await video.play().catch(()=>{});
          const started=Date.now();
          while(Date.now()-started<850){
            await sleep(100);
            let q='';try{q=player.getPlaybackQuality?.()||'';}catch{}
            if(q===high)break;
          }
          await sleep(360);
          probes++;
        }catch{}
      }

      // Final short seek only if there was no second quality probe.
      if(probes<2&&targets[1]!=null){
        seek(targets[1]);
        await video.play().catch(()=>{});
        await sleep(520);
        probes++;
      }
      return{ok:true,levels:sorted,current,high:high||'',probes};
    }}).catch(()=>[]);
    return result?.[0]?.result||{ok:false,levels:[],probes:0};
  }

  async function captureYouTubeQualityMatrix(tabId){
    const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const video=[...document.querySelectorAll('video')].find(v=>v.readyState>=1)||document.querySelector('video');
      const players=[document.getElementById('movie_player'),document.querySelector('ytd-reel-video-renderer[is-active] #movie_player'),...[...document.querySelectorAll('#movie_player')]].filter(Boolean);
      const player=players.find(p=>typeof p.getAvailableQualityLevels==='function')||players[0];
      if(!video||!player)return{levels:[],captured:0,elapsed:0};
      if(!window.__BABYLON_MEDIA_RESTORE__)window.__BABYLON_MEDIA_RESTORE__={paused:video.paused,muted:video.muted,volume:video.volume,time:video.currentTime,quality:player.getPlaybackQuality?.()||''};
      try{video.muted=true;await video.play();}catch{}

      const rank=['highres','hd2160','hd1440','hd1080','hd720','large','medium','small','tiny'];
      let levels=[];
      try{levels=player.getAvailableQualityLevels?.()||[];}catch{}
      try{const data=player.getAvailableQualityData?.()||[];levels=[...levels,...data.map(x=>x.quality).filter(Boolean)];}catch{}
      levels=[...new Set(levels)].filter(Boolean).sort((a,b)=>{
        const ai=rank.indexOf(a),bi=rank.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi);
      });

      // Nếu API player không trả danh sách thì thử các mức phổ biến, nhưng giới hạn để không quét 25-30 giây.
      if(!levels.length)levels=['hd2160','hd1440','hd1080','hd720','large','medium','small'];

      // Loại mức trùng ý nghĩa và ưu tiên 2K/1080/720/480/360/240/144.
      const maxLevels=7;
      levels=levels.slice(0,maxLevels);
      const duration=Number(video.duration||0);let captured=0;
      const t0=Date.now();

      for(let i=0;i<levels.length;i++){
        const level=levels[i];
        try{
          player.setPlaybackQualityRange?.(level,level);
          player.setPlaybackQuality?.(level);
          if(Number.isFinite(duration)&&duration>3){
            const ratio=.10+(i%5)*.15;
            video.currentTime=Math.max(.2,Math.min(duration-.6,duration*ratio));
          }
          await video.play().catch(()=>{});

          // Bản cũ chờ tối đa 2.6s + 0.6s cho MỖI chất lượng.
          // Bản nhanh chỉ cho player 700ms để chuyển và 180ms để request media xuất hiện.
          const started=Date.now();
          while(Date.now()-started<700){
            await sleep(100);
            let q='';try{q=player.getPlaybackQuality?.()||'';}catch{}
            if(q===level)break;
          }
          await sleep(180);
          captured++;
        }catch{}
      }
      await sleep(250);
      return{levels,captured,elapsed:Date.now()-t0};
    }}).catch(()=>[]);
    return result?.[0]?.result||{levels:[],captured:0,elapsed:0};
  }

  async function captureYouTubeEmergencyProbe(tabId){
    const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const video=document.querySelector('video');
      const player=document.getElementById('movie_player')||document.querySelector('ytd-reel-video-renderer[is-active] #movie_player');
      if(!video)return{ok:false};
      const duration=Number(video.duration||0);
      const seek=(t)=>{try{if(player?.seekTo)player.seekTo(t,true);else video.currentTime=t;}catch{try{video.currentTime=t}catch{}}};
      try{video.muted=true;await video.play();}catch{}
      if(Number.isFinite(duration)&&duration>10){seek(Math.max(1,Math.min(duration-1.5,duration*.88)));await sleep(780);seek(Math.max(1,Math.min(duration-1.5,duration*.34)));await sleep(620);}
      else {try{video.currentTime=Math.max(0,Number(video.currentTime||0)+1.5)}catch{}await sleep(650);}
      return{ok:true};
    }}).catch(()=>[]);
    return result?.[0]?.result||{ok:false};
  }

  async function nudgePlayback(tabId){await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>{const v=document.querySelector('video');if(!v)return false;window.__BABYLON_MEDIA_RESTORE__={paused:v.paused,muted:v.muted,volume:v.volume,time:v.currentTime};try{v.muted=true;v.play().catch(()=>{});}catch{}return true;}}).catch(()=>{});}
  async function restorePlayback(tabId){await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>{const v=document.querySelector('video'),s=window.__BABYLON_MEDIA_RESTORE__;if(!v||!s)return;try{v.muted=s.muted;v.volume=s.volume;v.currentTime=s.time||v.currentTime;if(s.paused)v.pause();}catch{}try{const p=document.getElementById('movie_player');if(p&&s.quality){p.setPlaybackQualityRange?.(s.quality,s.quality);p.setPlaybackQuality?.(s.quality);}}catch{}delete window.__BABYLON_MEDIA_RESTORE__;}}).catch(()=>{});}

  function mergeItems(items){const map=new Map();for(const raw of items||[]){if(!raw?.url||!/^https?:\/\//i.test(raw.url))continue;const item=normalizeItem(raw);const key=item.itag?`itag:${item.itag}:${item.kind}`:`${item.kind}:${item.height||0}:${item.quality}:${stripVolatile(item.url)}`;const old=map.get(key);if(!old||itemScore(item)>itemScore(old))map.set(key,item);}return[...map.values()];}
  function normalizeItem(raw){const mime=String(raw.mime||'').toLowerCase(),url=String(raw.url||'');let parsed=null;try{parsed=new URL(url);}catch{}const itag=Number(raw.itag||parsed?.searchParams.get('itag')||0),yt=YT_ITAG_META[itag]||null;let kind=raw.kind||yt?.kind||(/^audio\//.test(mime)?'audio':'video');let ext=raw.ext||yt?.ext||(mime.includes('webm')?'webm':kind==='audio'?'m4a':'mp4');if(/\.mp3(?:\?|$)/i.test(url)||mime.includes('audio/mpeg'))ext='mp3';let quality=raw.quality||yt?.q||(kind==='audio'?'Audio':'Video');const height=Number(raw.height||resolutionNum(quality)||0);let hasAudio=raw.hasAudio,hasVideo=raw.hasVideo;if(yt){hasAudio=yt.hasAudio;hasVideo=yt.hasVideo;}if(kind==='audio'){hasAudio=true;hasVideo=false;}let totalBytes=Number(raw.totalBytes||raw.sizeBytes||parsed?.searchParams.get('clen')||0);return{...raw,itag,kind,ext,height,quality,hasAudio,hasVideo:hasVideo!==false,totalBytes,sizeBytes:totalBytes,sizeText:raw.sizeText||humanSize(totalBytes),source:raw.source||'network'};}

  function isUsableYouTubeNetworkItem(item){
    if(!item?.url)return false;
    let u=null;try{u=new URL(item.url)}catch{return false;}
    if(!/googlevideo\.com$/i.test(u.hostname)&&!/\.googlevideo\.com$/i.test(u.hostname)&&!/videoplayback/i.test(u.pathname))return false;
    // Chấp nhận response thật từ debugger/passive ngay cả khi YouTube không để itag trong URL mới.
    // Loại manifest/text và các response quá nhỏ không phải media.
    if(item.kind!=='video')return false;
    const mime=String(item.mime||'');
    if(/text\/|json|xml/i.test(mime))return false;
    const total=Number(item.totalBytes||item.sizeBytes||u.searchParams.get('clen')||0);
    return total===0 || total>256*1024;
  }

  function isUsableYouTubeAudioItem(item){
    if(!item||item.kind!=='audio')return false;
    const itag=Number(item.itag||0);
    const known=[139,140,141,249,250,251].includes(itag);
    // YouTube không cung cấp MP3 gốc. Các mục MP3 vài KB thường là âm thanh UI/quảng cáo bị bắt nhầm.
    if(String(item.ext||'').toLowerCase()==='mp3')return false;
    if(known)return true;
    if(item.verifiedDirect||item.pageExtracted){
      const mime=String(item.mime||'').toLowerCase();
      return /audio\/(mp4|webm)/.test(mime) && Number(item.totalBytes||item.sizeBytes||0)>64*1024;
    }
    return false;
  }

  function renderItems(items,subtitles){
    const audios=items.filter(x=>x.kind==='audio').filter(x=>currentPlatform!=='YouTube'||isUsableYouTubeAudioItem(x));const videos=items.filter(x=>x.kind==='video');
    const validVideos=videos.filter(x=>{
      if(currentPlatform!=='YouTube')return true;
      if(x.verifiedDirect||x.pageExtracted)return Boolean(x.itag||x.height||x.quality);
      // Network-only responses are often one byte-range segment. Only trust them as a full candidate
      // when YouTube exposes a known itag AND the total object length is known.
      return Boolean(x.itag&&Number(x.totalBytes||0)>256*1024);
    });
    const complete=dedupe(validVideos.filter(x=>x.hasAudio===true),x=>`${x.height}|${x.itag}|${x.ext}|muxed`).sort((a,b)=>(b.height||0)-(a.height||0));
    const separate=dedupe(validVideos.filter(x=>x.hasAudio===false),x=>`${x.height}|${x.itag}|${x.ext}`).sort((a,b)=>(b.height||0)-(a.height||0));
    const audio=dedupe(audios,x=>`${x.itag}|${x.bitrate||0}|${x.ext}|${x.quality}`).sort((a,b)=>Number(b.bitrate||0)-Number(a.bitrate||0));
    const mergeAudio=pickMergeAudio(audio);
    info.classList.remove('hidden');videoList.innerHTML='';audioList.innerHTML='';if(subtitleList)subtitleList.innerHTML='';
    const rows=[...complete,...separate];videoSection.classList.toggle('hidden',!rows.length);audioSection.classList.toggle('hidden',!audio.length);subtitleSection?.classList.toggle('hidden',!subtitles.length);
    rows.forEach((item,idx)=>videoList.appendChild(buildRow(item,{recommended:idx===0&&item.hasAudio!==false,mergeAudio})));audio.forEach(item=>audioList.appendChild(buildRow(item,{})));subtitles.forEach(s=>subtitleList?.appendChild(buildSubtitleRow(s)));
    countEl.textContent=`${rows.length+audio.length+subtitles.length} lựa chọn`;
    const mergeable=separate.filter(v=>canMergeMp4(v,mergeAudio)).length;
    if(rows.length||audio.length)setStatus(`Đã tìm thấy ${rows.length} video${mergeable?` • ${mergeable} mức có thể ghép hình + tiếng`:''}${audio.length?` • ${audio.length} audio`:''}${subtitles.length?` • ${subtitles.length} phụ đề`:''}.`,'ok');
    else if(subtitles.length)setStatus(`Đã thấy ${subtitles.length} phụ đề nhưng chưa có luồng video/audio có thể dùng. BaByLon đã tự kích lại Network; nếu YouTube vẫn không phát URL trực tiếp, thử QUÉT SÂU YT.`,'warn');
    else setStatus('Chưa bắt được luồng. Hãy để video phát vài giây rồi quét lại.','warn');
  }

  function pickMergeAudio(audio){return audio.filter(a=>a.ext==='m4a'||/audio\/mp4/i.test(a.mime||'')).sort((a,b)=>Number(b.bitrate||0)-Number(a.bitrate||0))[0]||null;}
  function canMergeMp4(video,audio){return Boolean(video&&audio&&video.ext==='mp4'&&(audio.ext==='m4a'||audio.ext==='mp4'));}

  function buildRow(item,{recommended=false,mergeAudio=null}={}){
    const row=document.createElement('div');row.className=`download-candidate${recommended?' recommended':''}`;
    const main=document.createElement('div');main.className='download-candidate-main';const heading=document.createElement('div');heading.className='download-candidate-title';
    const q=document.createElement('span');q.textContent=prettyQuality(item);const ext=document.createElement('span');ext.className='download-ext';ext.textContent=`.${item.ext||'mp4'}`;heading.append(q,ext);
    const sourceBadge=document.createElement('span');sourceBadge.className='download-source-badge';sourceBadge.textContent=String(item.source||'').startsWith('yt-')?'DIRECT':item.source==='passive'?'LIVE':item.source==='page'?'PLAYER':item.source==='network'?'NETWORK':String(item.source||'MEDIA').toUpperCase();heading.appendChild(sourceBadge);
    const kind=document.createElement('span');kind.className='download-kind';
    if(item.kind==='audio')kind.textContent=item.ext==='mp3'?'MP3 gốc':'audio gốc';else if(item.hasAudio===false&&canMergeMp4(item,mergeAudio))kind.textContent='ghép hình + tiếng';else if(item.hasAudio===false)kind.textContent='video không tiếng';else kind.textContent='hình + tiếng';heading.appendChild(kind);
    const meta=document.createElement('div');meta.className='download-candidate-meta';meta.textContent=[item.fps?`${item.fps}fps`:'',item.codec?shortCodec(item.codec):'',item.sizeText||'',item.itag?`itag ${item.itag}`:''].filter(Boolean).join(' • ');
    const prog=document.createElement('div');prog.className='candidate-progress';prog.innerHTML='<i></i>';prog.hidden=true;main.append(heading,meta,prog);
    const btn=document.createElement('button');btn.className='download-one-btn';
    if(item.kind==='audio'){btn.classList.add('audio');btn.textContent=`TẢI ${String(item.ext||'AUDIO').toUpperCase()}`;btn.onclick=()=>downloadSingle(item,btn,prog);}
    else if(item.hasAudio===false&&canMergeMp4(item,mergeAudio)){btn.classList.add('merge');btn.textContent='GHÉP & TẢI';btn.onclick=()=>downloadMergedMp4(item,mergeAudio,btn,prog);}
    else {btn.textContent='TẢI';btn.onclick=()=>downloadSingle(item,btn,prog);}
    row.append(main,btn);return row;
  }

  function buildSubtitleRow(sub){const row=document.createElement('div');row.className='download-candidate';const main=document.createElement('div');main.className='download-candidate-main';const h=document.createElement('div');h.className='download-candidate-title';const q=document.createElement('span');q.textContent=sub.name||sub.languageCode||'Phụ đề';const ext=document.createElement('span');ext.className='download-ext';ext.textContent='.srt';h.append(q,ext);const m=document.createElement('div');m.className='download-candidate-meta';m.textContent=[sub.languageCode,sub.kind==='asr'?'Tự động':''].filter(Boolean).join(' • ');main.append(h,m);const btn=document.createElement('button');btn.className='download-one-btn subtitle';btn.textContent='TẢI SRT';btn.onclick=()=>downloadSubtitle(sub,btn);row.append(main,btn);return row;}

  async function downloadSingle(item,button,progress){
    const base=getRequestedName(),ext=item.ext||(item.kind==='audio'?'m4a':'mp4');
    button.disabled=true;const old=button.textContent;button.textContent='ĐANG TẢI';setProgress(progress,0,true);
    try{
      if(currentPlatform==='YouTube'){
        if(item.kind!=='audio' && !(item.hasAudio===true&&item.hasVideo!==false)){
          throw new Error('Đây là luồng video không tiếng. Hãy dùng “GHÉP & TẢI” nếu có audio tương thích.');
        }
        if(item.kind==='audio' && String(ext).toLowerCase()==='mp3'){
          throw new Error('YouTube không có MP3 gốc; mục này là tài nguyên bị nhận nhầm.');
        }

        // Lấy lại URL mới nhất theo itag trước khi tải để tránh link googlevideo đã hết hạn.
        const fresh=await refreshYouTubeDownloadItem(item).catch(()=>item);
        setStatus(`Đang tải ${item.kind==='audio'?'audio':prettyQuality(item)} trực tiếp trong BaByLon...`,'ok');
        const bytes=await fetchMediaBytes(fresh,p=>setProgress(progress,p,true));
        validateMediaBytes(bytes,ext,fresh.mime);
        triggerBlobDownload(new Blob([bytes],{type:mimeForExt(ext)}),`${base}.${ext}`);
        setStatus(`Đã tải xong ${base}.${ext}.`,'ok');
      } else {
        const response=await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_DOWNLOAD',item:{...item,url:fullResourceUrl(item)},filename:`${base}.${ext}`});
        if(!response?.ok)throw new Error(response?.error||'Chrome từ chối tải.');
        setStatus(`Đã bắt đầu tải ${base}.${ext}.`,'ok');
      }
    }catch(e){setStatus(`Tải thất bại: ${e?.message||e}`,'error');}
    finally{button.disabled=false;button.textContent=old;setProgress(progress,100,false);}
  }

  async function refreshYouTubeDownloadItem(item){
    const itag=Number(item?.itag||0);
    if(!itag||!activeTabId)return item;
    try{
      const tab=await chrome.tabs.get(activeTabId);
      if(!tab?.url||detectPlatform(tab.url)!=='YouTube'||youtubeVideoId(tab.url)!==youtubeVideoId(input.value))return item;
      const fresh=await extractYouTubeClientFormats(activeTabId,input.value);
      const match=(fresh?.items||[]).find(x=>Number(x.itag||0)===itag&&x.kind===item.kind&&x.url);
      return match?{...item,...match,sourceTabId:activeTabId}:item;
    }catch{return item;}
  }

  function validateMediaBytes(bytes,ext,mime=''){
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||0);
    if(b.byteLength<1024)throw new Error('Máy chủ không trả về file media hoàn chỉnh.');
    const e=String(ext||'').toLowerCase();
    const ascii=(a,z)=>String.fromCharCode(...b.slice(a,z));
    if(e==='mp4'||e==='m4a'){
      const probe=ascii(0,Math.min(64,b.length));
      if(!probe.includes('ftyp')&&!probe.includes('moov')&&!probe.includes('moof'))throw new Error('YouTube trả về dữ liệu không phải MP4/M4A (có thể link đã hết hạn).');
    }else if(e==='webm'){
      if(!(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3))throw new Error('Dữ liệu tải về không phải WebM hợp lệ.');
    }else if(e==='mp3'){
      const id3=ascii(0,3)==='ID3'; const frame=b[0]===0xff&&(b[1]&0xe0)===0xe0;
      if(!id3&&!frame)throw new Error('Dữ liệu tải về không phải MP3 hợp lệ.');
    }
    const head=ascii(0,Math.min(160,b.length)).toLowerCase();
    if(/<!doctype|<html|access denied|forbidden|not found/.test(head))throw new Error('Máy chủ trả trang lỗi thay vì file media.');
    return true;
  }

  async function downloadMergedMp4(video,audio,button,progress){const base=getRequestedName();button.disabled=true;const old=button.textContent;button.textContent='ĐANG GHÉP';setProgress(progress,0,true);try{
      setStatus(`Đang tải ${prettyQuality(video)} phần hình...`,'ok');const videoBytes=await fetchMediaBytes(video,p=>setProgress(progress,p*.46,true));
      setStatus('Đang tải phần âm thanh...','ok');const audioBytes=await fetchMediaBytes(audio,p=>setProgress(progress,46+p*.44,true));
      setStatus('Đang ghép MP4 trong BaByLon...','ok');const merged=muxFragmentedMp4(videoBytes,audioBytes,p=>setProgress(progress,90+p*.1,true));
      triggerBlobDownload(new Blob([merged],{type:'video/mp4'}),`${base}.mp4`);setStatus(`Đã ghép và tải ${prettyQuality(video)} có tiếng: ${base}.mp4`,'ok');
    }catch(e){setStatus(`Ghép/tải thất bại: ${e?.message||e}`,'error');}finally{button.disabled=false;button.textContent=old;setProgress(progress,100,false);}}

  async function downloadSubtitle(sub,button){const old=button.textContent;button.disabled=true;button.textContent='ĐANG TẢI';try{const u=new URL(sub.url);u.searchParams.set('fmt','json3');const r=await fetch(u.toString(),{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const json=await r.json();const srt=json3ToSrt(json);triggerBlobDownload(new Blob([srt],{type:'text/plain;charset=utf-8'}),`${getRequestedName()} - ${sanitizeFilename(sub.name||sub.languageCode||'subtitle')}.srt`);setStatus('Đã tải phụ đề SRT.','ok');}catch(e){setStatus(`Không tải được phụ đề: ${e?.message||e}`,'error');}finally{button.disabled=false;button.textContent=old;}}

  function json3ToSrt(json){let idx=1,out=[];for(const ev of json?.events||[]){if(!ev?.segs?.length)continue;const text=ev.segs.map(s=>s.utf8||'').join('').replace(/\n+/g,' ').trim();if(!text)continue;const start=Number(ev.tStartMs||0),end=start+Number(ev.dDurationMs||2000);out.push(String(idx++),`${srtTime(start)} --> ${srtTime(end)}`,text,'');}return out.join('\n');}
  function srtTime(ms){const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000),x=Math.floor(ms%1000);return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`;}

  async function fetchMediaBytes(item,onProgress){
    const total=Number(item.totalBytes||safeParam(item.url,'clen')||0);if(total>650*1024*1024)throw new Error('File quá lớn để ghép trực tiếp trong bộ nhớ (>650 MB).');
    if(/googlevideo\.com/i.test(item.url)&&total>0){const chunkSize=8*1024*1024,chunks=[];let loaded=0;for(let start=0;start<total;start+=chunkSize){const end=Math.min(total-1,start+chunkSize-1);const url=googleVideoRangeUrl(item.url,start,end);const r=await fetch(url,{cache:'no-store',credentials:'omit',referrer:'https://www.youtube.com/'});if(!r.ok)throw new Error(`Media HTTP ${r.status} tại ${Math.floor(start/1024/1024)}MB`);const b=new Uint8Array(await r.arrayBuffer());chunks.push(b);loaded+=b.byteLength;onProgress?.(Math.min(100,loaded/total*100));if(!b.byteLength)break;}return concatBytes(chunks,loaded);}
    const r=await fetch(fullResourceUrl(item),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`Media HTTP ${r.status}`);const len=Number(r.headers.get('content-length')||total||0);if(!r.body)return new Uint8Array(await r.arrayBuffer());const reader=r.body.getReader(),chunks=[];let loaded=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;if(len)onProgress?.(Math.min(100,loaded/len*100));}return concatBytes(chunks,loaded);}
  function googleVideoRangeUrl(url,start,end){const u=new URL(url);for(const k of ['rn','rbuf','sq','ump','alr','srfvp'])u.searchParams.delete(k);u.searchParams.set('range',`${start}-${end}`);return u.toString();}
  function fullResourceUrl(item){try{const u=new URL(item.url);if(/googlevideo\.com/i.test(u.hostname)){for(const k of ['rn','rbuf','sq','ump','alr','srfvp'])u.searchParams.delete(k);if(item?.verifiedDirect||item?.pageExtracted){u.searchParams.delete('range');}else{const total=Number(item.totalBytes||u.searchParams.get('clen')||0);if(total>0)u.searchParams.set('range',`0-${total-1}`);else u.searchParams.delete('range');}}return u.toString();}catch{return item.url;}}
  function safeParam(url,key){try{return new URL(url).searchParams.get(key)||'';}catch{return ''}}
  function concatBytes(chunks,total){const out=new Uint8Array(total||chunks.reduce((n,c)=>n+c.byteLength,0));let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength;}return out;}
  function triggerBlobDownload(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=sanitizeFilename(filename);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function mimeForExt(ext){return ext==='m4a'?'audio/mp4':ext==='webm'?'video/webm':ext==='mp3'?'audio/mpeg':'video/mp4';}
  function setProgress(el,p,show){if(!el)return;el.hidden=!show;const bar=el.querySelector('i');if(bar)bar.style.width=`${Math.max(0,Math.min(100,p||0))}%`;}

  /* Minimal fragmented-MP4 muxer: combines a YouTube MP4 video track + M4A audio track without re-encoding. */
  function muxFragmentedMp4(videoBytes,audioBytes,onProgress){
    const v=asU8(videoBytes),a=asU8(audioBytes);const vb=topBoxes(v),ab=topBoxes(a);const vMoov=findBox(vb,'moov'),aMoov=findBox(ab,'moov'),ftyp=findBox(vb,'ftyp')||findBox(ab,'ftyp');if(!vMoov||!aMoov||!ftyp)throw new Error('Nguồn MP4 không có cấu trúc ftyp/moov cần thiết.');
    const vTracks=childBoxes(v,vMoov).filter(b=>b.type==='trak'),aTracks=childBoxes(a,aMoov).filter(b=>b.type==='trak');if(!vTracks.length||!aTracks.length)throw new Error('Không tìm thấy track video/audio.');
    const videoTrack=vTracks[0],audioTrack=aTracks[0];const videoId=readTrackId(v,videoTrack)||1;let audioId=readTrackId(a,audioTrack)||1;if(audioId===videoId)audioId=videoId+1;
    const vScale=readTrackTimescale(v,videoTrack)||90000,aScale=readTrackTimescale(a,audioTrack)||48000;
    const audioTrak=copyBox(a,audioTrack);patchTrackIdInTrak(audioTrak,audioId);
    const newMoov=buildCombinedMoov(v,vMoov,a,aMoov,audioTrak,audioId);
    onProgress?.(20);
    const fragments=[];collectFragments(v,vb,videoId,videoId,vScale,'video',fragments);collectFragments(a,ab,readTrackId(a,audioTrack)||1,audioId,aScale,'audio',fragments);
    if(!fragments.length)throw new Error('Không tìm thấy các fragment MP4 để ghép.');
    fragments.sort((x,y)=>x.time-y.time||(x.kind==='video'?-1:1));let seq=1;for(const f of fragments){patchMfhdSequence(f.moof,seq++);}
    onProgress?.(60);
    const parts=[copyBox(v,ftyp),newMoov];for(const f of fragments){parts.push(f.moof,f.mdat);}const total=parts.reduce((n,p)=>n+p.byteLength,0);const out=new Uint8Array(total);let off=0;for(let i=0;i<parts.length;i++){out.set(parts[i],off);off+=parts[i].byteLength;if(i%20===0)onProgress?.(60+35*i/parts.length);}onProgress?.(100);return out;
  }
  function asU8(x){return x instanceof Uint8Array?x:new Uint8Array(x);}function u32(b,o){return((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}function w32(b,o,n){b[o]=(n>>>24)&255;b[o+1]=(n>>>16)&255;b[o+2]=(n>>>8)&255;b[o+3]=n&255;}function u64(b,o){return Number((BigInt(u32(b,o))<<32n)|BigInt(u32(b,o+4)));}
  function typeAt(b,o){return String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]);}
  function topBoxes(b,start=0,end=b.byteLength){const out=[];let p=start;while(p+8<=end){let size=u32(b,p),header=8;const type=typeAt(b,p+4);if(size===1&&p+16<=end){size=u64(b,p+8);header=16;}else if(size===0)size=end-p;if(!size||size<8||p+size>end)break;out.push({type,start:p,end:p+size,size,header,dataStart:p+header});p+=size;}return out;}
  function childBoxes(buf,box){return topBoxes(buf,box.dataStart,box.end);}function findBox(list,type){return list.find(b=>b.type===type)||null;}function copyBox(buf,box){return buf.slice(box.start,box.end);}function makeBox(type,payloads){const total=8+payloads.reduce((n,p)=>n+p.byteLength,0);const out=new Uint8Array(total);w32(out,0,total);out.set([...type].map(c=>c.charCodeAt(0)),4);let off=8;for(const p of payloads){out.set(p,off);off+=p.byteLength;}return out;}
  function findDesc(buf,box,path){let cur=box;for(const t of path){const c=childBoxes(buf,cur).find(x=>x.type===t);if(!c)return null;cur=c;}return cur;}
  function readTrackId(buf,trak){const tkhd=findDesc(buf,trak,['tkhd']);if(!tkhd)return 0;const v=buf[tkhd.dataStart];const off=tkhd.dataStart+(v===1?20:12);return u32(buf,off);}
  function readTrackTimescale(buf,trak){const mdhd=findDesc(buf,trak,['mdia','mdhd']);if(!mdhd)return 0;const v=buf[mdhd.dataStart];const off=mdhd.dataStart+(v===1?20:12);return u32(buf,off);}
  function patchTrackIdInTrak(trakBytes,newId){const boxes=topBoxes(trakBytes);const trak=boxes[0];if(!trak)return;const tkhd=findDesc(trakBytes,trak,['tkhd']);if(!tkhd)return;const v=trakBytes[tkhd.dataStart];w32(trakBytes,tkhd.dataStart+(v===1?20:12),newId);}
  function buildCombinedMoov(v,vMoov,a,aMoov,audioTrak,audioId){const vc=childBoxes(v,vMoov),ac=childBoxes(a,aMoov);const vMvex=vc.find(x=>x.type==='mvex'),aMvex=ac.find(x=>x.type==='mvex');let combinedMvex=null;if(vMvex){const parts=childBoxes(v,vMvex).map(x=>copyBox(v,x));if(aMvex){const trex=childBoxes(a,aMvex).find(x=>x.type==='trex');if(trex){const t=copyBox(a,trex);w32(t,12,audioId);parts.push(t);}}combinedMvex=makeBox('mvex',parts);}const payload=[];let insertedAudio=false;for(const c of vc){if(c.type==='trak'){payload.push(copyBox(v,c));if(!insertedAudio){payload.push(audioTrak);insertedAudio=true;}}else if(c.type==='mvex'){if(combinedMvex)payload.push(combinedMvex);}else payload.push(copyBox(v,c));}if(!insertedAudio)payload.push(audioTrak);if(!vMvex&&aMvex){const parts=[];for(const x of childBoxes(a,aMvex)){if(x.type==='trex'){const t=copyBox(a,x);w32(t,12,audioId);parts.push(t);}}if(parts.length)payload.push(makeBox('mvex',parts));}return makeBox('moov',payload);}
  function collectFragments(buf,boxes,oldId,newId,scale,kind,out){for(let i=0;i<boxes.length;i++){const b=boxes[i];if(b.type!=='moof')continue;let mdat=null;for(let j=i+1;j<Math.min(boxes.length,i+4);j++){if(boxes[j].type==='mdat'){mdat=boxes[j];break;}if(boxes[j].type==='moof')break;}if(!mdat)continue;const moof=copyBox(buf,b);patchTfhdTrackId(moof,oldId,newId);const time=readTfdtTime(moof)/(scale||1);out.push({kind,time,moof,mdat:copyBox(buf,mdat)});}}
  function patchTfhdTrackId(moof,oldId,newId){const root=topBoxes(moof)[0];if(!root)return;for(const traf of childBoxes(moof,root).filter(x=>x.type==='traf')){const tfhd=childBoxes(moof,traf).find(x=>x.type==='tfhd');if(tfhd&&u32(moof,tfhd.dataStart+4)===oldId)w32(moof,tfhd.dataStart+4,newId);}}
  function readTfdtTime(moof){const root=topBoxes(moof)[0];if(!root)return 0;for(const traf of childBoxes(moof,root).filter(x=>x.type==='traf')){const tfdt=childBoxes(moof,traf).find(x=>x.type==='tfdt');if(tfdt){const v=moof[tfdt.dataStart];return v===1?u64(moof,tfdt.dataStart+4):u32(moof,tfdt.dataStart+4);}}return 0;}
  function patchMfhdSequence(moof,seq){const root=topBoxes(moof)[0];if(!root)return;const mfhd=childBoxes(moof,root).find(x=>x.type==='mfhd');if(mfhd)w32(moof,mfhd.dataStart+4,seq);}

  function dedupeSubtitles(list){const m=new Map();for(const s of list||[]){const k=`${s.languageCode}|${s.name}`;if(!m.has(k))m.set(k,s);}return[...m.values()];}
  function itemScore(item){let score=0;if(item.source==='page')score+=30;if(item.itag)score+=20;if(item.hasAudio===true&&item.hasVideo!==false)score+=40;if(item.totalBytes)score+=5;return score;}
  function sameVideoPage(a,b){if(detectPlatform(a)==='YouTube'&&detectPlatform(b)==='YouTube')return youtubeVideoId(a)&&youtubeVideoId(a)===youtubeVideoId(b);try{return canonicalPageUrl(a)===canonicalPageUrl(b);}catch{return a===b;}}
  function canonicalPageUrl(value){try{const u=new URL(value);u.hash='';if(/youtube\.com$/i.test(u.hostname.replace(/^www\./,''))){for(const key of [...u.searchParams.keys()])if(key!=='v')u.searchParams.delete(key);}return u.toString();}catch{return value;}}
  function stripVolatile(url){try{const u=new URL(url);for(const k of ['range','rn','rbuf','sq'])u.searchParams.delete(k);return`${u.hostname}${u.pathname}?itag=${u.searchParams.get('itag')||''}`;}catch{return url.slice(0,220);}}
  function autoFillName(title){if(!nameInput.value.trim()||nameInput.dataset.autoName!=='0'){nameInput.value=sanitizeFilename(title);nameInput.dataset.autoName='1';}nameInput.oninput=()=>{nameInput.dataset.autoName='0';};}
  function prettyQuality(item){if(item.kind==='audio'){const kbps=Math.round(Number(item.bitrate||0)/1000);return kbps?`${kbps} kbps`:item.quality||'Audio';}const q=String(item.quality||'Video');const n=Number(q.match(/(\d{3,4})p/i)?.[1]||item.height||0);if(n>=2160)return`4K ${n}p`;if(n>=1440)return`2K ${n}p`;if(n>=1080)return`Full HD ${n}p`;if(n>=720)return`HD ${n}p`;if(n===480)return'Tiêu chuẩn 480p';if(n===360)return'Trung bình 360p';if(n===240)return'Thấp 240p';if(n===144)return'Di động 144p';return q;}
  function shortCodec(codec){return String(codec||'').split(',')[0].split('.')[0].replace('avc1','H.264').replace('vp09','VP9').replace('av01','AV1').replace('mp4a','AAC').replace('opus','Opus');}
  function resolutionNum(text){const m=String(text||'').match(/(\d{3,4})p/i);return m?Number(m[1]):0;}
  function humanSize(bytes){const n=Number(bytes||0);if(!n)return'';if(n>=1024**3)return`${(n/1024**3).toFixed(1)} GB`;if(n>=1024**2)return`${(n/1024**2).toFixed(1)} MB`;if(n>=1024)return`${(n/1024).toFixed(0)} KB`;return`${n} B`;}
  function clearLists(){info.classList.add('hidden');videoList.innerHTML='';audioList.innerHTML='';if(subtitleList)subtitleList.innerHTML='';videoSection.classList.add('hidden');audioSection.classList.add('hidden');subtitleSection?.classList.add('hidden');}
  function dedupe(list,keyFn){const m=new Map();for(const x of list){const k=keyFn(x),old=m.get(k);if(!old||itemScore(x)>itemScore(old))m.set(k,x);}return[...m.values()];}
  function getRequestedName(){const name=sanitizeFilename(nameInput.value||currentTitle||'video');nameInput.value=name;saveName();return name;}
  async function saveName(){nameInput.value=sanitizeFilename(nameInput.value);await chrome.storage.local.set({babylonDownloadLastName:nameInput.value});}
  function cleanTitle(value){return String(value||'').replace(/\s*-\s*YouTube\s*$/i,'').replace(/\s*\|\s*Facebook\s*$/i,'').trim();}
  function sanitizeFilename(value){return String(value||'video').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().replace(/\.+$/g,'').slice(0,140)||'video';}
  function setStatus(message,type=''){status.textContent=message;status.className=`download-status ${type}`.trim();}
  function setLoading(running){findBtn.disabled=running;currentBtn.disabled=running;findBtn.textContent=running?'ĐANG QUÉT...':'QUÉT / LÀM MỚI';}
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  window.BaByLonVideoDownloader={onOpen};
  init();
})();
