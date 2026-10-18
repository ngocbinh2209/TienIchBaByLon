const $ = (id) => document.getElementById(id);
const MEDIA_DB = 'fb-group-poster';
let previewUrls = [];

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMedia(files) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    store.clear();
    [...files].forEach((file, index) => store.put(file, String(index)));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadMedia() {
  const db = await openDb();
  const files = await new Promise((resolve, reject) => {
    const request = db.transaction('media').objectStore('media').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return files;
}

function renderStoredMedia(files) {
  previewUrls.forEach(URL.revokeObjectURL);
  previewUrls = [];
  $('mediaPreview').replaceChildren();
  $('fileNames').textContent = files.length
    ? `Đã lưu ${files.length} tệp: ${files.map((f) => `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`).join(', ')}`
    : 'Chưa chọn tệp';
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const element = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
    element.src = url;
    if (element.tagName === 'VIDEO') element.controls = true;
    $('mediaPreview').appendChild(element);
  });
  $('clearMedia').style.display = files.length ? 'inline-block' : 'none';
}

function saveForm() {
  chrome.storage.local.set({ formConfig: { caption: $('caption').value, joinGroups: $('joinGroups').checked, delaySeconds: $('delay').value, groupLimit: $('groupLimit').value, skipCount: $('skipCount').value } });
}

function loadForm() {
  chrome.storage.local.get('formConfig', (result) => {
    const form = result.formConfig || {};
    if (typeof form.caption === 'string') $('caption').value = form.caption;
    if (typeof form.joinGroups === 'boolean') $('joinGroups').checked = form.joinGroups;
    if (form.delaySeconds) $('delay').value = form.delaySeconds;
    if (form.groupLimit) $('groupLimit').value = form.groupLimit;
    if (form.skipCount !== undefined) $('skipCount').value = form.skipCount;
    $('charCount').textContent = $('caption').value.length;
  });
}

function render(state = {}) {
  const stats = state.stats || {};
  const labels = { idle: 'Đang chờ', scanning: 'Đang quét nhóm...', running: 'Đang chạy...', paused: 'Đã tạm dừng', stopped: 'Đã dừng', completed: 'Đã hoàn tất', error: 'Có lỗi' };
  $('status').textContent = labels[state.status] || state.status || 'Đang chờ';
  if (state.status === 'running' && state.phase === 'checking-recent-post') $('status').textContent = 'Đang kiểm tra: Đã đăng';
  if (state.status === 'running' && state.phase === 'checking-pending-post') $('status').textContent = 'Đang kiểm tra: Đang chờ';
  $('scanned').textContent = `Đã quét: ${stats.scanned || 0}`;
  $('processed').textContent = `Đã xử lý: ${stats.processed || 0}/${stats.scanned || 0}`;
  $('success').textContent = `Đã đăng: ${stats.success || 0}`;
  $('skipped').textContent = `Bỏ qua: ${stats.skipped || 0}`;
  $('scannedValue').textContent = stats.scanned || 0;
  $('processedValue').textContent = stats.processed || 0;
  $('successValue').textContent = stats.success || 0;
  $('skippedValue').textContent = stats.skipped || 0;
  const percent = stats.scanned ? Math.min(100, Math.round(((stats.processed || 0) / stats.scanned) * 100)) : 0;
  $('progressText').textContent = `${percent}%`;
  $('progressFill').style.width = `${percent}%`;
  $('logs').replaceChildren(...(state.logs || []).slice(-12).reverse().map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  $('pause').textContent = state.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng';
  $('start').disabled = ['scanning', 'running', 'paused'].includes(state.status);
}

function getState() { chrome.runtime.sendMessage({ action: 'getState' }, (r) => render(r?.state)); }

$('caption').addEventListener('input', () => { $('charCount').textContent = $('caption').value.length; saveForm(); });
$('joinGroups').addEventListener('change', saveForm);
$('delay').addEventListener('change', saveForm);
$('groupLimit').addEventListener('change', () => {
  $('groupLimit').value = String(Math.min(100, Math.max(1, Number($('groupLimit').value) || 100)));
  saveForm();
});
$('skipCount').addEventListener('change', () => {
  $('skipCount').value = String(Math.min(1000, Math.max(0, Number($('skipCount').value) || 0)));
  saveForm();
});
$('media').addEventListener('change', async () => {
  const files = [...$('media').files];
  const videos = files.filter((f) => f.type.startsWith('video/'));
  if (videos.length && files.length > 1) { $('media').value = ''; return alert('Chỉ được chọn một video hoặc nhiều ảnh.'); }
  await saveMedia(files);
  renderStoredMedia(files);
});

$('clearMedia').addEventListener('click', async () => {
  $('media').value = '';
  await saveMedia([]);
  renderStoredMedia([]);
});

$('resetContent').addEventListener('click', async () => {
  if (!confirm('Xóa toàn bộ caption, media và tùy chọn đã lưu?')) return;
  $('caption').value = '';
  $('charCount').textContent = '0';
  $('joinGroups').checked = false;
  $('delay').value = '15';
  $('groupLimit').value = '100';
  $('skipCount').value = '0';
  $('media').value = '';
  await saveMedia([]);
  await new Promise((resolve) => chrome.storage.local.remove('formConfig', resolve));
  renderStoredMedia([]);
});

$('start').addEventListener('click', async () => {
  const caption = $('caption').value.trim();
  const newFiles = [...$('media').files];
  if (newFiles.length) await saveMedia(newFiles);
  const storedFiles = await loadMedia();
  if (!caption && !storedFiles.length) return alert('Hãy nhập caption hoặc chọn media.');
  saveForm();
  chrome.runtime.sendMessage({ action: 'start', config: { caption, joinGroups: $('joinGroups').checked, delaySeconds: Math.max(5, Number($('delay').value) || 15), groupLimit: Math.min(100, Math.max(1, Number($('groupLimit').value) || 100)), skipCount: Math.min(1000, Math.max(0, Number($('skipCount').value) || 0)), mediaCount: storedFiles.length } }, (r) => {
    if (!r?.ok) alert(r?.error || 'Không thể bắt đầu.');
    getState();
  });
});

$('pause').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'togglePause' }, getState));
$('stop').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'stop' }, getState));
chrome.storage.onChanged.addListener((changes) => { if (changes.jobState) render(changes.jobState.newValue); });
loadForm();
loadMedia().then(renderStoredMedia);
getState();
