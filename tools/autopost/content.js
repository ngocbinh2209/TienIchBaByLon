(() => {
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const textOf = (el) => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');
const lower = (el) => textOf(el).toLocaleLowerCase('vi');

function normalizeGroupUrl(raw) {
  try {
    const url = new URL(raw, location.origin);
    const match = url.pathname.match(/^\/groups\/([^/]+)/);
    if (!match || ['feed', 'discover', 'joins', 'create'].includes(match[1])) return null;
    return `${url.origin}/groups/${match[1]}`;
  } catch { return null; }
}

const MAX_GROUPS_TO_SCAN = 1100;

function collectGroupsOnPage(seen, groups, limit = MAX_GROUPS_TO_SCAN) {
  let added = 0;
  const main = document.querySelector('[role="main"]') || document.querySelector('main');
  if (!main) return added;
  const anchors = [...main.querySelectorAll('a[href*="/groups/"]')]
    .filter((anchor) => anchor.getClientRects().length > 0)
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.top - br.top || ar.left - br.left;
    });
  for (const anchor of anchors) {
    if (groups.length >= limit) break;
    const url = normalizeGroupUrl(anchor.href);
    if (!url || seen.has(url)) continue;
    const card = anchor.closest('[role="article"]') || anchor.closest('div[style*="border-radius"]') || anchor.parentElement;
    // innerText giữ dấu xuống dòng giữa tên nhóm và thông tin thành viên.
    // Không dùng textOf ở đây vì hàm đó gộp mọi khoảng trắng, khiến một số
    // nhóm có tên dài bị hiểu nhầm là toàn bộ nội dung thẻ và bị bỏ qua.
    const name = (anchor.innerText || anchor.textContent || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || '';
    if (!name || name.length > 200 || !card) continue;
    seen.add(url);
    groups.push({ name, url, order: groups.length + 1 });
    added += 1;
  }
  return added;
}

async function scanGroups(requestedLimit = 100) {
  const groupLimit = Math.min(MAX_GROUPS_TO_SCAN, Math.max(1, Number(requestedLimit) || 100));
  const seen = new Set();
  const groups = [];
  window.scrollTo({ top: 0, behavior: 'auto' });
  await sleep(400);

  let stableAtBottom = 0;
  for (let step = 0; step < 2000 && stableAtBottom < 3 && groups.length < groupLimit; step += 1) {
    const added = collectGroupsOnPage(seen, groups, groupLimit);
    if (added) reportProgress(`Đang quét: đã tìm thấy ${groups.length} nhóm theo thứ tự`);

    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80;
    stableAtBottom = atBottom && added === 0 ? stableAtBottom + 1 : 0;
    if (stableAtBottom >= 3) break;

    // Cuộn bước nhỏ để các danh sách ảo hóa của Facebook không bỏ lọt thẻ
    // nằm giữa hai lần chụp danh sách.
    window.scrollBy({ top: Math.max(260, Math.floor(window.innerHeight * 0.4)), behavior: 'auto' });
    await sleep(500);
  }
  collectGroupsOnPage(seen, groups, groupLimit);
  return groups;
}

function visible(el) { return !!el && el.getClientRects().length > 0; }
function allButtons() { return [...document.querySelectorAll('button,[role="button"]')].filter(visible); }
function findButton(pattern, exact = false) { return allButtons().find((el) => exact ? pattern.test(lower(el)) && lower(el).match(pattern)?.[0] === lower(el) : pattern.test(lower(el))); }

function findJoinButton() { return findButton(/^(tham gia|tham gia nhóm|join|join group)$/); }
function findPendingJoin() { return allButtons().some((el) => /hủy yêu cầu|đang chờ|cancel request|pending/.test(lower(el))); }
function findJoinedButton() { return allButtons().find((el) => /^(đã tham gia|joined)$/.test(lower(el))); }
function findCheckpoint() { return /checkpoint|captcha|xác minh danh tính|kiểm tra bảo mật/i.test(document.body.innerText); }

async function waitFor(fn, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = fn(); if (value) return value; await sleep(250); }
  return null;
}

async function waitForStable(fn, stableMs = 5000, timeout = 40000) {
  const deadline = Date.now() + timeout;
  let stableSince = 0;
  while (Date.now() < deadline) {
    if (fn()) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= stableMs) return true;
    } else {
      stableSince = 0;
    }
    await sleep(300);
  }
  return false;
}

