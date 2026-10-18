const $ = (id) => document.getElementById(id);

let isRunning = false;
let stopRequested = false;
let currentChannelKeywords = [];
let currentTags = [];
let currentHashtags = [];
let currentOldestHashtags = [];
let currentLatestTags = [];
let keywordPollTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// ===== BaByLon compact header UI controls (font size + light/dark) =====
const UI_FONT_MIN = 0.9;
const UI_FONT_MAX = 1.35;
const UI_FONT_STEP = 0.1;
let babylonUiFontScale = 1;
let babylonUiTheme = 'light';

function clampUiFontScale(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.min(UI_FONT_MAX, Math.max(UI_FONT_MIN, Number(num.toFixed(2))));
}

function updateHeaderUiControls() {
  const decBtn = $('fontDecreaseBtn');
  const incBtn = $('fontIncreaseBtn');
  const themeBtn = $('themeToggleBtn');
  const percent = Math.round(babylonUiFontScale * 100);

  if (decBtn) {
    decBtn.disabled = babylonUiFontScale <= UI_FONT_MIN;
    decBtn.title = `Giảm cỡ chữ • hiện tại ${percent}%`;
  }
  if (incBtn) {
    incBtn.disabled = babylonUiFontScale >= UI_FONT_MAX;
    incBtn.title = `Tăng cỡ chữ • hiện tại ${percent}%`;
  }
  if (themeBtn) {
    themeBtn.classList.toggle('is-dark', babylonUiTheme === 'dark');
    themeBtn.title = babylonUiTheme === 'dark'
      ? 'Chuyển sang chế độ sáng'
      : 'Chuyển sang chế độ tối';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
}

function applyUiPreferences() {
  document.documentElement.style.setProperty('--font-scale', String(babylonUiFontScale));
  document.body.classList.toggle('theme-dark', babylonUiTheme === 'dark');
  document.body.classList.toggle('theme-light', babylonUiTheme !== 'dark');
  updateHeaderUiControls();
}

async function saveUiPreferences() {
  try {
    await chrome.storage.local.set({ babylonUiFontScale, babylonUiTheme });
  } catch (_) {}
}

async function toggleUiTheme() {
  babylonUiTheme = babylonUiTheme === 'dark' ? 'light' : 'dark';
  applyUiPreferences();
  await saveUiPreferences();
}

async function changeUiFontScale(delta = 0) {
  babylonUiFontScale = clampUiFontScale(babylonUiFontScale + delta);
  applyUiPreferences();
  await saveUiPreferences();
}

async function initUiPreferences() {
  try {
    const saved = await chrome.storage.local.get(['babylonUiFontScale', 'babylonUiTheme']);
    babylonUiFontScale = clampUiFontScale(saved.babylonUiFontScale || 1);
    babylonUiTheme = saved.babylonUiTheme === 'dark' ? 'dark' : 'light';
  } catch (_) {
    babylonUiFontScale = 1;
    babylonUiTheme = 'light';
  }

  applyUiPreferences();
  $('fontDecreaseBtn')?.addEventListener('click', () => changeUiFontScale(-UI_FONT_STEP));
  $('fontIncreaseBtn')?.addEventListener('click', () => changeUiFontScale(UI_FONT_STEP));
  $('themeToggleBtn')?.addEventListener('click', toggleUiTheme);
}

function setStatus(message = '', type = '') {
  const el = $('status');
  el.textContent = message;
  el.className = `status ${type}`;
}

function setProgress(percent, text = '') {
  $('progressWrap').classList.remove('hidden');
  $('progressBar').style.width = `${Math.max(0, Math.min(100, percent))}%`;
  $('progressText').textContent = text;
}

function hideProgress() {
  $('progressWrap').classList.add('hidden');
  $('progressBar').style.width = '0%';
  $('progressText').textContent = '';
}

function normalizeChannelUrl(input) {
  let raw = (input || '').trim();
  if (!raw) throw new Error('Hãy dán link kênh YouTube.');

  if (raw.startsWith('@')) raw = `https://www.youtube.com/${raw}`;
  if (!/^https?:\/\//i.test(raw)) {
    if (/^(www\.)?youtube\.com\//i.test(raw) || /^m\.youtube\.com\//i.test(raw)) raw = `https://${raw}`;
    else throw new Error('Link chưa đúng. Ví dụ: https://www.youtube.com/@tenkenh');
  }

  const url = new URL(raw);
  if (!/(^|\.)youtube\.com$/i.test(url.hostname)) throw new Error('Chỉ hỗ trợ link youtube.com.');

  const parts = url.pathname.split('/').filter(Boolean);
  if (!parts.length) throw new Error('Đây chưa phải link kênh YouTube.');

  let channelPath = '';
  if (parts[0].startsWith('@')) channelPath = `/${parts[0]}`;
  else if (['channel', 'user', 'c'].includes(parts[0]) && parts[1]) channelPath = `/${parts[0]}/${parts[1]}`;
  else throw new Error('Hãy dùng link kênh dạng youtube.com/@handle hoặc youtube.com/channel/UC...');

  return `https://www.youtube.com${channelPath}`;
}

function splitKeywords(raw) {
  const text = (raw || '').trim();
  if (!text) return [];
  const result = [];

  if (text.includes(',')) {
    let token = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        quoted = !quoted;
        continue;
      }
      if (ch === ',' && !quoted) {
        const value = token.trim();
        if (value) result.push(value);
        token = '';
      } else token += ch;
    }
    const tail = token.trim();
    if (tail) result.push(tail);
  } else {
    const re = /"([^"]+)"|(\S+)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const value = (match[1] || match[2] || '').trim();
      if (value) result.push(value);
    }
  }

  const seen = new Set();
  return result.filter((item) => {
    const cleaned = item.replace(/^[\s'“”"]+|[\s'“”"]+$/g, '').trim();
    if (!cleaned || cleaned === '…' || cleaned === '...') return false;
    const key = cleaned.toLocaleLowerCase('vi');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => item.replace(/^[\s'“”"]+|[\s'“”"]+$/g, '').trim());
}

function waitForTabComplete(tabId, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => finish(new Error('Trang YouTube tải quá lâu. Hãy thử lại.')), timeoutMs);

    function finish(error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error); else resolve();
    }

    function onUpdated(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') finish();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch(() => {});
  });
}

async function extractChannelKeywordsFromTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      function isObj(v) { return v && typeof v === 'object'; }

      function deepFind(root) {
        if (!isObj(root)) return '';
        const stack = [root];
        const seen = new Set();
        let visited = 0;
        while (stack.length && visited < 150000) {
          const cur = stack.pop();
          if (!isObj(cur) || seen.has(cur)) continue;
          seen.add(cur);
          visited++;

          if (cur.channelMetadataRenderer && typeof cur.channelMetadataRenderer.keywords === 'string') {
            return cur.channelMetadataRenderer.keywords.trim();
          }
          if (typeof cur.keywords === 'string' && cur.externalId && cur.title) return cur.keywords.trim();

          if (Array.isArray(cur)) {
            for (let i = cur.length - 1; i >= 0; i--) if (isObj(cur[i])) stack.push(cur[i]);
          } else {
            for (const value of Object.values(cur)) if (isObj(value)) stack.push(value);
          }
        }
        return '';
      }

      function decodeJsonString(encoded) {
        try { return JSON.parse(`"${encoded}"`); } catch (_) { return ''; }
      }

      function scanText(text) {
        if (!text || !text.includes('channelMetadataRenderer')) return '';
        const marker = '"channelMetadataRenderer"';
        let p = 0;
        while ((p = text.indexOf(marker, p)) !== -1) {
          const block = text.slice(p, Math.min(text.length, p + 120000));
          const m = block.match(/"keywords"\s*:\s*"((?:\\.|[^"\\])*)"/);
          if (m?.[1]) {
            const decoded = decodeJsonString(m[1]);
            if (decoded) return decoded.trim();
          }
          p += marker.length;
        }
        return '';
      }

      const direct = deepFind(window.ytInitialData);
      if (direct) return { raw: direct, source: 'ytInitialData' };

      for (const script of document.scripts) {
        const found = scanText(script.textContent || '');
        if (found) return { raw: found, source: 'pageScript' };
      }

      const htmlFound = scanText(document.documentElement?.innerHTML || '');
      if (htmlFound) return { raw: htmlFound, source: 'pageHtml' };

      return { raw: '', source: 'none' };
    }
  });
  return result || { raw: '', source: 'none' };
}

