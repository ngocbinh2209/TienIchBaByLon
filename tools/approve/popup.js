const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const scanBtn = document.getElementById('scanBtn');
const autoBtn = document.getElementById('autoBtn');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const cacheInfo = document.getElementById('cacheInfo');
const searchCount = document.getElementById('searchCount');
const approvedCountEl = document.getElementById('approvedCount');
const rejectedCountEl = document.getElementById('rejectedCount');
const totalCountEl = document.getElementById('totalCount');
const approveStatLabel = document.getElementById('approveStatLabel');
const rejectStatLabel = document.getElementById('rejectStatLabel');
const APPROVE_ENGINE_VERSION = '1.42.77';

const GEMINI_SHARED_KEYS_STORAGE = 'babylon_gemini_api_keys_sync_v1';
async function updateSharedGeminiBadge() {
  const badge = document.getElementById('approveSharedAi');
  if (!badge) return;
  try {
    const sync = await chrome.storage.sync.get([GEMINI_SHARED_KEYS_STORAGE]);
    const local = await chrome.storage.local.get([GEMINI_SHARED_KEYS_STORAGE]);
    const syncKeys = Array.isArray(sync[GEMINI_SHARED_KEYS_STORAGE]) ? sync[GEMINI_SHARED_KEYS_STORAGE] : [];
    const localKeys = Array.isArray(local[GEMINI_SHARED_KEYS_STORAGE]) ? local[GEMINI_SHARED_KEYS_STORAGE] : [];
    const keys = syncKeys.length ? syncKeys : localKeys;
    badge.textContent = `🤖 Gemini AI • ${keys.length} API chung • tự chuyển API khi hết quota`;
  } catch (_) {
    badge.textContent = '🤖 Gemini AI • dùng API từ Trung tâm Gemini chung của BaByLon';
  }
}
chrome.storage.onChanged.addListener((changes, areaName) => {
  if ((areaName === 'sync' || areaName === 'local') && changes[GEMINI_SHARED_KEYS_STORAGE]) updateSharedGeminiBadge();
});

let uiTaskId = 0;
let cachedEntries = [];
let currentCacheKey = '';
let currentGroupLabel = '';
let currentCacheMode = 'scan';

function setStatus(text) {
  statusEl.textContent = text;
}


function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDecisionClass(entry) {
  const action = normalizeSearch(entry.actionTaken || '');
  if (action.includes('da duyet')) return 'APPROVE';
  if (action.includes('da tu choi')) return 'REJECT';
  if (action.includes('giu lai')) return 'REVIEW';
  return String(entry.decision || 'REVIEW').toUpperCase();
}

function getStatusLabel(entry) {
  const action = normalizeSearch(entry.actionTaken || '');
  if (action.includes('da duyet')) return 'ĐÃ DUYỆT';
  if (action.includes('da tu choi')) return 'ĐÃ TỪ CHỐI';
  if (action.includes('giu lai')) return 'GIỮ LẠI';
  const decision = getDecisionClass(entry);
  if (decision === 'APPROVE') return 'SẼ DUYỆT';
  if (decision === 'REJECT') return 'SẼ TỪ CHỐI';
  return 'CẦN XEM';
}

