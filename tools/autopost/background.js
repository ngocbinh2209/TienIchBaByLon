const EMPTY_STATE = { status: 'idle', groups: [], index: 0, searchUrl: '', workTabId: null, phase: '', config: null, recentCheck: { posted: false, pending: false }, stats: { scanned: 0, processed: 0, success: 0, skipped: 0 }, logs: [] };
const RECENT_GROUP_TTL = 24 * 60 * 60 * 1000;
let transitionTimer = null;
let groupCommandInFlight = false;

const getStoredState = () => new Promise((resolve) => chrome.storage.local.get('jobState', (r) => resolve({ ...EMPTY_STATE, ...(r.jobState || {}), stats: { ...EMPTY_STATE.stats, ...(r.jobState?.stats || {}) } })));
const setStoredState = (state) => new Promise((resolve) => chrome.storage.local.set({ jobState: state }, resolve));
const stamp = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

async function readRecentGroupPosts() {
  const stored = await chrome.storage.local.get('recentGroupPosts');
  const now = Date.now();
  const recent = Object.fromEntries(Object.entries(stored.recentGroupPosts || {})
    .filter(([, postedAt]) => Number.isFinite(postedAt) && now - postedAt < RECENT_GROUP_TTL));
  await chrome.storage.local.set({ recentGroupPosts: recent });
  return recent;
}

async function markGroupPosted(url) {
  const recent = await readRecentGroupPosts();
  recent[url] = Date.now();
  await chrome.storage.local.set({ recentGroupPosts: recent });
}

async function mutate(fn) {
  const state = await getStoredState();
  fn(state);
  state.logs = (state.logs || []).slice(-100);
  await setStoredState(state);
  return state;
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => chrome.tabs.sendMessage(tabId, message, (response) => resolve(chrome.runtime.lastError ? null : response)));
}

function debuggerAttach(tabId) {
  return new Promise((resolve, reject) => chrome.debugger.attach({ tabId }, '1.3', () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
}

function debuggerCommand(tabId, method, params) {
  return new Promise((resolve, reject) => chrome.debugger.sendCommand({ tabId }, method, params, (result) => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(result)));
}

function debuggerDetach(tabId) {
  return new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve));
}

async function nativeInsertText(tabId, x, y, value) {
  let attached = false;
  try {
    await debuggerAttach(tabId);
    attached = true;
    await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await debuggerCommand(tabId, 'Input.insertText', { text: value });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    if (attached) await debuggerDetach(tabId);
  }
}

async function nativeFillComposer(tabId, value) {
  let attached = false;
  try {
    await debuggerAttach(tabId);
    attached = true;
    const focusResult = await debuggerCommand(tabId, 'Runtime.evaluate', {
      returnByValue: false,
      expression: `(() => {
        const visible = el => !!el && el.getClientRects().length > 0;
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
        const dialog = dialogs.find(el => /tạo bài viết|create post/i.test(el.innerText || '')) || dialogs.at(-1);
        if (!dialog) return null;
        const selectors = '[data-lexical-editor="true"],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]';
        const editors = [...new Set(dialog.querySelectorAll(selectors))].filter(visible).sort((a, b) => {
          const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
          return (br.width * br.height) - (ar.width * ar.height);
        });
        const editor = editors[0];
        if (!editor) return null;
        editor.click();
        editor.focus();
        const selection = getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        return editor;
      })()`
    });
    const editorObjectId = focusResult?.result?.objectId;
    if (!editorObjectId) return { ok: false, error: 'Không tìm thấy đối tượng editor Lexical trong dialog' };
    // Giữ nguyên tuyệt đối caption: không trim, không gộp khoảng trắng và
    // không tự thêm đoạn trống. Mỗi ký tự xuống dòng là đúng một phím Enter.
    const lines = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0) {
        const enter = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
        await debuggerCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', ...enter });
        await debuggerCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...enter });
      }
      if (lines[index]) {
        await debuggerCommand(tabId, 'Input.insertText', { text: lines[index] });
      }
    }
    return { ok: true, details: { lineCount: lines.length, characterCount: String(value).length } };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    if (attached) await debuggerDetach(tabId);
  }
}

