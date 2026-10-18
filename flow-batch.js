(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MAX_PROMPTS = 100;
  const DEFAULT_TIMEOUT = 180000;
  const state = {
    queue: [],
    running: false,
    paused: false,
    stopRequested: false,
    flowTabId: null,
    startedAt: 0,
    review: null,
    reviewResolve: null,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function setStatus(message, tone = '') {
    const el = $('flowBatchStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = `flow-batch-status${tone ? ` ${tone}` : ''}`;
  }

  function log(message, tone = '') {
    const box = $('flowBatchLog');
    if (!box) return;
    const row = document.createElement('div');
    row.className = `flow-batch-log-row${tone ? ` ${tone}` : ''}`;
    const now = new Date();
    row.innerHTML = `<span>${now.toLocaleTimeString('vi-VN', { hour12: false })}</span><b>${escapeHtml(message)}</b>`;
    box.prepend(row);
    while (box.children.length > 80) box.lastElementChild?.remove();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }


  function guessImageExtension(image) {
    const src = String(image?.src || image?.preview || '');
    if (/^data:image\/jpeg/i.test(src)) return 'jpg';
    if (/^data:image\/webp/i.test(src)) return 'webp';
    if (/^data:image\/png/i.test(src)) return 'png';
    try {
      const path = new URL(src).pathname.toLowerCase();
      const m = path.match(/\.(png|jpe?g|webp|gif)(?:$|\?)/i);
      if (m) return m[1] === 'jpeg' ? 'jpg' : m[1];
    } catch (_) {}
    return 'png';
  }
  function sanitizeFilename(value) {
    return String(value || 'flow-image')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'flow-image';
  }

  function currentDelimiter() {
    const mode = $('flowBatchDelimiter')?.value || '---';
    if (mode === 'custom') return $('flowBatchCustomDelimiter')?.value || '---';
    return mode;
  }

  function parsePrompts() {
    const raw = $('flowBatchPrompts')?.value || '';
    const delimiter = currentDelimiter();
    let parts = [];
    if (!raw.trim()) return [];

    if (delimiter === 'line') {
      parts = raw.split(/\r?\n/);
    } else if (delimiter === 'blank') {
      parts = raw.split(/\r?\n\s*\r?\n+/);
    } else if (delimiter === '---') {
      parts = raw.split(/\r?\n?\s*---+\s*\r?\n?/);
    } else {
      parts = raw.split(delimiter);
    }

    return parts.map((x) => x.trim()).filter(Boolean).slice(0, MAX_PROMPTS);
  }

  function updateCount() {
    const prompts = parsePrompts();
    const count = $('flowBatchPromptCount');
    if (count) count.textContent = `${prompts.length} prompt${prompts.length >= MAX_PROMPTS ? ` · tối đa ${MAX_PROMPTS}` : ''}`;
    return prompts;
  }

  function updateCustomDelimiterVisibility() {
    const custom = $('flowBatchCustomDelimiter');
    const wrap = $('flowBatchCustomWrap');
    const show = $('flowBatchDelimiter')?.value === 'custom';
    if (custom) custom.hidden = !show;
    if (wrap) wrap.hidden = !show;
  }

  function updateStats() {
    const total = state.queue.length;
    const running = state.queue.filter((x) => x.status === 'running').length;
    const review = state.queue.filter((x) => x.status === 'review').length;
    const done = state.queue.filter((x) => x.status === 'downloaded' || x.status === 'skipped').length;
    const errors = state.queue.filter((x) => x.status === 'error').length;
    const waiting = state.queue.filter((x) => x.status === 'waiting').length;
    if ($('flowBatchStatTotal')) $('flowBatchStatTotal').textContent = String(total);
    if ($('flowBatchStatRunning')) $('flowBatchStatRunning').textContent = String(running);
    if ($('flowBatchStatReview')) $('flowBatchStatReview').textContent = String(review);
    if ($('flowBatchStatDone')) $('flowBatchStatDone').textContent = String(done);
    if ($('flowBatchStatError')) $('flowBatchStatError').textContent = String(errors);
    if ($('flowBatchProgressText')) $('flowBatchProgressText').textContent = total ? `${done + errors}/${total} · chờ ${waiting + review}` : '0/0';
    const pct = total ? Math.min(100, Math.round(((done + errors) / total) * 100)) : 0;
    if ($('flowBatchProgressBar')) $('flowBatchProgressBar').style.width = `${pct}%`;
  }

  function statusLabel(item) {
    if (item.status === 'running') return 'ĐANG TẠO';
    if (item.status === 'review') return 'CHỜ DUYỆT';
    if (item.status === 'downloaded') return 'ĐÃ TẢI';
    if (item.status === 'skipped') return 'BỎ QUA';
    if (item.status === 'error') return 'LỖI';
    if (item.status === 'paused') return 'TẠM DỪNG';
    return 'CHỜ';
  }

  function renderQueue() {
    const grid = $('flowBatchQueue');
    if (!grid) return;
    grid.innerHTML = '';
    if (!state.queue.length) {
      grid.innerHTML = '<div class="flow-batch-empty">Dán prompt rồi bấm <b>TẠO ẢNH TỰ ĐỘNG</b>. BaByLon sẽ tự tạo trong Flow và đưa ảnh về đây để bạn duyệt.</div>';
      updateStats();
      return;
    }

    for (const item of state.queue) {
      const card = document.createElement('article');
      card.className = `flow-batch-item is-${item.status}`;
      card.dataset.index = String(item.index);
      const short = item.prompt.length > 180 ? `${item.prompt.slice(0, 180)}…` : item.prompt;
      const thumb = item.images?.[0]?.preview || item.images?.[0]?.src || '';
      card.innerHTML = `
        ${thumb ? `<img class="flow-batch-item-thumb" src="${escapeHtml(thumb)}" alt="Ảnh Flow #${item.index + 1}">` : ''}
        <div class="flow-batch-item-head">
          <span>#${item.index + 1}</span>
          <b>${statusLabel(item)}</b>
        </div>
        <p title="${escapeHtml(item.prompt)}">${escapeHtml(short)}</p>
        <small>${escapeHtml(item.note || '')}</small>
      `;
      grid.appendChild(card);
    }
    updateStats();
  }

  function refreshItem(index) {
    const item = state.queue[index];
    const card = $('flowBatchQueue')?.querySelector(`[data-index="${index}"]`);
    if (!item || !card) {
      renderQueue();
      return;
    }
    card.className = `flow-batch-item is-${item.status}`;
    const badge = card.querySelector('.flow-batch-item-head b');
    const note = card.querySelector('small');
    if (badge) badge.textContent = statusLabel(item);
    if (note) note.textContent = item.note || '';
    const oldThumb = card.querySelector('.flow-batch-item-thumb');
    const thumb = item.images?.[0]?.preview || item.images?.[0]?.src || '';
    if (thumb && !oldThumb) {
      const img = document.createElement('img');
      img.className = 'flow-batch-item-thumb';
      img.src = thumb;
      img.alt = `Ảnh Flow #${item.index + 1}`;
      card.prepend(img);
    }
    updateStats();
  }

  function buildQueue(prompts = updateCount()) {
    state.queue = prompts.map((prompt, index) => ({ index, prompt, status: 'waiting', note: '', images: [] }));
    renderQueue();
    hideReview();
    if (!prompts.length) {
      setStatus('Chưa có prompt để tạo ảnh.', 'warn');
      return false;
    }
    setStatus(`Đã nhận ${prompts.length} prompt. Bấm TẠO ẢNH TỰ ĐỘNG để BaByLon tự làm phần còn lại.`, 'ok');
    return true;
  }

  async function getSavedProjectUrl() {
    try {
      const x = await chrome.storage.local.get(['flowBatchLastProjectUrl']);
      return /^https:\/\/flow\.google\.com\/project\//i.test(x.flowBatchLastProjectUrl || '') ? x.flowBatchLastProjectUrl : '';
    } catch (_) { return ''; }
  }

  async function rememberProject(tab) {
    if (!tab?.url || !/^https:\/\/flow\.google\.com\/project\//i.test(tab.url)) return;
    try { await chrome.storage.local.set({ flowBatchLastProjectUrl: tab.url }); } catch (_) {}
  }

  async function findFlowTab() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeProject = tabs.find((t) => t.active && /^https:\/\/flow\.google\.com\/project\//i.test(t.url || ''));
    if (activeProject?.id) return activeProject;
    const project = tabs.find((t) => /^https:\/\/flow\.google\.com\/project\//i.test(t.url || ''));
    if (project?.id) return project;
    const anyFlow = tabs.find((t) => /^https:\/\/flow\.google\.com\//i.test(t.url || ''));
    return anyFlow || null;
  }

  async function openFlow() {
    const tab = await findFlowTab();
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { active: true });
      await rememberProject(tab);
      setStatus('Đã chuyển sang Google Flow.', 'ok');
      return tab;
    }
    const saved = await getSavedProjectUrl();
    const created = await chrome.tabs.create({ url: saved || 'https://flow.google.com/' });
    setStatus(saved ? 'Đang mở project Flow đã dùng gần nhất…' : 'Đã mở Google Flow. Chọn project một lần để BaByLon ghi nhớ.', 'ok');
    return created;
  }

  async function inspectFlow() {
    const tab = await findFlowTab();
    if (!tab?.id) {
      state.flowTabId = null;
      const pill = $('flowBatchFlowState');
      if (pill) {
        pill.textContent = 'CHƯA MỞ FLOW';
        pill.className = 'flow-batch-flow-state warn';
      }
      setStatus('Chưa tìm thấy Google Flow.', 'warn');
      return null;
    }
    state.flowTabId = tab.id;
    await rememberProject(tab);
    const pill = $('flowBatchFlowState');
    if (pill) {
      pill.textContent = /^https:\/\/flow\.google\.com\/project\//i.test(tab.url || '') ? 'PROJECT FLOW SẴN SÀNG' : 'FLOW ĐÃ MỞ';
      pill.className = 'flow-batch-flow-state ok';
    }
    setStatus(`Đã tìm thấy Flow: ${tab.title || 'Google Flow'}`, 'ok');
    return tab;
  }

  // Chạy trong MAIN world của Flow: nhập prompt, bấm đúng nút tạo, chờ ảnh render thật sự.
  async function flowPageCreateImage(prompt, timeoutMs) {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const visible = (el) => {
      if (!el || !el.isConnected) return false;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity || 1) > 0 && r.width > 3 && r.height > 3;
    };
    const labelOf = (el) => norm([
      el.getAttribute?.('aria-label'), el.getAttribute?.('data-tooltip'), el.getAttribute?.('title'),
      el.getAttribute?.('placeholder'), el.getAttribute?.('name'), el.innerText, el.textContent,
    ].filter(Boolean).join(' '));
    const deepAll = (selector) => {
      const out = [];
      const roots = [document];
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        try { out.push(...root.querySelectorAll(selector)); } catch (_) {}
        let all = [];
        try { all = root.querySelectorAll('*'); } catch (_) {}
        for (const el of all) if (el.shadowRoot) roots.push(el.shadowRoot);
      }
      return [...new Set(out)];
    };
    const readField = (el) => {
      if (!el) return '';
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return String(el.value || '');
      return String(el.innerText || el.textContent || '');
    };
    const bodyText = () => norm(document.body?.innerText || '');
    const agentSettingsOpen = () => /cài đặt tác nhân|agent settings/.test(bodyText());
    const closeAgentSettings = async () => {
      if (!agentSettingsOpen()) return false;
      const buttons = deepAll('button,[role="button"]')
        .filter(visible)
        .map((el) => ({ el, text: labelOf(el), r: el.getBoundingClientRect() }))
        .filter((x) => /^(close|đóng|x)$|close|đóng/.test(x.text))
        .sort((a, b) => b.r.right - a.r.right || a.r.top - b.r.top);
      if (buttons[0]) { try { buttons[0].el.click(); await wait(180); } catch (_) {} }
      if (agentSettingsOpen()) {
        try {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
          await wait(180);
        } catch (_) {}
      }
      return !agentSettingsOpen();
    };
    const detectHardBlock = () => {
      const strong = [
        'too many requests', 'rate limit', 'unusual traffic', 'quá nhiều yêu cầu', 'thử lại sau', 'bị chặn',
        'verify you are human', 'verify that you are human', 'xác minh bạn là người', 'không phải rô-bốt',
        'not a robot', 'recaptcha'
      ];
      const surfaceText = deepAll('[role="alert"],[role="dialog"],[aria-modal="true"],[aria-live="assertive"],[aria-live="polite"],snackbar,mat-snack-bar-container')
        .filter(visible).map((el) => norm(el.innerText || el.textContent || '')).filter(Boolean).join(' | ');
      const txt = surfaceText || bodyText();
      const hit = strong.find((x) => txt.includes(x));
      if (hit) return hit;
      if (txt.includes('captcha') && /verify|xác minh|robot|rô-bốt|human|người/.test(txt)) return 'captcha verification';
      return '';
    };
    const clickGenerationConfirmation = async () => {
      const panels = deepAll('[role="dialog"],[aria-modal="true"],[role="alertdialog"]')
        .filter(visible)
        .filter((el) => /xác nhận|confirm|trước khi tạo|before creat|before generat/.test(norm(el.innerText || el.textContent || '')));
      for (const panel of panels) {
        const btns = [...panel.querySelectorAll('button,[role="button"]')]
          .filter(visible)
          .map((el) => ({ el, text: labelOf(el), r: el.getBoundingClientRect() }))
          .filter((x) => /^(tạo|create|generate|xác nhận|confirm|tiếp tục|continue)$/.test(x.text))
          .sort((a, b) => b.r.right - a.r.right);
        if (btns[0]) { try { btns[0].el.click(); await wait(220); return true; } catch (_) {} }
      }
      return false;
    };

    const imageKey = (src, w, h) => `${String(src || '').split('#')[0]}|${w || 0}x${h || 0}`;
    const scanImages = () => {
      const found = [];
      const seen = new Set();
      for (const img of deepAll('img')) {
        if (!visible(img)) continue;
        const r = img.getBoundingClientRect();
        const src = String(img.currentSrc || img.src || '');
        const nw = Number(img.naturalWidth || 0), nh = Number(img.naturalHeight || 0);
        const area = r.width * r.height;
        if (!src || /^data:image\/svg/i.test(src)) continue;
        if (r.width < 160 || r.height < 130 || area < 26000) continue;
        if ((nw && nw < 256) || (nh && nh < 256)) continue;
        const context = norm(`${img.alt || ''} ${img.getAttribute('aria-label') || ''} ${img.closest('[role="button"]')?.getAttribute('aria-label') || ''}`);
        if (/avatar|profile|logo|icon|emoji|thumbnail|ảnh đại diện|hồ sơ/.test(context)) continue;
        const key = imageKey(src, nw, nh);
        if (seen.has(key)) continue;
        seen.add(key);
        let score = area;
        if (nw >= 768 && nh >= 512) score += 250000;
        if (/googleusercontent|ggpht|blob:|lh3\./i.test(src)) score += 90000;
        if (r.left > 180 && r.top > 90) score += 35000;
        found.push({ type: 'img', key, src, width: nw || Math.round(r.width), height: nh || Math.round(r.height), score });
      }
      for (const canvas of deepAll('canvas')) {
        if (!visible(canvas)) continue;
        const r = canvas.getBoundingClientRect();
        if (r.width < 200 || r.height < 160 || r.width * r.height < 42000) continue;
        const key = `canvas|${canvas.width || 0}x${canvas.height || 0}|${Math.round(r.left)}:${Math.round(r.top)}`;
        let preview = '';
        try {
          const max = 720;
          const scale = Math.min(1, max / Math.max(canvas.width || r.width, canvas.height || r.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round((canvas.width || r.width) * scale));
          c.height = Math.max(1, Math.round((canvas.height || r.height) * scale));
          c.getContext('2d')?.drawImage(canvas, 0, 0, c.width, c.height);
          preview = c.toDataURL('image/jpeg', .82);
        } catch (_) {}
        found.push({ type: 'canvas', key, src: '', preview, width: canvas.width || Math.round(r.width), height: canvas.height || Math.round(r.height), score: r.width * r.height + 50000 });
      }
      return found.sort((a, b) => b.score - a.score).slice(0, 12);
    };

    const before = scanImages();
    const beforeKeys = new Set(before.map((x) => x.key));

    const findEditors = () => deepAll('textarea,input[type="text"],[contenteditable="true"],[role="textbox"]')
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const text = labelOf(el);
        let score = 0;
        if (/prompt|create|tạo|describe|mô tả|want|muốn|idea|ý tưởng/.test(text)) score += 55;
        if (/search|tìm kiếm|filter|lọc/.test(text)) score -= 120;
        if (el.tagName === 'TEXTAREA') score += 22;
        if (el.getAttribute('contenteditable') === 'true') score += 18;
        if (r.width > 300) score += 12;
        if (r.top > innerHeight * 0.45) score += 12;
        if (r.bottom > innerHeight * 0.70) score += 18;
        return { el, r, score };
      })
      .sort((a, b) => b.score - a.score || b.r.bottom - a.r.bottom);

    let editors = findEditors();
    for (let i = 0; !editors.length && i < 16; i++) { await wait(350); editors = findEditors(); }
    const field = editors[0]?.el;
    if (!field) return { ok: false, error: 'Không tìm thấy ô nhập prompt của Flow.' };

    try {
      field.focus();
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(field, prompt); else field.value = prompt;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const sel = getSelection();
        const range = document.createRange();
        range.selectNodeContents(field);
        sel?.removeAllRanges(); sel?.addRange(range);
        try { document.execCommand('insertText', false, prompt); }
        catch (_) { field.textContent = prompt; }
        field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      }
    } catch (error) {
      return { ok: false, error: `Không điền được prompt: ${error?.message || error}` };
    }

    await wait(420);
    const typed = norm(readField(field));
    const wanted = norm(prompt);
    if (!typed || (!typed.includes(wanted.slice(0, Math.min(40, wanted.length))) && wanted.length > 8)) {
      return { ok: false, error: 'Flow chưa nhận nội dung prompt vào ô nhập.' };
    }

    const fr = field.getBoundingClientRect();
    let composer = field.parentElement;
    for (let depth = 0; composer && depth < 8; depth++, composer = composer.parentElement) {
      const r = composer.getBoundingClientRect();
      const btns = [...composer.querySelectorAll('button,[role="button"]')].filter(visible);
      const hasLowerRightAction = btns.some((btn) => {
        const br = btn.getBoundingClientRect();
        const cx = (br.left + br.right) / 2, cy = (br.top + br.bottom) / 2;
        return cx >= fr.right - 180 && cy >= fr.bottom - 100 && cy <= fr.bottom + 160;
      });
      if (btns.length >= 2 && hasLowerRightAction && r.width >= Math.max(280, fr.width * .85) && r.height >= 55 && r.height <= 420) break;
    }
    if (!composer || composer === document.body || composer === document.documentElement) composer = null;

    const candidatePool = (composer ? [...composer.querySelectorAll('button,[role="button"]')] : deepAll('button,[role="button"]'))
      .filter((el) => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true')
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        return cx >= fr.left + Math.max(120, fr.width * .42) && cx <= fr.right + 150 && cy >= fr.top - 70 && cy <= fr.bottom + 135;
      });
    const maxRight = candidatePool.length ? Math.max(...candidatePool.map((el) => el.getBoundingClientRect().right)) : fr.right;
    const candidates = candidatePool.map((el) => {
      const r = el.getBoundingClientRect(), text = labelOf(el), html = norm(el.innerHTML || '');
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      let score = 0;
      const badControl = /settings|setting|cài đặt|tác nhân|agent|option|tuỳ chọn|tùy chọn|control|điều khiển|aspect|ratio|tỷ lệ|model|mô hình|attach|đính kèm|upload|tải lên|plus|thêm/.test(`${text} ${html}`);
      if (badControl) score -= 500;
      if (el.getAttribute('type') === 'submit') score += 260;
      if (/^(send|submit|create|generate|run|go|gửi|tạo|bắt đầu)$/.test(text)) score += 210;
      else if (/send|submit|generate|create|tạo ảnh|gửi|arrow forward|arrow_forward|arrow right|east/.test(text)) score += 145;
      if (/close|đóng|cancel|hủy|clear|xóa|delete|remove|dismiss|thoát/.test(text)) score -= 300;
      if (r.right >= maxRight - 5) score += 190; else if (r.right >= maxRight - 55) score += 45;
      if (cx >= fr.right - 115) score += 70;
      if (r.right >= fr.right - 20) score += 55;
      if (cy >= fr.bottom - 85 && cy <= fr.bottom + 110) score += 55;
      if (r.width >= 28 && r.width <= 72 && r.height >= 28 && r.height <= 72) score += 30;
      if (Math.abs(r.width - r.height) <= 12) score += 18;
      if (el.querySelector('svg')) score += 12;
      if (cx >= fr.right - 100 && cy <= fr.top + 55) score -= 120;
      if (composer) score += 40;
      return { el, r, text, score };
    }).filter((x) => x.score > 80).sort((a, b) => b.score - a.score || b.r.right - a.r.right);

    if (!candidates.length) return { ok: false, error: 'Đã điền prompt nhưng không tìm thấy nút mũi tên Tạo của Flow.' };

    const beforeProcessing = /đang tạo|đang xử lý|generating|creating|processing|queued|rendering/.test(bodyText());
    let submitMethod = '';
    let confirmedStart = false;

    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      const c = candidates[i];
      try { c.el.scrollIntoView?.({ block: 'nearest' }); await wait(70); c.el.click(); submitMethod = c.text || 'nút mũi tên Tạo'; await wait(180); }
      catch (_) { continue; }
      if (agentSettingsOpen()) { await closeAgentSettings(); continue; }
      const start = Date.now();
      while (Date.now() - start < 12000) {
        await wait(350);
        if (agentSettingsOpen()) { await closeAgentSettings(); break; }
        await clickGenerationConfirmation();
        const block = detectHardBlock();
        if (block) return { ok: false, blocked: true, error: `Flow báo giới hạn/chặn: ${block}` };
        const nowText = bodyText();
        const nowField = norm(readField(field));
        if (nowField.length < Math.max(3, Math.floor(wanted.length * .20))) { confirmedStart = true; break; }
        if (!beforeProcessing && /đang tạo|đang xử lý|generating|creating|processing|queued|rendering/.test(nowText)) { confirmedStart = true; break; }
        if (!c.el.isConnected || c.el.disabled || c.el.getAttribute('aria-disabled') === 'true') { confirmedStart = true; break; }
      }
      if (confirmedStart) break;
    }

    if (!confirmedStart) return { ok: false, error: 'BaByLon đã điền prompt nhưng Flow chưa xác nhận bắt đầu tạo.' };

    const deadline = Date.now() + Math.max(45000, Number(timeoutMs || 180000));
    const stable = new Map();
    while (Date.now() < deadline) {
      await wait(1000);
      const block = detectHardBlock();
      if (block) return { ok: false, blocked: true, error: `Flow báo giới hạn/chặn: ${block}` };
      await clickGenerationConfirmation();
      const current = scanImages();
      const fresh = current.filter((x) => !beforeKeys.has(x.key));
      for (const img of fresh) stable.set(img.key, (stable.get(img.key) || 0) + 1);
      const ready = fresh.filter((x) => (stable.get(x.key) || 0) >= 2);
      if (ready.length) {
        await wait(1200);
        const finalFresh = scanImages().filter((x) => !beforeKeys.has(x.key));
        const chosen = (finalFresh.length ? finalFresh : ready).slice(0, 4).map((x) => ({
          type: x.type, key: x.key, src: x.src || '', preview: x.preview || x.src || '', width: x.width || 0, height: x.height || 0,
        }));
        return { ok: true, images: chosen, submitMethod, confirmedBy: 'Flow đã render ảnh mới' };
      }
    }

    return { ok: false, timeout: true, error: 'Flow đã bắt đầu tạo nhưng BaByLon chưa thấy ảnh hoàn tất trong thời gian chờ.' };
  }

  async function flowPageDownloadImage(target, filename) {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const src = String(target?.src || '');
    const key = String(target?.key || '');
    const safe = String(filename || 'flow-image.png').replace(/[\\/:*?"<>|]+/g, '_');
    const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const visible = (el) => {
      if (!el || !el.isConnected) return false;
      const st = getComputedStyle(el), r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 3 && r.height > 3;
    };
    const imgs = [...document.querySelectorAll('img')].filter(visible);
    let img = imgs.find((el) => String(el.currentSrc || el.src || '') === src);
    if (!img && key) img = imgs.find((el) => `${String(el.currentSrc || el.src || '').split('#')[0]}|${el.naturalWidth || 0}x${el.naturalHeight || 0}` === key);
    if (img) {
      let node = img;
      for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
        const btns = [...node.querySelectorAll('button,[role="button"],a')].filter(visible).map((el) => ({
          el, text: norm([el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-tooltip'), el.innerText, el.textContent].filter(Boolean).join(' '))
        })).filter((x) => /download|tải xuống|tải ảnh|save image|lưu ảnh/.test(x.text));
        if (btns[0]) { try { btns[0].el.click(); await wait(200); return { ok: true, method: 'Flow download' }; } catch (_) {} }
      }
    }
    if (src) {
      try {
        const a = document.createElement('a');
        a.href = src; a.download = safe; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        return { ok: true, method: 'page link' };
      } catch (e) { return { ok: false, error: e?.message || String(e) }; }
    }
    return { ok: false, error: 'Không còn tìm thấy ảnh trong Flow để tải.' };
  }

  async function createImageOnFlow(tabId, prompt) {
    const result = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', func: flowPageCreateImage, args: [prompt, selectedTimeoutMs()],
    });
    return result?.[0]?.result || { ok: false, error: 'Không nhận được phản hồi từ Flow.' };
  }

  async function downloadViaFlow(tabId, image, filename) {
    const result = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', func: flowPageDownloadImage, args: [image, filename],
    });
    return result?.[0]?.result || { ok: false, error: 'Không thể điều khiển tải ảnh trong Flow.' };
  }

  function selectedTimeoutMs() {
    return Math.max(45000, Number($('flowBatchTimeout')?.value || DEFAULT_TIMEOUT));
  }

  async function waitWhilePaused() {
    while (state.paused && !state.stopRequested) await sleep(250);
  }

  function hideReview() {
    state.review = null;
    const panel = $('flowBatchReviewPanel');
    if (panel) panel.hidden = true;
    const gallery = $('flowBatchReviewGallery');
    if (gallery) gallery.innerHTML = '';
  }

  function showReview(item, images) {
    state.review = { itemIndex: item.index, images, selected: new Set(images.length ? [0] : []) };
    const panel = $('flowBatchReviewPanel');
    const prompt = $('flowBatchReviewPrompt');
    const gallery = $('flowBatchReviewGallery');
    if (!panel || !gallery) return;
    panel.hidden = false;
    if (prompt) prompt.textContent = item.prompt;
    gallery.innerHTML = '';
    images.forEach((img, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `flow-review-thumb${index === 0 ? ' selected' : ''}`;
      button.dataset.index = String(index);
      button.innerHTML = `
        <span class="flow-review-check">${index === 0 ? '✓' : ''}</span>
        ${img.preview || img.src ? `<img src="${escapeHtml(img.preview || img.src)}" alt="Ảnh Flow ${index + 1}">` : '<div class="flow-review-placeholder">Ảnh đã tạo trong Flow</div>'}
        <small>${img.width && img.height ? `${img.width}×${img.height}` : `Ảnh ${index + 1}`}</small>`;
      button.addEventListener('click', () => {
        const selected = state.review?.selected;
        if (!selected) return;
        if (selected.has(index)) selected.delete(index); else selected.add(index);
        if (!selected.size) selected.add(index);
        [...gallery.querySelectorAll('.flow-review-thumb')].forEach((el) => {
          const i = Number(el.dataset.index);
          const on = selected.has(i);
          el.classList.toggle('selected', on);
          const check = el.querySelector('.flow-review-check'); if (check) check.textContent = on ? '✓' : '';
        });
      });
      gallery.appendChild(button);
    });
    panel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  function waitForReviewDecision(item, images) {
    showReview(item, images);
    setStatus(`Ảnh #${item.index + 1} đã tạo xong. Hãy xem ảnh rồi bấm ĐỒNG Ý & TẢI, TẠO LẠI hoặc BỎ QUA.`, 'ok');
    return new Promise((resolve) => { state.reviewResolve = resolve; });
  }

  function finishReview(action) {
    const resolve = state.reviewResolve;
    state.reviewResolve = null;
    if (resolve) resolve(action);
  }

  async function downloadSelectedReview() {
    const review = state.review;
    if (!review) return;
    const item = state.queue[review.itemIndex];
    if (!item) return;
    const selected = [...review.selected].sort((a, b) => a - b);
    if (!selected.length) { setStatus('Hãy chọn ít nhất 1 ảnh để tải.', 'warn'); return; }
    const approve = $('flowBatchApproveBtn');
    if (approve) approve.disabled = true;
    let okCount = 0;
    for (const idx of selected) {
      const img = review.images[idx];
      if (!img) continue;
      const base = `Flow_${String(item.index + 1).padStart(3, '0')}_${sanitizeFilename(item.prompt).slice(0, 42)}_${idx + 1}`;
      const ext = guessImageExtension(img);
      let downloaded = false;
      // Ưu tiên nút tải gốc của Flow để giữ đúng file/chất lượng/định dạng.
      if (state.flowTabId) {
        try {
          const r = await downloadViaFlow(state.flowTabId, img, `${base}.${ext}`);
          downloaded = !!r?.ok;
        } catch (_) {}
      }
      // Fallback: tải trực tiếp URL ảnh nếu Flow không có nút tải quanh ảnh.
      if (!downloaded && (/^https?:/i.test(img.src || '') || /^data:/i.test(img.src || ''))) {
        try {
          await chrome.downloads.download({ url: img.src, filename: `${base}.${ext}`, saveAs: false, conflictAction: 'uniquify' });
          downloaded = true;
        } catch (_) {}
      }
      if (downloaded) okCount++;
    }
    if (approve) approve.disabled = false;
    if (!okCount) {
      setStatus('Không tải được ảnh tự động. Ảnh vẫn còn trong Flow; bạn có thể bấm TẠO LẠI hoặc thử tải trực tiếp trong Flow.', 'error');
      return;
    }
    item.status = 'downloaded';
    item.note = `Đã duyệt và tải ${okCount} ảnh.`;
    refreshItem(item.index);
    log(`#${item.index + 1} đã duyệt và tải ${okCount} ảnh.`, 'ok');
    hideReview();
    finishReview('downloaded');
  }

  async function startRun({ onlyErrors = false } = {}) {
    if (state.running) return;
    const promptsNow = updateCount();
    const existingPrompts = state.queue.map((x) => x.prompt).join('\n---\n');
    const rawNow = promptsNow.join('\n---\n');
    if (!state.queue.length || (!onlyErrors && existingPrompts !== rawNow)) {
      if (!buildQueue(promptsNow)) return;
    }

    let targets;
    if (onlyErrors) {
      targets = state.queue.filter((x) => x.status === 'error');
      for (const item of targets) { item.status = 'waiting'; item.note = ''; item.images = []; refreshItem(item.index); }
    } else {
      targets = state.queue.filter((x) => ['waiting', 'error'].includes(x.status));
    }
    if (!targets.length) { setStatus('Không có prompt nào cần chạy.', 'warn'); return; }

    let flowTab = await findFlowTab();
    if (!flowTab?.id) {
      flowTab = await openFlow();
      await sleep(2600);
      flowTab = await findFlowTab();
    }
    if (!flowTab?.id) {
      setStatus('BaByLon chưa vào được Google Flow. Hãy mở/chọn project Flow một lần rồi bấm lại.', 'error');
      return;
    }
    if (!/^https:\/\/flow\.google\.com\/project\//i.test(flowTab.url || '')) {
      await chrome.tabs.update(flowTab.id, { active: true });
      setStatus('Flow đã mở nhưng chưa ở trong project. Hãy chọn project một lần; BaByLon sẽ ghi nhớ cho lần sau.', 'warn');
      return;
    }

    await rememberProject(flowTab);
    await chrome.tabs.update(flowTab.id, { active: true });
    state.flowTabId = flowTab.id;
    state.running = true;
    state.paused = false;
    state.stopRequested = false;
    state.startedAt = Date.now();
    syncControls();
    setStatus(`BaByLon đang tự tạo ${targets.length} ảnh trong Google Flow…`, 'ok');
    log(`Bắt đầu tự động tạo ${targets.length} ảnh.`);

    const retryCount = Math.max(0, Number($('flowBatchRetry')?.value || 1));

    for (let pos = 0; pos < targets.length; pos++) {
      if (state.stopRequested) break;
      await waitWhilePaused();
      if (state.stopRequested) break;
      const item = targets[pos];

      let completeItem = false;
      while (!completeItem && !state.stopRequested) {
        item.status = 'running';
        item.note = 'BaByLon đang nhập prompt, bấm Tạo và chờ Flow render ảnh…';
        item.images = [];
        refreshItem(item.index);
        hideReview();

        let response = null;
        let attempt = 0;
        for (; attempt <= retryCount; attempt++) {
          try { response = await createImageOnFlow(flowTab.id, item.prompt); }
          catch (error) { response = { ok: false, error: error?.message || String(error) }; }
          if (response?.ok || response?.blocked) break;
          if (attempt < retryCount) {
            item.note = `Chưa thấy ảnh hoàn tất. Thử lại ${attempt + 1}/${retryCount} sau 3 giây…`;
            refreshItem(item.index);
            await sleep(3000);
          }
        }

        if (response?.blocked) {
          item.status = 'error';
          item.note = response.error || 'Flow đang giới hạn/chặn.';
          refreshItem(item.index);
          state.paused = true;
          setStatus('Flow báo giới hạn/chặn. BaByLon đã tự TẠM DỪNG.', 'error');
          log(`#${item.index + 1}: ${item.note}`, 'error');
          syncControls();
          await waitWhilePaused();
          if (state.stopRequested) break;
          continue;
        }

        if (!response?.ok || !Array.isArray(response.images) || !response.images.length) {
          item.status = 'error';
          item.note = response?.error || 'Không lấy được ảnh đã tạo từ Flow.';
          refreshItem(item.index);
          log(`#${item.index + 1} lỗi: ${item.note}`, 'error');
          completeItem = true;
          break;
        }

        item.images = response.images;
        item.status = 'review';
        item.note = `Flow đã tạo ${response.images.length} ảnh · đang chờ bạn duyệt.`;
        refreshItem(item.index);
        log(`#${item.index + 1}: Flow đã tạo ${response.images.length} ảnh, chờ duyệt.`, 'ok');

        const decision = await waitForReviewDecision(item, response.images);
        if (decision === 'regenerate') {
          item.status = 'waiting';
          item.note = 'Bạn yêu cầu tạo lại ảnh.';
          refreshItem(item.index);
          log(`#${item.index + 1}: tạo lại theo yêu cầu.`, 'warn');
          await sleep(1000);
          continue;
        }
        if (decision === 'skipped') {
          item.status = 'skipped';
          item.note = 'Bạn đã bỏ qua ảnh này.';
          refreshItem(item.index);
          completeItem = true;
          break;
        }
        if (decision === 'downloaded') {
          completeItem = true;
          break;
        }
        if (decision === 'stop') break;
      }

      if (state.stopRequested) break;
      if (pos < targets.length - 1) {
        setStatus(`Đã xử lý #${item.index + 1}. BaByLon chuẩn bị prompt tiếp theo…`, 'ok');
        await sleep(1200);
      }
    }

    const stopped = state.stopRequested;
    state.running = false;
    state.paused = false;
    state.stopRequested = false;
    hideReview();
    syncControls();
    updateStats();
    const errors = state.queue.filter((x) => x.status === 'error').length;
    const downloaded = state.queue.filter((x) => x.status === 'downloaded').length;
    const skipped = state.queue.filter((x) => x.status === 'skipped').length;
    setStatus(stopped
      ? `Đã dừng. Đã tải ${downloaded} · bỏ qua ${skipped} · lỗi ${errors}.`
      : `Hoàn tất: đã tải ${downloaded} · bỏ qua ${skipped}${errors ? ` · lỗi ${errors}` : ''}.`,
      errors ? 'warn' : 'ok');
    log(stopped ? 'Đã dừng Flow Auto Creator.' : `Kết thúc: tải ${downloaded}, bỏ qua ${skipped}, lỗi ${errors}.`, errors ? 'warn' : 'ok');
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    syncControls();
    setStatus(state.paused ? 'Đã tạm dừng. BaByLon sẽ không gửi prompt tiếp theo.' : 'Đã tiếp tục.', state.paused ? 'warn' : 'ok');
    log(state.paused ? 'Tạm dừng.' : 'Tiếp tục.', state.paused ? 'warn' : 'ok');
  }

  function stopRun() {
    if (!state.running) return;
    state.stopRequested = true;
    state.paused = false;
    if (state.reviewResolve) finishReview('stop');
    hideReview();
    syncControls();
    setStatus('Đang dừng sau thao tác hiện tại…', 'warn');
  }

  function syncControls() {
    const start = $('flowBatchStartBtn');
    const pause = $('flowBatchPauseBtn');
    const stop = $('flowBatchStopBtn');
    const prepare = $('flowBatchPrepareBtn');
    if (start) start.disabled = state.running;
    if (prepare) prepare.disabled = state.running;
    if (pause) {
      pause.disabled = !state.running;
      pause.textContent = state.paused ? '▶ TIẾP TỤC' : '⏸ TẠM DỪNG';
    }
    if (stop) stop.disabled = !state.running;
  }

  async function saveSettings() {
    try {
      await chrome.storage.local.set({
        flowBatchSettings: {
          delimiter: $('flowBatchDelimiter')?.value || '---',
          customDelimiter: $('flowBatchCustomDelimiter')?.value || '',
          timeout: $('flowBatchTimeout')?.value || String(DEFAULT_TIMEOUT),
          retry: $('flowBatchRetry')?.value || '1',
        },
      });
    } catch (_) {}
  }

  async function restoreSettings() {
    try {
      const saved = await chrome.storage.local.get(['flowBatchSettings']);
      const s = saved.flowBatchSettings || {};
      if ($('flowBatchDelimiter') && s.delimiter) $('flowBatchDelimiter').value = s.delimiter;
      if ($('flowBatchCustomDelimiter')) $('flowBatchCustomDelimiter').value = s.customDelimiter || '';
      if ($('flowBatchTimeout') && s.timeout) $('flowBatchTimeout').value = s.timeout;
      if ($('flowBatchRetry') && s.retry != null) $('flowBatchRetry').value = s.retry;
    } catch (_) {}
    updateCustomDelimiterVisibility();
    updateCount();
  }

  function bind() {
    if (!$('flowBatchPage') || $('flowBatchPage').dataset.bound === '1') return;
    $('flowBatchPage').dataset.bound = '1';

    $('flowBatchPrompts')?.addEventListener('input', updateCount);
    $('flowBatchDelimiter')?.addEventListener('change', () => { updateCustomDelimiterVisibility(); updateCount(); saveSettings(); });
    $('flowBatchCustomDelimiter')?.addEventListener('input', () => { updateCount(); saveSettings(); });
    $('flowBatchTimeout')?.addEventListener('change', saveSettings);
    $('flowBatchRetry')?.addEventListener('change', saveSettings);
    $('flowBatchPrepareBtn')?.addEventListener('click', () => buildQueue());
    $('flowBatchOpenBtn')?.addEventListener('click', openFlow);
    $('flowBatchCheckBtn')?.addEventListener('click', inspectFlow);
    $('flowBatchStartBtn')?.addEventListener('click', () => startRun());
    $('flowBatchPauseBtn')?.addEventListener('click', togglePause);
    $('flowBatchStopBtn')?.addEventListener('click', stopRun);
    $('flowBatchRetryErrorsBtn')?.addEventListener('click', () => startRun({ onlyErrors: true }));
    $('flowBatchApproveBtn')?.addEventListener('click', downloadSelectedReview);
    $('flowBatchRegenerateBtn')?.addEventListener('click', () => { hideReview(); finishReview('regenerate'); });
    $('flowBatchSkipBtn')?.addEventListener('click', () => { hideReview(); finishReview('skipped'); });
    $('flowBatchClearBtn')?.addEventListener('click', () => {
      if (state.running) return;
      state.queue = [];
      if ($('flowBatchPrompts')) $('flowBatchPrompts').value = '';
      hideReview(); renderQueue(); updateCount(); setStatus('Đã xóa prompt và hàng đợi.', '');
    });
    $('flowBatchPromptFile')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      if ($('flowBatchPrompts')) $('flowBatchPrompts').value = text;
      updateCount(); setStatus(`Đã nhập file ${file.name}.`, 'ok'); event.target.value = '';
    });
    $('flowBatchImportBtn')?.addEventListener('click', () => $('flowBatchPromptFile')?.click());
  }

  async function onOpen() {
    bind();
    await restoreSettings();
    await inspectFlow();
    syncControls();
    renderQueue();
    hideReview();
  }

  window.BaByLonFlowBatch = { onOpen };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