function getGroupIdentity(url = '') {
  const match = String(url).match(/facebook\.com\/groups\/([^/?#]+)/i);
  if (!match) return { key: 'fbApproveScanCache:unknown', label: 'Facebook Group' };
  return { key: `fbApproveScanCache:${match[1]}`, label: match[1] };
}

function escapeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        reject(new Error('Không tìm thấy tab đang hoạt động.'));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

async function initCacheContext() {
  try {
    const tab = await getActiveTab();
    const identity = getGroupIdentity(tab.url || '');
    currentCacheKey = identity.key;
    currentGroupLabel = identity.label;
    await loadScanCache();
  } catch (_) {
    currentCacheKey = 'fbApproveScanCache:unknown';
    currentGroupLabel = 'Facebook Group';
  }
}

async function saveScanCache(entries, mode = 'scan') {
  if (!currentCacheKey) await initCacheContext();
  const payload = {
    version: APPROVE_ENGINE_VERSION,
    group: currentGroupLabel,
    mode,
    savedAt: Date.now(),
    entries: Array.isArray(entries) ? entries : [],
  };
  cachedEntries = payload.entries;
  currentCacheMode = mode;
  await chrome.storage.local.set({ [currentCacheKey]: payload });
  updateCacheInfo(payload);
  renderResults();
}

async function loadScanCache() {
  if (!currentCacheKey) return;
  const data = await chrome.storage.local.get(currentCacheKey);
  const payload = data[currentCacheKey];
  if (!payload || !Array.isArray(payload.entries) || payload.version !== APPROVE_ENGINE_VERSION) {
    cachedEntries = [];
    currentCacheMode = 'scan';
    updateCacheInfo(null);
    renderResults();
    return;
  }
  cachedEntries = payload.entries;
  currentCacheMode = payload.mode || 'scan';
  updateCacheInfo(payload);
  renderResults();
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(timestamp));
  } catch (_) {
    return '';
  }
}

function updateCacheInfo(payload) {
  if (!payload || !cachedEntries.length) {
    cacheInfo.textContent = 'Chưa có dữ liệu quét.';
    searchCount.textContent = '';
    return;
  }
  const modeText = payload.mode === 'auto' ? 'kết quả tự động duyệt' : 'kết quả scan';
  cacheInfo.textContent = `Đã lưu ${cachedEntries.length} bài • ${modeText}${payload.savedAt ? ` • ${formatTime(payload.savedAt)}` : ''}`;
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const haystack = normalizeSearch([
    entry.author,
    entry.summary,
    entry.reason,
    entry.actionTaken,
    entry.decision,
    entry.category,
  ].filter(Boolean).join(' '));
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

function filteredEntries() {
  const query = searchInput.value || '';
  const filter = statusFilter.value || 'ALL';
  return cachedEntries.filter((entry) => {
    if (filter !== 'ALL' && getDecisionClass(entry) !== filter) return false;
    return matchesSearch(entry, query);
  });
}

function makeResultItem(entry) {
  const item = document.createElement('article');
  const decision = getDecisionClass(entry);
  item.className = `result-item status-${decision.toLowerCase()}`;

  const top = document.createElement('div');
  top.className = 'result-top';

  const author = document.createElement('strong');
  author.className = 'result-author';
  author.textContent = escapeText(entry.author) || 'Không rõ người đăng';

  const badge = document.createElement('span');
  badge.className = `status-badge badge-${decision.toLowerCase()}`;
  badge.textContent = getStatusLabel(entry);

  top.append(author, badge);

  const summary = document.createElement('div');
  summary.className = 'result-summary';
  summary.textContent = escapeText(entry.summary) || '(Không có nội dung tóm tắt)';

  const reason = document.createElement('div');
  reason.className = 'result-reason';
  reason.textContent = escapeText(entry.reason || entry.actionTaken || '');

  const footer = document.createElement('div');
  footer.className = 'result-footer';

  if (entry.actionTaken) {
    const action = document.createElement('span');
    action.className = 'action-taken';
    action.textContent = entry.actionTaken;
    footer.appendChild(action);
  }

  const locateBtn = document.createElement('button');
  locateBtn.type = 'button';
  locateBtn.className = 'locate-btn';
  locateBtn.textContent = '↗ Tới bài';
  locateBtn.addEventListener('click', async () => {
    locateBtn.disabled = true;
    const old = locateBtn.textContent;
    locateBtn.textContent = 'Đang tìm...';
    try {
      const response = await sendMessageToActiveTab({
        action: 'locateScannedPost',
        postKey: entry.postKey || '',
        permalink: entry.permalink || '',
        author: entry.author || '',
        summary: entry.summary || '',
      });
      if (response?.found) {
        setStatus('✅ Đã đưa tới bài viết trên Facebook.');
      } else {
        setStatus('Không thấy card bài viết đang được Facebook tải. Kết quả quét vẫn được lưu để tra cứu.');
      }
    } catch (error) {
      setStatus('Không thể tới bài: ' + error.message);
    } finally {
      locateBtn.disabled = false;
      locateBtn.textContent = old;
    }
  });
  footer.appendChild(locateBtn);

  item.append(top, summary);
  if (reason.textContent) item.appendChild(reason);
  item.appendChild(footer);
  return item;
}

function updateModerationStats() {
  let approved = 0;
  let rejected = 0;
  const isAuto = currentCacheMode === 'auto';

  cachedEntries.forEach((entry) => {
    const action = normalizeSearch(entry.actionTaken || '');
    if (isAuto) {
      if (action.includes('da duyet')) approved += 1;
      else if (action.includes('da tu choi')) rejected += 1;
    } else {
      const decision = getDecisionClass(entry);
      if (decision === 'APPROVE') approved += 1;
      else if (decision === 'REJECT' || decision === 'REVIEW') rejected += 1;
    }
  });

  approveStatLabel.textContent = isAuto ? 'ĐÃ DUYỆT' : 'SẼ DUYỆT';
  rejectStatLabel.textContent = isAuto ? 'ĐÃ TỪ CHỐI' : 'SẼ TỪ CHỐI';
  approvedCountEl.textContent = String(approved);
  rejectedCountEl.textContent = String(rejected);
  totalCountEl.textContent = String(cachedEntries.length);
}

function renderResults() {
  updateModerationStats();
  const list = filteredEntries();
  resultEl.innerHTML = '';

  if (!cachedEntries.length) {
    searchCount.textContent = '';
    return;
  }

  searchCount.textContent = `${list.length}/${cachedEntries.length} bài`;
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'result-empty';
    empty.textContent = 'Không tìm thấy bài phù hợp.';
    resultEl.appendChild(empty);
    return;
  }

  list.forEach((entry) => resultEl.appendChild(makeResultItem(entry)));
}

// Chỉ module Duyệt bài: nếu trang Facebook pending_posts được F5/Reload,
// background sẽ xóa cache của đúng Group. Nếu side panel đang mở, cập nhật UI ngay.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !currentCacheKey) return;
  const change = changes[currentCacheKey];
  if (!change || change.newValue !== undefined) return;

  cachedEntries = [];
  currentCacheMode = 'scan';
  searchInput.value = '';
  statusFilter.value = 'ALL';
  updateCacheInfo(null);
  renderResults();
  setStatus('🔄 Trang đã tải lại • kết quả quét Duyệt bài trước đó đã được xóa.');
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action !== 'approveScanProgress') return false;
  const found = Number(message.found || 0);
  const expected = Number(message.expected || 0);
  setStatus(message.phase || (expected ? `Đang quét ${found}/${expected} bài...` : `Đang quét ${found} bài...`));
  return false;
});