async function checkRecentGroupPost() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const main = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
    const pageText = lower(main);
    if (/không có bài viết nào để hiển thị|no posts to show/.test(pageText)) return { recent: false, evidence: 'không có bài viết' };

    // Facebook có thể bọc thời gian cùng biểu tượng quyền riêng tư trong nhiều
    // phần tử lồng nhau. Đọc toàn vùng nội dung sau khi danh sách tải xong.
    const justNow = pageText.match(/vừa xong|just now/i);
    if (justNow) return { recent: true, evidence: justNow[0] };

    const timePattern = /(\d+)\s*(giây|phút|ph|giờ|seconds?|minutes?|hours?|sec|min|hrs?)/gi;
    for (const match of pageText.matchAll(timePattern)) {
      const amount = Number(match[1]);
      const unit = match[2].toLocaleLowerCase('vi');
      const isHour = /giờ|hours?|hrs?/.test(unit);
      if (!isHour || amount <= 24) return { recent: true, evidence: match[0] };
    }

    // Có bài và thời gian đã chuyển sang đơn vị ngày/tuần/tháng/năm: bài gần
    // nhất đã ngoài cửa sổ 24 giờ nên được phép đăng.
    const oldPost = pageText.match(/\d+\s*(ngày|tuần|tháng|năm|days?|weeks?|months?|years?)/i);
    if (oldPost) return { recent: false, evidence: oldPost[0] };
    await sleep(150);
  }
  // Không xác định được dữ liệu thì ưu tiên chống đăng trùng.
  return { recent: true, evidence: 'Facebook chưa tải hoặc không đọc được thời gian', uncertain: true };
}

function isCaptionDraftVisible(caption) {
  const expected = caption.trim().replace(/\s+/g, ' ').slice(0, 30);
  if (!expected) return false;
  const editors = [...document.querySelectorAll('[data-lexical-editor="true"],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]')];
  return editors.some((editor) => visible(editor) && textOf(editor).includes(expected));
}

function findComposerLauncher() {
  const candidates = [...document.querySelectorAll('[role="button"],div[contenteditable="true"]')].filter(visible);
  return candidates.find((el) => /bạn viết gì|tạo bài viết|write something|create post/.test(`${lower(el)} ${(el.getAttribute('aria-label') || '').toLowerCase()}`));
}