async function getChannelKeywords(channelUrl) {
  let tab;
  try {
    setStatus('Đang đọc từ khóa cấp kênh...');
    setProgress(5, 'Bước 1/3: đọc từ khóa cấp kênh');
    tab = await chrome.tabs.create({ url: channelUrl, active: false });
    await waitForTabComplete(tab.id);

    let extracted = { raw: '', source: 'none' };
    for (let attempt = 0; attempt < 6; attempt++) {
      if (stopRequested) break;
      extracted = await extractChannelKeywordsFromTab(tab.id);
      if (extracted.raw) break;
      await sleep(700);
    }
    return extracted;
  } finally {
    if (tab?.id) try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

function parseVideoIdFromHref(href) {
  if (!href) return '';
  try {
    const url = new URL(href, 'https://www.youtube.com');
    if (url.pathname === '/watch') return url.searchParams.get('v') || '';
    const shortMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shortMatch) return shortMatch[1];
    const liveMatch = url.pathname.match(/^\/live\/([^/?#]+)/);
    if (liveMatch) return liveMatch[1];
  } catch (_) {}
  return '';
}

async function collectIdsFromTab(tabId, label, globalSet) {
  // Cách chính: đọc ytInitialData + continuation của chính YouTube.
  // Cách này không phụ thuộc background tab có cuộn/lazy-load hay không.
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async () => {
        const ids = new Set();
        const seenTokens = new Set();
        const tokenQueue = [];

        function addId(value) {
          if (typeof value !== 'string') return;
          const id = value.trim();
          if (/^[A-Za-z0-9_-]{11}$/.test(id)) ids.add(id);
        }

        function addToken(value) {
          if (typeof value !== 'string') return;
          const token = value.trim();
          if (!token || token.length < 10 || seenTokens.has(token) || tokenQueue.includes(token)) return;
          tokenQueue.push(token);
        }

        function walk(root) {
          if (!root || typeof root !== 'object') return;

          const stack = [root];
          const seen = new Set();
          let visited = 0;

          while (stack.length && visited < 600000) {
            const cur = stack.pop();
            if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
            seen.add(cur);
            visited++;

            // Những renderer chính của trang kênh.
            if (cur.videoRenderer?.videoId) addId(cur.videoRenderer.videoId);
            if (cur.gridVideoRenderer?.videoId) addId(cur.gridVideoRenderer.videoId);
            if (cur.reelItemRenderer?.videoId) addId(cur.reelItemRenderer.videoId);

            // Shorts đời mới / endpoint.
            if (cur.watchEndpoint?.videoId) addId(cur.watchEndpoint.videoId);
            if (cur.reelWatchEndpoint?.videoId) addId(cur.reelWatchEndpoint.videoId);

            // Continuation của tab Video / Shorts / Live.
            if (cur.continuationCommand?.token) addToken(cur.continuationCommand.token);
            if (cur.nextContinuationData?.continuation) addToken(cur.nextContinuationData.continuation);
            if (cur.reloadContinuationData?.continuation) addToken(cur.reloadContinuationData.continuation);

            if (Array.isArray(cur)) {
              for (let i = cur.length - 1; i >= 0; i--) {
                if (cur[i] && typeof cur[i] === 'object') stack.push(cur[i]);
              }
            } else {
              for (const value of Object.values(cur)) {
                if (value && typeof value === 'object') stack.push(value);
              }
            }
          }
        }

        // Đọc trang đầu.
        walk(window.ytInitialData);

        const ytcfg = window.ytcfg;
        const apiKey = ytcfg?.get?.('INNERTUBE_API_KEY') || '';
        const context = ytcfg?.get?.('INNERTUBE_CONTEXT') || null;
        const clientName = ytcfg?.get?.('INNERTUBE_CONTEXT_CLIENT_NAME') || '';
        const clientVersion =
          ytcfg?.get?.('INNERTUBE_CONTEXT_CLIENT_VERSION') ||
          context?.client?.clientVersion ||
          '';

        // Đọc toàn bộ continuation mà YouTube trả về.
        if (apiKey && context) {
          let pages = 0;

          while (tokenQueue.length && pages < 250) {
            const token = tokenQueue.shift();
            if (!token || seenTokens.has(token)) continue;
            seenTokens.add(token);
            pages++;

            try {
              const response = await fetch(
                `/youtubei/v1/browse?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
                {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(clientName ? { 'X-YouTube-Client-Name': String(clientName) } : {}),
                    ...(clientVersion ? { 'X-YouTube-Client-Version': String(clientVersion) } : {})
                  },
                  body: JSON.stringify({
                    context,
                    continuation: token
                  })
                }
              );

              if (!response.ok) continue;
              const data = await response.json();
              walk(data);
            } catch (_) {
              // Sau đó còn fallback bằng cuộn DOM ở ngoài.
            }
          }
        }

        return {
          ids: [...ids],
          continuationPages: seenTokens.size
        };
      }
    });

    for (const id of (result?.ids || [])) globalSet.add(id);

    if ((result?.ids || []).length) {
      setStatus(`Đang tìm video công khai: ${globalSet.size} video...`);
      setProgress(
        15,
        `Bước 2/3: ${label} — ${result.ids.length} nội dung • ${result.continuationPages || 0} trang dữ liệu`
      );
      return;
    }
  } catch (_) {
    // Nếu YouTube đổi internal API, dùng fallback cuộn DOM phía dưới.
  }

  // Fallback: cuộn từng đoạn nhỏ thay vì nhảy thẳng xuống cuối.
  // Cách cũ nhảy scrollHeight ngay lập tức nên Shorts background tab có thể chỉ tải 10–20 video.
  let stagnant = 0;
  let lastTotal = globalSet.size;
  let loops = 0;

  while (!stopRequested && stagnant < 14 && loops < 1400) {
    loops++;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const hrefs = [];
        const selectors = [
          'a[href*="/watch?v="]',
          'a[href^="/shorts/"]',
          'a[href^="/live/"]',
          'a#thumbnail[href]'
        ];

        document.querySelectorAll(selectors.join(',')).forEach((a) => {
          const href = a.getAttribute('href');
          if (href) hrefs.push(href);
        });

        const root = document.scrollingElement || document.documentElement;
        const viewport = Math.max(window.innerHeight || 800, 600);
        const nextTop = Math.min(
          root.scrollHeight,
          root.scrollTop + Math.floor(viewport * 0.88)
        );

        root.scrollTo({ top: nextTop, behavior: 'instant' });

        return {
          hrefs,
          height: root.scrollHeight,
          top: root.scrollTop
        };
      }
    });

    for (const href of (result?.hrefs || [])) {
      const id = parseVideoIdFromHref(href);
      if (id) globalSet.add(id);
    }

    if (globalSet.size === lastTotal) stagnant++;
    else {
      stagnant = 0;
      lastTotal = globalSet.size;
    }

    setStatus(`Đang tìm video công khai: ${globalSet.size} video...`);
    setProgress(15, `Bước 2/3: ${label} — đã tìm ${globalSet.size} video`);

    // Cho lazy loader đủ thời gian nạp cụm tiếp theo.
    await sleep(stagnant >= 4 ? 1200 : 450);
  }
}
async function collectAllPublicVideoIds(channelUrl) {
  const ids = new Set();
  const tabsToScan = [
    { suffix: '/videos', label: 'Video' },
    { suffix: '/shorts', label: 'Shorts' },
    { suffix: '/streams', label: 'Live' }
  ];

  for (const item of tabsToScan) {
    if (stopRequested) break;
    let tab;
    try {
      tab = await chrome.tabs.create({ url: `${channelUrl}${item.suffix}`, active: false });
      await waitForTabComplete(tab.id);
      await sleep(900);
      await collectIdsFromTab(tab.id, item.label, ids);
    } catch (_) {
      // Một số kênh không có tab tương ứng; bỏ qua.
    } finally {
      if (tab?.id) try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }

  return [...ids];
}

function decodeJsonString(raw) {
  try { return JSON.parse(`"${raw}"`); } catch (_) { return ''; }
}

function extractJsonArrayAfter(text, key, start = 0, maxDistance = 500000) {
  const keyPos = text.indexOf(`"${key}"`, start);
  if (keyPos < 0 || keyPos - start > maxDistance) return null;
  const colon = text.indexOf(':', keyPos + key.length + 2);
  if (colon < 0) return null;
  let i = colon + 1;
  while (/\s/.test(text[i] || '')) i++;
  if (text[i] !== '[') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let j = i; j < text.length && j - i < maxDistance; j++) {
    const ch = text[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(i, j + 1)); } catch (_) { return null; }
      }
    }
  }
  return null;
}

function extractJsonStringAfter(text, key, start = 0, maxDistance = 500000) {
  const keyPos = text.indexOf(`"${key}"`, start);
  if (keyPos < 0 || keyPos - start > maxDistance) return '';
  const colon = text.indexOf(':', keyPos + key.length + 2);
  if (colon < 0) return '';
  const rest = text.slice(colon + 1, colon + 1 + maxDistance);
  const m = rest.match(/^\s*"((?:\\.|[^"\\])*)"/);
  return m?.[1] ? decodeJsonString(m[1]) : '';
}

function extractVideoDataFromHtml(html) {
  if (!html) return { tags: [], title: '', description: '', publishedAt: '' };

  let base = html.indexOf('"videoDetails"');
  if (base < 0) base = html.indexOf('videoDetails');
  if (base < 0) base = 0;

  const tags = extractJsonArrayAfter(html, 'keywords', base, 600000);
  const title = extractJsonStringAfter(html, 'title', base, 250000);
  const description = extractJsonStringAfter(html, 'shortDescription', base, 600000);
  const publishedAt = extractJsonStringAfter(html, 'publishDate', 0, 2500000) || extractJsonStringAfter(html, 'uploadDate', 0, 2500000);

  return {
    tags: Array.isArray(tags) ? tags.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [],
    title: title || '',
    description: description || '',
    publishedAt: publishedAt || ''
  };
}

function extractHashtags(text) {
  const matches = (text || '').match(/#[\p{L}\p{N}_\u200c\u200d]+/gu) || [];
  const seen = new Set();
  const out = [];
  for (const tag of matches) {
    const key = tag.toLocaleLowerCase('vi');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

async function fetchVideoData(videoId) {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=vi`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  return extractVideoDataFromHtml(html);
}

function addUsage(map, values) {
  const localSeen = new Set();
  for (const value of values) {
    const display = (value || '').trim();
    if (!display) continue;
    const key = display.toLocaleLowerCase('vi');
    if (localSeen.has(key)) continue;
    localSeen.add(key);
    if (!map.has(key)) map.set(key, { text: display, count: 0 });
    map.get(key).count++;
  }
}

async function scanVideoMetadata(videoIds) {
  const tagMap = new Map();
  const hashtagMap = new Map();
  let completed = 0;
  let failed = 0;
  let latestVideo = null;
  const total = videoIds.length;
  const concurrency = Math.min(4, Math.max(1, total));
  let nextIndex = 0;

  async function worker() {
    while (!stopRequested) {
      const index = nextIndex++;
      if (index >= total) return;
      const id = videoIds[index];
      try {
        const data = await fetchVideoData(id);
        data.id = id;
        addUsage(tagMap, data.tags);

        const time = data.publishedAt ? Date.parse(data.publishedAt) : NaN;
        if (!latestVideo) {
          latestVideo = { ...data, _time: Number.isFinite(time) ? time : NaN, _index: index };
        } else {
          const currentTime = latestVideo._time;
          const shouldReplace = Number.isFinite(time)
            ? (!Number.isFinite(currentTime) || time > currentTime)
            : (!Number.isFinite(currentTime) && index < latestVideo._index);
          if (shouldReplace) latestVideo = { ...data, _time: Number.isFinite(time) ? time : NaN, _index: index };
        }
        addUsage(hashtagMap, extractHashtags(`${data.title}\n${data.description}`));
      } catch (_) {
        failed++;
      } finally {
        completed++;
        const pct = total ? 20 + Math.round((completed / total) * 80) : 100;
        setStatus(`Đang đọc thẻ/hashtag: ${completed}/${total} video...`);
        setProgress(pct, `Bước 3/3: ${completed}/${total} video${failed ? ` • lỗi ${failed}` : ''}`);
      }
      await sleep(80);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const sortMap = (map) => [...map.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'vi'));
  return {
    tags: sortMap(tagMap),
    hashtags: sortMap(hashtagMap),
    latestVideo,
    completed,
    failed
  };
}

function renderPlainChips(containerId, items) {
  const container = $(containerId);
  container.innerHTML = '';
  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = item;
    container.appendChild(chip);
  }
}

function renderRankedChips(containerId, items, videoTotal) {
  const container = $(containerId);
  container.innerHTML = '';
  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'chip rank';
    chip.title = videoTotal ? `${item.count}/${videoTotal} video (${Math.round(item.count / videoTotal * 100)}%)` : `${item.count} video`;

    const text = document.createElement('span');
    text.textContent = item.text;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = item.count;

    chip.appendChild(text);
    chip.appendChild(count);
    container.appendChild(chip);
  }
}

function renderResults({
  channelKeywords = [],
  channelRaw = '',
  tags = [],
  hashtagsNewest = [],
  hashtagsOldest = [],
  latestVideo = null,
  videoTotal = 0,
  newestCount = 0,
  oldestCount = 0,
  sampledCount = 0
}) {
  currentChannelKeywords = channelKeywords;
  currentTags = tags.map((x) => x.text);
  currentHashtags = hashtagsNewest.map((x) => x.text);
  currentOldestHashtags = hashtagsOldest.map((x) => x.text);
  currentLatestTags = latestVideo?.tags || [];

  [
    'summaryCard',
    'channelCard',
    'latestTagsCard',
    'tagsCard',
    'hashtagsCard',
    'oldestHashtagsCard'
  ].forEach((id) => $(id).classList.remove('hidden'));

  $('videoCount').textContent = videoTotal;
  $('channelKeywordCount').textContent = channelKeywords.length;
  $('latestTagCount').textContent = currentLatestTags.length;
  $('tagCount').textContent = tags.length;
  $('hashtagCount').textContent = `${hashtagsNewest.length}/${hashtagsOldest.length}`;

  $('channelCountText').textContent = `${channelKeywords.length} từ khóa`;
  renderPlainChips('channelChips', channelKeywords);
  $('rawKeywords').value = channelRaw || '';
  $('copyChannelBtn').disabled = channelKeywords.length === 0;

  if (channelKeywords.length) {
    $('channelEmpty').classList.add('hidden');
    $('rawDetails').classList.remove('hidden');
  } else {
    $('channelEmpty').textContent = 'YouTube không gửi từ khóa cấp kênh công khai cho trang này.';
    $('channelEmpty').classList.remove('hidden');
    $('rawDetails').classList.add('hidden');
  }

  // Thẻ video mới nhất
  renderPlainChips('latestTagsChips', currentLatestTags);
  $('copyLatestTagsBtn').disabled = currentLatestTags.length === 0;

  const latestLink = $('latestVideoLink');
  if (latestVideo?.id) {
    latestLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(latestVideo.id)}`;
    latestLink.textContent = latestVideo.title || `Video ${latestVideo.id}`;
    latestLink.classList.remove('hidden');
  } else {
    latestLink.removeAttribute('href');
    latestLink.textContent = '';
    latestLink.classList.add('hidden');
  }

  if (latestVideo) {
    const dateText = latestVideo.publishedAt
      ? new Date(latestVideo.publishedAt).toLocaleDateString('vi-VN')
      : 'không có ngày xuất bản';
    $('latestVideoMeta').textContent = `${currentLatestTags.length} thẻ • ${dateText}`;
  } else {
    $('latestVideoMeta').textContent = 'Không tìm thấy video';
  }

  if (currentLatestTags.length) {
    $('latestTagsEmpty').classList.add('hidden');
  } else {
    $('latestTagsEmpty').textContent = latestVideo
      ? 'Video mới nhất không công khai thẻ (tags), hoặc video này không có thẻ.'
      : 'Không tìm thấy video mới nhất để đọc thẻ.';
    $('latestTagsEmpty').classList.remove('hidden');
  }

  // Thẻ được gộp từ hai đầu lịch sử kênh
  $('tagsCountText').textContent =
    `${tags.length} thẻ duy nhất • mẫu ${sampledCount || newestCount + oldestCount} nội dung`;
  renderRankedChips('tagsChips', tags, Math.max(1, sampledCount || newestCount + oldestCount));
  $('copyTagsBtn').disabled = tags.length === 0;

  if (tags.length) {
    $('tagsEmpty').classList.add('hidden');
  } else {
    $('tagsEmpty').textContent = 'Không tìm thấy thẻ công khai trong 12 nội dung mới nhất và 12 video cũ nhất của kênh.';
    $('tagsEmpty').classList.remove('hidden');
  }

  // 12 nội dung mới nhất
  $('hashtagsCountText').textContent =
    `${hashtagsNewest.length} hashtag duy nhất • ${newestCount} nội dung mới nhất`;
  renderRankedChips('hashtagsChips', hashtagsNewest, Math.max(1, newestCount));
  $('copyHashtagsBtn').disabled = hashtagsNewest.length === 0;

  if (hashtagsNewest.length) {
    $('hashtagsEmpty').classList.add('hidden');
  } else {
    $('hashtagsEmpty').textContent = `Không tìm thấy hashtag trong ${newestCount || 0} nội dung mới nhất.`;
    $('hashtagsEmpty').classList.remove('hidden');
  }

  // 12 video cũ nhất của kênh
  $('oldestHashtagsCountText').textContent =
    `${hashtagsOldest.length} hashtag duy nhất • ${oldestCount} video cũ nhất của kênh`;
  renderRankedChips('oldestHashtagsChips', hashtagsOldest, Math.max(1, oldestCount));
  $('copyOldestHashtagsBtn').disabled = hashtagsOldest.length === 0;

  if (hashtagsOldest.length) {
    $('oldestHashtagsEmpty').classList.add('hidden');
  } else {
    $('oldestHashtagsEmpty').textContent = `Không tìm thấy hashtag trong ${oldestCount || 0} video cũ nhất của kênh.`;
    $('oldestHashtagsEmpty').classList.remove('hidden');
  }
}

function clearResults() {
  [
    'summaryCard',
    'channelCard',
    'latestTagsCard',
    'tagsCard',
    'hashtagsCard',
    'oldestHashtagsCard'
  ].forEach((id) => $(id).classList.add('hidden'));

  currentChannelKeywords = [];
  currentTags = [];
  currentHashtags = [];
  currentOldestHashtags = [];
  currentLatestTags = [];
}

function stopKeywordPolling() {
  if (keywordPollTimer) clearInterval(keywordPollTimer);
  keywordPollTimer = null;
}

async function getKeywordJobState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'BABYLON_KEYWORD_GET_STATE' });
    return response?.state || null;
  } catch (_) {
    return null;
  }
}

function applyKeywordJobState(state) {
  if (!state) return;

  if (state.status === 'idle') {
    isRunning = false;
    stopKeywordPolling();
    clearResults();
    $('channelInput').value = '';
    $('analyzeBtn').textContent = 'LẤY TỪ KHÓA + THẺ + HASHTAG';
    $('analyzeBtn').classList.remove('stop');
    setStatus('');
    setProgress(0, '');
    return;
  }

  if (state.channelUrl && !$('channelInput').value.trim()) {
    $('channelInput').value = state.channelUrl;
  }

  if (state.status === 'running') {
    isRunning = true;
    $('analyzeBtn').textContent = 'DỪNG QUÉT';
    $('analyzeBtn').classList.add('stop');
    setStatus(state.message || 'BaByLon đang phân tích...', state.statusTextType || '');
    setProgress(state.progress || 0, state.progressText || 'Đang chạy');
    return;
  }

  isRunning = false;
  $('analyzeBtn').textContent = 'LẤY TỪ KHÓA + THẺ + HASHTAG';
  $('analyzeBtn').classList.remove('stop');

  if (state.status === 'complete') {
    if (state.channelUrl) $('channelInput').value = state.channelUrl;
    if (state.result) renderResults(state.result);
    setStatus(state.message || 'Hoàn tất.', state.statusTextType || 'ok');
    setProgress(state.progress ?? 100, state.progressText || 'Hoàn tất');
  } else if (state.status === 'error') {
    setStatus(state.message || state.error || 'Có lỗi khi phân tích.', 'error');
  } else if (state.status === 'stopped') {
    setStatus(state.message || 'Đã dừng.', 'warn');
  }
}

function startKeywordPolling() {
  stopKeywordPolling();

  keywordPollTimer = setInterval(async () => {
    const state = await getKeywordJobState();
    if (!state) return;

    applyKeywordJobState(state);

    if (state.status !== 'running') {
      stopKeywordPolling();
    }
  }, 700);
}

async function restoreKeywordState() {
  const state = await getKeywordJobState();
  if (!state) return;

  // Kết quả cũ vẫn giữ nguyên khi đóng popup / đổi tab.
  // Chỉ một lần quét mới mới thay kết quả này.
  applyKeywordJobState(state);

  if (state.status === 'running') {
    startKeywordPolling();
  }
}

async function analyze() {
  const state = await getKeywordJobState();

  if (state?.status === 'running') {
    try {
      await chrome.runtime.sendMessage({ type: 'BABYLON_KEYWORD_STOP' });
      setStatus('Đang dừng sau tác vụ hiện tại...', 'warn');
      startKeywordPolling();
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
    }
    return;
  }

  let channelUrl;
  try {
    channelUrl = normalizeChannelUrl($('channelInput').value);
  } catch (error) {
    setStatus(error.message, 'error');
    return;
  }

  // Chỉ khi người dùng chủ động bấm đọc kênh mới thì mới bỏ kết quả cũ.
  clearResults();
  isRunning = true;
  $('analyzeBtn').textContent = 'DỪNG QUÉT';
  $('analyzeBtn').classList.add('stop');
  setStatus('Bắt đầu phân tích...');
  setProgress(2, 'Chuẩn bị');

  try {
    await chrome.storage.local.set({ lastChannelUrl: channelUrl });
    $('channelInput').value = channelUrl;

    const response = await chrome.runtime.sendMessage({
      type: 'BABYLON_KEYWORD_START',
      channelUrl
    });

    if (!response?.ok) throw new Error(response?.error || 'Không khởi động được bộ quét.');

    applyKeywordJobState(response.state);
    startKeywordPolling();
  } catch (error) {
    isRunning = false;
    $('analyzeBtn').textContent = 'LẤY TỪ KHÓA + THẺ + HASHTAG';
    $('analyzeBtn').classList.remove('stop');
    setStatus(error?.message || String(error), 'error');
  }
}

async function useCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('youtube.com/')) {
    setStatus('Hãy mở trang kênh YouTube trước.', 'error');
    return;
  }
  try {
    $('channelInput').value = normalizeChannelUrl(tab.url);
    setStatus('Đã lấy link kênh đang mở.');
  } catch (_) {
    setStatus('Trang hiện tại chưa phải trang kênh YouTube.', 'error');
  }
}

async function copyList(items, label) {
  if (!items.length) return;
  await navigator.clipboard.writeText(items.join(', '));
  setStatus(`Đã copy ${label}.`, 'ok');
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get(['lastChannelUrl']);

  $('analyzeBtn').addEventListener('click', analyze);
  $('currentBtn').addEventListener('click', useCurrentPage);
  $('copyChannelBtn').addEventListener('click', () => copyList(currentChannelKeywords, 'từ khóa kênh'));
  $('copyLatestTagsBtn').addEventListener('click', () => copyList(currentLatestTags, 'thẻ video mới nhất'));
  $('copyTagsBtn').addEventListener('click', () => copyList(currentTags, 'thẻ video'));
  $('copyHashtagsBtn').addEventListener('click', () => copyList(currentHashtags, 'hashtag 12 nội dung mới nhất'));
  $('copyOldestHashtagsBtn').addEventListener('click', () => copyList(currentOldestHashtags, 'hashtag 12 video cũ nhất của kênh'));

  $('channelInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') analyze();
  });

  // Đóng popup / đổi tab: vẫn khôi phục job và kết quả cũ.
  // Nhưng nếu trang YouTube đã Reload thì background đã xóa state + lastChannelUrl,
  // vì vậy popup mở lại sẽ là phiên trắng để quét kênh khác.
  const state = await getKeywordJobState();
  if (state?.channelUrl) $('channelInput').value = state.channelUrl;
  else $('channelInput').value = '';

  await restoreKeywordState();
});

// ===== BaByLon V3: điều hướng nhiều chức năng =====
function setCompactScrollTabState(running) {
  const tab = $('tabScroll');
  if (!tab) return;

  // Chỉ đổi trạng thái màu của tab.
  // Không sửa text/badge nữa để luôn giữ đúng 2 dòng:
  // "Cuộn xuống" / "Cuộn lên".
  tab.classList.toggle('scroll-running', Boolean(running));

  const icon = tab.querySelector('.tool-icon');
  if (icon) icon.textContent = '⇅';
}


async function stopBaByLonScrollIfRunning() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
      setCompactScrollTabState(false);
      return false;
    }

    const status = await chrome.runtime.sendMessage({
      type: 'BABYLON_GET_AUTO_SCROLL_STATUS',
      tabId: tab.id
    });

    if (!status?.ok || !status.running) {
      setCompactScrollTabState(false);
      return false;
    }

    const stopped = await chrome.runtime.sendMessage({
      type: 'BABYLON_TOGGLE_AUTO_SCROLL',
      tabId: tab.id
    });

    if (stopped?.ok) {
      setCompactScrollTabState(false);
      const button = $('scrollToggleBtn');
      if (button) {
        button.textContent = 'BẮT ĐẦU TỰ CUỘN';
        button.classList.remove('running');
      }
      setScrollStatus('Đã dừng tự cuộn khi chuyển sang chức năng khác.', 'warn');
      return true;
    }
  } catch (_) {
    // Không chặn việc chuyển chức năng nếu trang không cho kiểm tra trạng thái.
  }
  return false;
}


function syncBaByLonToolChooser(pageId, collapse = false) {
  const chooser = document.getElementById('babylonToolChooser');
  const tab = [...document.querySelectorAll('.tool-tab[data-page]')]
    .find((item) => item.dataset.page === pageId);
  if (!chooser || !tab) return;

  const icon = tab.querySelector('.tool-icon')?.textContent?.trim() || '🧰';
  const label = tab.querySelector('.tool-label')?.textContent?.replace(/\s+/g, ' ').trim() || 'Chức năng';
  const iconEl = document.getElementById('babylonSelectedToolIcon');
  const labelEl = document.getElementById('babylonSelectedToolName');
  const hintEl = document.getElementById('babylonToolChooserHint');
  if (iconEl) iconEl.textContent = icon;
  if (labelEl) labelEl.textContent = label;
  if (hintEl) hintEl.textContent = 'Đang mở · Bấm để đổi chức năng khác';

  if (collapse) {
    chooser.open = false;
    // Giữ trạng thái thu gọn khi popup hoặc side panel được mở lại.
    chrome.storage.local.set({ babylonToolMenuCollapsed: true }).catch(() => {});
  }
}

async function openToolPage(pageId, options = {}) {
  syncBaByLonToolChooser(pageId, options.collapseMenu !== false);

  // Không để lỗi phụ của auto-scroll làm vô hiệu hóa toàn bộ menu.
  if (pageId !== 'scrollPage') {
    try {
      await stopBaByLonScrollIfRunning();
    } catch (error) {
      console.warn('[BaByLon] Không thể kiểm tra/dừng auto-scroll:', error);
    }
  }

  document.body.classList.remove('scroll-compact');

  document.querySelectorAll('.tool-page').forEach((page) =>
    page.classList.toggle('active', page.id === pageId)
  );
  document.querySelectorAll('.tool-tab[data-page]').forEach((tab) =>
    tab.classList.toggle('active', tab.dataset.page === pageId)
  );

  await chrome.storage.local.set({ babylonLastTool: pageId });

  if (pageId === 'scrollPage') {
    await refreshScrollPageInfo();
    await syncScrollButtonState();
  }
  if (pageId === 'datePage' && window.BaByLonDateChecker?.onOpen) {
    await window.BaByLonDateChecker.onOpen();
  }
  if (pageId === 'downloadPage' && window.BaByLonVideoDownloader?.onOpen) {
    await window.BaByLonVideoDownloader.onOpen();
  }
  if (pageId === 'seriesDownloadPage' && window.BaByLonSeriesDownloader?.onOpen) {
    await window.BaByLonSeriesDownloader.onOpen();
  }
  if (pageId === 'ipCheckPage' && window.BaByLonIPChecker?.onOpen) {
    await window.BaByLonIPChecker.onOpen();
  }
  if (pageId === 'worldTimePage' && window.BaByLonWorldTime?.onOpen) {
    await window.BaByLonWorldTime.onOpen();
  }
  if (pageId === 'translatorPage' && window.BaByLonTranslator?.onOpen) {
    await window.BaByLonTranslator.onOpen();
  }
  if (pageId === 'qrPage' && window.BaByLonQR?.onOpen) {
    await window.BaByLonQR.onOpen();
  }
  if (pageId === 'flowBatchPage' && window.BaByLonFlowBatch?.onOpen) {
    await window.BaByLonFlowBatch.onOpen();
  }
  if (pageId === 'aiStudioPage' && window.BaByLonAIStudio?.onOpen) {
    await window.BaByLonAIStudio.onOpen();
  }
  if (pageId === 'youtubeVideoPage' && window.BaByLonYoutubeVideoTools?.onOpen) {
    await window.BaByLonYoutubeVideoTools.onOpen();
  }
  if (pageId === 'ytAnalyticsPage' && window.BaByLonYoutubeAnalytics?.onOpen) {
    await window.BaByLonYoutubeAnalytics.onOpen();
  }
}

async function refreshScrollPageInfo() {
  const titleEl = $('scrollPageTitle');
  const urlEl = $('scrollPageUrl');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    titleEl.textContent = tab?.title || 'Trang hiện tại';
    urlEl.textContent = tab?.url || '';
  } catch (_) {
    titleEl.textContent = 'Không đọc được trang hiện tại';
    urlEl.textContent = '';
  }
}

function setScrollStatus(text, type = '') {
  const el = $('scrollStatus');
  el.textContent = text;
  el.className = `scroll-status ${type}`;
}

async function syncScrollButtonState() {
  const button = $('scrollToggleBtn');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) return;
    const response = await chrome.runtime.sendMessage({ type: 'BABYLON_GET_AUTO_SCROLL_STATUS', tabId: tab.id });
    if (response?.ok && response.running) {
      button.textContent = 'DỪNG TỰ CUỘN';
      button.classList.add('running');
      setCompactScrollTabState(true);
      setScrollStatus('Đang tự cuộn • bạn vẫn có thể chọn các chức năng khác.', 'ok');
    } else {
      button.textContent = 'BẮT ĐẦU TỰ CUỘN';
      button.classList.remove('running');
      setCompactScrollTabState(false);
    }
  } catch (_) {
    // Không ảnh hưởng chức năng chính nếu trang không cho kiểm tra trạng thái.
  }
}

async function toggleBaByLonScroll() {
  const button = $('scrollToggleBtn');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Không tìm thấy tab hiện tại.');
    if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
      throw new Error('Chrome không cho phép tự cuộn trên trang hệ thống này. Hãy mở một website bình thường.');
    }

    button.disabled = true;
    setScrollStatus('Đang gửi lệnh tới trang...', '');
    const response = await chrome.runtime.sendMessage({ type: 'BABYLON_TOGGLE_AUTO_SCROLL', tabId: tab.id });
    if (!response?.ok) throw new Error(response?.error || 'Không thể chạy tự cuộn.');

    if (response.status === 'started') {
      button.textContent = 'DỪNG TỰ CUỘN';
      button.classList.add('running');
      setCompactScrollTabState(true);
      setScrollStatus('Đang tự cuộn • chọn chức năng khác sẽ tự dừng.', 'ok');
    } else if (response.status === 'stopping') {
      button.textContent = 'BẮT ĐẦU TỰ CUỘN';
      button.classList.remove('running');
      setCompactScrollTabState(false);
      setScrollStatus('Đang dừng tự cuộn...', 'warn');
    }
  } catch (error) {
    setScrollStatus(error?.message || String(error), 'error');
  } finally {
    button.disabled = false;
  }
}


async function scrollBaByLonToTop() {
  const button = $('scrollTopBtn');
  const toggleButton = $('scrollToggleBtn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('Không tìm thấy tab hiện tại.');
    }

    if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
      throw new Error('Chrome không cho phép cuộn trên trang hệ thống này.');
    }

    button.disabled = true;
    setScrollStatus('Đang đưa trang về đầu...', '');

    const response = await chrome.runtime.sendMessage({
      type: 'BABYLON_SCROLL_TO_TOP',
      tabId: tab.id
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Không thể cuộn lên đầu trang.');
    }

    // Nếu đang tự cuộn, lệnh "lên đầu" cũng dừng nó.
    if (toggleButton) {
      toggleButton.textContent = 'BẮT ĐẦU TỰ CUỘN';
      toggleButton.classList.remove('running');
    }
    setCompactScrollTabState(false);

    setScrollStatus(
      response.stoppedAutoScroll
        ? 'Đã dừng tự cuộn và đưa trang lên đầu.'
        : 'Đã đưa trang lên đầu.',
      'ok'
    );
  } catch (error) {
    setScrollStatus(error?.message || String(error), 'error');
  } finally {
    button.disabled = false;
  }
}


function detectBaByLonPlatform(url = '') {
  try {
    if (/^(chrome|edge|about|chrome-extension):/i.test(url)) {
      return { key: 'system', name: 'Trang hệ thống' };
    }
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      return { key: 'youtube', name: 'YouTube' };
    }
    if (host === 'facebook.com' || host === 'm.facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
      return { key: 'facebook', name: 'Facebook' };
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return { key: 'tiktok', name: 'TikTok' };
    }
    if (host === 'douyin.com' || host.endsWith('.douyin.com')) {
      return { key: 'douyin', name: 'Douyin' };
    }
    if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) {
      return { key: 'bilibili', name: 'Bilibili' };
    }
    return { key: 'web', name: 'Website khác' };
  } catch (_) {
    return { key: 'unknown', name: 'Không xác định' };
  }
}


function applyPlatformCardThemes() {
  const palette = {
    youtube: {
      solid: '#ef4444',
      soft: '#fff1f2',
      glow: 'rgba(239,68,68,.20)',
    },
    facebook: {
      solid: '#1877f2',
      soft: '#eff6ff',
      glow: 'rgba(24,119,242,.20)',
    },
    tiktok: {
      solid: '#111827',
      soft: '#f3f4f6',
      glow: 'rgba(17,24,39,.18)',
    },
    all: {
      solid: '#22c55e',
      soft: '#f0fdf4',
      glow: 'rgba(34,197,94,.20)',
    },
    douyin: {
      solid: '#475569',
      soft: '#f8fafc',
      glow: 'rgba(71,85,105,.18)',
    },
    bilibili: {
      solid: '#ec4899',
      soft: '#fdf2f8',
      glow: 'rgba(236,72,153,.20)',
    },
  };

  document.querySelectorAll('.tool-tab[data-platforms]').forEach((tab) => {
    const platforms = (tab.dataset.platforms || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    const colors = platforms
      .map((key) => palette[key]?.solid)
      .filter(Boolean);

    const softColors = platforms
      .map((key) => palette[key]?.soft)
      .filter(Boolean);

    const first = palette[platforms[0]] || {
      solid: '#94a3b8',
      soft: '#f8fafc',
      glow: 'rgba(100,116,139,.16)',
    };

    const ringStops = colors.length
      ? colors
      : ['#cbd5e1', '#cbd5e1'];

    const softStops = softColors.length
      ? softColors
      : ['#ffffff', '#f8fafc'];

    // Với card đa nền tảng, chia màu rõ ràng theo đúng thứ tự badge.
    const ring = ringStops.length === 1
      ? `linear-gradient(135deg, ${ringStops[0]}, ${ringStops[0]})`
      : `linear-gradient(135deg, ${ringStops.join(', ')})`;

    const activeBg = softStops.length === 1
      ? `linear-gradient(135deg, ${softStops[0]}, #ffffff)`
      : `linear-gradient(135deg, ${softStops.join(', ')})`;

    tab.style.setProperty('--platform-ring', ring);
    tab.style.setProperty('--platform-active-bg', activeBg);
    tab.style.setProperty('--platform-glow', first.glow);
    tab.style.setProperty('--platform-accent', first.solid);
  });
}


async function decorateToolsByCurrentPlatform() {
  const pill = $('currentPlatformPill');
  if (!pill) return;

  let platform = { key: 'unknown', name: 'Không xác định' };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    platform = detectBaByLonPlatform(tab?.url || '');
  } catch (_) {}

  pill.textContent = platform.name;
  pill.className = `current-platform-pill ${platform.key}`;

  document.querySelectorAll('.tool-tab[data-platforms]').forEach((tab) => {
    const supported = (tab.dataset.platforms || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    const compatible =
      supported.includes('all') ||
      supported.includes(platform.key);

    tab.classList.toggle('compatible', compatible);
    tab.classList.toggle('not-current', !compatible);

    const names = {
      youtube: 'YouTube',
      facebook: 'Facebook',
      tiktok: 'TikTok',
      douyin: 'Douyin',
      bilibili: 'Bilibili',
      all: 'Tất cả website',
    };
    const supportText = supported.map((x) => names[x] || x).join(' • ');
    tab.title = `Hỗ trợ: ${supportText}${compatible ? ' • Phù hợp với trang hiện tại' : ''}`;
  });
}


window.addEventListener('DOMContentLoaded', async () => {
  await initUiPreferences();
  applyPlatformCardThemes();
  await decorateToolsByCurrentPlatform();
  const chooser = document.getElementById('babylonToolChooser');
  const saved = await chrome.storage.local.get(['babylonLastTool', 'babylonToolMenuCollapsed']);
  if (chooser) {
    chooser.open = saved.babylonToolMenuCollapsed !== true;
    const refreshChooser = () => {
      const action = document.getElementById('babylonToolChooserAction');
      if (action) action.textContent = chooser.open ? 'Thu gọn' : 'Đổi công cụ';
    };
    refreshChooser();
    chooser.addEventListener('toggle', () => {
      refreshChooser();
      chrome.storage.local.set({ babylonToolMenuCollapsed: !chooser.open }).catch(() => {});
    });
  }
  const validPages = [
    'keywordsPage','ytAnalyticsPage','aiStudioPage','youtubeVideoPage','scrollPage','datePage','worldTimePage','downloadPage','seriesDownloadPage','ipCheckPage','twoFactorPage','qrPage','translatorPage','flowBatchPage',
    'newGroupsPage','inviteLikersPage','autoPostPage','approvePage'
  ];
  const pageId = validPages.includes(saved.babylonLastTool) ? saved.babylonLastTool : 'keywordsPage';

  $('tabKeywords').addEventListener('click', () => openToolPage('keywordsPage'));
  $('tabYtAnalytics')?.addEventListener('click', () => openToolPage('ytAnalyticsPage'));
  $('tabYoutubeVideo')?.addEventListener('click', () => openToolPage('youtubeVideoPage'));
  $('tabAiStudio')?.addEventListener('click', () => openToolPage('aiStudioPage'));
  $('tabDate').addEventListener('click', () => openToolPage('datePage'));
  $('tabWorldTime').addEventListener('click', () => openToolPage('worldTimePage'));
  $('tabDownload').addEventListener('click', () => openToolPage('downloadPage'));
  $('tabSeriesDownload')?.addEventListener('click', () => openToolPage('seriesDownloadPage'));
  $('tabIpCheck').addEventListener('click', () => openToolPage('ipCheckPage'));
  $('tabTwoFactor')?.addEventListener('click', () => openToolPage('twoFactorPage'));
  $('tabQr')?.addEventListener('click', () => openToolPage('qrPage'));
  $('tabTranslator')?.addEventListener('click', () => openToolPage('translatorPage'));
  $('tabFlowBatch')?.addEventListener('click', () => openToolPage('flowBatchPage'));
  $('tabNewGroups').addEventListener('click', () => openToolPage('newGroupsPage'));
  $('tabInviteLikers').addEventListener('click', () => openToolPage('inviteLikersPage'));
  $('tabAutoPost').addEventListener('click', () => openToolPage('autoPostPage'));
  $('tabApprove').addEventListener('click', () => openToolPage('approvePage'));

  // Cuộn xuống: vẫn hiển thị TOÀN BỘ các chức năng.
  // Bấm lần đầu = mở trang Cuộn xuống + chạy. Bấm lại = dừng.
  $('tabScroll').addEventListener('click', async () => {
    await openToolPage('scrollPage');
    await toggleBaByLonScroll();
  });

  $('scrollToggleBtn').addEventListener('click', toggleBaByLonScroll);
  $('scrollTopBtn').addEventListener('click', scrollBaByLonToTop);
  await openToolPage(pageId, { collapseMenu: false });
});