async function ensureContentScript(tabId) {
  const [check] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.fbGroupAutoMod?.version || window.fbGroupAutoModVersion || '',
  });

  if (!check || check.result !== APPROVE_ENGINE_VERSION) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['tools/approve/content_script.js'],
    });
  }
}

async function sendMessageToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab.url.includes('facebook.com')) {
    throw new Error('Mở trang Facebook Group đang duyệt bài rồi thử lại.');
  }

  const identity = getGroupIdentity(tab.url || '');
  if (identity.key !== currentCacheKey) {
    currentCacheKey = identity.key;
    currentGroupLabel = identity.label;
  }

  await ensureContentScript(tab.id);

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function cancelApproveTask() {
  try { await sendMessageToActiveTab({ action: 'cancelApproveTask' }); } catch (_) {}
}

searchInput.addEventListener('input', renderResults);
statusFilter.addEventListener('change', renderResults);
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  renderResults();
});

scanBtn.addEventListener('click', async () => {
  const taskId = ++uiTaskId;
  await cancelApproveTask();
  scanBtn.disabled = true;
  const oldLabel = scanBtn.textContent;
  scanBtn.textContent = '⏳ Đang quét nhanh...';

  try {
    setStatus('Đang quét toàn bộ bài chờ duyệt...');
    const response = await sendMessageToActiveTab({ action: 'scan' });
    if (taskId !== uiTaskId) return;
    if (response?.error) throw new Error(response.error);
    if (response?.cancelled) {
      setStatus('Đã dừng quét để chuyển sang tác vụ khác.');
      return;
    }
    if (!response || !Array.isArray(response.posts)) throw new Error('Không nhận được dữ liệu từ trang.');

    const posts = response.posts.map((post) => ({ ...post, sourceMode: 'scan' }));
    await saveScanCache(posts, 'scan');
    searchInput.value = '';
    statusFilter.value = 'ALL';
    renderResults();

    const expectedCount = Number(response.expectedCount || 0);
    const scannedCount = Number(response.scannedCount ?? posts.length);
    const exactVerified = response.loadComplete === true && expectedCount > 0 && scannedCount === expectedCount;
    setStatus(expectedCount
      ? (exactVerified
          ? `✅ Đã xác thực đúng ${scannedCount}/${expectedCount} bài • mỗi bài 1 lần.`
          : `⚠️ Đã xác thực ${scannedCount}/${expectedCount} bài • chưa đạt đúng số Facebook báo, không tính là quét đủ.`)
      : `✅ Quét xong ${scannedCount} bài • có thể tìm ngay bên dưới.`);
  } catch (error) {
    if (taskId === uiTaskId) setStatus('Lỗi: ' + error.message);
  } finally {
    if (taskId === uiTaskId) {
      scanBtn.disabled = false;
      scanBtn.textContent = oldLabel;
    }
  }
});