async function nativeClickReadyPost(tabId) {
  let attached = false;
  try {
    await debuggerAttach(tabId);
    attached = true;
    const evaluated = await debuggerCommand(tabId, 'Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const visible = el => !!el && el.getClientRects().length > 0;
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
        const dialog = dialogs.find(el => /tạo bài viết|create post/i.test(el.innerText || '')) || dialogs.at(-1);
        if (!dialog) return { found: false, ready: false, reason: 'no-dialog' };
        const dr = dialog.getBoundingClientRect();
        const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
        const exactPostLabel = el => {
          const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('vi');
          const aria = (el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('vi');
          return text === 'đăng' || text === 'post' || aria === 'đăng' || aria === 'post';
        };
        const matching = buttons.filter(el => {
          const r = el.getBoundingClientRect();
          const centerX = r.left + r.width / 2;
          const centerY = r.top + r.height / 2;
          return exactPostLabel(el) && centerX >= dr.left && centerX <= dr.right && centerY >= dr.top && centerY <= dr.bottom;
        });
        const button = matching.sort((a,b) => {
          const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
          return (br.width * br.height) - (ar.width * ar.height);
        })[0];
        if (!button) return { found: false, ready: false, reason: 'no-button' };
        const r = button.getBoundingClientRect();
        const background = getComputedStyle(button).backgroundColor || '';
        const channels = background.match(/\\d+/g)?.map(Number) || [];
        const visuallyBlue = channels.length >= 3 && channels[2] > channels[0] * 1.2 && channels[2] > channels[1];
        const ariaReady = button.getAttribute('aria-disabled') !== 'true';
        const ready = !button.disabled && (ariaReady || visuallyBlue);
        if (ready) button.click();
        return { found: true, ready, clicked: ready, visuallyBlue, ariaReady, background, x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`
    });
    const state = evaluated?.result?.value || { found: false, ready: false };
    return state;
  } catch (error) {
    return { found: false, ready: false, error: error.message };
  } finally {
    if (attached) await debuggerDetach(tabId);
  }
}

async function nativeDiscardComposer(tabId) {
  let attached = false;
  try {
    await debuggerAttach(tabId);
    attached = true;
    const closeInfo = await debuggerCommand(tabId, 'Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const visible = el => !!el && el.getClientRects().length > 0;
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
        const dialog = dialogs.find(el => /tạo bài viết|create post/i.test(el.innerText || '')) || dialogs.at(-1);
        if (!dialog) return { closed: true };
        const r = dialog.getBoundingClientRect();
        return { closed: false, x: r.right - 30, y: r.top + 30 };
      })()`
    });
    const close = closeInfo?.result?.value || {};
    if (!close.closed) {
      await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: close.x, y: close.y, button: 'left', clickCount: 1 });
      await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: close.x, y: close.y, button: 'left', clickCount: 1 });
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    const discardInfo = await debuggerCommand(tabId, 'Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const visible = el => !!el && el.getClientRects().length > 0;
        const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
        const button = buttons.find(el => /^(bỏ|bỏ bài viết|discard|discard post)$/i.test((el.innerText || el.textContent || '').trim()));
        if (!button) return { found: false };
        const r = button.getBoundingClientRect();
        return { found: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`
    });
    const discard = discardInfo?.result?.value || {};
    if (discard.found) {
      await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: discard.x, y: discard.y, button: 'left', clickCount: 1 });
      await debuggerCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: discard.x, y: discard.y, button: 'left', clickCount: 1 });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    if (attached) await debuggerDetach(tabId);
  }
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fb-group-poster', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('media');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readMedia() {
  const db = await openMediaDb();
  const files = await new Promise((resolve, reject) => {
    const req = db.transaction('media').objectStore('media').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return Promise.all(files.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return { name: file.name, type: file.type, base64: btoa(binary) };
  }));
}

async function navigateToCurrentGroup() {
  const state = await getStoredState();
  if (state.status !== 'running') return;
  const group = state.groups[state.index];
  if (!group) {
    await mutate((s) => { s.status = 'completed'; s.phase = ''; s.logs.push(`${stamp()} — Hoàn tất ${s.stats.processed} nhóm`); });
    if (state.searchUrl && state.workTabId) chrome.tabs.update(state.workTabId, { url: state.searchUrl });
    notify('Đã xử lý xong danh sách nhóm.');
    return;
  }
  await mutate((s) => { s.phase = 'checking-recent-post'; s.recentCheck = { posted: false, pending: false }; s.logs.push(`${stamp()} — Kết quả ${group.order} (phiên ${s.index + 1}/${s.groups.length}): kiểm tra bài đã đăng tại ${group.name}`); });
  chrome.tabs.update(state.workTabId, { url: `${group.url}/my_posted_content` });
}

async function checkLoadedGroupHistory() {
  if (groupCommandInFlight) return;
  groupCommandInFlight = true;
  const state = await getStoredState();
  const checkingPosted = state.phase === 'checking-recent-post';
  const checkingPending = state.phase === 'checking-pending-post';
  if (state.status !== 'running' || (!checkingPosted && !checkingPending)) { groupCommandInFlight = false; return; }
  const group = state.groups[state.index];
  const response = await sendToTab(state.workTabId, { action: 'checkRecentGroupPost' });
  groupCommandInFlight = false;
  if (checkingPosted && response?.recent) {
    await mutate((s) => { s.logs.push(`${stamp()} — ${group.name}: mục Đã đăng có bài ${response.evidence || ''} dưới 24 giờ; bỏ qua ngay, không cần kiểm tra Đang chờ`); });
    await completeGroup({ status: 'skipped', message: `${group.name}: Đã đăng có bài dưới 24 giờ, bỏ qua nhanh` });
    return;
  }
  if (checkingPosted) {
    await mutate((s) => {
      s.recentCheck = { ...(s.recentCheck || {}), posted: response?.recent === true };
      s.phase = 'checking-pending-post';
      s.logs.push(`${stamp()} — ${group.name}: mục Đã đăng ${response?.recent ? `có bài ${response.evidence || ''} (dưới 24 giờ)` : 'không có bài dưới 24 giờ'}; tiếp tục mục Đang chờ`);
    });
    chrome.tabs.update(state.workTabId, { url: `${group.url}/my_pending_content` });
    return;
  }
  const latest = await getStoredState();
  const postedRecent = latest.recentCheck?.posted === true;
  const pendingRecent = response?.recent === true;
  await mutate((s) => { s.logs.push(`${stamp()} — ${group.name}: mục Đang chờ ${pendingRecent ? `có bài ${response?.evidence || ''} (dưới 24 giờ)` : 'không có bài dưới 24 giờ'}; đã quét đủ 2 mục`); });
  if (postedRecent || pendingRecent) {
    const areas = [postedRecent ? 'Đã đăng' : '', pendingRecent ? 'Đang chờ' : ''].filter(Boolean).join(' và ');
    await completeGroup({ status: 'skipped', message: `${group.name}: mục ${areas} có bài dưới 24 giờ, bỏ qua` });
    return;
  }
  await mutate((s) => { s.phase = 'opening-group'; s.logs.push(`${stamp()} — ${group.name}: không có bài trong 24 giờ, chuẩn bị đăng`); });
  chrome.tabs.update(state.workTabId, { url: group.url });
}

async function processLoadedGroup() {
  if (groupCommandInFlight) return;
  groupCommandInFlight = true;
  const state = await getStoredState();
  if (state.status !== 'running' || state.phase !== 'opening-group') { groupCommandInFlight = false; return; }
  await mutate((s) => { s.phase = 'processing-group'; });
  const media = await readMedia();
  const response = await sendToTab(state.workTabId, { action: 'processGroup', config: state.config, media, group: state.groups[state.index] });
  if (!response) await completeGroup({ status: 'skipped', message: 'Không thể kết nối với trang nhóm' });
}

async function completeGroup(result) {
  groupCommandInFlight = false;
  if (result.status === 'manual') {
    await mutate((s) => {
      s.stats.processed += 1;
      s.stats.skipped += 1;
      s.status = 'paused';
      s.phase = 'manual';
      s.logs.push(`${stamp()} — ${result.message}`);
    });
    notify('Facebook chưa xác nhận đăng bài. Tiện ích đã tạm dừng để không làm mất nội dung.');
    return;
  }
  if (result.status === 'success') {
    const current = await getStoredState();
    const postedGroup = current.groups[current.index];
    if (postedGroup?.url) await markGroupPosted(postedGroup.url);
  }
  const state = await mutate((s) => {
    if (s.phase === 'waiting-return' || !['running', 'paused'].includes(s.status)) return;
    s.stats.processed += 1;
    if (result.status === 'success') s.stats.success += 1; else s.stats.skipped += 1;
    s.logs.push(`${stamp()} — ${result.message}`);
    s.index += 1;
    s.phase = 'waiting-return';
  });
  if (!['running', 'paused'].includes(state.status)) return;
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(async () => {
    const latest = await getStoredState();
    if (latest.status !== 'running') return;
    await mutate((s) => { s.phase = 'returning-search'; });
    chrome.tabs.update(latest.workTabId, { url: latest.searchUrl });
  }, Math.max(5, state.config?.delaySeconds || 15) * 1000);
}

async function notify(text) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Trình đăng bài nhóm', message: text });
}

chrome.runtime.onInstalled.addListener(() => setStoredState(EMPTY_STATE));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.action === 'getState') return sendResponse({ state: await getStoredState() });
    if (message.action === 'start') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith('https://www.facebook.com/search/groups')) return sendResponse({ ok: false, error: 'Hãy mở trang kết quả tìm kiếm Nhóm trên Facebook trước.' });
      await setStoredState({ ...EMPTY_STATE, status: 'scanning', searchUrl: tab.url, workTabId: tab.id, config: message.config, logs: [`${stamp()} — Bắt đầu quét danh sách nhóm`] });
      const requestedLimit = Math.min(100, Math.max(1, Number(message.config?.groupLimit) || 100));
      const skipCount = Math.min(1000, Math.max(0, Number(message.config?.skipCount) || 0));
      const response = await sendToTab(tab.id, { action: 'scanGroups', limit: skipCount + requestedLimit });
      const scannedGroups = response?.groups || [];
      if (!scannedGroups.length) { await mutate((s) => { s.status = 'error'; s.logs.push(`${stamp()} — Không tìm thấy nhóm nào trên màn hình`); }); return sendResponse({ ok: false, error: 'Không tìm thấy nhóm. Hãy cuộn trang để tải danh sách rồi thử lại.' }); }
      const groups = scannedGroups.slice(skipCount, skipCount + requestedLimit);
      const ignored = 0;
      if (!groups.length) {
        await mutate((s) => { s.status = 'completed'; s.logs.push(`${stamp()} — Chỉ tìm thấy ${scannedGroups.length} nhóm, không còn nhóm nào sau khi bỏ qua ${skipCount} nhóm đầu`); });
        return sendResponse({ ok: false, error: `Không còn kết quả sau vị trí ${skipCount}. Facebook chỉ tải được ${scannedGroups.length} nhóm.` });
      }
      groups.forEach((group, index) => { group.sessionOrder = index + 1; });
      await mutate((s) => {
        s.groups = groups;
        s.stats.scanned = groups.length;
        s.status = 'running';
        s.logs.push(`${stamp()} — Đã bỏ qua ${skipCount} nhóm đầu; xử lý ${groups.length} nhóm từ kết quả ${skipCount + 1}`);
      });
      await navigateToCurrentGroup();
      return sendResponse({ ok: true });
    }
    if (message.action === 'groupDone') { await completeGroup(message.result); return sendResponse({ ok: true }); }
    if (message.action === 'progress') {
      await mutate((s) => { s.logs.push(`${stamp()} — ${message.text}`); });
      return sendResponse({ ok: true });
    }
    if (message.action === 'nativeInsertText') {
      const tabId = sender.tab?.id;
      if (!tabId) return sendResponse({ ok: false, error: 'Không xác định được tab Facebook' });
      return sendResponse(await nativeInsertText(tabId, message.x, message.y, message.text || ''));
    }
    if (message.action === 'nativeFillComposer') {
      const tabId = sender.tab?.id;
      if (!tabId) return sendResponse({ ok: false, error: 'Không xác định được tab Facebook' });
      return sendResponse(await nativeFillComposer(tabId, message.text || ''));
    }
    if (message.action === 'nativeClickReadyPost') {
      const tabId = sender.tab?.id;
      if (!tabId) return sendResponse({ found: false, ready: false, error: 'Không xác định được tab Facebook' });
      return sendResponse(await nativeClickReadyPost(tabId));
    }
    if (message.action === 'nativeDiscardComposer') {
      const tabId = sender.tab?.id;
      if (!tabId) return sendResponse({ ok: false, error: 'Không xác định được tab Facebook' });
      return sendResponse(await nativeDiscardComposer(tabId));
    }
    if (message.action === 'togglePause') {
      const state = await mutate((s) => { s.status = s.status === 'paused' ? 'running' : s.status === 'running' ? 'paused' : s.status; s.logs.push(`${stamp()} — ${s.status === 'paused' ? 'Đã tạm dừng' : 'Đã tiếp tục'}`); });
      if (state.status === 'paused') clearTimeout(transitionTimer);
      if (state.status === 'running') {
        if (state.phase === 'waiting-return' || state.phase === 'returning-search') {
          await mutate((s) => { s.phase = 'returning-search'; });
          const tab = await chrome.tabs.get(state.workTabId);
          if (tab.url?.startsWith('https://www.facebook.com/search/groups')) await navigateToCurrentGroup();
          else chrome.tabs.update(state.workTabId, { url: state.searchUrl });
        }
        else if (state.phase === 'checking-recent-post' || state.phase === 'checking-pending-post') {
          const tab = await chrome.tabs.get(state.workTabId);
          const expectedPath = state.phase === 'checking-recent-post' ? '/my_posted_content' : '/my_pending_content';
          if (tab.url?.includes(expectedPath)) checkLoadedGroupHistory();
          else {
            const group = state.groups[state.index];
            if (group) chrome.tabs.update(state.workTabId, { url: `${group.url}${expectedPath}` });
          }
        }
        else if (state.phase === 'opening-group') processLoadedGroup();
      }
      return sendResponse({ ok: true });
    }
    if (message.action === 'stop') { groupCommandInFlight = false; clearTimeout(transitionTimer); const state = await mutate((s) => { s.status = 'stopped'; s.phase = ''; s.logs.push(`${stamp()} — Đã dừng phiên`); }); if (state.searchUrl && state.workTabId) chrome.tabs.update(state.workTabId, { url: state.searchUrl }); return sendResponse({ ok: true }); }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const state = await getStoredState();
  if (tabId !== state.workTabId || state.status !== 'running') return;
  if (state.phase === 'checking-recent-post' && tab.url?.includes('/my_posted_content')) setTimeout(checkLoadedGroupHistory, 250);
  else if (state.phase === 'checking-pending-post' && tab.url?.includes('/my_pending_content')) setTimeout(checkLoadedGroupHistory, 250);
  else if (state.phase === 'opening-group' && tab.url?.includes('/groups/')) setTimeout(processLoadedGroup, 650);
  else if (state.phase === 'returning-search' && tab.url?.startsWith('https://www.facebook.com/search/groups')) setTimeout(navigateToCurrentGroup, 400);
});