function findDialog() {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
  return dialogs.find((dialog) => /tạo bài viết|create post/i.test(textOf(dialog))) || dialogs.at(-1);
}
function findEditor(dialog) {
  const root = dialog || document;
  const selectors = [
    '[data-lexical-editor="true"]',
    '[data-lexical-editor="true"][contenteditable]',
    '[role="textbox"][contenteditable]',
    '[role="textbox"]',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[contenteditable]:not([contenteditable="false"])',
    '[aria-label*="Tạo bài viết"]',
    '[aria-label*="Bạn viết gì"]',
    '[aria-placeholder*="Tạo bài viết"]',
    '[aria-placeholder*="Bạn viết gì"]'
  ];
  let editors = [...new Set([...root.querySelectorAll(selectors.join(','))])]
    .filter((el) => visible(el) && !['BUTTON', 'INPUT', 'TEXTAREA'].includes(el.tagName));
  if (!editors.length) {
    const placeholder = [...root.querySelectorAll('*')]
      .filter(visible)
      .filter((el) => /tạo bài viết công khai|bạn viết gì|write something/i.test(textOf(el)) && textOf(el).length < 120)
      .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
    if (placeholder) {
      const editableParent = placeholder.closest('[role="textbox"],[contenteditable]');
      // Không dùng parent thông thường: đặt contenteditable lên khối lớn sẽ làm
      // caption sai cỡ chữ và phá bố cục trình soạn bài.
      if (editableParent) editors = [editableParent];
    }
  }
  const preferred = editors.filter((el) => {
    const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('aria-placeholder') || ''} ${el.getAttribute('data-lexical-editor') || ''} ${textOf(el)}`.toLocaleLowerCase('vi');
    return /tạo bài viết|viết gì|create post|write something|true|textbox/.test(label) || el.getAttribute('role') === 'textbox';
  });
  return (preferred.length ? preferred : editors).sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (br.width * br.height) - (ar.width * ar.height);
  })[0];
}

async function focusEditorByPosition(dialog) {
  const rect = dialog.getBoundingClientRect();
  // Vùng soạn thảo nằm ở phần giữa phía trên dialog, trên hàng "Thêm vào bài viết".
  const points = [0.38, 0.45, 0.52];
  for (const ratio of points) {
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height * ratio);
    if (!hit) continue;
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height * ratio }));
    hit.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height * ratio }));
    hit.click();
    await sleep(250);
    const active = document.activeElement;
    const activeIsEditor = active && active !== document.body && dialog.contains(active)
      && (active.getAttribute('role') === 'textbox' || active.hasAttribute('contenteditable'));
    const candidate = activeIsEditor ? active : hit.closest('[role="textbox"],[contenteditable]');
    if (candidate && (candidate.getAttribute('role') === 'textbox' || candidate.hasAttribute('contenteditable'))) return candidate;
  }
  return null;
}

function reportProgress(text) {
  chrome.runtime.sendMessage({ action: 'progress', text });
}

function requestNativeInsert(x, y, text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'nativeInsertText', x, y, text }, (response) => {
      resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : response);
    });
  });
}

function requestNativeComposerFill(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'nativeFillComposer', text }, (response) => {
      resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : response);
    });
  });
}

function requestNativePostClick() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'nativeClickReadyPost' }, (response) => {
      resolve(chrome.runtime.lastError ? { clicked: false, error: chrome.runtime.lastError.message } : response);
    });
  });
}

function requestNativeDiscard() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'nativeDiscardComposer' }, (response) => {
      resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : response);
    });
  });
}

async function discardFailedDraft(caption) {
  await requestNativeDiscard();
  return waitFor(() => !isCaptionDraftVisible(caption || ''), 10000);
}

async function insertCaption(editor, caption, dialog) {
  // Mỗi nhóm chỉ được phép thực hiện đúng một lệnh nhập caption.
  // Không chạy bất kỳ fallback nào vì có thể làm nội dung bị lặp.
  const composerResult = await requestNativeComposerFill(caption);
  await sleep(800);
  return composerResult?.ok === true;
}

async function attachFiles(dialog, media) {
  if (!media?.length) return true;
  const findUploadInput = () => {
    const inputs = [...document.querySelectorAll('input[type="file"]')].filter((el) => !el.disabled);
    return inputs.find((el) => dialog.contains(el) && /image|video/i.test(el.accept || ''))
      || inputs.find((el) => el.multiple && /image|video/i.test(el.accept || ''));
  };
  let input = findUploadInput();
  if (!input) {
    const mediaButton = [...dialog.querySelectorAll('button,[role="button"]')].filter(visible).find((el) => {
      const label = `${textOf(el)} ${el.getAttribute('aria-label') || ''}`.toLocaleLowerCase('vi');
      return /ảnh.*video|photo.*video|ảnh\/video|photo\/video/.test(label);
    });
    if (mediaButton) {
      mediaButton.click();
      input = await waitFor(findUploadInput, 4000);
    }
  }
  if (!input) {
    // Nút ảnh thường là biểu tượng đầu tiên bên phải trong hàng "Thêm vào bài viết".
    const rect = dialog.getBoundingClientRect();
    await requestNativeInsert(rect.left + rect.width * 0.60, rect.top + rect.height * 0.76, '');
    input = await waitFor(findUploadInput, 5000);
  }
  if (!input) return false;
  const transfer = new DataTransfer();
  media.forEach((item) => {
    const binary = atob(item.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    transfer.items.add(new File([bytes], item.name, { type: item.type }));
  });
  input.files = transfer.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(1000);
  return true;
}

async function processGroup({ config, media, group }) {
  if (findCheckpoint()) return { status: 'skipped', message: `${group.name}: gặp CAPTCHA/checkpoint, đã bỏ qua` };
  const composerAvailableBeforeJoin = !!findComposerLauncher();
  if (findPendingJoin() && !composerAvailableBeforeJoin) return { status: 'skipped', message: `${group.name}: yêu cầu tham gia đang chờ duyệt và chưa có quyền đăng` };
  if (findPendingJoin() && composerAvailableBeforeJoin) reportProgress(`${group.name}: yêu cầu tham gia đang chờ nhưng nhóm vẫn cho phép đăng bài`);
  const join = findJoinButton();
  if (composerAvailableBeforeJoin) {
    reportProgress(`${group.name}: đã có quyền tạo bài`);
  }
  if (join && config.joinGroups) {
      join.click();
      reportProgress(`${group.name}: đã bấm nút Tham gia theo tùy chọn`);
      await sleep(1200);
      let dialog = findDialog();
      if (dialog && /trả lời|câu hỏi|answer|question/.test(lower(dialog))) return { status: 'skipped', message: `${group.name}: có câu hỏi tham gia, cần xử lý thủ công` };
      // Một số nhóm hiện hộp quy tắc/xác nhận dù không có câu hỏi.
      if (dialog) {
        const confirmJoin = [...dialog.querySelectorAll('button,[role="button"]')]
          .filter(visible)
          .find((el) => /^(tham gia nhóm|tham gia|gửi|đồng ý và tham gia|join group|submit)$/i.test(textOf(el)) && el.getAttribute('aria-disabled') !== 'true');
        if (confirmJoin) {
          confirmJoin.click();
          await sleep(1000);
        }
      }
      // Facebook cập nhật nút "Tham gia" thành "Đã tham gia" khá chậm.
      await waitFor(() => findJoinedButton() || findPendingJoin() || !findJoinButton(), 15000);
      if (findPendingJoin() && !composerAvailableBeforeJoin) return { status: 'skipped', message: `${group.name}: đã gửi yêu cầu tham gia, đang chờ duyệt` };
      if (findPendingJoin() && composerAvailableBeforeJoin) reportProgress(`${group.name}: đã gửi yêu cầu tham gia; tiếp tục đăng vì nhóm có ô tạo bài`);
      if (!findJoinedButton() && findJoinButton() && !composerAvailableBeforeJoin) return { status: 'skipped', message: `${group.name}: Facebook chưa xác nhận tham gia sau 15 giây` };
      if (!findJoinedButton() && findJoinButton() && composerAvailableBeforeJoin) reportProgress(`${group.name}: chưa xác nhận được trạng thái tham gia; vẫn tiếp tục đăng bài`);
      await sleep(2000);
  } else if (!composerAvailableBeforeJoin && join && !config.joinGroups) {
    return { status: 'skipped', message: `${group.name}: không có ô tạo bài; tùy chọn tham gia đang tắt` };
  }

  const launcher = await waitFor(findComposerLauncher, 8000);
  if (!launcher) return { status: 'skipped', message: `${group.name}: không có khu vực đăng bài` };
  reportProgress(`${group.name}: đã tìm thấy ô tạo bài`);
  launcher.click();
  const dialog = await waitFor(findDialog, 8000);
  if (!dialog) return { status: 'skipped', message: `${group.name}: không mở được hộp tạo bài` };
  let editor = await waitFor(() => findEditor(dialog), 2500);
  if (!editor) editor = await focusEditorByPosition(dialog);
  reportProgress(`${group.name}: chuẩn bị điền ${config.caption?.length || 0} ký tự`);
  if (config.caption) {
    const captionInserted = await insertCaption(editor, config.caption, dialog);
    if (!captionInserted) return { status: 'skipped', message: `${group.name}: Facebook không nhận nội dung caption` };
    reportProgress(`${group.name}: đã điền đầy đủ caption`);
  }
  if (media?.length && !(await attachFiles(dialog, media))) return { status: 'skipped', message: `${group.name}: không tìm thấy nơi tải media` };
  if (media?.length) reportProgress(`${group.name}: đã chọn ${media.length} tệp, đang chờ tải lên`);
  if (media?.length) await sleep(media.some((m) => m.type.startsWith('video/')) ? 8000 : 3000);
  const draftTrackedBeforePost = config.caption ? isCaptionDraftVisible(config.caption) : true;
  if (!draftTrackedBeforePost) return { status: 'manual', message: `${group.name}: không theo dõi được bản nháp trước khi đăng; đã tạm dừng an toàn` };
  reportProgress(`${group.name}: đang chờ Facebook bật nút Đăng`);
  let clicked = false;
  const readyDeadline = Date.now() + (media?.some((m) => m.type.startsWith('video/')) ? 120000 : 60000);
  while (Date.now() < readyDeadline) {
    const result = await requestNativePostClick();
    if (result?.clicked) { clicked = true; break; }
    await sleep(1000);
  }
  if (!clicked) {
    await discardFailedDraft(config.caption);
    return { status: 'skipped', message: `${group.name}: Facebook không bật nút Đăng; đã đóng bản nháp và bỏ qua` };
  }
  reportProgress(`${group.name}: đã click trực tiếp nút Đăng`);
  await sleep(1500);
  return { status: 'success', message: `${group.name}: đã thực hiện click Đăng` };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanGroups') {
    scanGroups(message.limit).then((groups) => sendResponse({ groups }));
    return true;
  }
  if (message.action === 'processGroup') {
    processGroup(message).then((result) => chrome.runtime.sendMessage({ action: 'groupDone', result }));
    sendResponse({ accepted: true });
  }
  if (message.action === 'checkRecentGroupPost') {
    checkRecentGroupPost().then(sendResponse);
    return true;
  }
});

})();
