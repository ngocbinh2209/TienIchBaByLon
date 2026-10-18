(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const startInput = $('seriesStartEpisode');
  const endInput = $('seriesEndEpisode');
  const waitInput = $('seriesWaitSeconds');
  const modeSelect = $('seriesDownloadMode');
  const scanBtn = $('seriesScanBtn');
  const startBtn = $('seriesStartBtn');
  const pauseBtn = $('seriesPauseBtn');
  const stopBtn = $('seriesStopBtn');
  const statusEl = $('seriesStatus');
  const titleEl = $('seriesDetectedTitle');
  const foundEl = $('seriesDetectedEpisodes');
  const currentEl = $('seriesCurrentEpisode');
  const okEl = $('seriesDoneCount');
  const errorEl = $('seriesErrorCount');
  const totalEl = $('seriesTotalCount');
  const progressFill = $('seriesProgressFill');
  const progressText = $('seriesProgressText');
  const logEl = $('seriesLog');
  const queueEl = $('seriesQueue');
  const retrySelect = $('seriesRetryCount');

  let initialized = false;
  let running = false;
  let paused = false;
  let stopRequested = false;
  let activeTabId = 0;
  let seriesTitle = '';
  let queue = [];
  let doneCount = 0;
  let errorCount = 0;
  let currentEpisode = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function init() {
    if (initialized || !startInput) return;
    initialized = true;
    const saved = await chrome.storage.local.get([
      'babylonSeriesStart','babylonSeriesEnd','babylonSeriesWait','babylonSeriesMode','babylonSeriesRetry'
    ]);
    startInput.value = Number(saved.babylonSeriesStart || 1);
    endInput.value = Number(saved.babylonSeriesEnd || 0);
    waitInput.value = String(saved.babylonSeriesWait || '4');
    modeSelect.value = saved.babylonSeriesMode || 'auto-hq-hybrid';
    retrySelect.value = String(saved.babylonSeriesRetry ?? '1');

    scanBtn?.addEventListener('click', scanSeries);
    startBtn?.addEventListener('click', startSeries);
    pauseBtn?.addEventListener('click', togglePause);
    stopBtn?.addEventListener('click', requestStop);
    [startInput,endInput,waitInput,modeSelect,retrySelect].forEach((el) => el?.addEventListener('change', saveSettings));
  }

  async function onOpen() {
    await init();
    await scanSeries(false);
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      babylonSeriesStart: clampInt(startInput.value,1,9999,1),
      babylonSeriesEnd: clampInt(endInput.value,0,9999,0),
      babylonSeriesWait: String(waitInput.value || '4'),
      babylonSeriesMode: modeSelect.value || 'cococ-first',
      babylonSeriesRetry: String(retrySelect.value || '1')
    });
  }

  async function getActiveTikTokTab() {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id) throw new Error('Không tìm thấy tab hiện tại.');
    const url = String(tab.url || '');
    if (!/^https?:\/\/(?:www\.|m\.)?tiktok\.com\//i.test(url)) {
      throw new Error('Hãy mở trang phim/tập trên TikTok trước.');
    }
    activeTabId = tab.id;
    return tab;
  }

  async function scanSeries(showStatus = true) {
    try {
      const tab = await getActiveTikTokTab();
      if (showStatus) setStatus('Đang đọc danh sách tập trên TikTok...');
      const info = await runPageAction(tab.id,'scan',0);
      if (!info?.ok) throw new Error(info?.error || 'Không tìm thấy danh sách tập.');
      seriesTitle = sanitizeFilename(info.title || tab.title || 'TikTok Series');
      titleEl.textContent = seriesTitle || 'TikTok Series';
      const max = Number(info.maxEpisode || 0);
      const visible = Array.isArray(info.episodes) ? info.episodes : [];
      const ranges = Array.isArray(info.ranges) ? info.ranges : [];
      foundEl.textContent = max
        ? `Phát hiện đến tập ${max}${ranges.length ? ` • ${ranges.join(' · ')}` : ''}`
        : `Đang thấy ${visible.length} tập trên màn hình`;
      if (!Number(endInput.value) && max) endInput.value = max;
      if (showStatus) setStatus(`Đã nhận diện series • ${max || visible.length} tập.`, 'ok');
      return {tab,info};
    } catch (e) {
      if (showStatus) setStatus(e?.message || String(e),'error');
      return null;
    }
  }

  async function startSeries() {
    if (running) return;
    const scanned = await scanSeries(false);
    if (!scanned) {
      setStatus('Không thể bắt đầu vì chưa nhận diện được danh sách tập.','error');
      return;
    }
    const detectedMax = Number(scanned.info.maxEpisode || 0);
    const start = clampInt(startInput.value,1,9999,1);
    const endRaw = clampInt(endInput.value,0,9999,0);
    const end = endRaw || detectedMax;
    if (!end || end < start) {
      setStatus('Khoảng tập không hợp lệ. Hãy nhập Từ tập / Đến tập.','error');
      return;
    }
    await saveSettings();
    queue = [];
    for (let ep = start; ep <= end; ep++) queue.push({episode:ep,state:'wait',message:''});
    doneCount = 0;
    errorCount = 0;
    currentEpisode = 0;
    running = true;
    paused = false;
    stopRequested = false;
    renderQueue();
    updateStats();
    updateButtons();
    logEl.innerHTML = '';
    log(`Bắt đầu tải series từ tập ${start} đến ${end}.`);
    setStatus('Đang chạy tự động. Giữ tab TikTok và BaByLon Side Panel mở.','ok');

    try {
      for (const job of queue) {
        if (stopRequested) break;
        await waitWhilePaused();
        if (stopRequested) break;
        currentEpisode = job.episode;
        job.state = 'running';
        job.message = 'Đang chuyển tập';
        renderQueue(); updateStats();

        const retries = clampInt(retrySelect.value,0,3,1);
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await processEpisode(job.episode, scanned.tab.id);
            lastError = null;
            break;
          } catch (e) {
            lastError = e;
            if (attempt < retries) {
              log(`Tập ${job.episode}: lỗi ${e?.message || e} • thử lại ${attempt + 1}/${retries}.`,'warn');
              await sleep(1500);
            }
          }
        }

        if (lastError) {
          job.state = 'error';
          job.message = lastError?.message || String(lastError);
          errorCount++;
          log(`Tập ${job.episode}: ${job.message}`,'error');
        } else {
          job.state = 'done';
          job.message = 'Đã bắt đầu tải';
          doneCount++;
          log(`Tập ${job.episode}: đã bắt đầu tải.`,'ok');
        }
        renderQueue(); updateStats();
        if (!stopRequested) await sleep(700);
      }
    } finally {
      running = false;
      paused = false;
      try { if (activeTabId) await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_STOP',tabId:activeTabId}); } catch {}
      updateButtons();
      if (stopRequested) setStatus(`Đã dừng • tải ${doneCount}/${queue.length} tập, lỗi ${errorCount}.`,'warn');
      else setStatus(`Hoàn tất • tải ${doneCount}/${queue.length} tập, lỗi ${errorCount}.`, errorCount ? 'warn' : 'ok');
    }
  }

  async function processEpisode(episode, tabId) {
    const mode = modeSelect.value || 'cococ-first';
    const waitSeconds = Math.max(2, Math.min(15, Number(waitInput.value || 4)));

    // Bật Network trước khi đổi tập để không bỏ lỡ request video mới.
    try { await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_STOP',tabId}); } catch {}
    try { await chrome.runtime.sendMessage({type:'BABYLON_PASSIVE_MEDIA_CLEAR',tabId}); } catch {}
    try { await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_START',tabId}); } catch {}

    const before = await runPageAction(tabId,'media-state',0).catch(()=>null);
    const selection = await ensureEpisodeSelected(tabId, episode);
    if (!selection?.ok) throw new Error(selection?.error || `Không chuyển được sang tập ${episode}.`);
    if (selection.alreadyCurrent) log(`Tập ${episode}: đang là tập hiện tại • giữ nguyên để tải.`,'ok');
    else log(`Tập ${episode}: đã mở${selection.range ? ` nhóm ${selection.range}` : ''} và chọn đúng tập.`,'ok');

    await waitForEpisodeMedia(tabId,before,waitSeconds);
    if (stopRequested) throw new Error('Đã dừng.');

    // AUTO HQ HYBRID: Desktop Controller thực hiện click thật trên UI Cốc Cốc.
    // Nếu menu có 720p/1080p+ -> controller chọn dòng VIDEO cao nhất.
    // Nếu chỉ có Tiêu chuẩn -> giữ nguyên Browser fallback cũ (legacy 1.43.03).
    if (mode === 'auto-hq-hybrid') {
      const bridge = await requestDesktopHq(episode).catch(e=>({ok:false,error:e?.message||String(e)}));
      if (bridge?.mode === 'hq') {
        const dl = await waitForNewVideoDownload(bridge.startedAt || Date.now()-1500, 12);
        if (dl?.ok) {
          log(`Tập ${episode}: Cốc Cốc HQ đã bắt đầu tải • ${bridge.choice || 'chất lượng cao nhất'}.`,'ok');
          return;
        }
        log(`Tập ${episode}: đã chọn HQ nhưng chưa thấy download thật • dùng fallback cũ.`, 'warn');
      } else if (bridge?.mode === 'standard') {
        log(`Tập ${episode}: chỉ có Tiêu chuẩn • dùng downloader cũ 1.43.03.`, 'ok');
      } else {
        log(`Tập ${episode}: Desktop Controller chưa sẵn sàng (${bridge?.error || 'không phản hồi'}) • dùng fallback cũ.`, 'warn');
      }
      const legacy = await browserFallbackDownload(tabId, episode);
      if (!legacy?.ok) throw new Error(legacy?.error || 'Downloader cũ không tải được video.');
      log(`Tập ${episode}: fallback cũ đã tạo lượt tải • ${legacy.label || 'video'}.`,'ok');
      return;
    }

    // Chế độ HQ thủ công: BaByLon chỉ chọn đúng tập và CHỜ người dùng thao tác
    // trên giao diện riêng của Cốc Cốc: nút xanh ↓ -> chọn VIDEO chất lượng cao nhất.
    // Extension không cố click browser UI để tránh SERVER_FORBIDDEN / tải nhầm URL.
    if (mode === 'manual-hq-hybrid') {
      const manual = await waitForManualCocCocDownload(tabId, episode, 30);
      if (manual?.ok) {
        log(`Tập ${episode}: Cốc Cốc đã bắt đầu tải video thủ công${manual.filename ? ` • ${manual.filename}` : ''}.`,'ok');
        setStatus(`Tập ${episode}: đã nhận lượt tải Cốc Cốc • đang chuyển tập tiếp theo...`,'ok');
        return;
      }
      log(`Tập ${episode}: không nhận được lượt tải video Cốc Cốc trong 30 giây • dùng cơ chế tải cũ.`, 'warn');
      setStatus(`Tập ${episode}: không thấy lượt tải Cốc Cốc • đang dùng downloader cũ...`, 'warn');
      const oldDownload = await browserFallbackDownload(tabId, episode);
      if (!oldDownload?.ok) throw new Error(oldDownload?.error || 'Downloader cũ không tải được video.');
      log(`Tập ${episode}: downloader cũ đã tạo lượt tải • ${oldDownload.label || 'video'}.`,'ok');
      return;
    }

    if (mode !== 'browser-only') {
      const cococ = await downloadViaCocCocVerified(tabId, episode);
      if (cococ?.ok) {
        log(`Tập ${episode}: Cốc Cốc đã bắt đầu tải thật${cococ.choice ? ` • ${cococ.choice}` : ''}.`,'ok');
        return;
      }
      if (mode === 'cococ-only') {
        throw new Error(cococ?.error || 'Không xác minh được Cốc Cốc đã bắt đầu tải.');
      }
      log(`Tập ${episode}: Cốc Cốc chưa tạo lượt tải thật • chuyển Browser fallback.`,'warn');
    }

    const downloaded = await browserFallbackDownload(tabId, episode);
    if (!downloaded?.ok) throw new Error(downloaded?.error || 'Không tìm thấy luồng video để tải.');
    log(`Tập ${episode}: Browser fallback đã tạo lượt tải thật • ${downloaded.label || 'video tốt nhất'}.`,'ok');
  }

  async function ensureEpisodeSelected(tabId, episode) {
    const state = await runPageAction(tabId,'series-state',episode).catch(()=>null);
    if (Number(state?.currentEpisode || 0) === Number(episode)) {
      return {ok:true,alreadyCurrent:true,range:state?.currentRange || ''};
    }

    let locate = await runPageAction(tabId,'locate-episode',episode).catch(()=>null);
    let rangeText = '';

    // Tập chưa hiện: bắt buộc bấm tab nhóm trước, ví dụ 1-24 -> 25-45.
    if (!locate?.ok) {
      const range = await runPageAction(tabId,'locate-range',episode).catch(()=>null);
      if (!range?.ok) throw new Error(range?.error || `Không tìm thấy tab nhóm chứa tập ${episode}.`);
      rangeText = range.range || '';
      log(`Tập ${episode}: chuyển sang nhóm ${rangeText || 'chứa tập này'}...`);
      const clickedRange = await trustedClickAt(tabId, range);
      if (!clickedRange) throw new Error(`Không bấm được tab nhóm ${rangeText || ''}.`);

      locate = await waitForEpisodeVisible(tabId, episode, 6500);
      if (!locate?.ok) {
        // TikTok đôi khi cần click lại sau khi sidebar vừa re-render.
        const range2 = await runPageAction(tabId,'locate-range',episode).catch(()=>null);
        if (range2?.ok) {
          await trustedClickAt(tabId, range2);
          locate = await waitForEpisodeVisible(tabId, episode, 4500);
        }
      }
      if (!locate?.ok) throw new Error(`Đã bấm nhóm ${rangeText || ''} nhưng danh sách vẫn chưa hiện tập ${episode}.`);
    } else {
      rangeText = locate.range || '';
    }

    const clickedEpisode = await trustedClickAt(tabId, locate);
    if (!clickedEpisode) throw new Error(`Không bấm được nút tập ${episode}.`);

    const verified = await waitForCurrentEpisode(tabId, episode, 5500);
    if (!verified?.ok) {
      // Fallback DOM click một lần rồi xác minh lại.
      const dom = await runPageAction(tabId,'open-episode',episode).catch(()=>null);
      if (!dom?.ok) throw new Error(dom?.error || `TikTok chưa chuyển sang tập ${episode}.`);
      const verified2 = await waitForCurrentEpisode(tabId, episode, 3500);
      if (!verified2?.ok && verified2?.currentEpisode) {
        throw new Error(`TikTok vẫn đang ở tập ${verified2.currentEpisode}, chưa sang tập ${episode}.`);
      }
    }
    return {ok:true,alreadyCurrent:false,range:rangeText};
  }

  async function trustedClickAt(tabId, target) {
    const x = Number(target?.x), y = Number(target?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const res = await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_CLICK',tabId,x,y}).catch(()=>null);
    return Boolean(res?.ok);
  }

  async function waitForEpisodeVisible(tabId, episode, timeout=5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const loc = await runPageAction(tabId,'locate-episode',episode).catch(()=>null);
      if (loc?.ok) return loc;
      await sleep(250);
    }
    return {ok:false};
  }

  async function waitForCurrentEpisode(tabId, episode, timeout=5000) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      last = await runPageAction(tabId,'series-state',episode).catch(()=>null);
      if (Number(last?.currentEpisode || 0) === Number(episode)) return {ok:true,...last};
      // Một số bản TikTok không expose nhãn tập hiện tại; nếu nút đích đã active thì cũng coi là đúng.
      if (last?.targetActive === true) return {ok:true,...last};
      await sleep(250);
    }
    return {ok:false,currentEpisode:Number(last?.currentEpisode||0),targetActive:Boolean(last?.targetActive)};
  }

  async function requestDesktopHq(episode) {
    const startedAt = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 9000);
    try {
      const r = await fetch(`http://127.0.0.1:18766/prepare?episode=${encodeURIComponent(episode)}&t=${startedAt}`, {cache:'no-store',signal:ctrl.signal});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return {...data,startedAt};
    } finally { clearTimeout(timer); }
  }

  async function waitForNewVideoDownload(startedAt, timeoutSeconds=12) {
    const before = await chrome.downloads.search({}).catch(()=>[]);
    const beforeIds = new Set((before||[]).filter(d=>Date.parse(d.startTime||0)<startedAt-1200).map(d=>d.id));
    const deadline = Date.now()+timeoutSeconds*1000;
    while(Date.now()<deadline){
      const list=await chrome.downloads.search({}).catch(()=>[]);
      const d=(list||[]).filter(x=>{
        if(beforeIds.has(x.id))return false;
        const t=Date.parse(x.startTime||0); if(t && t<startedAt-1500)return false;
        const n=String(x.filename||'').toLowerCase(), m=String(x.mime||'').toLowerCase();
        return /\.(mp4|webm|mkv|mov|m4v)$/.test(n)||m.startsWith('video/');
      }).sort((a,b)=>Date.parse(b.startTime||0)-Date.parse(a.startTime||0))[0];
      if(d && d.state!=='interrupted')return {ok:true,downloadId:d.id,filename:d.filename||''};
      await sleep(250);
    }
    return {ok:false};
  }

  async function waitForManualCocCocDownload(tabId, episode, timeoutSeconds = 30) {
    const before = await chrome.downloads.search({}).catch(()=>[]);
    const beforeIds = new Set((before || []).map(x => x.id));
    const startedAt = Date.now();
    setStatus(`Tập ${episode} đã sẵn sàng • BẤM NÚT XANH ↓ CỐC CỐC → chọn VIDEO chất lượng CAO NHẤT. BaByLon sẽ tự sang tập tiếp theo khi download bắt đầu.`, 'warn');
    log(`Tập ${episode}: chờ thao tác thủ công • bấm ↓ Cốc Cốc → chọn VIDEO cao nhất (tối đa ${timeoutSeconds}s).`, 'warn');

    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      if (stopRequested) return {ok:false,error:'Đã dừng.'};
      await waitWhilePaused();
      const list = await chrome.downloads.search({}).catch(()=>[]);
      const fresh = (list || []).filter(d => {
        if (beforeIds.has(d.id)) return false;
        const t = Date.parse(d.startTime || 0);
        if (t && t < startedAt - 1500) return false;
        const name = String(d.filename || '').toLowerCase();
        const mime = String(d.mime || '').toLowerCase();
        // Chỉ nhận lượt tải media; tuyệt đối không coi .htm/.html là video.
        if (/\.(?:html?|txt|json)(?:$|\?)/i.test(name)) return false;
        return /\.(?:mp4|webm|mkv|mov|m4v)(?:$|\?)/i.test(name) || mime.startsWith('video/');
      });
      if (fresh.length) {
        const d = fresh.sort((a,b)=>Date.parse(b.startTime||0)-Date.parse(a.startTime||0))[0];
        if (d.state === 'interrupted') {
          log(`Tập ${episode}: lượt tải Cốc Cốc bị gián đoạn (${d.error || 'không rõ lỗi'}), tiếp tục chờ bạn chọn lại.`, 'warn');
        } else {
          return {ok:true,downloadId:d.id,filename:(d.filename||'').split(/[\\/]/).pop()};
        }
      }
      await sleep(300);
    }
    return {ok:false,error:'Hết thời gian chờ thao tác Cốc Cốc.'};
  }

  async function downloadViaCocCocVerified(tabId, episode) {
    const before = await chrome.downloads.search({}).catch(()=>[]);
    const beforeIds = new Set((before||[]).map(x=>x.id));
    const startedAt = Date.now();
    const cococ = await runPageAction(tabId,'cococ-download',episode).catch(()=>null);
    if (!cococ?.ok) return cococ || {ok:false,error:'Không điều khiển được menu tải Cốc Cốc.'};

    // Không còn tin vào "đã click". Chỉ thành công nếu browser thực sự tạo download item mới.
    const deadline = Date.now() + 2600;
    while (Date.now() < deadline) {
      const list = await chrome.downloads.search({}).catch(()=>[]);
      const fresh = (list||[]).filter(d => !beforeIds.has(d.id) && Date.parse(d.startTime || 0) >= startedAt - 1500);
      if (fresh.length) {
        const d = fresh.sort((a,b)=>Date.parse(b.startTime||0)-Date.parse(a.startTime||0))[0];
        if (d.state === 'interrupted') return {ok:false,error:d.error || 'Cốc Cốc tạo lượt tải nhưng bị gián đoạn.'};
        return {ok:true,downloadId:d.id,choice:cococ.choice||''};
      }
      await sleep(250);
    }
    return {ok:false,error:(cococ?.error || 'Cốc Cốc chưa tạo lượt tải HQ; dùng Browser fallback cũ.')};
  }

  async function waitForEpisodeMedia(tabId,before,waitSeconds) {
    const deadline = Date.now() + waitSeconds * 1000;
    let readySeen = false;
    while (Date.now() < deadline) {
      if (stopRequested) return;
      const s = await runPageAction(tabId,'media-state',0).catch(()=>null);
      if (s?.ok) {
        const changed = before && ((s.pageUrl && s.pageUrl !== before.pageUrl) || (s.src && before.src && s.src !== before.src));
        if (changed || Number(s.readyState || 0) >= 2) readySeen = true;
      }
      if (readySeen && Date.now() + 900 >= deadline) break;
      await sleep(500);
    }
    await runPageAction(tabId,'nudge-video',0).catch(()=>null);
    await sleep(900);
  }

  async function browserFallbackDownload(tabId, episode) {
    const [active, passive, page, pageCandidates] = await Promise.all([
      chrome.runtime.sendMessage({type:'BABYLON_MEDIA_GET',tabId}).catch(()=>({items:[]})),
      chrome.runtime.sendMessage({type:'BABYLON_PASSIVE_MEDIA_GET',tabId}).catch(()=>({items:[]})),
      runPageAction(tabId,'media-state',0).catch(()=>null),
      runPageAction(tabId,'media-candidates',0).catch(()=>({items:[]}))
    ]);
    let items = [...(active?.items || []), ...(passive?.items || []), ...(pageCandidates?.items || [])];
    if (page?.src && /^https?:/i.test(page.src)) {
      items.push({url:page.src,kind:'video',ext:'mp4',quality:`${page.height || 0}p`,hasAudio:true,hasVideo:true,totalBytes:0,source:'page-video'});
    }
    items = dedupeItems(items).filter((x) => {
      const u = String(x?.url || '');
      if (!/^https?:/i.test(u)) return false;
      if (x.kind !== 'video' || x.ext === 'm3u8' || x.ext === 'mpd') return false;
      if (x.hasVideo === false) return false;
      if (/(avatar|cover|poster|thumbnail|image|googleads|doubleclick)/i.test(u)) return false;
      const bytes = Number(x.totalBytes || x.sizeBytes || 0);
      if (bytes && bytes < 150000) return false;
      return true;
    });
    if (!items.length) return {ok:false,error:'Không bắt được file video trực tiếp của tập hiện tại.'};
    items.sort((a,b) => candidateScore(b) - candidateScore(a));
    const best = items[0];
    const ext = ['mp4','webm','mov','m4v'].includes(String(best.ext||'').toLowerCase()) ? String(best.ext).toLowerCase() : 'mp4';
    const filename = `${sanitizeFilename(seriesTitle || 'TikTok Series')} - Tap_${String(episode).padStart(3,'0')}.${ext}`;
    const res = await chrome.runtime.sendMessage({type:'BABYLON_MEDIA_DOWNLOAD',item:best,filename}).catch((e)=>({ok:false,error:e?.message||String(e)}));
    if (!res?.ok) return {ok:false,error:res?.error || 'Chrome từ chối tải file.'};
    await sleep(650);
    try {
      const found = await chrome.downloads.search({id:res.downloadId});
      const d = found?.[0];
      if (d?.state === 'interrupted') return {ok:false,error:d.error || 'Lượt tải bị gián đoạn.'};
    } catch {}
    return {ok:true,downloadId:res.downloadId,label:best.quality || `${best.ext || 'video'}`};
  }

  function candidateScore(x) {
    const q = String(x.quality || '');
    const res = Number(q.match(/(2160|1440|1080|720|480|360|240|144)p/i)?.[1] || x.height || 0);
    const bytes = Number(x.totalBytes || x.sizeBytes || 0);
    let s = res * 1000000 + Math.min(bytes, 999999999);
    if (x.hasAudio === true) s += 5e12;
    if (x.hasVideo === true) s += 2e12;
    if (/tiktok|byteoversea|ibyteimg|douyin|muscdn/i.test(String(x.url || ''))) s += 5e11;
    if (String(x.ext || '').toLowerCase() === 'mp4') s += 1e11;
    return s;
  }

  function dedupeItems(list) {
    const map = new Map();
    for (const x of list || []) {
      const url = String(x?.url || '');
      if (!url) continue;
      let key = url;
      try {
        const u = new URL(url);
        ['range','rn','rbuf','sq'].forEach((k)=>u.searchParams.delete(k));
        key = u.toString();
      } catch {}
      const old = map.get(key);
      if (!old || candidateScore(x) > candidateScore(old)) map.set(key,x);
    }
    return [...map.values()];
  }

  async function runPageAction(tabId, action, value) {
    const results = await chrome.scripting.executeScript({
      target:{tabId},
      world:'MAIN',
      func: async (actionName, targetValue) => {
        const sleep = (ms) => new Promise((r)=>setTimeout(r,ms));
        const txt = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g,' ').trim();
        const norm = (value) => String(value || '').replace(/[‐‑‒–—−﹘﹣－]/g,'-').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
        const visible = (el) => {
          if (!(el instanceof Element)) return false;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .05;
        };
        const clickable = (el) => {
          if (!(el instanceof Element)) return null;
          let cur = el;
          for (let i=0;i<4 && cur;i++,cur=cur.parentElement) {
            if (cur.matches?.('button,a,[role="button"],[tabindex],input')) return cur;
            const cs = getComputedStyle(cur);
            if (cs.cursor === 'pointer') return cur;
          }
          return el;
        };
        const deepElements = () => {
          const out=[]; const roots=[document]; const seen=new Set();
          while(roots.length){
            const root=roots.pop(); if(!root||seen.has(root))continue; seen.add(root);
            for(const el of root.querySelectorAll?.('*')||[]){out.push(el); if(el.shadowRoot)roots.push(el.shadowRoot);}
          }
          return out;
        };
        const findSeriesRoot = () => {
          const all = [...document.querySelectorAll('body *')].filter(visible);
          const seed = all.filter((el)=>/^Tập$/i.test(txt(el)) || /^Episodes?$/i.test(txt(el))).slice(0,20);
          let best=null,bestScore=-1;
          const evaluate=(root)=>{
            if(!root||!visible(root))return;
            const els=[root,...root.querySelectorAll('*')].filter(visible);
            const nums=els.filter(e=>/^\d{1,4}$/.test(txt(e))).length;
            const ranges=els.filter(e=>/^\d{1,4}\s*[-–]\s*\d{1,4}$/.test(txt(e))).length;
            if(nums<3)return;
            const r=root.getBoundingClientRect();
            let score=nums+ranges*8;
            if(r.left>innerWidth*.55)score+=12;
            if(r.width<innerWidth*.5)score+=4;
            if(score>bestScore){bestScore=score;best=root;}
          };
          for(const s of seed){let p=s;for(let i=0;i<7&&p;i++,p=p.parentElement)evaluate(p);}
          if(!best){
            for(const el of all.filter(e=>/^\d{1,4}\s*[-–]\s*\d{1,4}$/.test(txt(e))).slice(0,30)){
              let p=el;for(let i=0;i<6&&p;i++,p=p.parentElement)evaluate(p);
            }
          }
          return best;
        };
        const seriesInfo = () => {
          const root=findSeriesRoot();
          const scope=root ? [root,...root.querySelectorAll('*')] : [...document.querySelectorAll('body *')];
          const ranges=[]; const eps=[];
          for(const el of scope){
            if(!visible(el))continue; const t=norm(txt(el));
            const rm=t.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
            if(rm){const a=+rm[1],b=+rm[2];if(b>=a&&b-a<200&&!ranges.some(x=>x.a===a&&x.b===b))ranges.push({a,b,text:`${a}-${b}`,el});continue;}
            if(/^\d{1,4}$/.test(t)){const n=+t;if(n>0&&n<10000&&!eps.includes(n))eps.push(n);}
          }
          // Tabs nhóm có thể nằm ngoài root grid; đọc thêm toàn bộ phần bên phải màn hình.
          for(const el of deepElements().filter(visible)){
            const t=norm(txt(el)); const rm=t.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/); if(!rm)continue;
            const a=+rm[1],b=+rm[2],r=el.getBoundingClientRect();
            if(b>=a&&b-a<250&&r.left>innerWidth*.55&&!ranges.some(x=>x.a===a&&x.b===b))ranges.push({a,b,text:`${a}-${b}`,el});
          }
          ranges.sort((a,b)=>a.a-b.a); eps.sort((a,b)=>a-b);
          const max=Math.max(0,...eps,...ranges.map(x=>x.b));
          let title='';
          if(root){
            let p=root.parentElement;
            for(let i=0;i<4&&p&&!title;i++,p=p.parentElement){
              const heads=[...p.querySelectorAll('h1,h2,h3,strong')].filter(visible).map(txt).filter(t=>t&&t.length>4&&t.length<140&&!/^Tập$/i.test(t));
              title=heads[0]||'';
            }
          }
          if(!title)title=document.title.replace(/\s*\|\s*TikTok.*$/i,'').replace(/\s*-\s*TikTok.*$/i,'').trim();
          return {root,ranges,eps,max,title};
        };
        const clickElement = async (el) => {
          const c=clickable(el); if(!c)return false;
          try{c.scrollIntoView({block:'center',inline:'center'});}catch{}
          await sleep(120);
          try{c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse'}));}catch{}
          try{c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));}catch{}
          try{c.click();}catch{}
          try{c.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}catch{}
          return true;
        };
        const findRangeForEpisode = (ep) => {
          const candidates=[]; const seen=new Set();
          for(const el of deepElements().filter(visible)){
            const raw=norm(txt(el));
            const m=raw.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
            if(!m)continue;
            const a=+m[1],b=+m[2]; if(ep<a||ep>b||b<a||b-a>250)continue;
            // Ưu tiên chính leaf/tab có text 25-45; không leo lên container chứa cả 1-24 + 25-45.
            let c=el;
            const parentClickable=clickable(el);
            if(parentClickable && norm(txt(parentClickable)).match(/^\d{1,4}\s*-\s*\d{1,4}$/)) c=parentClickable;
            if(seen.has(c))continue; seen.add(c);
            const r=c.getBoundingClientRect(); let score=0;
            if(r.left>innerWidth*.55)score+=80;
            if(r.width>=50&&r.width<260)score+=25;
            if(r.height>=20&&r.height<90)score+=20;
            if(c.matches?.('button,[role="button"]'))score+=15;
            if(c.getAttribute?.('aria-selected')==='true')score+=5;
            const cs=getComputedStyle(c); if(cs.cursor==='pointer')score+=10;
            candidates.push({el:c,a,b,text:`${a}-${b}`,score});
          }
          candidates.sort((x,y)=>y.score-x.score);
          return candidates[0]||null;
        };
        const findEpisodeButton = (ep, rootHint=null) => {
          const source=rootHint ? [rootHint,...rootHint.querySelectorAll('*')] : deepElements();
          const seen=new Set(); const candidates=[];
          for(const el of source){
            if(!visible(el)||norm(txt(el))!==String(ep))continue;
            const c=clickable(el); if(!c||seen.has(c))continue; seen.add(c);
            const r=c.getBoundingClientRect();
            if(r.width>180||r.height>120)continue;
            let score=0;
            if(r.left>innerWidth*.55)score+=50;
            if(r.width<=90)score+=15;
            if(r.height<=80)score+=15;
            if(c.matches?.('button,[role="button"]'))score+=10;
            const aria=(c.getAttribute?.('aria-label')||'')+' '+(c.getAttribute?.('title')||'');
            if(/tập|episode/i.test(aria))score+=10;
            candidates.push({el:c,score});
          }
          candidates.sort((a,b)=>b.score-a.score);
          return candidates[0]?.el||null;
        };
        const rectOf = (el) => {
          if(!el||!visible(el))return null; const r=el.getBoundingClientRect();
          return {x:r.left+r.width/2,y:r.top+r.height/2,left:r.left,top:r.top,width:r.width,height:r.height};
        };
        const detectCurrentEpisode = () => {
          const all=deepElements().filter(visible); const hits=[];
          for(const el of all){
            const t=norm(txt(el)); const r=el.getBoundingClientRect();
            const m=t.match(/(?:^|\b)(?:Tập|Episode)\s*(\d{1,4})(?:\b|\s*\|)/i);
            if(!m)continue;
            let score=0;
            if(r.left<innerWidth*.65)score+=80; // nhãn tập nằm trên player, không phải lưới bên phải
            if(r.top>innerHeight*.45)score+=20;
            if(t.length<80)score+=20;
            hits.push({n:+m[1],score});
          }
          hits.sort((a,b)=>b.score-a.score); return hits[0]?.n||0;
        };
        const targetLooksActive = (ep) => {
          const btn=findEpisodeButton(ep,null); if(!btn)return false;
          const aria=[btn.getAttribute?.('aria-selected'),btn.getAttribute?.('aria-current'),btn.getAttribute?.('data-active')].map(String).join(' ').toLowerCase();
          if(/true|page|active/.test(aria))return true;
          const cls=String(btn.className||'').toLowerCase(); if(/active|selected|current/.test(cls))return true;
          return false;
        };
        const waitEpisodeButton = async (ep, timeout=4500) => {
          const deadline=Date.now()+timeout;
          while(Date.now()<deadline){
            const info=seriesInfo();
            const found=findEpisodeButton(ep,info.root)||findEpisodeButton(ep,null);
            if(found)return{button:found,info};
            await sleep(220);
          }
          return null;
        };
        const openEpisode = async (ep) => {
          let info=seriesInfo();
          if(!info.root)return{ok:false,error:'Không tìm thấy vùng danh sách tập.'};

          // Nếu tập chưa hiện ở nhóm hiện tại, phải bấm tab nhóm chứa tập trước
          // (ví dụ 1-24 -> 25-45), chờ TikTok render lại danh sách rồi mới bấm tập.
          let episodeButton=findEpisodeButton(ep,info.root);
          let rangeText='';
          if(!episodeButton){
            const range=findRangeForEpisode(ep) || info.ranges.find(r=>ep>=r.a&&ep<=r.b);
            if(!range)return{ok:false,error:`Không tìm thấy nhóm tập chứa tập ${ep}.`};
            rangeText=range.text||`${range.a}-${range.b}`;
            await clickElement(range.el);
            let waited=await waitEpisodeButton(ep,5000);
            if(!waited){
              // Có trang TikTok cần click tab nhóm lần 2 sau khi panel vừa render lại.
              const retryRange=findRangeForEpisode(ep);
              if(retryRange){
                await clickElement(retryRange.el);
                waited=await waitEpisodeButton(ep,3500);
              }
            }
            if(!waited)return{ok:false,error:`Đã bấm nhóm ${rangeText} nhưng chưa thấy nút tập ${ep}.`,range:rangeText};
            info=waited.info;
            episodeButton=waited.button;
          } else {
            const range=findRangeForEpisode(ep) || info.ranges.find(r=>ep>=r.a&&ep<=r.b);
            rangeText=range?.text||'';
          }

          await clickElement(episodeButton);
          await sleep(350);
          return{ok:true,range:rangeText,episode:ep};
        };
        const mediaState = () => {
          const videos=[...document.querySelectorAll('video')].filter(visible).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height);
          const v=videos[0]||document.querySelector('video');
          return{ok:true,pageUrl:location.href,src:String(v?.currentSrc||v?.src||''),readyState:Number(v?.readyState||0),duration:Number(v?.duration||0),paused:Boolean(v?.paused),width:Number(v?.videoWidth||0),height:Number(v?.videoHeight||0)};
        };
        const nudge = async()=>{
          const videos=[...document.querySelectorAll('video')].filter(visible);const v=videos[0]||document.querySelector('video');
          if(!v)return{ok:false};
          try{v.muted=true;await v.play();}catch{}
          return{ok:true};
        };
        const mediaCandidates = () => {
          const items=[]; const add=(url,bytes=0,source='performance')=>{
            url=String(url||''); if(!/^https?:/i.test(url))return;
            if(!/(video|play|mime_type=video|byteoversea|tiktokcdn|muscdn|ibytedtos|v\d+[-.]|tos[-_/]|\.mp4(?:\?|$))/i.test(url))return;
            if(/avatar|cover|poster|thumbnail|image|googleads|doubleclick/i.test(url))return;
            items.push({url,kind:'video',ext:'mp4',quality:'TikTok',hasAudio:true,hasVideo:true,totalBytes:Number(bytes||0),source});
          };
          for(const v of document.querySelectorAll('video')) add(v.currentSrc||v.src,0,'video-src');
          try{for(const e of performance.getEntriesByType('resource').slice(-800))add(e.name,e.transferSize||e.encodedBodySize||0,'performance');}catch{}
          const seen=new Set(); return {ok:true,items:items.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;}).slice(-120)};
        };
        const cococDownload = async()=>{
          const elements=deepElements().filter(visible);
          const video=document.querySelector('video'); const vr=video?.getBoundingClientRect?.();
          const scoreButton=(el)=>{
            const t=(txt(el)+' '+(el.getAttribute?.('aria-label')||'')+' '+(el.getAttribute?.('title')||'')+' '+String(el.id||'')+' '+String(el.className||'')).toLowerCase();
            const r=el.getBoundingClientRect(); let s=0;
            if(/tải xuống|tải video|download/.test(t))s+=100;
            if(/[↓⬇⇩]/.test(txt(el)))s+=35;
            if(/download/.test(t))s+=40;
            if(vr&&r.left>=vr.left-20&&r.left<=vr.right+20&&r.top>=vr.top-40&&r.top<=vr.top+100)s+=35;
            if(r.width>=18&&r.width<=90&&r.height>=18&&r.height<=70)s+=10;
            return s;
          };
          let buttons=elements.filter(el=>el.matches?.('button,[role="button"],a,[tabindex]')||getComputedStyle(el).cursor==='pointer');
          buttons=buttons.map(el=>({el,s:scoreButton(el)})).filter(x=>x.s>=55).sort((a,b)=>b.s-a.s);
          if(!buttons.length)return{ok:false,error:'Nút tải Cốc Cốc không nằm trong DOM của trang.'};
          await clickElement(buttons[0].el); await sleep(450);
          const after=deepElements().filter(visible);
          const menu=after.find(el=>/Chọn tệp để tải|Choose.*download/i.test(txt(el)));
          const scope=menu ? (()=>{let p=menu;for(let i=0;i<5&&p;i++,p=p.parentElement){if(/\.mp4|VIDEO/i.test(txt(p))&&p.getBoundingClientRect().width<700)return [p,...p.querySelectorAll('*')];}return after;})() : after;
          const choices=[];
          for(const el of scope){
            if(!visible(el))continue;const t=txt(el);if(!/\.mp4\b/i.test(t))continue;
            const c=clickable(el);if(!c)continue;let s=20;
            if(/2160|4k/i.test(t))s+=100;if(/1440|2k/i.test(t))s+=90;if(/1080|full hd/i.test(t))s+=80;if(/720|hd/i.test(t))s+=70;if(/480|tiêu chuẩn|standard/i.test(t))s+=55;
            if(/video/i.test(t))s+=15;if(/audio|mp3/i.test(t))s-=60;
            choices.push({el:c,s,text:t.slice(0,100)});
          }
          choices.sort((a,b)=>b.s-a.s);
          if(!choices.length)return{ok:false,error:'Đã mở nút tải nhưng không đọc được lựa chọn VIDEO của Cốc Cốc.'};
          await clickElement(choices[0].el); await sleep(300);
          return{ok:true,choice:choices[0].text};
        };

        if(actionName==='scan'){
          const i=seriesInfo();return{ok:Boolean(i.root||i.max),title:i.title,episodes:i.eps,ranges:i.ranges.map(x=>x.text),maxEpisode:i.max};
        }
        if(actionName==='series-state'){
          const i=seriesInfo(); const ep=Number(targetValue||0); const active=detectCurrentEpisode();
          const r=findRangeForEpisode(ep); return{ok:true,currentEpisode:active,targetActive:targetLooksActive(ep),currentRange:r?.text||'',visibleEpisodes:i.eps,ranges:i.ranges.map(x=>x.text)};
        }
        if(actionName==='locate-range'){
          const ep=Number(targetValue); const r=findRangeForEpisode(ep); const p=rectOf(r?.el);
          return p?{ok:true,range:r.text,a:r.a,b:r.b,...p}:{ok:false,error:`Không tìm thấy tab nhóm chứa tập ${ep}.`};
        }
        if(actionName==='locate-episode'){
          const ep=Number(targetValue); const i=seriesInfo(); const b=findEpisodeButton(ep,i.root)||findEpisodeButton(ep,null); const p=rectOf(b); const r=findRangeForEpisode(ep);
          return p?{ok:true,episode:ep,range:r?.text||'',active:targetLooksActive(ep),...p}:{ok:false,error:`Tập ${ep} chưa hiện trong nhóm hiện tại.`};
        }
        if(actionName==='media-candidates')return mediaCandidates();
        if(actionName==='open-episode')return await openEpisode(Number(targetValue));
        if(actionName==='media-state')return mediaState();
        if(actionName==='nudge-video')return await nudge();
        if(actionName==='cococ-download')return await cococDownload();
        return{ok:false,error:'Unknown action'};
      },
      args:[action,value]
    });
    const valueOut = results?.[0]?.result;
    if (!valueOut) throw new Error('Trang không trả kết quả thao tác.');
    return valueOut;
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    updateButtons();
    setStatus(paused ? 'Đã tạm dừng. Bấm TIẾP TỤC để chạy tiếp.' : 'Đang tiếp tục tải series...', paused ? 'warn' : 'ok');
    log(paused ? 'Tạm dừng theo yêu cầu.' : 'Tiếp tục hàng đợi.', paused ? 'warn' : 'ok');
  }

  function requestStop() {
    if (!running) return;
    stopRequested = true;
    paused = false;
    updateButtons();
    setStatus('Đang dừng sau bước hiện tại...','warn');
  }

  async function waitWhilePaused() {
    while (paused && !stopRequested) await sleep(300);
  }

  function renderQueue() {
    if (!queueEl) return;
    queueEl.innerHTML = '';
    const slice = queue.length > 120 ? queue.slice(Math.max(0,(currentEpisode||queue[0]?.episode)-6 - queue[0].episode), Math.max(0,(currentEpisode||queue[0]?.episode)-6 - queue[0].episode)+24) : queue;
    for (const job of slice) {
      const row = document.createElement('div');
      row.className = `series-queue-item ${job.state}`;
      const icon = job.state==='done'?'✓':job.state==='error'?'!':job.state==='running'?'▶':'•';
      row.innerHTML = `<span class="series-queue-ep">${icon} Tập ${job.episode}</span><span class="series-queue-msg"></span>`;
      row.querySelector('.series-queue-msg').textContent = job.message || stateText(job.state);
      queueEl.appendChild(row);
    }
  }

  function updateStats() {
    totalEl.textContent = String(queue.length || 0);
    currentEl.textContent = currentEpisode ? String(currentEpisode) : '—';
    okEl.textContent = String(doneCount);
    errorEl.textContent = String(errorCount);
    const finished = doneCount + errorCount;
    const pct = queue.length ? Math.round(finished / queue.length * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${finished}/${queue.length || 0} • ${pct}%`;
  }

  function updateButtons() {
    startBtn.disabled = running;
    scanBtn.disabled = running;
    pauseBtn.disabled = !running;
    stopBtn.disabled = !running;
    pauseBtn.textContent = paused ? '▶ TIẾP TỤC' : 'Ⅱ TẠM DỪNG';
  }

  function stateText(s) { return s==='done'?'Đã tải':s==='error'?'Lỗi':s==='running'?'Đang xử lý':'Chờ'; }
  function setStatus(text,type='') { statusEl.textContent = text; statusEl.className = `series-status ${type}`.trim(); }
  function log(text,type='') {
    if (!logEl) return;
    const line=document.createElement('div'); line.className=`series-log-line ${type}`.trim();
    line.textContent=`${new Date().toLocaleTimeString('vi-VN',{hour12:false})}  ${text}`;
    logEl.prepend(line); while(logEl.children.length>80)logEl.lastElementChild?.remove();
  }
  function clampInt(v,min,max,fallback){const n=parseInt(v,10);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function sanitizeFilename(value){return String(value||'TikTok Series').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().replace(/\.+$/g,'').slice(0,110)||'TikTok Series';}

  window.BaByLonSeriesDownloader = {onOpen};
  init();
})();