autoBtn.addEventListener('click', async () => {
  const taskId = ++uiTaskId;

  // 1.42.20: Auto TUYỆT ĐỐI không scan/phân loại lại.
  // Nó chỉ lấy đúng danh sách + quyết định đã được tạo bởi nút "Scan bài chờ duyệt".
  if (!cachedEntries.length || currentCacheMode !== 'scan') {
    setStatus('⚠️ Hãy bấm “Scan bài chờ duyệt” trước. Tự động duyệt chỉ thao tác theo danh sách Scan đã có.');
    return;
  }

  const plan = cachedEntries.map((entry, index) => ({
    id: entry.id || index + 1,
    author: entry.author || null,
    authorKey: entry.authorKey || '',
    summary: entry.summary || '',
    decision: String(entry.decision || '').toUpperCase() === 'APPROVE' ? 'APPROVE' : 'REJECT',
    reason: entry.reason || '',
    postKey: entry.postKey || '',
    permalink: entry.permalink || '',
    strongIdentity: entry.strongIdentity || '',
    mediaIdentity: entry.mediaIdentity || '',
    domIdentity: entry.domIdentity || '',
    contentFingerprint: entry.contentFingerprint || '',
    authorConfident: !!entry.authorConfident,
  }));

  autoBtn.disabled = true;
  scanBtn.disabled = true;
  const oldLabel = autoBtn.textContent;
  autoBtn.textContent = '⏳ Đang duyệt theo danh sách...';

  try {
    await cancelApproveTask();
    setStatus(`▶️ Dùng đúng ${plan.length} bài đã Scan • không quét lại, không phân loại lại.`);
    const response = await sendMessageToActiveTab({ action: 'executeScannedPlan', plan });
    if (taskId !== uiTaskId) return;
    if (response?.error) throw new Error(response.error);
    if (!response || !Array.isArray(response.results)) throw new Error('Không nhận được kết quả thao tác từ Facebook.');

    let approved = 0;
    let rejected = 0;
    let unprocessed = 0;
    response.results.forEach((item) => {
      if (/đã duyệt/i.test(item.actionTaken || '')) approved += 1;
      else if (/đã từ chối/i.test(item.actionTaken || '')) rejected += 1;
      else unprocessed += 1;
    });

    // Giữ nguyên decision/reason từ Scan; chỉ cập nhật actionTaken do Facebook xác nhận.
    const byKey = new Map(response.results.map((item) => [item.postKey || `id:${item.id}`, item]));
    const entries = plan.map((planned) => {
      const result = byKey.get(planned.postKey || `id:${planned.id}`) || {};
      return {
        ...planned,
        ...result,
        decision: planned.decision,
        reason: planned.reason,
        sourceMode: 'auto',
      };
    });

    await saveScanCache(entries, 'auto');
    searchInput.value = '';
    statusFilter.value = 'ALL';
    renderResults();
    setStatus(`✅ Xong theo danh sách Scan: ${approved} đã duyệt • ${rejected} đã từ chối${unprocessed ? ` • ${unprocessed} chưa thao tác được` : ''}.`);
  } catch (error) {
    if (taskId === uiTaskId) setStatus('Lỗi: ' + error.message);
  } finally {
    if (taskId === uiTaskId) {
      autoBtn.disabled = false;
      autoBtn.textContent = oldLabel;
      scanBtn.disabled = false;
    }
  }
});

(async function init() {
  await initCacheContext();
  await updateSharedGeminiBadge();
  try {
    const sync = await chrome.storage.sync.get(['babylon_gemini_api_keys_sync_v1']);
    const local = await chrome.storage.local.get(['babylon_gemini_api_keys_sync_v1']);
    const keys = Array.isArray(sync.babylon_gemini_api_keys_sync_v1) && sync.babylon_gemini_api_keys_sync_v1.length
      ? sync.babylon_gemini_api_keys_sync_v1
      : (Array.isArray(local.babylon_gemini_api_keys_sync_v1) ? local.babylon_gemini_api_keys_sync_v1 : []);
    if (!keys.length) setStatus('⚠️ Chưa có Gemini API trong Trung tâm API chung của BaByLon.');
  } catch (_) {}
})();
