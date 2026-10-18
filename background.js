/* BaByLon core */
/* BaByLon AssistiveTouch bootstrap v1.42.92
 * Content scripts cannot run on chrome:// pages. This bootstrap makes the
 * floating button appear on already-open normal http/https tabs immediately
 * after BaByLon is installed/reloaded, without requiring a manual page refresh.
 */
const BABYLON_ASSISTIVE_SCRIPT = "assistive-touch.js";

function babylonCanInjectAssistive(url = "") {
  // Chrome/Cốc Cốc only allow content-script injection into normal web/file pages.
  // Internal browser pages (chrome://, coccoc://, edge://, extensions store, etc.) are protected.
  return /^(https?|file):\/\//i.test(String(url || ""));
}

async function babylonEnsureAssistiveTouch(tabId, url = "") {
  if (!Number.isInteger(tabId) || !babylonCanInjectAssistive(url)) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [BABYLON_ASSISTIVE_SCRIPT]
    });
    return true;
  } catch (_) {
    // Restricted browser pages, Chrome Web Store and some protected pages reject injection.
    return false;
  }
}

async function babylonBootstrapAssistiveTouch() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
      tabs.map(tab => babylonEnsureAssistiveTouch(tab.id, tab.url))
    );
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  setTimeout(() => babylonBootstrapAssistiveTouch(), 250);
});
chrome.runtime.onStartup.addListener(() => {
  setTimeout(() => babylonBootstrapAssistiveTouch(), 250);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await babylonEnsureAssistiveTouch(tabId, tab?.url);
  } catch (_) {}
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    babylonEnsureAssistiveTouch(tabId, tab?.url || changeInfo.url || "");
  }
});

// Also run whenever the service worker starts (including extension Reload in chrome://extensions).
setTimeout(() => babylonBootstrapAssistiveTouch(), 350);

// Catch tabs/pages that become available after install/reload, including SPA navigations.
chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(() => babylonEnsureAssistiveTouch(tab?.id, tab?.url || tab?.pendingUrl || ""), 350);
});

try {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) {
      setTimeout(() => babylonEnsureAssistiveTouch(details.tabId, details.url || ""), 120);
    }
  });
  chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
    if (details.frameId === 0) {
      babylonEnsureAssistiveTouch(details.tabId, details.url || "");
    }
  });
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0) {
      babylonEnsureAssistiveTouch(details.tabId, details.url || "");
    }
  });
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    if (details.frameId === 0) {
      babylonEnsureAssistiveTouch(details.tabId, details.url || "");
    }
  });
} catch (_) {}

(() => {
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "AUTO_SCROLL_FINISHED" || !sender.tab?.id) return;

  const tabId = sender.tab.id;
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  chrome.action.setTitle({
    tabId,
    title: "Bắt đầu / dừng tự cuộn"
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (![
    'BABYLON_TOGGLE_AUTO_SCROLL',
    'BABYLON_GET_AUTO_SCROLL_STATUS',
    'BABYLON_SCROLL_TO_TOP'
  ].includes(message?.type)) return;

  (async () => {
    const tabId = Number(message.tabId);
    if (!tabId) throw new Error("Không xác định được tab hiện tại.");

    try {
      if (message.type === 'BABYLON_GET_AUTO_SCROLL_STATUS') {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => Boolean(window.__AUTO_SCROLL_TO_END_EXTENSION_V1__?.running)
        });
        sendResponse({ ok: true, running: Boolean(results?.[0]?.result) });
        return;
      }

      if (message.type === 'BABYLON_SCROLL_TO_TOP') {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: scrollBaByLonPageToTop
        });

        const result = results?.[0]?.result || {};

        await chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
        await chrome.action.setTitle({ tabId, title: "BaByLon" }).catch(() => {});

        sendResponse({
          ok: true,
          stoppedAutoScroll: Boolean(result.stoppedAutoScroll)
        });
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: startOrStopAutoScroll
      });

      const status = results?.[0]?.result || "unknown";
      if (status === "started") {
        await chrome.action.setBadgeText({ tabId, text: "ON" });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#16a34a" });
        await chrome.action.setTitle({ tabId, title: "BaByLon — đang tự cuộn" });
      } else if (status === "stopping") {
        await chrome.action.setBadgeText({ tabId, text: "" });
        await chrome.action.setTitle({ tabId, title: "BaByLon" });
      }
      sendResponse({ ok: true, status });
    } catch (error) {
      console.error("BaByLon auto-scroll error:", error);
      try {
        await chrome.action.setBadgeText({ tabId, text: "!" });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" });
      } catch (_) {}
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();

  return true;
});


function scrollBaByLonPageToTop() {
  const STATE_KEY = "__AUTO_SCROLL_TO_END_EXTENSION_V1__";
  const BADGE_ID = "__auto_scroll_to_end_status__";

  const oldState = window[STATE_KEY];
  const stoppedAutoScroll = Boolean(oldState?.running);

  if (oldState?.running) {
    oldState.stopRequested = true;
    oldState.running = false;
    oldState.setStatus?.("Đã dừng tự cuộn", "warning");
  }

  // Xóa badge của chế độ tự cuộn để không che giao diện sau khi về đầu.
  try {
    document.getElementById(BADGE_ID)?.remove();
  } catch (_) {}

  function getRootScroller() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function isVisible(element) {
    if (!element) return false;
    if (element === document.documentElement || element === document.body) return true;

    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findBestScroller() {
    const root = getRootScroller();
    const viewportWidth = window.innerWidth || 1;
    const viewportHeight = window.innerHeight || 1;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    let best = root;
    let bestScore = Math.max(
      1,
      (root?.scrollHeight || 0) - (window.innerHeight || root?.clientHeight || 0)
    );

    for (const element of document.querySelectorAll("body *")) {
      if (!isVisible(element)) continue;

      const style = getComputedStyle(element);
      const scrollable =
        (style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflowY === "overlay") &&
        element.scrollHeight > element.clientHeight + 80;

      if (!scrollable) continue;

      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
      );

      if (
        visibleWidth < viewportWidth * 0.25 ||
        visibleHeight < viewportHeight * 0.25
      ) {
        continue;
      }

      const containsCenter =
        rect.left <= centerX &&
        rect.right >= centerX &&
        rect.top <= centerY &&
        rect.bottom >= centerY;

      let score =
        (element.scrollHeight - element.clientHeight) +
        (visibleWidth * visibleHeight) / Math.max(1, viewportWidth);

      if (containsCenter) score *= 2.5;
      if (element.tagName === "MAIN") score *= 1.5;
      if (element.getAttribute("role") === "main") score *= 1.5;

      if (score > bestScore) {
        bestScore = score;
        best = element;
      }
    }

    return best;
  }

  function moveToTop(element) {
    const root = getRootScroller();
    const isRoot =
      element === root ||
      element === document.documentElement ||
      element === document.body;

    if (isRoot) {
      window.scrollTo({
        top: 0,
        left: window.scrollX || 0,
        behavior: "smooth"
      });

      // Fallback cho một số website/browser.
      if (root) root.scrollTop = 0;
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      return;
    }

    element.scrollTo({
      top: 0,
      left: element.scrollLeft || 0,
      behavior: "smooth"
    });
  }

  const root = getRootScroller();
  const mainScroller = findBestScroller();

  // Cuộn cả root và vùng cuộn chính để hỗ trợ SPA.
  moveToTop(root);
  if (mainScroller && mainScroller !== root) {
    moveToTop(mainScroller);
  }

  return { stoppedAutoScroll };
}

function startOrStopAutoScroll() {
  const STATE_KEY = "__AUTO_SCROLL_TO_END_EXTENSION_V1__";
  const BADGE_ID = "__auto_scroll_to_end_status__";

  const oldState = window[STATE_KEY];
  if (oldState?.running) {
    oldState.stopRequested = true;
    oldState.setStatus?.("Đang dừng…", "warning");
    return "stopping";
  }

  const state = {
    running: true,
    stopRequested: false,
    setStatus: null
  };
  window[STATE_KEY] = state;

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function createStatusBadge() {
    document.getElementById(BADGE_ID)?.remove();

    const host = document.createElement("div");
    host.id = BADGE_ID;
    host.style.position = "fixed";
    host.style.top = "16px";
    host.style.right = "16px";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .box {
          box-sizing: border-box;
          max-width: 320px;
          padding: 10px 14px;
          border-radius: 12px;
          color: #fff;
          background: rgba(17, 24, 39, 0.94);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.30);
          font: 600 13px/1.4 Arial, sans-serif;
          letter-spacing: 0.1px;
          backdrop-filter: blur(8px);
        }
        .success { background: rgba(22, 101, 52, 0.95); }
        .warning { background: rgba(180, 83, 9, 0.95); }
        .error { background: rgba(185, 28, 28, 0.95); }
      </style>
      <div class="box">Đang chuẩn bị tự cuộn…</div>
    `;

    (document.documentElement || document.body).appendChild(host);
    const box = shadow.querySelector(".box");

    return {
      host,
      update(text, type = "") {
        box.textContent = text;
        box.className = `box ${type}`.trim();
      }
    };
  }

  const badge = createStatusBadge();
  state.setStatus = badge.update;

  function isVisible(element) {
    if (!element || element === document.documentElement || element === document.body) {
      return true;
    }

    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getRootScroller() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getMetrics(element) {
    const root = getRootScroller();
    const isRoot =
      element === root ||
      element === document.documentElement ||
      element === document.body;

    if (isRoot) {
      const height = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0,
        root?.scrollHeight || 0
      );

      const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
      const top = window.scrollY ?? root.scrollTop ?? 0;

      return {
        top,
        height,
        viewport,
        remaining: Math.max(0, height - viewport - top),
        isRoot: true
      };
    }

    return {
      top: element.scrollTop,
      height: element.scrollHeight,
      viewport: element.clientHeight || 1,
      remaining: Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop),
      isRoot: false
    };
  }

  function findBestScroller() {
    const root = getRootScroller();
    const viewportWidth = window.innerWidth || 1;
    const viewportHeight = window.innerHeight || 1;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    const candidates = [{ element: root, score: 0 }];

    for (const element of document.querySelectorAll("body *")) {
      if (!isVisible(element)) continue;

      const style = getComputedStyle(element);
      const canScroll =
        (style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflowY === "overlay") &&
        element.scrollHeight > element.clientHeight + 80;

      if (!canScroll) continue;

      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
      );
      const visibleArea = visibleWidth * visibleHeight;
      const viewportArea = viewportWidth * viewportHeight;

      if (
        visibleWidth < viewportWidth * 0.25 ||
        visibleHeight < viewportHeight * 0.25 ||
        visibleArea < viewportArea * 0.12
      ) {
        continue;
      }

      const containsCenter =
        rect.left <= centerX &&
        rect.right >= centerX &&
        rect.top <= centerY &&
        rect.bottom >= centerY;

      let score =
        (element.scrollHeight - element.clientHeight) +
        visibleArea / Math.max(1, viewportWidth);

      if (containsCenter) score *= 2.5;
      if (element.tagName === "MAIN") score *= 1.5;
      if (element.getAttribute("role") === "main") score *= 1.5;

      candidates.push({ element, score });
    }

    const rootMetrics = getMetrics(root);
    candidates[0].score =
      rootMetrics.height > rootMetrics.viewport + 80
        ? (rootMetrics.height - rootMetrics.viewport) * 1.25
        : 1;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || root;
  }

  function scrollElementToBottom(element) {
    const metrics = getMetrics(element);

    if (metrics.isRoot) {
      const target = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0
      );

      window.scrollTo({
        top: target,
        left: window.scrollX,
        behavior: "smooth"
      });
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      left: element.scrollLeft,
      behavior: "smooth"
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
  }

  async function run() {
    const CHECK_INTERVAL_MS = 1000;
    const STABLE_AT_BOTTOM_MS = 15000;
    const BOTTOM_TOLERANCE_PX = 12;

    let stableSince = null;
    let previousHeight = -1;
    let previousScroller = null;

    try {
      while (!state.stopRequested) {
        const root = getRootScroller();
        const scroller = findBestScroller();

        // Cuộn cả trang gốc và vùng cuộn chính để hỗ trợ các web dạng ứng dụng.
        scrollElementToBottom(root);
        if (scroller !== root) {
          scrollElementToBottom(scroller);
        }

        await sleep(CHECK_INTERVAL_MS);

        const currentScroller =
          scroller?.isConnected || scroller === root ? scroller : findBestScroller();
        const metrics = getMetrics(currentScroller);
        const atBottom = metrics.remaining <= BOTTOM_TOLERANCE_PX;

        const scrollerChanged = currentScroller !== previousScroller;
        const heightChanged = Math.abs(metrics.height - previousHeight) > 2;

        if (scrollerChanged || heightChanged || !atBottom) {
          stableSince = null;
        } else if (stableSince === null) {
          stableSince = Date.now();
        }

        if (atBottom) {
          const stableSeconds =
            stableSince === null
              ? 0
              : Math.floor((Date.now() - stableSince) / 1000);

          badge.update(
            `Đang chờ tải thêm… ${stableSeconds}/${STABLE_AT_BOTTOM_MS / 1000} giây`
          );
        } else {
          badge.update(
            `Đang cuộn… còn khoảng ${formatNumber(metrics.remaining)} px`
          );
        }

        if (
          atBottom &&
          stableSince !== null &&
          Date.now() - stableSince >= STABLE_AT_BOTTOM_MS
        ) {
          break;
        }

        previousHeight = metrics.height;
        previousScroller = currentScroller;
      }

      if (state.stopRequested) {
        badge.update("Đã dừng tự cuộn.", "warning");
      } else {
        badge.update("Đã đến cuối trang.", "success");
      }
    } catch (error) {
      console.error("Lỗi khi tự cuộn:", error);
      badge.update("Không thể tiếp tục tự cuộn.", "error");
    } finally {
      state.running = false;

      try {
        chrome.runtime.sendMessage({ type: "AUTO_SCROLL_FINISHED" });
      } catch (_) {
        // Trang có thể đã chuyển hướng hoặc ngữ cảnh tiện ích đã bị đóng.
      }

      setTimeout(() => {
        badge.host?.remove();
        if (window[STATE_KEY] === state) {
          delete window[STATE_KEY];
        }
      }, 3000);
    }
  }

  run();
  return "started";
}

})();

/* Facebook auto group poster */
(() => {
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
  const allowedActions = new Set([
    'getState','start','groupDone','progress','nativeInsertText','nativeFillComposer',
    'nativeClickReadyPost','nativeDiscardComposer','togglePause','stop'
  ]);
  if (!allowedActions.has(message?.action)) return false;
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

})();

/* Facebook group auto moderator • BaByLon 1.42.56 Gemini shared API pool */
(() => {
const GEMINI_KEYS_STORAGE = 'babylon_gemini_api_keys_sync_v1';
const GEMINI_ACTIVE_STORAGE = 'babylon_gemini_active_key_index_v1';
const GEMINI_LEGACY_STORAGE = 'babylon_gemini_api_key';
const DEFAULT_GEMINI_API_KEYS = [];
const MODERATION_MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro'
];

function sanitizeGeminiKeys(value) {
  const raw = Array.isArray(value) ? value : [];
  const out=[]; const seen=new Set();
  for (const item of raw) { const key=String(item||'').trim(); if(!key||seen.has(key)) continue; seen.add(key); out.push(key); }
  return out.slice(0,20);
}

async function storageGet(area, keys) {
  return new Promise((resolve)=>{ try { chrome.storage[area].get(keys,(r)=>resolve(chrome.runtime.lastError?{}:(r||{}))); } catch(_){ resolve({}); } });
}
async function storageSetBoth(obj) {
  await Promise.all([
    new Promise((resolve)=>{ try{chrome.storage.sync.set(obj,()=>resolve());}catch(_){resolve();} }),
    new Promise((resolve)=>{ try{chrome.storage.local.set(obj,()=>resolve());}catch(_){resolve();} })
  ]);
}

async function getSharedGeminiPool() {
  const sync=await storageGet('sync',[GEMINI_KEYS_STORAGE,GEMINI_ACTIVE_STORAGE]);
  const local=await storageGet('local',[GEMINI_KEYS_STORAGE,GEMINI_ACTIVE_STORAGE,GEMINI_LEGACY_STORAGE]);
  const syncKeys=sanitizeGeminiKeys(sync[GEMINI_KEYS_STORAGE]);
  const localKeys=sanitizeGeminiKeys(local[GEMINI_KEYS_STORAGE]);
  const legacy=String(local[GEMINI_LEGACY_STORAGE]||'').trim();
  let keys=sanitizeGeminiKeys([...DEFAULT_GEMINI_API_KEYS,...syncKeys,...localKeys,legacy]);
  let active=Number(sync[GEMINI_ACTIVE_STORAGE]);
  if(!Number.isInteger(active)) active=Number(local[GEMINI_ACTIVE_STORAGE]);
  if(!Number.isInteger(active)) active=0;
  active=Math.max(0,Math.min(active,Math.max(0,keys.length-1)));
  if(keys.length) await storageSetBoth({[GEMINI_KEYS_STORAGE]:keys,[GEMINI_ACTIVE_STORAGE]:active});
  return {keys,active};
}

function safeParseJson(value) {
  try { return JSON.parse(value); }
  catch (_) {
    const match=String(value||'').match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if(match) { try{return JSON.parse(match[0]);}catch(__){} }
    return null;
  }
}

async function listGenerateModels(apiKey) {
  try {
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':apiKey}});
    if(!response.ok) return [];
    const data=await response.json();
    return (Array.isArray(data?.models)?data.models:[])
      .filter((m)=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent'))
      .map((m)=>String(m.name||'').replace(/^models\//,''))
      .filter(Boolean);
  } catch(_) { return []; }
}

async function resolveModerationModels(apiKey) {
  const available=await listGenerateModels(apiKey);
  if(!available.length) return [...MODERATION_MODEL_PRIORITY];
  const out=[];
  for(const model of MODERATION_MODEL_PRIORITY) if(available.includes(model)) out.push(model);
  for(const model of available) if(/flash/i.test(model)&&!out.includes(model)) out.push(model);
  for(const model of available) if(/pro/i.test(model)&&!out.includes(model)) out.push(model);
  for(const model of available) if(!out.includes(model)) out.push(model);
  return out.slice(0,10);
}

function extractGeminiText(data) {
  const parts=data?.candidates?.[0]?.content?.parts;
  if(!Array.isArray(parts)) return '';
  return parts.map((p)=>typeof p?.text==='string'?p.text:'').join('').trim();
}

async function callGeminiWithPool(prompt) {
  const {keys,active}=await getSharedGeminiPool();
  if(!keys.length) throw new Error('Chưa có Gemini API trong Trung tâm API chung của BaByLon.');
  const order=[...Array(keys.length).keys()].map((_,offset)=>(active+offset)%keys.length);
  let lastError=null;

  for(const keyIndex of order) {
    const apiKey=keys[keyIndex];
    const models=await resolveModerationModels(apiKey);
    for(const model of models) {
      try {
        const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          body:JSON.stringify({
            contents:[{role:'user',parts:[{text:prompt}]}],
            generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:3000}
          })
        });
        if(!response.ok) {
          const text=await response.text().catch(()=> '');
          const err=new Error(`Gemini ${response.status}${text?`: ${text.slice(0,240)}`:''}`);
          err.status=response.status; err.model=model; throw err;
        }
        const data=await response.json();
        const content=extractGeminiText(data);
        if(!content) throw new Error(`Gemini ${model} không trả nội dung.`);
        if(keyIndex!==active) await storageSetBoth({[GEMINI_ACTIVE_STORAGE]:keyIndex});
        return {content,model,keyIndex};
      } catch(error) {
        lastError=error;
        const status=Number(error?.status||0);
        if(status===401||status===403) break;      // key lỗi quyền -> API kế tiếp
        if(status===429) continue;                 // model hết quota -> thử model khác, rồi key khác
        if(status===404||status===400) continue;   // model không dùng được -> model khác
        continue;
      }
    }
  }
  throw lastError || new Error('Không còn Gemini API khả dụng trong kho chung.');
}

function buildAiPrompt(posts) {
  const header = `Bạn là trợ lý kiểm duyệt cho Facebook Group chuyên TUYỂN NGƯỜI và TÌM VIỆC tại Việt Nam.
Quy tắc:
- APPROVE: người đăng đang tìm việc/ứng tuyển; ưu tiên duyệt.
- APPROVE: tin tuyển nhân viên/tuyển lao động/phục vụ/bán hàng/sale/shipper/thời vụ/part-time/full-time nếu thực sự là việc làm. Từ "sale", "inbox", "TikTok" một mình KHÔNG phải lý do từ chối.
- REJECT: quảng cáo bán sản phẩm/dịch vụ không liên quan việc làm; vay tiền/giải ngân/đa cấp/scam/cá cược hoặc spam rõ ràng.
- REVIEW: chưa chắc có liên quan việc làm; không tự REJECT chỉ vì thiếu thông tin.
- NEED_INFO: chắc chắn là bài việc làm nhưng cần quản trị viên xem thêm.
Chỉ trả về mảng JSON [{"id": số, "decision": "APPROVE"|"NEED_INFO"|"REJECT"|"REVIEW", "reason": "..."}]. Không thêm nội dung ngoài JSON.`;
  const postsText=posts.map((item)=>`POST_ID:${item.id}\n${item.text}`).join('\n\n---\n\n');
  return `${header}\n\nDưới đây là các bài đăng cần phân loại:\n\n${postsText}`;
}


// Optional multi-AI moderation engine. Automatic mode retains Gemini's existing
// moderation behavior; selecting Groq/OpenRouter explicitly enables these APIs.
async function callSelectedModerationAI(prompt){
  const saved=(await chrome.storage.local.get('babylon_ai_hub_v1')).babylon_ai_hub_v1||{};
  const provider=saved.provider;
  if(!['groq','openrouter'].includes(provider))return callGeminiWithPool(prompt);
  const keys=Array.isArray(saved.keys?.[provider])?saved.keys[provider]:[];
  if(!keys.length)throw Error(`Chưa có API key ${provider} trong Trung tâm AI BaByLon.`);
  const base=provider==='groq'?'https://api.groq.com/openai/v1':'https://openrouter.ai/api/v1';
  let lastError;
  for(const key of keys){
    try{
      const listRes=await fetch(`${base}/models`,{headers:{Authorization:`Bearer ${key}`}});
      const list=await listRes.json().catch(()=>({}));
      if(!listRes.ok)throw Error(`${provider} không lấy được danh sách model (HTTP ${listRes.status}).`);
      let models=(list.data||[]).map(m=>m.id).filter(x=>typeof x==='string');
      if(provider==='openrouter')models=models.filter(x=>x.endsWith(':free'));
      else models=models.filter(x=>!/whisper|tts|guard|vision|playai|orpheus|distil/i.test(x));
      models.sort((a,b)=>Number(/20b|flash|mini|8b/i.test(b))-Number(/20b|flash|mini|8b/i.test(a)));
      for(const model of models.slice(0,3)){
        const response=await fetch(`${base}/chat/completions`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0,max_tokens:3000,stream:false})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok){lastError=Error(`${provider}/${model}: ${data.error?.message||response.status}`);continue;}
        const content=String(data.choices?.[0]?.message?.content||'').trim();
        if(content)return {content,model:`${provider}/${model}`,keyIndex:0};
      }
    }catch(e){lastError=e;}
  }
  throw lastError||Error(`${provider} không trả kết quả kiểm duyệt.`);
}

async function classifyPosts(posts) {
  if(!Array.isArray(posts)||!posts.length) return {results:[]};
  const {content,model,keyIndex}=await callSelectedModerationAI(buildAiPrompt(posts));
  const parsed=safeParseJson(content);
  if(!Array.isArray(parsed)) throw new Error('AI trả JSON kiểm duyệt không hợp lệ; chưa thực hiện duyệt bài.');
  const normalized=parsed.map((item)=>({
    id:item.id,
    decision:String(item.decision||'').trim().toUpperCase(),
    reason:item.reason?String(item.reason).trim():''
  }));
  return {results:normalized,geminiModel:model,geminiApiIndex:keyIndex};
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message.action==='classifyPosts') {
    classifyPosts(message.posts)
      .then((result)=>sendResponse(result))
      .catch((error)=>sendResponse({error:error.message||String(error)}));
    return true;
  }
  return false;
});
})();


/* BaByLon V8 native media downloader
 * Dùng chrome.downloads trực tiếp để tránh lỗi CORS "Failed to fetch"
 * với URL media có chữ ký/ngắn hạn.
 */
(() => {
  const pending = new Map();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "BABYLON_DIRECT_MEDIA_DOWNLOAD") return false;

    (async () => {
      try {
        const url = String(message.url || "");
        const filename = sanitizeFilename(String(message.filename || "video.mp4"));
        if (!/^https?:\/\//i.test(url)) throw new Error("URL media không hợp lệ.");

        // Không dùng fetch/HEAD trước khi tải: nhiều CDN video chặn fetch của extension
        // nhưng Chrome Downloads vẫn tải được bình thường.
        const downloadId = await chrome.downloads.download({
          url,
          filename,
          saveAs: false,
          conflictAction: "uniquify"
        });

        if (!downloadId && downloadId !== 0) throw new Error("Chrome không tạo được lượt tải.");

        pending.set(downloadId, {
          expectedMime: String(message.expectedMime || "").toLowerCase(),
          filename,
          startedAt: Date.now()
        });

        // Kiểm tra metadata sau khi Chrome bắt đầu request thật.
        setTimeout(() => validateStartedDownload(downloadId).catch(() => {}), 1200);

        sendResponse({ ok: true, downloadId, filename });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();

    return true;
  });

  chrome.downloads.onChanged.addListener((delta) => {
    if (!pending.has(delta.id)) return;

    if (delta.state?.current === "complete") {
      setTimeout(() => validateCompletedDownload(delta.id).catch(() => {}), 250);
    } else if (delta.state?.current === "interrupted") {
      pending.delete(delta.id);
    }
  });

  async function validateStartedDownload(id) {
    const items = await chrome.downloads.search({ id });
    const item = items?.[0];
    if (!item || !pending.has(id)) return;

    const mime = String(item.mime || "").toLowerCase();
    // Nếu server trả HTML/text thay vì media, hủy ngay để tránh file giả MP4.
    if (mime && /^(text\/html|text\/plain|application\/json)/i.test(mime)) {
      try { await chrome.downloads.cancel(id); } catch {}
      try { await chrome.downloads.removeFile(id); } catch {}
      try { await chrome.downloads.erase({ id }); } catch {}
      pending.delete(id);
    }
  }

  async function validateCompletedDownload(id) {
    const items = await chrome.downloads.search({ id });
    const item = items?.[0];
    if (!item) {
      pending.delete(id);
      return;
    }

    const mime = String(item.mime || "").toLowerCase();
    const total = Number(item.totalBytes || item.bytesReceived || 0);

    // Chặn file lỗi rất nhỏ hoặc response text bị gắn nhầm đuôi .mp4.
    if (
      total > 0 && total < 1024 ||
      /^(text\/html|text\/plain|application\/json)/i.test(mime)
    ) {
      try { await chrome.downloads.removeFile(id); } catch {}
      try { await chrome.downloads.erase({ id }); } catch {}
    }
    pending.delete(id);
  }

  function sanitizeFilename(name) {
    return String(name || "video.mp4")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/g, "")
      .slice(0, 180) || "video.mp4";
  }
})();



/* BaByLon GoogleVideo fetch compatibility.
 * Only XMLHttpRequest/fetch initiated by extension pages is affected; YouTube's own Media requests stay untouched.
 */
(() => {
  const RULE_ID = 93201;
  async function installGoogleVideoHeaders(){
    try{
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds:[RULE_ID],
        addRules:[{
          id:RULE_ID,priority:1,
          action:{type:'modifyHeaders',requestHeaders:[
            {header:'Referer',operation:'set',value:'https://www.youtube.com/'},
            {header:'Origin',operation:'set',value:'https://www.youtube.com'}
          ]},
          condition:{urlFilter:'||googlevideo.com/',resourceTypes:['xmlhttprequest']}
        }]
      });
    }catch{}
  }
  installGoogleVideoHeaders();
  chrome.runtime.onStartup?.addListener(()=>installGoogleVideoHeaders());
  chrome.runtime.onInstalled?.addListener(()=>installGoogleVideoHeaders());
})();

/* ===== BaByLon Media Capture =====
 * Kiến trúc: gắn Chrome DevTools Protocol vào tab đang xem, quan sát Network,
 * lấy chính URL media mà player đang request. Không phụ thuộc vào DOM/meta giả.
 */
(() => {
  const sessions = new Map(); // tabId -> { items: Map, requests: Map, attached: bool, startedAt }

  const YT_ITAGS = {
    17:{q:"144p",ext:"3gp",kind:"muxed"},
    18:{q:"360p",ext:"mp4",kind:"muxed"},
    22:{q:"720p",ext:"mp4",kind:"muxed"},
    37:{q:"1080p",ext:"mp4",kind:"muxed"},

    160:{q:"144p",ext:"mp4",kind:"video"},
    133:{q:"240p",ext:"mp4",kind:"video"},
    134:{q:"360p",ext:"mp4",kind:"video"},
    135:{q:"480p",ext:"mp4",kind:"video"},
    136:{q:"720p",ext:"mp4",kind:"video"},
    137:{q:"1080p",ext:"mp4",kind:"video"},
    264:{q:"1440p",ext:"mp4",kind:"video"},
    266:{q:"2160p",ext:"mp4",kind:"video"},

    278:{q:"144p",ext:"webm",kind:"video"},
    242:{q:"240p",ext:"webm",kind:"video"},
    243:{q:"360p",ext:"webm",kind:"video"},
    244:{q:"480p",ext:"webm",kind:"video"},
    247:{q:"720p",ext:"webm",kind:"video"},
    248:{q:"1080p",ext:"webm",kind:"video"},
    271:{q:"1440p",ext:"webm",kind:"video"},
    313:{q:"2160p",ext:"webm",kind:"video"},

    139:{q:"48 kbps",ext:"m4a",kind:"audio"},
    140:{q:"128 kbps",ext:"m4a",kind:"audio"},
    141:{q:"256 kbps",ext:"m4a",kind:"audio"},
    249:{q:"50 kbps",ext:"webm",kind:"audio"},
    250:{q:"70 kbps",ext:"webm",kind:"audio"},
    251:{q:"160 kbps",ext:"webm",kind:"audio"},
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message?.type;
    if (!type?.startsWith("BABYLON_MEDIA_")) return false;

    (async () => {
      try {
        if (type === "BABYLON_MEDIA_START") {
          const tabId = Number(message.tabId);
          await startCapture(tabId);
          sendResponse({ok:true});
          return;
        }

        if (type === "BABYLON_MEDIA_GET") {
          const tabId = Number(message.tabId);
          const session = sessions.get(tabId);
          sendResponse({
            ok:true,
            attached:Boolean(session?.attached),
            items: session ? sortItems([...session.items.values()]) : []
          });
          return;
        }

        if (type === "BABYLON_MEDIA_STOP") {
          const tabId = Number(message.tabId);
          await stopCapture(tabId);
          sendResponse({ok:true});
          return;
        }

        if (type === "BABYLON_MEDIA_PREFLIGHT") {
          const item = message.item || {};
          const url = normalizeDownloadUrl(item.url || "", item);
          if (!/^https?:\/\//i.test(url)) throw new Error("URL media không hợp lệ.");
          try {
            const response = await fetch(url, {
              method:"GET",
              headers:{Range:"bytes=0-1"},
              cache:"no-store",
              redirect:"follow",
              credentials:"omit"
            });
            const contentType = response.headers.get("content-type") || "";
            const contentRange = response.headers.get("content-range") || "";
            const contentLength = Number(response.headers.get("content-length") || 0);
            try { await response.arrayBuffer(); } catch {}
            if (!response.ok && response.status !== 206) {
              sendResponse({ok:true,warning:`Fetch thử trả HTTP ${response.status}; BaByLon vẫn cho phép tải bằng luồng đã bắt.`});
              return;
            }
            sendResponse({
              ok:true,
              status:response.status,
              contentType,
              contentRange,
              contentLength
            });
          } catch (error) {
            // Một số CDN chặn fetch của extension nhưng chrome.downloads vẫn tải được.
            sendResponse({ok:true,warning:error?.message || String(error)});
          }
          return;
        }

        if (type === "BABYLON_MEDIA_CLICK") {
          const tabId = Number(message.tabId);
          const x = Number(message.x), y = Number(message.y);
          if (!tabId || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Tọa độ click không hợp lệ.");
          await startCapture(tabId);
          await chrome.debugger.sendCommand({tabId}, "Input.dispatchMouseEvent", {type:"mouseMoved", x, y});
          await chrome.debugger.sendCommand({tabId}, "Input.dispatchMouseEvent", {type:"mousePressed", x, y, button:"left", buttons:1, clickCount:1});
          await chrome.debugger.sendCommand({tabId}, "Input.dispatchMouseEvent", {type:"mouseReleased", x, y, button:"left", buttons:0, clickCount:1});
          sendResponse({ok:true});
          return;
        }

        if (type === "BABYLON_MEDIA_DOWNLOAD") {
          const item = message.item || {};
          const filename = sanitizeFilename(message.filename || `video.${item.ext || "mp4"}`);
          const url = normalizeDownloadUrl(item.url || "", item);

          if (!/^https?:\/\//i.test(url)) throw new Error("URL media không hợp lệ.");

          const id = await chrome.downloads.download({
            url,
            filename,
            saveAs:false,
            conflictAction:"uniquify"
          });

          sendResponse({ok:true, downloadId:id, filename});
          return;
        }

        sendResponse({ok:false, error:"Unknown media action"});
      } catch (error) {
        sendResponse({ok:false, error:error?.message || String(error)});
      }
    })();

    return true;
  });

  chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source?.tabId;
    if (!tabId || !sessions.has(tabId)) return;
    const session = sessions.get(tabId);

    if (method === "Network.requestWillBeSent") {
      const req = params?.request;
      if (!req?.url) return;
      session.requests.set(params.requestId, {
        url:req.url,
        headers:req.headers || {},
        resourceType:params.type || "",
      });
      return;
    }

    if (method === "Network.responseReceived") {
      const response = params?.response;
      if (!response?.url) return;

      const req = session.requests.get(params.requestId) || {};
      const item = classifyResponse(response, req, params.type || "");
      if (!item) return;

      const key = itemKey(item);
      const old = session.items.get(key);
      if (!old || scoreItem(item) >= scoreItem(old)) {
        session.items.set(key, item);
      }
      return;
    }
  });

  chrome.debugger.onDetach.addListener((source) => {
    const tabId = source?.tabId;
    const session = sessions.get(tabId);
    if (session) session.attached = false;
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    sessions.delete(tabId);
  });

  async function startCapture(tabId) {
    if (!tabId) throw new Error("Không tìm thấy tab video.");

    let session = sessions.get(tabId);
    if (!session) {
      session = {items:new Map(), requests:new Map(), attached:false, startedAt:Date.now()};
      sessions.set(tabId, session);
    }

    if (session.attached) return;

    try {
      await chrome.debugger.attach({tabId}, "1.3");
    } catch (error) {
      // Nếu chính extension đã attach từ tool khác, vẫn thử bật Network.
      const text = String(error?.message || error || "");
      if (!/already attached|Another debugger/i.test(text)) throw error;
    }

    try {
      await chrome.debugger.sendCommand({tabId}, "Network.enable", {
        maxTotalBufferSize: 10000000,
        maxResourceBufferSize: 5000000,
      });
      await chrome.debugger.sendCommand({tabId}, "Network.setCacheDisabled", {cacheDisabled:false});
      session.attached = true;
    } catch (error) {
      try { await chrome.debugger.detach({tabId}); } catch {}
      throw new Error("Không bật được bộ bắt Network: " + (error?.message || error));
    }
  }

  async function stopCapture(tabId) {
    const session = sessions.get(tabId);
    if (!session) return;
    if (session.attached) {
      try { await chrome.debugger.detach({tabId}); } catch {}
    }
    sessions.delete(tabId);
  }

  function classifyResponse(response, request, resourceType) {
    const url = response.url || "";
    const mime = String(response.mimeType || header(response.headers, "content-type") || "").toLowerCase();
    const status = Number(response.status || 0);

    if (status && status >= 400) return null;

    const likely =
      /^video\//i.test(mime) ||
      /^audio\//i.test(mime) ||
      /application\/(?:vnd\.apple\.mpegurl|x-mpegurl|dash\+xml)/i.test(mime) ||
      /\.(mp4|m4v|webm|m4a|mp3|m3u8|mpd)(?:\?|$)/i.test(url) ||
      /videoplayback/i.test(url) ||
      /googlevideo\.com/i.test(url) ||
      /fbcdn\.net/i.test(url) ||
      /video\/tos/i.test(url) ||
      /bilivideo/i.test(url);

    if (!likely) return null;

    if (/googleads|doubleclick|pagead/i.test(url)) return null;

    const parsed = safeUrl(url);
    const itag = Number(parsed?.searchParams.get("itag") || 0);
    const yt = YT_ITAGS[itag] || null;

    let kind = "video";
    let quality = "";
    let ext = "";
    let hasAudio = null;
    let hasVideo = null;

    if (yt) {
      kind = yt.kind === "audio" ? "audio" : "video";
      quality = yt.q;
      ext = yt.ext;
      hasAudio = yt.kind === "muxed" || yt.kind === "audio";
      hasVideo = yt.kind === "muxed" || yt.kind === "video";
    } else if (/^audio\//i.test(mime)) {
      kind = "audio"; hasAudio = true; hasVideo = false;
    } else if (/mpegurl|dash\+xml|\.m3u8|\.mpd/i.test(mime + " " + url)) {
      kind = "manifest"; hasAudio = null; hasVideo = null;
    } else {
      kind = "video"; hasVideo = true;
      hasAudio = resourceType === "Media" ? null : null;
    }

    if (!ext) {
      if (/mp4/i.test(mime) || /\.mp4(?:\?|$)/i.test(url)) ext = kind === "audio" ? "m4a" : "mp4";
      else if (/webm/i.test(mime) || /\.webm(?:\?|$)/i.test(url)) ext = "webm";
      else if (/mpeg/i.test(mime) || /\.mp3(?:\?|$)/i.test(url)) ext = "mp3";
      else if (/m3u8/i.test(mime + url)) ext = "m3u8";
      else if (/mpd/i.test(mime + url)) ext = "mpd";
      else ext = kind === "audio" ? "m4a" : "mp4";
    }

    if (!quality) {
      quality =
        parsed?.searchParams.get("quality_label") ||
        parsed?.searchParams.get("quality") ||
        parsed?.searchParams.get("q") ||
        (kind === "audio" ? "Audio" : kind === "manifest" ? "Playlist" : "Video");
    }

    const contentRange = header(response.headers, "content-range");
    const totalBytes = totalFromRange(contentRange) || Number(header(response.headers, "content-length") || 0) || 0;

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      url,
      mime,
      status,
      kind,
      quality,
      ext,
      itag: itag || 0,
      hasAudio,
      hasVideo,
      totalBytes,
      sizeText: humanSize(totalBytes),
      range: header(request.headers, "Range") || header(request.headers, "range") || "",
      resourceType,
      host: parsed?.hostname || "",
      capturedAt:Date.now(),
      requestHeaders: request.headers || {}
    };
  }

  function itemKey(item) {
    if (item.itag) return `yt:${item.itag}:${item.kind}`;
    if (item.kind === "manifest") return `manifest:${item.url}`;
    return `${item.kind}:${item.quality}:${item.ext}:${item.host}:${stripRange(item.url)}`;
  }

  function scoreItem(item) {
    let score = 0;
    if (item.itag) score += 50;
    if (item.hasAudio === true && item.hasVideo === true) score += 40;
    if (item.totalBytes > 1000000) score += 10;
    if (/googlevideo|fbcdn|tiktok|douyin|bilivideo/i.test(item.host)) score += 10;
    if (item.kind === "manifest") score -= 10;
    return score;
  }

  function sortItems(items) {
    return items.sort((a,b) => {
      const ak = a.kind === "video" ? 0 : a.kind === "audio" ? 1 : 2;
      const bk = b.kind === "video" ? 0 : b.kind === "audio" ? 1 : 2;
      if (ak !== bk) return ak - bk;
      const ar = resolutionNum(a.quality);
      const br = resolutionNum(b.quality);
      if (br !== ar) return br - ar;
      return (b.totalBytes || 0) - (a.totalBytes || 0);
    });
  }

  function resolutionNum(text) {
    const m = String(text || "").match(/(\d{3,4})p/i);
    return m ? Number(m[1]) : 0;
  }

  function normalizeDownloadUrl(url, item) {
    try {
      const u = new URL(url);
      if (/googlevideo\.com/i.test(u.hostname)) {
        for (const key of ["rn","rbuf","sq","ump","alr","srfvp"]) u.searchParams.delete(key);
        if (item?.verifiedDirect || item?.pageExtracted) {
          u.searchParams.delete("range");
        } else {
          const total = Number(item?.totalBytes || u.searchParams.get("clen") || 0);
          if (total > 0) u.searchParams.set("range", `0-${total - 1}`);
          else u.searchParams.delete("range");
        }
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  function stripRange(url) {
    try {
      const u = new URL(url);
      u.searchParams.delete("range");
      return u.toString();
    } catch {
      return url;
    }
  }

  function header(headers, name) {
    if (!headers) return "";
    const wanted = name.toLowerCase();
    for (const [k,v] of Object.entries(headers)) {
      if (String(k).toLowerCase() === wanted) return String(v);
    }
    return "";
  }

  function totalFromRange(value) {
    const m = String(value || "").match(/\/(\d+)$/);
    return m ? Number(m[1]) || 0 : 0;
  }

  function safeUrl(url) {
    try { return new URL(url); } catch { return null; }
  }

  function humanSize(n) {
    n = Number(n || 0);
    if (!n) return "";
    const units = ["B","KB","MB","GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function sanitizeFilename(name) {
    return String(name || "video.mp4")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/g, "")
      .slice(0, 180) || "video.mp4";
  }
})();


/* =====================================================================
 * BaByLon Keywords Background Job
 * - Tiếp tục chạy khi popup bị đóng / đổi tab / click sang Chrome khác.
 * - Kết quả + tiến độ được lưu vào chrome.storage.local.
 * - Hashtag: 12 nội dung mới nhất + 12 video cũ nhất của kênh.
 * ===================================================================== */
(() => {
  const JOB_KEY = "babylonKeywordJobStateV142";
  let jobState = null;
  let jobRunning = false;
  let stopRequested = false;
  // Khi người dùng F5/Reload trang YouTube, bỏ toàn bộ kết quả đang lưu.
  // Job cũ (nếu còn chạy) sẽ dừng ở checkpoint kế tiếp và không được ghi state trở lại.
  let suppressJobPersistence = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!String(message?.type || "").startsWith("BABYLON_KEYWORD_")) return false;

    (async () => {
      try {
        if (message.type === "BABYLON_KEYWORD_GET_STATE") {
          const state = await getJobState();
          sendResponse({ ok: true, state });
          return;
        }

        if (message.type === "BABYLON_KEYWORD_RESET") {
          await resetKeywordState();
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "BABYLON_KEYWORD_STOP") {
          stopRequested = true;
          const state = await getJobState();
          if (state?.status === "running") {
            await updateJob({
              message: "Đang dừng sau tác vụ hiện tại...",
              statusTextType: "warn"
            });
          }
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "BABYLON_KEYWORD_START") {
          const channelUrl = normalizeChannelUrlBg(message.channelUrl || "");

          if (jobRunning) {
            sendResponse({
              ok: false,
              error: suppressJobPersistence
                ? "BaByLon đang dừng phiên quét cũ sau khi Reload. Chờ 1–2 giây rồi bấm lại."
                : "BaByLon đang phân tích một kênh khác."
            });
            return;
          }

          suppressJobPersistence = false;
          stopRequested = false;
          jobRunning = true;

          jobState = {
            status: "running",
            channelUrl,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            progress: 2,
            progressText: "Chuẩn bị",
            message: "Bắt đầu phân tích...",
            statusTextType: "",
            result: null,
            error: ""
          };
          await persistJob();

          // Trả lời ngay để popup có thể đóng mà job vẫn tiếp tục trong service worker.
          sendResponse({ ok: true, state: jobState });

          runKeywordJob(channelUrl)
            .catch(async (error) => {
              if (error?.message === "__STOPPED__") {
                await updateJob({
                  status: "stopped",
                  message: "Đã dừng quét theo yêu cầu.",
                  statusTextType: "warn",
                  progressText: "Đã dừng"
                });
              } else {
                await updateJob({
                  status: "error",
                  error: error?.message || String(error),
                  message: error?.message || String(error),
                  statusTextType: "error"
                });
              }
            })
            .finally(async () => {
              const wasSuppressed = suppressJobPersistence;
              jobRunning = false;
              stopRequested = false;

              if (wasSuppressed) {
                // Bảo đảm job cũ không làm sống lại kết quả sau khi người dùng Reload trang.
                jobState = {
                  status: "idle",
                  channelUrl: "",
                  progress: 0,
                  progressText: "",
                  message: "",
                  result: null,
                  error: ""
                };
                await chrome.storage.local.remove([JOB_KEY, "lastChannelUrl"]);
                suppressJobPersistence = false;
              }
            });

          return;
        }

        sendResponse({ ok: false, error: "Keyword action không hợp lệ." });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();

    return true;
  });

  async function getJobState() {
    if (jobState) return jobState;
    const saved = await chrome.storage.local.get([JOB_KEY]);
    jobState = saved[JOB_KEY] || {
      status: "idle",
      channelUrl: "",
      progress: 0,
      progressText: "",
      message: "",
      result: null,
      error: ""
    };
    return jobState;
  }

  async function persistJob() {
    if (!jobState) return;
    if (suppressJobPersistence && jobRunning) return;
    jobState.updatedAt = Date.now();
    await chrome.storage.local.set({ [JOB_KEY]: jobState });
  }

  async function updateJob(patch) {
    // Sau F5/Reload, job cũ có thể còn vài request đang chờ. Không cho các request đó
    // ghi lại kết quả cũ vào storage.
    if (suppressJobPersistence && jobRunning) return;
    await getJobState();
    jobState = { ...jobState, ...patch, updatedAt: Date.now() };
    await chrome.storage.local.set({ [JOB_KEY]: jobState });
  }

  async function resetKeywordState() {
    // Nếu đang quét thì yêu cầu job cũ dừng, nhưng UI/storage được xóa ngay.
    if (jobRunning) {
      suppressJobPersistence = true;
      stopRequested = true;
    }

    jobState = {
      status: "idle",
      channelUrl: "",
      progress: 0,
      progressText: "",
      message: "",
      result: null,
      error: ""
    };

    await chrome.storage.local.remove([JOB_KEY, "lastChannelUrl"]);
  }

  function checkStopped() {
    if (stopRequested) throw new Error("__STOPPED__");
  }

  function normalizeChannelUrlBg(input) {
    let raw = String(input || "").trim();
    if (!raw) throw new Error("Hãy dán link kênh YouTube.");

    if (raw.startsWith("@")) raw = `https://www.youtube.com/${raw}`;
    if (!/^https?:\/\//i.test(raw)) {
      if (/^(www\.)?youtube\.com\//i.test(raw) || /^m\.youtube\.com\//i.test(raw)) raw = `https://${raw}`;
      else throw new Error("Link kênh YouTube không hợp lệ.");
    }

    const url = new URL(raw);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) throw new Error("Keywords chỉ hỗ trợ YouTube.");

    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) throw new Error("Đây chưa phải link kênh YouTube.");

    let channelPath = "";
    if (parts[0].startsWith("@")) channelPath = `/${parts[0]}`;
    else if (["channel", "user", "c"].includes(parts[0]) && parts[1]) channelPath = `/${parts[0]}/${parts[1]}`;
    else throw new Error("Hãy dùng link youtube.com/@handle hoặc youtube.com/channel/UC...");

    return `https://www.youtube.com${channelPath}`;
  }

  function waitForTabCompleteBg(tabId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => finish(new Error("Trang YouTube tải quá lâu.")), timeoutMs);

      function finish(error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        error ? reject(error) : resolve();
      }

      function onUpdated(id, changeInfo) {
        if (id === tabId && changeInfo.status === "complete") finish();
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === "complete") finish();
      }).catch(() => {});
    });
  }

  async function runKeywordJob(channelUrl) {
    checkStopped();

    await updateJob({
      status: "running",
      progress: 4,
      progressText: "Chuẩn bị",
      message: "Đang nhận diện kênh YouTube...",
      statusTextType: ""
    });

    // Bước 1: cần channelId để dùng chính playlist Uploads của kênh.
    const channelData = await getChannelKeywordsBg(channelUrl);
    checkStopped();

    // 1.41: "12 video cũ nhất" phải đúng nghĩa 12 nội dung có ngày đăng SỚM NHẤT
    // còn công khai trên kênh. Không suy ra từ 12 phần tử cuối của playlist nữa.
    // BaByLon mở chính các tab Video / Shorts / Live, chọn bộ lọc Cũ nhất (Oldest)
    // của YouTube rồi gom các ứng viên đầu tiên của từng tab. Sau đó metadata thật
    // được dùng để xếp toàn bộ ứng viên theo ngày đăng tăng dần và chọn đúng 12 cái cũ nhất.
    const uploadEdges = await collectExactUploadEdgesBg(channelData.channelId, 12);
    checkStopped();

    let newestCandidateIds = [];
    let oldestCandidateIds = [];
    let exactUploadTotal = 0;
    let sourceMode = "youtube-oldest-filter";

    if (uploadEdges?.ids?.length) {
      exactUploadTotal = uploadEdges.total || uploadEdges.ids.length;
      // Không dùng playlist Uploads làm nguồn duy nhất cho nhóm mới nhất.
      // YouTube có thể trả renderer/continuation khác nhau theo tài khoản; 1.41 từng có
      // trường hợp playlist có ID nhưng metadata của các ID đó không khớp card đang thấy.
      newestCandidateIds = [];
    }

    // Luôn dùng bộ lọc Cũ nhất của chính YouTube để xác định nhóm cũ nhất.
    // Lấy tối đa 12 từ mỗi loại là đủ: top 12 toàn kênh không thể cần phần tử
    // thứ 13 của một loại nếu đã có 12 phần tử cũ hơn trong chính loại đó.
    let tabLists = [];
    try {
      await updateJob({
        progress: 24,
        progressText: "Chọn 12 video cũ nhất",
        message: "Đang mở Video / Shorts / Live và chọn bộ lọc Cũ nhất của YouTube..."
      });
      tabLists = await collectChannelContentBg(channelUrl);
      checkStopped();
    } catch (_) {
      tabLists = [];
    }

    if ((tabLists || []).some((tab) => tab.oldestMethod === "full-scroll-fallback")) {
      sourceMode = "channel-grid-full-scroll-verified";
    } else if ((tabLists || []).some((tab) => tab.oldestMethod === "youtube-oldest-chip")) {
      sourceMode = "youtube-oldest-chip-verified";
    }

    const oldestSeen = new Set();
    for (const tab of tabLists || []) {
      for (const id of (tab.oldestIds || []).slice(0, 12)) {
        if (!oldestSeen.has(id)) {
          oldestSeen.add(id);
          oldestCandidateIds.push(id);
        }
      }
    }

    // Nếu không đọc được chip Cũ nhất (ví dụ YouTube đổi UI), mới fallback sang
    // phần cuối của playlist Uploads. Fallback này không còn là nguồn chính.
    if (!oldestCandidateIds.length && uploadEdges?.oldestIds?.length) {
      sourceMode = "uploads-playlist-fallback";
      oldestCandidateIds = [...new Set(uploadEdges.oldestIds)].slice(-15);
    }

    // Nhóm mới nhất luôn lấy từ chính các card đang ở bộ lọc Mới nhất của Video / Shorts / Live.
    // Playlist Uploads chỉ bổ sung ứng viên nếu UI thiếu, tuyệt đối không thay thế nguồn UI.
    {
      const newestSeen = new Set();
      const mergedNewest = [];
      for (const tab of tabLists || []) {
        for (const id of (tab.newestIds || []).slice(0, 12)) {
          if (!newestSeen.has(id)) {
            newestSeen.add(id);
            mergedNewest.push(id);
          }
        }
      }
      for (const id of (uploadEdges?.newestIds || []).slice(0, 15)) {
        if (!newestSeen.has(id)) {
          newestSeen.add(id);
          mergedNewest.push(id);
        }
      }
      newestCandidateIds = mergedNewest;
    }

    if (!exactUploadTotal) {
      exactUploadTotal = new Set([...newestCandidateIds, ...oldestCandidateIds]).size;
    }

    await updateJob({
      progress: 38,
      progressText: `${oldestCandidateIds.length} ứng viên cũ nhất`,
      message: "Đã lấy ứng viên bằng bộ lọc Cũ nhất. Đang đọc ngày đăng thật để chọn đúng 12 video cũ nhất..."
    });

    // Chỉ đọc metadata của hai đầu lịch sử, không scan metadata toàn kênh.
    const candidateIds = [];
    const candidateSeen = new Set();
    for (const id of [...newestCandidateIds, ...oldestCandidateIds]) {
      if (!candidateSeen.has(id)) {
        candidateSeen.add(id);
        candidateIds.push(id);
      }
    }

    if (!candidateIds.length) {
      const result = {
        channelKeywords: splitKeywordsBg(channelData.raw || ""),
        channelRaw: channelData.raw || "",
        tags: [],
        hashtagsNewest: [],
        hashtagsOldest: [],
        latestVideo: null,
        videoTotal: 0,
        newestCount: 0,
        oldestCount: 0,
        sampledCount: 0,
        oldestSource: sourceMode
      };
      await updateJob({
        status: "complete",
        progress: 100,
        progressText: "Hoàn tất",
        message: "Không tìm thấy nội dung công khai để phân tích.",
        statusTextType: "warn",
        result
      });
      return;
    }

    await updateJob({
      progress: 42,
      progressText: `Metadata ${candidateIds.length} ứng viên`,
      message: `Đang đọc mô tả + hashtag của 12 nội dung mới nhất và 12 video cũ nhất...`
    });

    const metadata = await fetchCandidateMetadataBg(candidateIds);
    checkStopped();

    const valid = metadata.filter((x) => x && x.id);
    const metaById = new Map(valid.map((x) => [x.id, x]));

    const placeholderFor = (id, index) => ({
      id, title: "", description: "", hashtags: [], tags: [],
      publishedAt: "", metadataSource: "unresolved", _time: NaN, _candidateIndex: index
    });
    let newestPool = newestCandidateIds.map((id, index) => metaById.get(id) || placeholderFor(id, index));
    let oldestPool = oldestCandidateIds.map((id, index) => metaById.get(id) || placeholderFor(id, index));

    // Xếp theo ngày đăng thật. Với nhóm cũ nhất, item không đọc được ngày sẽ bị đẩy
    // xuống sau item có ngày xác định để không vô tình chen một video mới vào top 12.
    newestPool = newestPool.slice().sort((a, b) => {
      if (Number.isFinite(a._time) && Number.isFinite(b._time)) return b._time - a._time;
      return (a._candidateIndex || 0) - (b._candidateIndex || 0);
    });
    oldestPool = oldestPool.slice().sort((a, b) => {
      const at = Number.isFinite(a._time) ? a._time : Number.POSITIVE_INFINITY;
      const bt = Number.isFinite(b._time) ? b._time : Number.POSITIVE_INFINITY;
      if (at !== bt) return at - bt;
      return (a._candidateIndex || 0) - (b._candidateIndex || 0);
    });

    const newest = newestPool.slice(0, 12);
    const oldest = oldestPool.slice(0, 12);

    const hashtagNewestMap = new Map();
    const hashtagOldestMap = new Map();
    const tagMap = new Map();

    for (const item of newest) {
      const hashes = new Set([
        ...(item.hashtags || []),
        ...extractHashtagsBg(`${item.title}\n${item.description}`)
      ]);
      addUsageBg(hashtagNewestMap, [...hashes]);
      addUsageBg(tagMap, item.tags || []);
    }
    for (const item of oldest) {
      const hashes = new Set([
        ...(item.hashtags || []),
        ...extractHashtagsBg(`${item.title}\n${item.description}`)
      ]);
      addUsageBg(hashtagOldestMap, [...hashes]);
      addUsageBg(tagMap, item.tags || []);
    }

    const sortMap = (map) =>
      [...map.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "vi"));

    const latestVideo = newest[0] || null;
    const sampledCount = new Set([...newest, ...oldest].map((x) => x.id)).size;
    const result = {
      channelKeywords: splitKeywordsBg(channelData.raw || ""),
      channelRaw: channelData.raw || "",
      tags: sortMap(tagMap),
      hashtagsNewest: sortMap(hashtagNewestMap),
      hashtagsOldest: sortMap(hashtagOldestMap),
      latestVideo,
      videoTotal: exactUploadTotal || candidateIds.length,
      newestCount: newest.length,
      oldestCount: oldest.length,
      sampledCount,
      newestVideos: newest.map(slimVideo),
      oldestVideos: oldest.map(slimVideo),
      oldestSource: sourceMode
    };

    await updateJob({
      status: "complete",
      progress: 100,
      progressText: `Hoàn tất • ${newest.length} mới + ${oldest.length} cũ nhất`,
      message:
        `Hoàn tất: ${result.hashtagsNewest.length} hashtag ở ${newest.length} video mới nhất, ` +
        `${result.hashtagsOldest.length} hashtag ở ${oldest.length} video cũ nhất của kênh.`,
      statusTextType: "ok",
      result
    });
  }

  function slimVideo(item) {
    return {
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      publishedAt: item.publishedAt || "",
      tags: item.tags || [],
      hashtags: item.hashtags || [],
      metadataSource: item.metadataSource || ""
    };
  }

  async function getChannelKeywordsBg(channelUrl) {
    let tab;
    try {
      tab = await chrome.tabs.create({ url: channelUrl, active: false });
      await waitForTabCompleteBg(tab.id);
      await sleep(100);

      for (let attempt = 0; attempt < 2; attempt++) {
        checkStopped();
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: () => {
            const isObj = (v) => v && typeof v === "object";

            function deepFind(root) {
              const found = { raw: "", channelId: "" };
              if (!isObj(root)) return found;

              const queue = [root];
              let q = 0;
              const seen = new Set();

              while (q < queue.length && q < 220000) {
                const cur = queue[q++];
                if (!isObj(cur) || seen.has(cur)) continue;
                seen.add(cur);

                const meta = cur.channelMetadataRenderer;
                if (meta) {
                  if (!found.raw && typeof meta.keywords === "string") found.raw = meta.keywords.trim();
                  if (!found.channelId && /^UC[A-Za-z0-9_-]+$/.test(String(meta.externalId || ""))) {
                    found.channelId = String(meta.externalId);
                  }
                }

                const browseId = cur?.browseEndpoint?.browseId;
                if (!found.channelId && /^UC[A-Za-z0-9_-]+$/.test(String(browseId || ""))) {
                  found.channelId = String(browseId);
                }

                if (found.raw && found.channelId) return found;

                if (Array.isArray(cur)) {
                  for (const value of cur) if (isObj(value)) queue.push(value);
                } else {
                  for (const value of Object.values(cur)) if (isObj(value)) queue.push(value);
                }
              }
              return found;
            }

            function decodeJsonString(encoded) {
              try { return JSON.parse(`"${encoded}"`); } catch (_) { return ""; }
            }

            function scanText(text) {
              const found = { raw: "", channelId: "" };
              if (!text) return found;

              const idMatch = text.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/) ||
                              text.match(/"browseId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/);
              if (idMatch?.[1]) found.channelId = idMatch[1];

              if (text.includes("channelMetadataRenderer")) {
                const marker = '"channelMetadataRenderer"';
                const p = text.indexOf(marker);
                if (p >= 0) {
                  const block = text.slice(p, Math.min(text.length, p + 140000));
                  const m = block.match(/"keywords"\s*:\s*"((?:\\.|[^"\\])*)"/);
                  if (m?.[1]) found.raw = decodeJsonString(m[1]).trim();
                }
              }
              return found;
            }

            const direct = deepFind(window.ytInitialData);
            if (direct.raw || direct.channelId) return { ...direct, source: "ytInitialData" };

            let merged = { raw: "", channelId: "" };
            for (const script of document.scripts) {
              const f = scanText(script.textContent || "");
              if (!merged.raw && f.raw) merged.raw = f.raw;
              if (!merged.channelId && f.channelId) merged.channelId = f.channelId;
              if (merged.raw && merged.channelId) break;
            }
            return { ...merged, source: merged.raw || merged.channelId ? "pageScript" : "none" };
          }
        });

        if (result?.raw || result?.channelId) return result;
        await sleep(180);
      }

      return { raw: "", channelId: "", source: "none" };
    } finally {
      if (tab?.id) try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }

  // Playlist Uploads chỉ còn dùng để lấy tổng số / nhóm mới nhất và làm fallback.
  // Nhóm 12 video cũ nhất ở 1.41 được xác định bằng chính bộ lọc Cũ nhất của YouTube.
  async function collectExactUploadEdgesBg(channelId, edgeLimit = 12) {
    if (!/^UC[A-Za-z0-9_-]+$/.test(String(channelId || ""))) return null;

    const playlistId = `UU${String(channelId).slice(2)}`;
    let tab;
    try {
      await updateJob({
        progress: 12,
        progressText: "Đọc lịch sử Uploads",
        message: "Đang lấy thứ tự upload thật của toàn kênh..."
      });

      tab = await chrome.tabs.create({
        url: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
        active: false
      });
      await waitForTabCompleteBg(tab.id, 22000);
      await sleep(120);

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        args: [edgeLimit],
        func: async (wanted) => {
          const ordered = [];
          const idSeen = new Set();
          const tokenQueue = [];
          const tokenSeen = new Set();

          function addId(value) {
            if (typeof value !== "string") return;
            const id = value.trim();
            if (!/^[A-Za-z0-9_-]{11}$/.test(id) || idSeen.has(id)) return;
            idSeen.add(id);
            ordered.push(id);
          }

          function addToken(value) {
            if (typeof value !== "string") return;
            const token = value.trim();
            if (!token || token.length < 10 || tokenSeen.has(token) || tokenQueue.includes(token)) return;
            tokenQueue.push(token);
          }

          function walkOrdered(root) {
            if (!root || typeof root !== "object") return;
            const queue = [root];
            let q = 0;
            const seen = new Set();

            while (q < queue.length && q < 900000) {
              const cur = queue[q++];
              if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
              seen.add(cur);

              if (cur.playlistVideoRenderer?.videoId) addId(cur.playlistVideoRenderer.videoId);
              if (cur.playlistPanelVideoRenderer?.videoId) addId(cur.playlistPanelVideoRenderer.videoId);
              if (cur.videoRenderer?.videoId) addId(cur.videoRenderer.videoId);
              if (cur.gridVideoRenderer?.videoId) addId(cur.gridVideoRenderer.videoId);
              if (cur.reelItemRenderer?.videoId) addId(cur.reelItemRenderer.videoId);

              if (cur.continuationCommand?.token) addToken(cur.continuationCommand.token);
              if (cur.nextContinuationData?.continuation) addToken(cur.nextContinuationData.continuation);
              if (cur.reloadContinuationData?.continuation) addToken(cur.reloadContinuationData.continuation);

              if (Array.isArray(cur)) {
                for (const value of cur) if (value && typeof value === "object") queue.push(value);
              } else {
                for (const value of Object.values(cur)) if (value && typeof value === "object") queue.push(value);
              }
            }
          }

          walkOrdered(window.ytInitialData);

          const ytcfg = window.ytcfg;
          const apiKey = ytcfg?.get?.("INNERTUBE_API_KEY") || "";
          const context = ytcfg?.get?.("INNERTUBE_CONTEXT") || null;
          const clientName = ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_NAME") || "";
          const clientVersion =
            ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_VERSION") ||
            context?.client?.clientVersion ||
            "";

          // Đi đến hết playlist. Với vài trăm video thường chỉ mất vài continuation.
          if (apiKey && context) {
            let pages = 0;
            while (tokenQueue.length && pages < 80) {
              const token = tokenQueue.shift();
              if (!token || tokenSeen.has(token)) continue;
              tokenSeen.add(token);
              pages++;

              try {
                const response = await fetch(
                  `/youtubei/v1/browse?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
                  {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                      "Content-Type": "application/json",
                      ...(clientName ? { "X-YouTube-Client-Name": String(clientName) } : {}),
                      ...(clientVersion ? { "X-YouTube-Client-Version": String(clientVersion) } : {})
                    },
                    body: JSON.stringify({ context, continuation: token })
                  }
                );
                if (!response.ok) continue;
                walkOrdered(await response.json());
              } catch (_) {}
            }
          }

          return {
            ids: ordered,
            newestIds: ordered.slice(0, Math.max(wanted, 15)),
            oldestIds: ordered.slice(Math.max(0, ordered.length - Math.max(wanted, 15))),
            total: ordered.length,
            continuationPages: tokenSeen.size
          };
        }
      });

      if (!result?.ids?.length) return null;
      return result;
    } catch (_) {
      return null;
    } finally {
      if (tab?.id) try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
  }

  async function collectChannelContentBg(channelUrl) {
    const tabsToScan = [
      { suffix: "/videos", label: "Video" },
      { suffix: "/shorts", label: "Shorts" },
      { suffix: "/streams", label: "Live" }
    ];

    // 1.42: nguồn Mới nhất và Cũ nhất đều lấy từ chính grid của kênh.
    // Nếu YouTube không cho chuyển sang Cũ nhất, fallback chính xác là cuộn HẾT
    // grid Mới nhất rồi lấy 12 card cuối, không lấy "12 phần tử cuối" từ cây JSON bất định.
    return Promise.all(tabsToScan.map(async (item, index) => {
      checkStopped();
      let tab;
      const targetUrl = `${channelUrl}${item.suffix}`;

      try {
        await updateJob({
          progress: 12 + index * 4,
          progressText: `Quét ${item.label}`,
          message: `Đang xác định Mới nhất / Cũ nhất của ${item.label}...`
        });

        tab = await chrome.tabs.create({ url: targetUrl, active: false });
        await waitForTabCompleteBg(tab.id, 22000);
        await sleep(180);

        const newestIds = await collectFirstCardsFromCurrentSortBg(tab.id, 12);
        let oldestIds = await switchToOldestAndCollectBg(tab.id, 12);
        let oldestMethod = oldestIds.length ? "youtube-oldest-chip" : "";

        if (!oldestIds.length) {
          // Trở về URL mặc định (Mới nhất), cuộn đến tận đáy và lấy 12 card cuối.
          // Chậm hơn nhưng không được phép gắn nhãn "cũ nhất" cho một danh sách chưa xác minh.
          try {
            await chrome.tabs.update(tab.id, { url: targetUrl });
            await waitForTabCompleteBg(tab.id, 22000);
            await sleep(180);
          } catch (_) {}
          const fullOrder = await collectAllCardsFromCurrentSortBg(tab.id, 5000);
          oldestIds = fullOrder.slice(Math.max(0, fullOrder.length - 12));
          oldestMethod = oldestIds.length ? "full-scroll-fallback" : "";
        }

        return { ...item, newestIds, oldestIds, oldestMethod };
      } catch (_) {
        return { ...item, newestIds: [], oldestIds: [], oldestMethod: "" };
      } finally {
        if (tab?.id) try { await chrome.tabs.remove(tab.id); } catch (_) {}
      }
    }));
  }

  async function collectFirstCardsFromCurrentSortBg(tabId, limit = 12) {
    const collected = [];
    const seen = new Set();
    let stagnant = 0;

    for (let attempt = 0; attempt < 14 && collected.length < limit && stagnant < 6; attempt++) {
      checkStopped();

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [limit],
        func: (wanted) => {
          function parseId(href) {
            const h = String(href || "");
            let m = h.match(/[?&]v=([A-Za-z0-9_-]{11})/);
            if (m) return m[1];
            m = h.match(/\/(?:shorts|live)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
            return m ? m[1] : "";
          }

          function gridCards() {
            const roots = [
              ...document.querySelectorAll('ytd-rich-grid-renderer #contents, ytd-grid-renderer #items, ytd-section-list-renderer #contents')
            ];
            const scope = roots.length ? roots : [document];
            const cards = [];
            const cardSeen = new Set();
            for (const root of scope) {
              root.querySelectorAll(
                'ytd-rich-item-renderer, ytd-rich-grid-media, ytd-grid-video-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model'
              ).forEach((card) => {
                if (!cardSeen.has(card)) { cardSeen.add(card); cards.push(card); }
              });
            }
            return cards;
          }

          const ids = [];
          const seen = new Set();
          const cards = gridCards();
          for (const card of cards) {
            const anchors = card.querySelectorAll('a[href*="watch?v="], a[href^="/shorts/"], a[href^="/live/"]');
            let id = "";
            for (const a of anchors) {
              id = parseId(a.getAttribute('href'));
              if (id) break;
            }
            if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
          }

          // Fallback vẫn bị giới hạn trong grid, tránh lấy video ở sidebar/header.
          if (!ids.length) {
            const roots = document.querySelectorAll('ytd-rich-grid-renderer #contents, ytd-grid-renderer #items');
            for (const root of roots) {
              for (const a of root.querySelectorAll('a#thumbnail[href], a[href^="/shorts/"]')) {
                const id = parseId(a.getAttribute('href'));
                if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
              }
            }
          }

          if (ids.length < wanted) {
            const last = cards[cards.length - 1];
            if (last?.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'instant' });
            else (document.scrollingElement || document.documentElement).scrollBy({ top: Math.max(window.innerHeight * 1.2, 900), behavior: 'instant' });
            window.dispatchEvent(new Event('scroll'));
          }
          return ids;
        }
      });

      const before = collected.length;
      for (const id of result || []) {
        if (id && !seen.has(id)) {
          seen.add(id);
          collected.push(id);
          if (collected.length >= limit) break;
        }
      }
      stagnant = collected.length === before ? stagnant + 1 : 0;
      if (collected.length < limit) await sleep(stagnant >= 2 ? 260 : 130);
    }

    return collected.slice(0, limit);
  }

  async function collectAllCardsFromCurrentSortBg(tabId, maxItems = 5000) {
    const collected = [];
    const seen = new Set();
    let stagnant = 0;
    let lastHeight = 0;

    for (let attempt = 0; attempt < 90 && collected.length < maxItems && stagnant < 9; attempt++) {
      checkStopped();
      let result = null;
      try {
        [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            function parseId(href) {
              const h = String(href || "");
              let m = h.match(/[?&]v=([A-Za-z0-9_-]{11})/);
              if (m) return m[1];
              m = h.match(/\/(?:shorts|live)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
              return m ? m[1] : "";
            }
            const roots = [...document.querySelectorAll('ytd-rich-grid-renderer #contents, ytd-grid-renderer #items, ytd-section-list-renderer #contents')];
            const scope = roots.length ? roots : [document];
            const ids = [];
            const idSeen = new Set();
            const cards = [];
            const cardSeen = new Set();
            for (const root of scope) {
              root.querySelectorAll('ytd-rich-item-renderer, ytd-rich-grid-media, ytd-grid-video-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model').forEach((card) => {
                if (!cardSeen.has(card)) { cardSeen.add(card); cards.push(card); }
              });
            }
            for (const card of cards) {
              for (const a of card.querySelectorAll('a[href*="watch?v="], a[href^="/shorts/"], a[href^="/live/"]')) {
                const id = parseId(a.getAttribute('href'));
                if (id) {
                  if (!idSeen.has(id)) { idSeen.add(id); ids.push(id); }
                  break;
                }
              }
            }
            const root = document.scrollingElement || document.documentElement;
            const last = cards[cards.length - 1];
            if (last?.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'instant' });
            else root.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
            window.dispatchEvent(new Event('scroll'));
            return { ids, height: root.scrollHeight, top: root.scrollTop, viewport: window.innerHeight || 0 };
          }
        });
      } catch (_) {}

      const before = collected.length;
      for (const id of result?.ids || []) {
        if (id && !seen.has(id)) { seen.add(id); collected.push(id); }
      }
      const height = Number(result?.height || 0);
      if (collected.length === before && height <= lastHeight + 4) stagnant++;
      else stagnant = 0;
      lastHeight = Math.max(lastHeight, height);
      await sleep(stagnant >= 4 ? 420 : 180);
    }
    return collected.slice(0, maxItems);
  }

  async function switchToOldestAndCollectBg(tabId, limit = 12) {
    checkStopped();

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => (document.scrollingElement || document.documentElement).scrollTo({ top: 0, behavior: 'instant' })
      });
    } catch (_) {}
    await sleep(120);

    const beforeIds = await collectFirstCardsFromCurrentSortBg(tabId, Math.min(4, limit));
    if (!beforeIds.length) return [];

    // Thử tối đa 4 lần. 1.41 chỉ gọi el.click(), có trường hợp YouTube không đổi chip
    // trong tab nền nên BaByLon đã vô tình gắn nhãn "cũ nhất" cho video mới.
    for (let attempt = 0; attempt < 4; attempt++) {
      checkStopped();
      let action = null;
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => {
            const normalize = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
            const selected = (el) => {
              if (!el) return false;
              const candidates = [el, el.parentElement, el.closest?.('[role="tab"], [role="button"], yt-chip-cloud-chip-renderer, yt-tab-shape')].filter(Boolean);
              return candidates.some((x) =>
                x.getAttribute?.('aria-selected') === 'true' ||
                x.getAttribute?.('aria-checked') === 'true' ||
                x.hasAttribute?.('selected') ||
                /(^|\s)(selected|iron-selected)(\s|$)/i.test(String(x.className || ''))
              );
            };
            const nodes = [...document.querySelectorAll('yt-chip-cloud-chip-renderer, yt-tab-shape, tp-yt-paper-tab, [role="tab"], button, [role="button"], a')];
            const el = nodes.find((node) => {
              const text = normalize(node.innerText || node.textContent || node.getAttribute?.('aria-label'));
              return text === 'cũ nhất' || text === 'oldest';
            });
            if (!el) return { found: false, alreadySelected: false, href: '' };
            if (selected(el)) return { found: true, alreadySelected: true, href: '' };

            const anchor = el.matches?.('a[href]') ? el : (el.querySelector?.('a[href]') || el.closest?.('a[href]'));
            const href = anchor?.href || anchor?.getAttribute?.('href') || '';
            if (href) {
              try { location.assign(href); return { found: true, alreadySelected: false, href }; } catch (_) {}
            }

            const target = el.closest?.('button, [role="button"], [role="tab"], yt-chip-cloud-chip-renderer, yt-tab-shape') || el;
            try {
              for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
                target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
              }
            } catch (_) {}
            try { target.click(); } catch (_) {}
            return { found: true, alreadySelected: false, href: '' };
          }
        });
        action = result;
      } catch (_) {}

      if (!action?.found) return [];
      if (action.href) {
        try { await waitForTabCompleteBg(tabId, 9000); } catch (_) {}
      }

      let changed = Boolean(action.alreadySelected);
      for (let wait = 0; wait < 30 && !changed; wait++) {
        checkStopped();
        await sleep(160);
        try {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (beforeFirst) => {
              const normalize = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
              const nodes = [...document.querySelectorAll('yt-chip-cloud-chip-renderer, yt-tab-shape, tp-yt-paper-tab, [role="tab"], button, [role="button"], a')];
              const chip = nodes.find((node) => {
                const text = normalize(node.innerText || node.textContent || node.getAttribute?.('aria-label'));
                return text === 'cũ nhất' || text === 'oldest';
              });
              const selected = chip && (
                chip.getAttribute?.('aria-selected') === 'true' ||
                chip.getAttribute?.('aria-checked') === 'true' ||
                chip.hasAttribute?.('selected') ||
                /(^|\s)(selected|iron-selected)(\s|$)/i.test(String(chip.className || '')) ||
                chip.closest?.('[aria-selected="true"], [aria-checked="true"], .selected, .iron-selected')
              );
              let first = '';
              const roots = [...document.querySelectorAll('ytd-rich-grid-renderer #contents, ytd-grid-renderer #items')];
              outer: for (const root of roots) {
                for (const a of root.querySelectorAll('a[href*="watch?v="], a[href^="/shorts/"], a[href^="/live/"]')) {
                  const h = a.getAttribute('href') || '';
                  const m = h.match(/[?&]v=([A-Za-z0-9_-]{11})/) || h.match(/\/(?:shorts|live)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
                  if (m) { first = m[1]; break outer; }
                }
              }
              return { first, selected: Boolean(selected), changed: Boolean(first && first !== beforeFirst) };
            },
            args: [beforeIds[0] || '']
          });
          // ID đầu thay đổi là tín hiệu mạnh nhất; selected dùng khi tab chỉ có rất ít video.
          changed = Boolean(result?.changed || (result?.selected && result?.first));
        } catch (_) {}
      }

      if (changed) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => (document.scrollingElement || document.documentElement).scrollTo({ top: 0, behavior: 'instant' })
          });
        } catch (_) {}
        await sleep(140);
        const ids = await collectFirstCardsFromCurrentSortBg(tabId, limit);
        if (ids.length) return ids;
      }
    }

    // Không xác minh được sort => trả rỗng. Caller sẽ cuộn toàn bộ danh sách Mới nhất.
    // Tuyệt đối không lấy danh sách hiện tại rồi gọi nó là "cũ nhất".
    return [];
  }

  async function collectOrderedIdsFromTabBg(tabId) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async () => {
          const ordered = [];
          const idSeen = new Set();
          const tokenQueue = [];
          const tokenSeen = new Set();

          function addId(value) {
            if (typeof value !== "string") return;
            const id = value.trim();
            if (!/^[A-Za-z0-9_-]{11}$/.test(id) || idSeen.has(id)) return;
            idSeen.add(id);
            ordered.push(id);
          }

          function addToken(value) {
            if (typeof value !== "string") return;
            const token = value.trim();
            if (!token || token.length < 10 || tokenSeen.has(token) || tokenQueue.includes(token)) return;
            tokenQueue.push(token);
          }

          function walkOrdered(root) {
            if (!root || typeof root !== "object") return;
            const queue = [root];
            let q = 0;
            const seen = new Set();

            while (q < queue.length && q < 700000) {
              const cur = queue[q++];
              if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
              seen.add(cur);

              if (cur.videoRenderer?.videoId) addId(cur.videoRenderer.videoId);
              if (cur.gridVideoRenderer?.videoId) addId(cur.gridVideoRenderer.videoId);
              if (cur.reelItemRenderer?.videoId) addId(cur.reelItemRenderer.videoId);
              if (cur.reelWatchEndpoint?.videoId) addId(cur.reelWatchEndpoint.videoId);

              if (cur.continuationCommand?.token) addToken(cur.continuationCommand.token);
              if (cur.nextContinuationData?.continuation) addToken(cur.nextContinuationData.continuation);
              if (cur.reloadContinuationData?.continuation) addToken(cur.reloadContinuationData.continuation);

              if (Array.isArray(cur)) {
                for (const value of cur) if (value && typeof value === "object") queue.push(value);
              } else {
                for (const value of Object.values(cur)) if (value && typeof value === "object") queue.push(value);
              }
            }
          }

          walkOrdered(window.ytInitialData);

          const ytcfg = window.ytcfg;
          const apiKey = ytcfg?.get?.("INNERTUBE_API_KEY") || "";
          const context = ytcfg?.get?.("INNERTUBE_CONTEXT") || null;
          const clientName = ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_NAME") || "";
          const clientVersion =
            ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_VERSION") ||
            context?.client?.clientVersion ||
            "";

          if (apiKey && context) {
            let pages = 0;

            while (tokenQueue.length && pages < 300) {
              const token = tokenQueue.shift();
              if (!token || tokenSeen.has(token)) continue;
              tokenSeen.add(token);
              pages++;

              try {
                const response = await fetch(
                  `/youtubei/v1/browse?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
                  {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                      "Content-Type": "application/json",
                      ...(clientName ? { "X-YouTube-Client-Name": String(clientName) } : {}),
                      ...(clientVersion ? { "X-YouTube-Client-Version": String(clientVersion) } : {})
                    },
                    body: JSON.stringify({ context, continuation: token })
                  }
                );

                if (!response.ok) continue;
                walkOrdered(await response.json());
              } catch (_) {}
            }
          }

          return { ids: ordered, continuationPages: tokenSeen.size };
        }
      });

      if (Array.isArray(result?.ids) && result.ids.length) return result.ids;
    } catch (_) {}

    // Fallback DOM: cuộn từng viewport để YouTube lazy-load.
    const ids = [];
    const seen = new Set();
    let stagnant = 0;
    let lastCount = 0;

    for (let loop = 0; loop < 1200 && stagnant < 14; loop++) {
      checkStopped();

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const hrefs = [];
          document
            .querySelectorAll('a[href*="/watch?v="],a[href^="/shorts/"],a[href^="/live/"],a#thumbnail[href]')
            .forEach((a) => {
              const href = a.getAttribute("href");
              if (href) hrefs.push(href);
            });

          const root = document.scrollingElement || document.documentElement;
          const viewport = Math.max(window.innerHeight || 800, 600);
          root.scrollTo({
            top: Math.min(root.scrollHeight, root.scrollTop + Math.floor(viewport * 0.9)),
            behavior: "instant"
          });

          return { hrefs };
        }
      });

      for (const href of result?.hrefs || []) {
        const id = parseVideoIdBg(href);
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }

      if (ids.length === lastCount) stagnant++;
      else {
        stagnant = 0;
        lastCount = ids.length;
      }

      await sleep(stagnant >= 4 ? 1000 : 400);
    }

    return ids;
  }

  function parseVideoIdBg(href) {
    if (!href) return "";
    try {
      const url = new URL(href, "https://www.youtube.com");
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const s = url.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (s) return s[1];
      const l = url.pathname.match(/^\/live\/([^/?#]+)/);
      if (l) return l[1];
    } catch (_) {}
    return "";
  }

  async function fetchCandidateMetadataBg(videoIds) {
    // V5 hashtag resolver: player + next metadata + rendered YouTube DOM fallback.
    // Mục tiêu: hashtag hiển thị trên YouTube phải được đọc đúng, kể cả khi
    // videoDetails.shortDescription bị YouTube trả rỗng cho Shorts.
    const CACHE_KEY = "babylonVideoMetaCacheV5_hashtag_truth";
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    const total = videoIds.length;
    const out = new Array(total);
    const now = Date.now();

    let cache = {};
    try {
      const saved = await chrome.storage.local.get([CACHE_KEY]);
      cache = saved[CACHE_KEY] && typeof saved[CACHE_KEY] === "object" ? saved[CACHE_KEY] : {};
    } catch (_) {}

    const missing = [];
    for (let i = 0; i < total; i++) {
      const id = videoIds[i];
      const cached = cache[id];
      // Không tái sử dụng cache rỗng. Cache chỉ hợp lệ khi có mô tả/hashtag/tags thực.
      const useful = cached?.data && (
        String(cached.data.description || "").trim() ||
        (cached.data.hashtags || []).length ||
        (cached.data.tags || []).length
      );
      if (useful && now - Number(cached.savedAt || 0) < CACHE_TTL) {
        out[i] = { ...cached.data, id, _candidateIndex: i };
      } else {
        missing.push({ id, index: i });
      }
    }

    let resolverTab = null;
    let resolvedMap = {};

    // Cách 1: gọi song song player + next bằng context của chính youtube.com.
    // /next thường chứa phần mô tả mà /player có thể bỏ trống trên Shorts.
    if (missing.length) {
      try {
        resolverTab = await chrome.tabs.create({
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(missing[0].id)}&hl=vi`,
          active: false
        });
        await waitForTabCompleteBg(resolverTab.id, 22000);
        await sleep(180);

        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: resolverTab.id },
          world: "MAIN",
          args: [missing.map((x) => x.id)],
          func: async (ids) => {
            const ytcfg = window.ytcfg;
            const apiKey = ytcfg?.get?.("INNERTUBE_API_KEY") || "";
            const context = ytcfg?.get?.("INNERTUBE_CONTEXT") || null;
            const clientName = ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_NAME") || "";
            const clientVersion =
              ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_VERSION") ||
              context?.client?.clientVersion || "";

            if (!apiKey || !context) return { ok: false, items: {} };

            const headers = {
              "Content-Type": "application/json",
              ...(clientName ? { "X-YouTube-Client-Name": String(clientName) } : {}),
              ...(clientVersion ? { "X-YouTube-Client-Version": String(clientVersion) } : {})
            };

            function textOf(value) {
              if (!value) return "";
              if (typeof value === "string") return value;
              if (typeof value.simpleText === "string") return value.simpleText;
              if (typeof value.content === "string") return value.content;
              if (Array.isArray(value.runs)) return value.runs.map((r) => r?.text || "").join("");
              return "";
            }

            function hashtagsOf(text) {
              return [...new Set((String(text || "").match(/#[\\p{L}\\p{N}_\\u200c\\u200d]+/gu) || []))];
            }

            function findDescriptionInNext(root) {
              const candidates = [];
              const stack = [root];
              const seen = new Set();
              let visited = 0;

              const add = (text, weight = 0) => {
                text = String(text || "").trim();
                if (!text) return;
                candidates.push({ text, weight, hashes: hashtagsOf(text).length });
              };

              while (stack.length && visited < 350000) {
                const cur = stack.pop();
                if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
                seen.add(cur);
                visited++;

                // Các renderer mô tả chính của video hiện tại.
                const secondary = cur.videoSecondaryInfoRenderer;
                if (secondary) {
                  add(textOf(secondary.description), 100);
                  add(textOf(secondary.attributedDescription), 110);
                }

                const expandable = cur.expandableVideoDescriptionBodyRenderer;
                if (expandable) {
                  add(textOf(expandable.attributedDescription), 120);
                  add(textOf(expandable.descriptionBodyText), 115);
                  add(textOf(expandable.description), 110);
                }

                const body = cur.videoDescriptionBodyRenderer;
                if (body) {
                  add(textOf(body.attributedDescription), 120);
                  add(textOf(body.descriptionBodyText), 115);
                  add(textOf(body.description), 110);
                }

                // YouTube mới dùng attributedDescription.content trong structured description.
                if (cur.attributedDescription && typeof cur.attributedDescription.content === "string") {
                  add(cur.attributedDescription.content, 105);
                }

                // Một số response giữ shortDescription trực tiếp.
                if (typeof cur.shortDescription === "string") add(cur.shortDescription, 125);

                if (Array.isArray(cur)) {
                  for (let i = cur.length - 1; i >= 0; i--) {
                    if (cur[i] && typeof cur[i] === "object") stack.push(cur[i]);
                  }
                } else {
                  for (const value of Object.values(cur)) {
                    if (value && typeof value === "object") stack.push(value);
                  }
                }
              }

              candidates.sort((a, b) =>
                (b.hashes - a.hashes) ||
                (b.weight - a.weight) ||
                (b.text.length - a.text.length)
              );
              return candidates[0]?.text || "";
            }

            const items = {};
            let nextIndex = 0;
            // 8 workers cân bằng tốc độ và tránh YouTube throttle.
            const workers = Math.min(8, Math.max(1, ids.length));

            async function worker() {
              while (true) {
                const index = nextIndex++;
                if (index >= ids.length) return;
                const videoId = ids[index];

                try {
                  const body = JSON.stringify({
                    context,
                    videoId,
                    contentCheckOk: true,
                    racyCheckOk: true
                  });

                  const [playerRes, nextRes] = await Promise.all([
                    fetch(`/youtubei/v1/player?prettyPrint=false&key=${encodeURIComponent(apiKey)}`, {
                      method: "POST", credentials: "same-origin", headers, body
                    }).catch(() => null),
                    fetch(`/youtubei/v1/next?prettyPrint=false&key=${encodeURIComponent(apiKey)}`, {
                      method: "POST", credentials: "same-origin", headers, body
                    }).catch(() => null)
                  ]);

                  let player = {};
                  let nextData = {};
                  try { if (playerRes?.ok) player = await playerRes.json(); } catch (_) {}
                  try { if (nextRes?.ok) nextData = await nextRes.json(); } catch (_) {}

                  const details = player?.videoDetails || {};
                  const micro = player?.microformat?.playerMicroformatRenderer || {};
                  const microDescription =
                    textOf(micro?.description) ||
                    textOf(micro?.attributedDescription);
                  const nextDescription = findDescriptionInNext(nextData);

                  // Ưu tiên text có hashtag / mô tả từ /next, sau đó player.
                  const descriptions = [
                    String(details.shortDescription || ""),
                    String(microDescription || ""),
                    String(nextDescription || "")
                  ].filter(Boolean);
                  descriptions.sort((a, b) => {
                    const ah = hashtagsOf(a).length;
                    const bh = hashtagsOf(b).length;
                    return (bh - ah) || (b.length - a.length);
                  });
                  const description = descriptions[0] || "";

                  const combinedForHashes = [
                    details.title || "",
                    ...descriptions
                  ].join("\n");

                  items[videoId] = {
                    title: String(details.title || textOf(micro?.title) || ""),
                    description,
                    hashtags: hashtagsOf(combinedForHashes),
                    tags: Array.isArray(details.keywords)
                      ? details.keywords.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim())
                      : [],
                    publishedAt: String(micro.publishDate || micro.uploadDate || ""),
                    metadataSource: nextDescription ? "youtubei-next" : "youtubei-player"
                  };
                } catch (_) {}
              }
            }

            await Promise.all(Array.from({ length: workers }, () => worker()));
            return { ok: true, items };
          }
        });

        if (result?.ok && result?.items) resolvedMap = result.items;
      } catch (_) {
        resolvedMap = {};
      } finally {
        if (resolverTab?.id) {
          try { await chrome.tabs.remove(resolverTab.id); } catch (_) {}
        }
      }
    }

    let completed = 0;
    let failed = 0;
    const cacheHits = total - missing.length;
    const renderedFallback = [];

    for (let i = 0; i < total; i++) {
      checkStopped();
      if (out[i]) {
        const parsed = out[i].publishedAt ? Date.parse(out[i].publishedAt) : NaN;
        out[i]._time = Number.isFinite(parsed) ? parsed : NaN;
        completed++;
        continue;
      }

      const id = videoIds[i];
      const direct = resolvedMap[id] || null;
      const directHashes = direct
        ? [...new Set([...(direct.hashtags || []), ...extractHashtagsBg(`${direct.title || ""}\n${direct.description || ""}`)])]
        : [];

      // Nếu đã lấy được hashtag thì coi metadata là chuẩn ngay.
      // Nếu chưa có hashtag, vẫn giữ data nhưng bắt buộc xác minh qua DOM trang YouTube.
      if (direct) {
        const parsed = direct.publishedAt ? Date.parse(direct.publishedAt) : NaN;
        out[i] = {
          ...direct,
          hashtags: directHashes,
          id,
          _time: Number.isFinite(parsed) ? parsed : NaN,
          _candidateIndex: i
        };
      }

      if (!directHashes.length) renderedFallback.push({ id, index: i });
      else {
        cache[id] = { savedAt: now, data: out[i] };
        completed++;
      }
    }

    // Cách 2 (xác minh cuối): mở đúng trang watch của video và đọc DOM mà người dùng nhìn thấy.
    // Chỉ chạy cho video chưa lấy ra hashtag ở player/next. Đây là lớp chống lỗi cuối cùng.
    let nextRendered = 0;
    const renderedWorkers = Math.min(6, renderedFallback.length);

    async function renderedWorker() {
      while (true) {
        checkStopped();
        const pos = nextRendered++;
        if (pos >= renderedFallback.length) return;
        const { id, index } = renderedFallback[pos];
        let tab = null;

        try {
          tab = await chrome.tabs.create({
            url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&hl=vi`,
            active: false
          });
          await waitForTabCompleteBg(tab.id, 18000);
          await sleep(220);

          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            args: [id],
            func: async (targetId) => {
              const texts = [];
              const add = (value) => {
                const text = String(value || "").trim();
                if (text && !texts.includes(text)) texts.push(text);
              };
              const hashes = (text) => String(text || "").match(/#[\\p{L}\\p{N}_\\u200c\\u200d]+/gu) || [];

              // Player response của chính trang.
              const p = window.ytInitialPlayerResponse || {};
              const details = p?.videoDetails || {};
              if (!details.videoId || details.videoId === targetId) {
                add(details.shortDescription);
                add(details.title);
                const micro = p?.microformat?.playerMicroformatRenderer || {};
                add(micro?.description?.simpleText);
                if (Array.isArray(micro?.description?.runs)) add(micro.description.runs.map((r) => r?.text || "").join(""));
              }

              // DOM của Watch page: textContent chứa cả phần bị thu gọn bởi "...thêm".
              const selectors = [
                '#description-inline-expander',
                'ytd-text-inline-expander#description-inline-expander',
                '#description-inner',
                'ytd-watch-metadata #description',
                'ytd-watch-metadata',
                'meta[name="description"]',
                'meta[property="og:description"]'
              ];
              for (const sel of selectors) {
                for (const el of document.querySelectorAll(sel)) {
                  add(el.getAttribute?.('content'));
                  add(el.textContent);
                  add(el.innerText);
                }
              }

              // Nếu watch metadata chưa hydrate, chờ ngắn rồi đọc lại.
              if (!texts.some((t) => hashes(t).length)) {
                await new Promise((r) => setTimeout(r, 450));
                for (const el of document.querySelectorAll('#description-inline-expander, ytd-watch-metadata, #description-inner')) {
                  add(el.textContent);
                  add(el.innerText);
                }
              }

              // Chọn text có nhiều hashtag nhất, sau đó dài nhất.
              texts.sort((a, b) => (hashes(b).length - hashes(a).length) || (b.length - a.length));
              const best = texts[0] || "";
              const allHashes = [...new Set(texts.flatMap(hashes))];

              return {
                title: String(details.title || document.title.replace(/\s*-\s*YouTube\s*$/i, "") || ""),
                description: best,
                hashtags: allHashes,
                tags: Array.isArray(details.keywords) ? details.keywords : [],
                publishedAt: String(p?.microformat?.playerMicroformatRenderer?.publishDate || p?.microformat?.playerMicroformatRenderer?.uploadDate || ""),
                metadataSource: "rendered-watch-dom"
              };
            }
          });

          const previous = out[index] || { id, _candidateIndex: index };
          const mergedHashes = [...new Set([
            ...(previous.hashtags || []),
            ...(result?.hashtags || []),
            ...extractHashtagsBg(`${result?.title || ""}\n${result?.description || ""}`)
          ])];

          const merged = {
            ...previous,
            title: result?.title || previous.title || "",
            description: result?.description || previous.description || "",
            hashtags: mergedHashes,
            tags: (result?.tags || []).length ? result.tags : (previous.tags || []),
            publishedAt: result?.publishedAt || previous.publishedAt || "",
            metadataSource: mergedHashes.length ? (result?.metadataSource || previous.metadataSource || "rendered") : (previous.metadataSource || "")
          };
          const parsed = merged.publishedAt ? Date.parse(merged.publishedAt) : NaN;
          out[index] = { ...merged, id, _time: Number.isFinite(parsed) ? parsed : NaN, _candidateIndex: index };

          // Cache chỉ khi thực sự có dữ liệu có ích; đặc biệt không cache "0 hashtag" rỗng.
          if (merged.description || merged.hashtags.length || merged.tags.length) {
            cache[id] = { savedAt: now, data: out[index] };
          }
          if (!merged.hashtags.length && !merged.description) failed++;
        } catch (_) {
          failed++;
        } finally {
          if (tab?.id) {
            try { await chrome.tabs.remove(tab.id); } catch (_) {}
          }
          completed++;
          if (completed === total || completed % 6 === 0) {
            const pct = total ? 42 + Math.round((completed / total) * 55) : 97;
            await updateJob({
              progress: pct,
              progressText: `Metadata ${Math.min(completed, total)}/${total}${cacheHits ? ` • cache ${cacheHits}` : ""}`,
              message: `Đang xác minh hashtag trực tiếp trên YouTube: ${Math.min(completed, total)}/${total}${failed ? ` • lỗi ${failed}` : ""}...`
            });
          }
        }
      }
    }

    if (renderedWorkers) await Promise.all(Array.from({ length: renderedWorkers }, () => renderedWorker()));

    // Cách 3: HTML fallback cuối cùng cho item vẫn chưa có metadata nào.
    const htmlFallback = [];
    for (let i = 0; i < total; i++) {
      const item = out[i];
      if (!item || (!item.description && !(item.hashtags || []).length && !(item.tags || []).length)) {
        htmlFallback.push({ id: videoIds[i], index: i });
      }
    }

    let nextHtml = 0;
    async function htmlWorker() {
      while (true) {
        checkStopped();
        const pos = nextHtml++;
        if (pos >= htmlFallback.length) return;
        const { id, index } = htmlFallback[pos];
        try {
          const data = await fetchVideoDataBg(id);
          if (data) {
            const hs = [...new Set([
              ...(data.hashtags || []),
              ...extractHashtagsBg(`${data.title || ""}\n${data.description || ""}`)
            ])];
            const parsed = data.publishedAt ? Date.parse(data.publishedAt) : NaN;
            out[index] = {
              ...data,
              hashtags: hs,
              metadataSource: "html-fallback",
              id,
              _time: Number.isFinite(parsed) ? parsed : NaN,
              _candidateIndex: index
            };
            if (data.description || hs.length || (data.tags || []).length) {
              cache[id] = { savedAt: now, data: out[index] };
            }
          }
        } catch (_) {}
      }
    }
    const htmlWorkers = Math.min(4, htmlFallback.length);
    if (htmlWorkers) await Promise.all(Array.from({ length: htmlWorkers }, () => htmlWorker()));

    try {
      const entries = Object.entries(cache);
      if (entries.length > 1200) {
        entries.sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0));
        cache = Object.fromEntries(entries.slice(0, 1200));
      }
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
      // Dọn cache lỗi cũ để nó không quay lại ảnh hưởng các lần scan sau.
      await chrome.storage.local.remove([
        "babylonVideoMetaCacheV4_first12",
        "babylonVideoMetaCacheV3",
        "babylonVideoMetaCacheV2"
      ]);
    } catch (_) {}

    return out.filter(Boolean);
  }

  async function fetchVideoDataBg(videoId) {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=vi`;
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return extractVideoDataFromHtmlBg(await response.text());
  }

  function decodeJsonStringBg(raw) {
    try { return JSON.parse(`"${raw}"`); } catch (_) { return ""; }
  }

  function extractJsonArrayAfterBg(text, key, start = 0, maxDistance = 500000) {
    const keyPos = text.indexOf(`"${key}"`, start);
    if (keyPos < 0 || keyPos - start > maxDistance) return null;
    const colon = text.indexOf(":", keyPos + key.length + 2);
    if (colon < 0) return null;
    let i = colon + 1;
    while (/\s/.test(text[i] || "")) i++;
    if (text[i] !== "[") return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length && j - i < maxDistance; j++) {
      const ch = text[j];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') inString = true;
      else if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(i, j + 1)); } catch (_) { return null; }
        }
      }
    }

    return null;
  }

  function extractJsonStringAfterBg(text, key, start = 0, maxDistance = 500000) {
    const keyPos = text.indexOf(`"${key}"`, start);
    if (keyPos < 0 || keyPos - start > maxDistance) return "";
    const colon = text.indexOf(":", keyPos + key.length + 2);
    if (colon < 0) return "";
    const rest = text.slice(colon + 1, colon + 1 + maxDistance);
    const m = rest.match(/^\s*"((?:\\.|[^"\\])*)"/);
    return m?.[1] ? decodeJsonStringBg(m[1]) : "";
  }

  function extractVideoDataFromHtmlBg(html) {
    if (!html) return { tags: [], title: "", description: "", publishedAt: "" };

    let base = html.indexOf('"videoDetails"');
    if (base < 0) base = html.indexOf("videoDetails");
    if (base < 0) base = 0;

    const tags = extractJsonArrayAfterBg(html, "keywords", base, 600000);
    const title = extractJsonStringAfterBg(html, "title", base, 250000);
    const description = extractJsonStringAfterBg(html, "shortDescription", base, 600000);
    const publishedAt =
      extractJsonStringAfterBg(html, "publishDate", 0, 2500000) ||
      extractJsonStringAfterBg(html, "uploadDate", 0, 2500000);

    const metaDescription = (() => {
      const m = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
      return m?.[1] || "";
    })();

    const metaTitle = (() => {
      const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
                html.match(/<title>([^<]*)<\/title>/i);
      return m?.[1] || "";
    })();

    const finalTitle = title || metaTitle || "";
    const finalDescription = description || metaDescription || "";
    return {
      tags: Array.isArray(tags)
        ? tags.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim())
        : [],
      title: finalTitle,
      description: finalDescription,
      hashtags: extractHashtagsBg(`${finalTitle}\n${finalDescription}`),
      publishedAt: publishedAt || ""
    };
  }

  function extractHashtagsBg(text) {
    const matches = String(text || "").match(/#[\p{L}\p{N}_\u200c\u200d]+/gu) || [];
    const seen = new Set();
    const out = [];

    for (const tag of matches) {
      const key = tag.toLocaleLowerCase("vi");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }

    return out;
  }

  function addUsageBg(map, values) {
    const localSeen = new Set();

    for (const value of values || []) {
      const display = String(value || "").trim();
      if (!display) continue;

      const key = display.toLocaleLowerCase("vi");
      if (localSeen.has(key)) continue;
      localSeen.add(key);

      if (!map.has(key)) map.set(key, { text: display, count: 0 });
      map.get(key).count++;
    }
  }

  function splitKeywordsBg(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];

    const result = [];

    if (text.includes(",")) {
      let token = "";
      let quoted = false;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
          quoted = !quoted;
          continue;
        }
        if (ch === "," && !quoted) {
          const value = token.trim();
          if (value) result.push(value);
          token = "";
        } else {
          token += ch;
        }
      }

      const tail = token.trim();
      if (tail) result.push(tail);
    } else {
      const re = /"([^"]+)"|(\S+)/g;
      let match;
      while ((match = re.exec(text)) !== null) {
        const value = (match[1] || match[2] || "").trim();
        if (value) result.push(value);
      }
    }

    const seen = new Set();
    return result
      .map((item) => item.replace(/^[\s'“”"]+|[\s'“”"]+$/g, "").trim())
      .filter((item) => {
        if (!item || item === "…" || item === "...") return false;
        const key = item.toLocaleLowerCase("vi");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // Reload reset theo từng chức năng, không ảnh hưởng cache của công cụ khác.
  // - YouTube Keywords: giữ hành vi cũ, F5 YouTube xóa kết quả Keywords.
  // - Facebook Duyệt bài: chỉ F5 trang /groups/<id>/pending_posts mới xóa KẾT QUẢ QUÉT.
  //   Lịch sử giới hạn 1 bài/24h (fbApproveRolling24h:...) được giữ nguyên để chống đăng lặp.
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0 || details.transitionType !== 'reload') return;

    try {
      const tab = await chrome.tabs.get(details.tabId);
      const url = new URL(details.url || tab?.url || '');
      const host = url.hostname.replace(/^www\./, '').toLowerCase();

      const isFacebook = host === 'facebook.com' || host === 'm.facebook.com';
      if (isFacebook) {
        const pendingMatch = url.pathname.match(/^\/groups\/([^/]+)\/pending_posts(?:\/|$)/i);
        if (pendingMatch) {
          // Chỉ xóa danh sách kết quả Scan/Auto đang hiển thị của Duyệt bài.
          // TUYỆT ĐỐI không xóa fbApproveRolling24h:<groupId>.
          await chrome.storage.local.remove(`fbApproveScanCache:${pendingMatch[1]}`);
          return;
        }
      }

      if (!tab?.active) return;
      const isYoutube = host === 'youtube.com' || host === 'm.youtube.com';
      if (!isYoutube) return;
      await resetKeywordState();
    } catch (_) {}
  });

})();


/* ===== BaByLon 1.27 media request compatibility ===== */
(async () => {
  try {
    if (!chrome.declarativeNetRequest?.updateSessionRules) return;
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [12701],
      addRules: [{
        id: 12701,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' }
          ]
        },
        condition: {
          regexFilter: '^https://[^/]*googlevideo\\.com/',
          resourceTypes: ['xmlhttprequest','media','other']
        }
      }]
    });
  } catch (e) {
    console.warn('BaByLon media header rule:', e);
  }
})();


/* ===== BaByLon 1.29 Passive Media Detector =====
 * Independent implementation inspired by a common browser-downloader workflow:
 * observe public media responses locally, cache candidates per tab, and let the
 * BaByLon UI render them immediately. No browsing history is transmitted.
 */
(() => {
  const tabCache = new Map();
  const requestTab = new Map();
  const MAX_ITEMS = 120;

  const YT = {
    17:{quality:'144p',ext:'3gp',kind:'video',hasAudio:true,hasVideo:true},
    18:{quality:'360p',ext:'mp4',kind:'video',hasAudio:true,hasVideo:true},
    22:{quality:'720p',ext:'mp4',kind:'video',hasAudio:true,hasVideo:true},
    37:{quality:'1080p',ext:'mp4',kind:'video',hasAudio:true,hasVideo:true},
    160:{quality:'144p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    133:{quality:'240p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    134:{quality:'360p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    135:{quality:'480p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    136:{quality:'720p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    137:{quality:'1080p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    264:{quality:'1440p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    266:{quality:'2160p',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    298:{quality:'720p60',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    299:{quality:'1080p60',ext:'mp4',kind:'video',hasAudio:false,hasVideo:true},
    278:{quality:'144p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    242:{quality:'240p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    243:{quality:'360p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    244:{quality:'480p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    247:{quality:'720p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    248:{quality:'1080p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    271:{quality:'1440p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    313:{quality:'2160p',ext:'webm',kind:'video',hasAudio:false,hasVideo:true},
    139:{quality:'48 kbps',ext:'m4a',kind:'audio',hasAudio:true,hasVideo:false},
    140:{quality:'128 kbps',ext:'m4a',kind:'audio',hasAudio:true,hasVideo:false},
    141:{quality:'256 kbps',ext:'m4a',kind:'audio',hasAudio:true,hasVideo:false},
    249:{quality:'50 kbps',ext:'webm',kind:'audio',hasAudio:true,hasVideo:false},
    250:{quality:'70 kbps',ext:'webm',kind:'audio',hasAudio:true,hasVideo:false},
    251:{quality:'160 kbps',ext:'webm',kind:'audio',hasAudio:true,hasVideo:false}
  };

  chrome.webRequest.onBeforeRequest.addListener((d) => {
    if (d.tabId >= 0) requestTab.set(d.requestId, d.tabId);
  }, {urls:['<all_urls>']});

  chrome.webRequest.onHeadersReceived.addListener((d) => {
    const tabId = d.tabId >= 0 ? d.tabId : requestTab.get(d.requestId);
    requestTab.delete(d.requestId);
    if (!(tabId >= 0) || !/^https?:/i.test(d.url || '')) return;
    const item = classifyPassive(d);
    if (!item) return;
    const cache = getCache(tabId);
    const key = passiveKey(item);
    const old = cache.items.get(key);
    if (!old || passiveScore(item) >= passiveScore(old)) cache.items.set(key, item);
    while (cache.items.size > MAX_ITEMS) cache.items.delete(cache.items.keys().next().value);
    cache.updatedAt = Date.now();
  }, {urls:['<all_urls>']}, ['responseHeaders']);

  chrome.tabs.onRemoved.addListener(tabId => tabCache.delete(tabId));
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (!change.url) return;
    // YouTube is a SPA. Do not instantly throw away the network cache on every
    // watch/playlist URL mutation; VDH-style detection benefits from keeping the
    // most recent media responses in the same tab. Old entries are naturally
    // replaced/deduped and the tab cache is removed when the tab closes.
    try {
      const host = new URL(change.url).hostname.replace(/^www\./,'');
      if (host === 'youtube.com' || host === 'm.youtube.com') return;
    } catch {}
    tabCache.delete(tabId);
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!['BABYLON_PASSIVE_MEDIA_GET','BABYLON_PASSIVE_MEDIA_CLEAR'].includes(msg?.type)) return false;
    try {
      const tabId = Number(msg.tabId || sender.tab?.id || 0);
      if (!tabId) throw new Error('Không xác định được tab.');
      if (msg.type === 'BABYLON_PASSIVE_MEDIA_CLEAR') {
        tabCache.delete(tabId);
        sendResponse({ok:true});
      } else {
        const cache = getCache(tabId);
        sendResponse({ok:true,items:[...cache.items.values()],updatedAt:cache.updatedAt});
      }
    } catch (e) { sendResponse({ok:false,error:e?.message||String(e)}); }
    return false;
  });

  function getCache(tabId){
    let c=tabCache.get(tabId);if(!c){c={items:new Map(),updatedAt:0};tabCache.set(tabId,c);}return c;
  }
  function header(headers,name){const h=(headers||[]).find(x=>String(x.name||'').toLowerCase()===name);return h?.value||'';}
  function classifyPassive(d){
    const url=String(d.url||'');
    let u;try{u=new URL(url);}catch{return null;}
    const type=String(header(d.responseHeaders,'content-type')||'').toLowerCase();
    const length=Number(header(d.responseHeaders,'content-length')||0);
    const range=header(d.responseHeaders,'content-range');
    const totalFromRange=Number(String(range).match(/\/(\d+)$/)?.[1]||0);
    const totalBytes=totalFromRange||length||Number(u.searchParams.get('clen')||0);
    const itag=Number(u.searchParams.get('itag')||0); const yt=YT[itag]||null;
    const isManifest=/application\/(?:vnd\.apple\.mpegurl|x-mpegurl|dash\+xml)/i.test(type)||/\.(?:m3u8|mpd)(?:\?|$)/i.test(url);
    const isVideo=/^video\//i.test(type)||/\.(?:mp4|m4v|webm|mov)(?:\?|$)/i.test(url)||/googlevideo\.com|videoplayback|fbcdn\.net|bilivideo|byteoversea|douyinvod/i.test(url);
    const isAudio=/^audio\//i.test(type)||/\.(?:m4a|mp3|aac|ogg|opus)(?:\?|$)/i.test(url);
    if(!isManifest&&!isVideo&&!isAudio)return null;
    if(isManifest)return{source:'passive',kind:'manifest',protocol:/mpd|dash/i.test(type+url)?'DASH':'HLS',url,mime:type,quality:'Streaming',ext:/mpd/i.test(url)?'mpd':'m3u8',hasVideo:true,hasAudio:true,totalBytes,detectedAt:Date.now()};
    let mime=type.split(';')[0];
    if(!mime&&u.searchParams.get('mime'))mime=decodeURIComponent(u.searchParams.get('mime'));
    let kind=yt?.kind||(isAudio&&!isVideo?'audio':'video');
    let ext=yt?.ext||(/webm/i.test(mime+url)?'webm':kind==='audio'?(type.includes('mpeg')?'mp3':'m4a'):'mp4');
    let quality=yt?.quality||guessQuality(u,url,kind);
    let hasAudio=yt?.hasAudio; let hasVideo=yt?.hasVideo;
    if(kind==='audio'){hasAudio=true;hasVideo=false;} else if(hasAudio==null){hasAudio=true;hasVideo=true;}
    const bitrate=Number(u.searchParams.get('bitrate')||u.searchParams.get('br')||0);
    return{source:'passive',url,mime,kind,quality,ext,itag,totalBytes,sizeBytes:totalBytes,bitrate,hasAudio,hasVideo,detectedAt:Date.now()};
  }
  function guessQuality(u,url,kind){
    if(kind==='audio'){const b=Number(u.searchParams.get('bitrate')||u.searchParams.get('br')||0);return b?`${Math.round(b/1000)} kbps`:'Audio';}
    const text=decodeURIComponent(url);
    const p=text.match(/(?:quality|height|res(?:olution)?)[=/:%_-]?(\d{3,4})/i)?.[1]||text.match(/(2160|1440|1080|720|480|360|240|144)p/i)?.[1];
    return p?`${p}p`:'Media';
  }
  function canonical(u){try{const x=new URL(u);for(const k of ['range','rn','rbuf','sq','ump','alr'])x.searchParams.delete(k);return x.toString();}catch{return u;}}
  function passiveKey(x){return x.itag?`yt:${x.itag}:${x.kind}`:`${x.kind}:${x.protocol||''}:${canonical(x.url).slice(0,500)}`;}
  function passiveScore(x){return (x.itag?20:0)+(x.totalBytes?8:0)+(x.hasAudio&&x.hasVideo?18:0)+(x.kind==='manifest'?2:0);}
})();

/* ===== BaByLon 1.37 YouTube Studio Analytics — exact visible Studio cards ===== */
(() => {
  const PROGRESS_KEY = 'babylonYtAnalyticsProgress';
  const RESULT_KEY = 'babylonYtAnalyticsResult';
  const analyticsDebug = new Map();

  const METRIC_DEFS = {
    views:{labels:['Số lượt xem','Lượt xem','Views'],tokens:['VIEWS'],type:'count',display:'Lượt xem'},
    watchTime:{labels:['Thời gian xem (giờ)','Thời gian xem','Watch time (hours)','Watch time'],tokens:['WATCH_TIME','WATCH_TIME_HOURS'],type:'number',display:'Giờ xem'},
    subscribers:{labels:['Số người đăng ký','Người đăng ký','Subscribers'],tokens:['SUBSCRIBERS_NET_CHANGE','SUBSCRIBERS'],type:'signed',display:'Người đăng ký'},
    impressions:{labels:['Số lượt hiển thị hình thu nhỏ','Số lần hiển thị hình thu nhỏ','Số lần hiển thị','Impressions'],tokens:['IMPRESSIONS','THUMBNAIL_IMPRESSIONS'],type:'count',display:'Hiển thị'},
    ctr:{labels:['Tỷ lệ nhấp vào hình thu nhỏ','Tỷ lệ nhấp của số lần hiển thị','Tỷ lệ nhấp lượt hiển thị','Tỷ lệ nhấp','Impressions click-through rate','Impressions CTR'],tokens:['IMPRESSIONS_CTR','THUMBNAIL_IMPRESSIONS_CTR'],type:'percent',display:'CTR'},
    averageViewDuration:{labels:['Thời lượng xem trung bình','Thời lượng xem TB','Average view duration'],tokens:['AVERAGE_VIEW_DURATION','AVERAGE_WATCH_TIME'],type:'duration',display:'Thời lượng xem TB'},
    averagePercentageViewed:{labels:['Tỷ lệ phần trăm đã xem trung bình','Phần trăm đã xem trung bình','Average percentage viewed'],tokens:['AVERAGE_PERCENTAGE_VIEWED'],type:'percent',display:'% xem trung bình'},
    estimatedRevenue:{labels:['Doanh thu ước tính','Estimated revenue'],tokens:['ESTIMATED_REVENUE','REVENUE'],type:'money',display:'Doanh thu'},
    adRevenue:{labels:['Doanh thu quảng cáo ước tính','Doanh thu quảng cáo','Estimated ad revenue','Ad revenue'],tokens:['ESTIMATED_AD_REVENUE','AD_REVENUE'],type:'money',display:'Doanh thu quảng cáo'},
    rpm:{labels:['Doanh thu mỗi nghìn lượt xem có chủ đích (RPM)','Doanh thu trên mỗi 1.000 lượt xem (RPM)','Revenue per 1,000 engaged views (RPM)','Revenue per mille (RPM)','RPM'],tokens:['REVENUE_PER_MILLE','RPM'],type:'money',display:'RPM'},
    cpm:{labels:['CPM dựa trên lượt phát','CPM theo lượt phát','Chi phí mỗi 1.000 lượt phát','Playback-based CPM','CPM'],tokens:['PLAYBACK_BASED_CPM','CPM'],type:'money',display:'CPM'},
    monetizedPlaybacks:{labels:['Số lượt phát có bật tính năng kiếm tiền ước tính','Lượt phát có bật tính năng kiếm tiền','Estimated monetized playbacks','Monetized playbacks'],tokens:['MONETIZED_PLAYBACKS','ESTIMATED_MONETIZED_PLAYBACKS'],type:'count',display:'Lượt phát có quảng cáo'},
    newViewers:{labels:['Người xem mới','New viewers'],tokens:['NEW_VIEWERS'],type:'count',display:'Người xem mới'},
    returningViewers:{labels:['Người xem quay lại','Returning viewers'],tokens:['RETURNING_VIEWERS'],type:'count',display:'Người xem quay lại'},
    monthlyAudience:{labels:['Khán giả hằng tháng','Khán giả hàng tháng','Monthly audience'],tokens:['MONTHLY_AUDIENCE'],type:'count',display:'Khán giả tháng'},
    uniqueViewers:{labels:['Người xem duy nhất','Người xem riêng biệt','Unique viewers'],tokens:['UNIQUE_VIEWERS'],type:'count',display:'Người xem duy nhất'},
    engagedViews:{labels:['Lượt xem có chủ đích','Lượt xem chủ động','Engaged views'],tokens:['ENGAGED_VIEWS'],type:'count',display:'Engaged views'},
    shownInFeed:{labels:['Hiển thị trong nguồn cấp dữ liệu','Đã hiển thị trong nguồn cấp dữ liệu','Shown in feed'],tokens:['SHOWN_IN_FEED','SHORTS_FEED_IMPRESSIONS'],type:'count',display:'Hiện trong Shorts feed'},
    stayedToWatch:{labels:['Đã xem so với vuốt bỏ qua','Ở lại xem','Stayed to watch','Viewed vs swiped away'],tokens:['STAYED_TO_WATCH','VIEWED_VS_SWIPED_AWAY'],type:'percent',display:'Ở lại xem'},
    likes:{labels:['Lượt thích','Likes'],tokens:['LIKES'],type:'count',display:'Lượt thích'},
    comments:{labels:['Bình luận','Comments'],tokens:['COMMENTS'],type:'count',display:'Bình luận'},
    shares:{labels:['Lượt chia sẻ','Chia sẻ','Shares'],tokens:['SHARES'],type:'count',display:'Chia sẻ'},
    realtimeViews:{labels:['Lượt xem · 48 giờ qua','Lượt xem 48 giờ qua','Views · Last 48 hours','Views in last 48 hours'],tokens:['REALTIME_VIEWS','VIEWS_48_HOURS'],type:'count',display:'Lượt xem 48 giờ'}
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'BABYLON_YT_ANALYTICS_RUN') return false;
    (async () => {
      try {
        const result = await runYoutubeStudioAnalytics();
        await chrome.storage.local.set({ [RESULT_KEY]: result });
        sendResponse({ ok: true, result });
      } catch (error) {
        await setAnalyticsProgress(100, error?.message || String(error), false);
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  });

  chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source?.tabId;
    const session = analyticsDebug.get(tabId);
    if (!session) return;
    if (method === 'Network.requestWillBeSent') {
      const req = params?.request || {};
      if (!req.url) return;
      if (/studio\.youtube\.com\/youtubei\/v1\//i.test(req.url)) {
        session.requests.set(params.requestId, {url:req.url, postData:req.postData || '', ts:Date.now()});
      }
      return;
    }
    if (method === 'Network.responseReceived') {
      const response = params?.response || {};
      const req = session.requests.get(params.requestId);
      if (!req) return;
      const interesting = /analytics_data|creator_analytics|dashboard|channel_analytics/i.test(req.url + ' ' + req.postData);
      if (!interesting) return;
      session.pending.set(params.requestId, { ...req, mime:response.mimeType || '', status:response.status || 0 });
      return;
    }
    if (method === 'Network.loadingFinished') {
      const meta = session.pending.get(params.requestId);
      if (!meta) return;
      session.pending.delete(params.requestId);
      (async () => {
        try {
          const body = await debuggerCommandAnalytics(tabId, 'Network.getResponseBody', {requestId:params.requestId});
          let text = body?.body || '';
          if (body?.base64Encoded) text = decodeBase64Utf8(text);
          if (!text || text.length > 25_000_000) return;
          const json = JSON.parse(text);
          session.responses.push({url:meta.url, postData:meta.postData, json, ts:Date.now()});
          if (session.responses.length > 120) session.responses.shift();
        } catch (_) {}
      })();
    }
  });

  chrome.debugger.onDetach.addListener(source => {
    const s = analyticsDebug.get(source?.tabId);
    if (s) s.attached = false;
  });

  function decodeBase64Utf8(str) {
    try {
      const bin = atob(str); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch { return ''; }
  }

  function debuggerCommandAnalytics(tabId, method, params={}) {
    return new Promise((resolve,reject)=>chrome.debugger.sendCommand({tabId},method,params,res=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve(res)));
  }

  async function attachAnalyticsDebugger(tabId) {
    const session={requests:new Map(),pending:new Map(),responses:[],attached:false};
    analyticsDebug.set(tabId,session);
    await new Promise((resolve,reject)=>chrome.debugger.attach({tabId},'1.3',()=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve()));
    session.attached=true;
    await debuggerCommandAnalytics(tabId,'Network.enable',{maxTotalBufferSize:50_000_000,maxResourceBufferSize:20_000_000,maxPostDataSize:5_000_000});
    await debuggerCommandAnalytics(tabId,'Network.setCacheDisabled',{cacheDisabled:true}).catch(()=>{});
    return session;
  }

  async function detachAnalyticsDebugger(tabId) {
    const session=analyticsDebug.get(tabId);
    analyticsDebug.delete(tabId);
    if (session?.attached) await new Promise(resolve=>chrome.debugger.detach({tabId},()=>resolve())).catch(()=>{});
    return session;
  }

  async function setAnalyticsProgress(percent, text, running = true) {
    await chrome.storage.local.set({[PROGRESS_KEY]:{percent,text,running,updatedAt:Date.now()}}).catch(()=>{});
  }

  async function runYoutubeStudioAnalytics() {
    let tabId = null;
    let originalActive = null;
    let createdTab = false;
    try {
      await setAnalyticsProgress(2, 'Chuẩn bị đọc trực tiếp YouTube Studio...');
      originalActive = (await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []))?.[0] || null;

      // IMPORTANT: YouTube Studio lazily renders / throttles analytics on an inactive
      // background tab. Previous builds crawled a hidden tab, which is why the user
      // could SEE CTR/RPM in Studio while BaByLon received blanks. 1.38 deliberately
      // uses a temporary ACTIVE Studio tab, reads the exact rendered cards, then
      // returns the user to the tab they were on.
      const tab = await chrome.tabs.create({
        url: 'https://studio.youtube.com/',
        active: true,
        ...(originalActive?.windowId ? { windowId: originalActive.windowId } : {})
      });
      tabId = tab.id;
      createdTab = true;
      if (!tabId) throw new Error('Không mở được YouTube Studio.');

      await waitAnalyticsTab(tabId, 30000);
      await waitForStudioReady(tabId, 18000);
      const identity = await executeAnalyticsSnapshot(tabId, 'identity');
      if (/accounts\.google\.com|ServiceLogin/i.test(identity?.href || '')) {
        throw new Error('Bạn chưa đăng nhập YouTube Studio.');
      }

      let channelId = String(identity?.href || '').match(/\/channel\/(UC[\w-]+)/)?.[1] || identity?.channelId || '';
      if (!channelId) {
        const r = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const hrefs = [...document.querySelectorAll('a[href]')].map(a => a.href || '');
            const h = hrefs.find(x => /studio\.youtube\.com\/channel\/UC[\w-]+/i.test(x));
            return h?.match(/\/channel\/(UC[\w-]+)/)?.[1] || location.href.match(/\/channel\/(UC[\w-]+)/)?.[1] || '';
          }
        }).catch(() => []);
        channelId = r?.[0]?.result || '';
      }
      if (!channelId) throw new Error('Không xác định được kênh YouTube đang đăng nhập.');

      const pages = {};
      const base = `https://studio.youtube.com/channel/${channelId}`;

      async function openRoute(key, path, pct, label, waitLabels = []) {
        await setAnalyticsProgress(pct, `Đọc ${label} trực tiếp từ YouTube Studio...`);
        await chrome.tabs.update(tabId, { url: `${base}/${path}`, active: true });
        await waitAnalyticsTab(tabId, 30000);
        await waitForStudioReady(tabId, 18000);
        if (waitLabels.length) await waitForStudioLabels(tabId, waitLabels, 12000).catch(() => false);
        pages[key] = pages[key] || {};
        pages[key].directApi = await executeStudioDirectApi(tabId, key.replace(/Video|Shorts$/,''), channelId).catch(() => null);
        pages[key].exact = await readExactStudioMetrics(tabId, key).catch(() => ({}));
        pages[key].dom = await deepCollectAnalyticsPage(tabId, key, true);
        // Re-read exact values after the scroll pass in case a card was lazy-rendered.
        pages[key].exact = {
          ...(pages[key].exact || {}),
          ...(await readExactStudioMetrics(tabId, key).catch(() => ({})))
        };
      }

      // 1) Overall channel cards.
      await openRoute(
        'overview',
        'analytics/tab-overview/period-default',
        10,
        'Tổng quan 28 ngày',
        ['Số lượt xem', 'Thời gian xem']
      );

      // 2) VIDEO analytics. CTR / impressions / AVD shown in the screenshot live here.
      await setAnalyticsProgress(30, 'Mở Nội dung → Video để đọc CTR / Hiển thị / AVD...');
      await chrome.tabs.update(tabId, { url: `${base}/analytics/tab-content/period-default`, active: true });
      await waitAnalyticsTab(tabId, 30000);
      await waitForStudioReady(tabId, 18000);
      await clickAnalyticsSubtab(tabId, 'Video').catch(() => false);
      await waitForStudioLabels(tabId, [
        'Tỷ lệ nhấp vào hình thu nhỏ',
        'Số lượt hiển thị hình thu nhỏ',
        'Thời lượng xem trung bình'
      ], 16000).catch(() => false);
      pages.contentVideo = {
        directApi: await executeStudioDirectApi(tabId, 'content', channelId).catch(() => null),
        exact: await readExactStudioMetrics(tabId, 'contentVideo').catch(() => ({})),
        dom: await deepCollectAnalyticsPage(tabId, 'contentVideo', true)
      };
      pages.contentVideo.exact = {
        ...(pages.contentVideo.exact || {}),
        ...(await readExactStudioMetrics(tabId, 'contentVideo').catch(() => ({})))
      };

      // 3) SHORTS analytics, for engaged views / feed / swipe metrics when available.
      await setAnalyticsProgress(48, 'Đọc Nội dung → Shorts...');
      await clickAnalyticsSubtab(tabId, 'Shorts').catch(() => false);
      await sleepAnalytics(1000);
      pages.contentShorts = {
        exact: await readExactStudioMetrics(tabId, 'contentShorts').catch(() => ({})),
        dom: await deepCollectAnalyticsPage(tabId, 'contentShorts', true)
      };

      // 4) Audience + viewer activity heatmap.
      await openRoute(
        'audience',
        'analytics/tab-audience/period-default',
        58,
        'Đối tượng người xem',
        ['Khán giả hằng tháng', 'Người xem quay lại', 'Khi người xem của bạn ở trên YouTube']
      );

      // 5) Revenue → Video. The official RPM in the user's screenshot is read HERE.
      await setAnalyticsProgress(73, 'Mở Doanh thu → Video để đọc RPM chính thức...');
      await chrome.tabs.update(tabId, { url: `${base}/analytics/tab-earn_revenue/period-default`, active: true });
      await waitAnalyticsTab(tabId, 30000);
      await waitForStudioReady(tabId, 18000);
      await clickAnalyticsSubtab(tabId, 'Video').catch(() => false);
      await waitForStudioLabels(tabId, [
        'Doanh thu mỗi nghìn lượt xem có chủ đích (RPM)',
        'Doanh thu ước tính'
      ], 16000).catch(() => false);
      pages.revenueVideo = {
        directApi: await executeStudioDirectApi(tabId, 'revenue', channelId).catch(() => null),
        exact: await readExactStudioMetrics(tabId, 'revenueVideo').catch(() => ({})),
        dom: await deepCollectAnalyticsPage(tabId, 'revenueVideo', true)
      };
      pages.revenueVideo.exact = {
        ...(pages.revenueVideo.exact || {}),
        ...(await readExactStudioMetrics(tabId, 'revenueVideo').catch(() => ({})))
      };

      // Read revenue overview as a separate scope. Do not let it overwrite Video RPM.
      pages.revenue = {
        directApi: await executeStudioDirectApi(tabId, 'revenue', channelId).catch(() => null),
        exact: await readExactStudioMetrics(tabId, 'revenue').catch(() => ({})),
        dom: pages.revenueVideo.dom
      };

      await setAnalyticsProgress(90, 'Đối chiếu các thẻ chính thức của Studio...');
      const responses = []; // 1.38 exact UI reader does not need chrome.debugger.
      const { metrics, metricSources, metricScopes } = mergeAllAnalytics(pages, responses);
      const heatmap = pickBestHeatmap(Object.values(pages).map(x => x?.dom?.heatmap));
      const channelName = cleanChannelName(pages.overview?.dom?.channelName || identity?.channelName || 'Kênh YouTube đang đăng nhập');
      const missingMetrics = Object.entries(METRIC_DEFS).filter(([k]) => !metrics[k]).map(([, d]) => d.display);

      const result = {
        channelId,
        channelName,
        metrics,
        metricSources,
        metricScopes,
        heatmap,
        pagesRead: Object.keys(pages).length,
        fallbackReads: 0,
        apiResponses: 0,
        missingMetrics,
        updatedAt: Date.now(),
        source: 'youtube-studio-exact-ui-v138'
      };
      await setAnalyticsProgress(
        100,
        `Hoàn tất • ${Object.values(metrics).filter(Boolean).length} chỉ số chính thức. CTR/RPM lấy trực tiếp từ card Studio.`,
        false
      );
      return result;
    } finally {
      if (createdTab && tabId) await chrome.tabs.remove(tabId).catch(() => {});
      if (originalActive?.id) {
        await chrome.tabs.update(originalActive.id, { active: true }).catch(() => {});
        if (originalActive.windowId) await chrome.windows.update(originalActive.windowId, { focused: true }).catch(() => {});
      }
    }
  }

  function cleanChannelName(v){return String(v||'').replace(/\s*-\s*YouTube Studio.*$/i,'').trim();}
  function sleepAnalytics(ms){return new Promise(r=>setTimeout(r,ms));}
  async function waitAnalyticsTab(tabId,timeoutMs=20000){const st=Date.now();while(Date.now()-st<timeoutMs){try{const t=await chrome.tabs.get(tabId);if(t?.status==='complete')return;}catch{}await sleepAnalytics(250);}}

  async function executeStudioDirectApi(tabId, mode, channelId) {
    const res=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async(mode,channelId)=>{
      try{
        const cfg=window.ytcfg;
        const key=cfg?.get?.('INNERTUBE_API_KEY');
        const context=cfg?.get?.('INNERTUBE_CONTEXT');
        if(!key||!context)return{ok:false,error:'No Innertube config'};
        const tabMap={overview:'ANALYTICS_TAB_ID_OVERVIEW',content:'ANALYTICS_TAB_ID_CONTENT',audience:'ANALYTICS_TAB_ID_AUDIENCE',revenue:'ANALYTICS_TAB_ID_REVENUE',reach:'ANALYTICS_TAB_ID_REACH',engagement:'ANALYTICS_TAB_ID_ENGAGEMENT'};
        const body={context,screenConfig:{entity:{channelId}},desktopState:{tabId:tabMap[mode]||tabMap.overview}};
        const r=await fetch(`/youtubei/v1/analytics_data/get_screen?alt=json&key=${encodeURIComponent(key)}`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
        const text=await r.text();
        if(!r.ok)return{ok:false,status:r.status,error:text.slice(0,500)};
        try{return{ok:true,json:JSON.parse(text)}}catch{return{ok:false,error:'Invalid JSON'}}
      }catch(e){return{ok:false,error:String(e?.message||e)}}
    },args:[mode,channelId]}).catch(()=>[]);
    return res?.[0]?.result||null;
  }

  async function clickAnalyticsSubtab(tabId, label) {
    const r = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (wanted) => {
        const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
        const target = norm(wanted);
        const all = [];
        const walk = root => {
          if (!root) return;
          const nodes = root.querySelectorAll ? [...root.querySelectorAll('*')] : [];
          for (const el of nodes) {
            all.push(el);
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        walk(document);
        const visible = el => {
          try { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none'; } catch { return false; }
        };
        const candidates = all.filter(el => {
          if (!visible(el)) return false;
          const txt = norm(el.innerText || el.textContent || '');
          return txt === target && txt.length < 40;
        });
        if (!candidates.length) return false;
        // Prefer actual tabs/buttons and the smallest visible element (deepest label).
        candidates.sort((a,b) => {
          const pa = /^(BUTTON|A|TP-YT-PAPER-TAB|YTCP-BUTTON)$/i.test(a.tagName) || /tab|button/i.test(a.getAttribute('role') || '') ? 0 : 1;
          const pb = /^(BUTTON|A|TP-YT-PAPER-TAB|YTCP-BUTTON)$/i.test(b.tagName) || /tab|button/i.test(b.getAttribute('role') || '') ? 0 : 1;
          if (pa !== pb) return pa - pb;
          const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
          return (ra.width*ra.height) - (rb.width*rb.height);
        });
        let el = candidates[0];
        let clickable = el;
        for (let i=0;i<5 && clickable;i++,clickable=clickable.parentElement) {
          const role = clickable.getAttribute?.('role') || '';
          if (/^(BUTTON|A|TP-YT-PAPER-TAB|YTCP-BUTTON)$/i.test(clickable.tagName) || /tab|button/i.test(role) || typeof clickable.onclick === 'function') {
            el = clickable; break;
          }
        }
        try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch {}
        try {
          ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window})));
          el.click?.();
        } catch { try { el.click?.(); } catch {} }
        return true;
      },
      args: [label]
    }).catch(() => []);
    if (r?.[0]?.result) await sleepAnalytics(900);
    return !!r?.[0]?.result;
  }

  async function waitForStudioReady(tabId, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          ready: document.readyState,
          text: (document.body?.innerText || '').slice(0, 12000),
          href: location.href,
          title: document.title || ''
        })
      }).catch(() => []);
      const x = r?.[0]?.result;
      if (x?.ready === 'complete' && /YouTube Studio|Số liệu phân tích|Trang tổng quan|Channel analytics|Dashboard/i.test(`${x?.text || ''} ${x?.title || ''}`)) return true;
      await sleepAnalytics(300);
    }
    return false;
  }

  async function waitForStudioLabels(tabId, labels = [], timeoutMs = 12000) {
    const wanted = labels.filter(Boolean);
    if (!wanted.length) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (labels) => {
          const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
          const textParts = [];
          const walk = root => {
            if (!root) return;
            if (root.nodeType === Node.TEXT_NODE) {
              const t = String(root.nodeValue || '').trim(); if (t) textParts.push(t); return;
            }
            if (root.shadowRoot) walk(root.shadowRoot);
            for (const c of root.childNodes || []) walk(c);
          };
          walk(document.documentElement);
          const blob = norm(textParts.join('\n'));
          return labels.some(l => blob.includes(norm(l)));
        },
        args: [wanted]
      }).catch(() => []);
      if (r?.[0]?.result) return true;
      await sleepAnalytics(350);
    }
    return false;
  }

  async function readExactStudioMetrics(tabId, mode) {
    const out = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (mode) => {
        const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
        const specs = {
          overview: {
            views:{labels:['Số lượt xem','Lượt xem'],type:'count'},
            watchTime:{labels:['Thời gian xem (giờ)','Thời gian xem'],type:'number'},
            subscribers:{labels:['Số người đăng ký','Người đăng ký'],type:'signed'},
            estimatedRevenue:{labels:['Doanh thu ước tính'],type:'money'}
          },
          contentVideo: {
            views:{labels:['Số lượt xem'],type:'count'},
            impressions:{labels:['Số lượt hiển thị hình thu nhỏ','Số lần hiển thị hình thu nhỏ'],type:'count'},
            ctr:{labels:['Tỷ lệ nhấp vào hình thu nhỏ','Tỷ lệ nhấp của số lần hiển thị'],type:'percent'},
            averageViewDuration:{labels:['Thời lượng xem trung bình'],type:'duration'},
            averagePercentageViewed:{labels:['Tỷ lệ phần trăm đã xem trung bình'],type:'percent'}
          },
          contentShorts: {
            views:{labels:['Số lượt xem'],type:'count'},
            engagedViews:{labels:['Lượt xem có chủ đích','Lượt xem chủ động'],type:'count'},
            shownInFeed:{labels:['Hiển thị trong nguồn cấp dữ liệu','Đã hiển thị trong nguồn cấp dữ liệu'],type:'count'},
            stayedToWatch:{labels:['Đã xem so với vuốt bỏ qua','Ở lại xem'],type:'percent'},
            averageViewDuration:{labels:['Thời lượng xem trung bình'],type:'duration'},
            averagePercentageViewed:{labels:['Tỷ lệ phần trăm đã xem trung bình'],type:'percent'}
          },
          audience: {
            newViewers:{labels:['Người xem mới'],type:'count'},
            returningViewers:{labels:['Người xem quay lại'],type:'count'},
            monthlyAudience:{labels:['Khán giả hằng tháng','Khán giả hàng tháng'],type:'count'},
            uniqueViewers:{labels:['Người xem duy nhất'],type:'count'}
          },
          revenue: {
            estimatedRevenue:{labels:['Doanh thu ước tính'],type:'money'},
            rpm:{labels:['Doanh thu mỗi nghìn lượt xem có chủ đích (RPM)','Doanh thu mỗi nghìn lượt xem (RPM)'],type:'money'},
            cpm:{labels:['CPM dựa trên lượt phát','CPM'],type:'money'},
            monetizedPlaybacks:{labels:['Số lượt phát có bật tính năng kiếm tiền ước tính','Lượt phát có bật tính năng kiếm tiền'],type:'count'},
            adRevenue:{labels:['Doanh thu quảng cáo ước tính','Doanh thu quảng cáo'],type:'money'}
          },
          revenueVideo: {
            estimatedRevenue:{labels:['Doanh thu ước tính'],type:'money'},
            rpm:{labels:['Doanh thu mỗi nghìn lượt xem có chủ đích (RPM)','Doanh thu mỗi nghìn lượt xem (RPM)'],type:'money'},
            cpm:{labels:['CPM dựa trên lượt phát','CPM'],type:'money'},
            monetizedPlaybacks:{labels:['Số lượt phát có bật tính năng kiếm tiền ước tính','Lượt phát có bật tính năng kiếm tiền'],type:'count'},
            adRevenue:{labels:['Doanh thu quảng cáo ước tính','Doanh thu quảng cáo'],type:'money'}
          }
        };
        const wanted = specs[mode] || {};

        const visible = el => {
          try {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0;
          } catch { return false; }
        };
        const composedParent = el => el?.parentElement || el?.getRootNode?.()?.host || null;
        const all = [];
        const walk = root => {
          if (!root) return;
          const nodes = root.querySelectorAll ? [...root.querySelectorAll('*')] : [];
          for (const el of nodes) {
            all.push(el);
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        walk(document);

        const shortText = el => {
          let t = '';
          try { t = String(el.innerText || el.textContent || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); } catch {}
          return t;
        };
        const entries = [];
        const seen = new Set();
        for (const el of all) {
          if (!visible(el)) continue;
          const text = shortText(el);
          if (!text || text.length > 130 || /\n/.test(text)) continue;
          const r = el.getBoundingClientRect();
          const key = `${text}|${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.width)}|${Math.round(r.height)}`;
          if (seen.has(key)) continue; seen.add(key);
          entries.push({el,text,norm:norm(text),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}});
        }

        const isValue = (v, type) => {
          v = String(v || '').replace(/\u00a0/g,' ').trim();
          if (!v || v.length > 80 || !/\d/.test(v)) return false;
          if (type === 'percent') return /^[-+]?\d{1,3}(?:[.,]\d+)?\s*%$/.test(v);
          if (type === 'money') return /(?:US\$|USD|[$€£¥₫])/.test(v) && /\d/.test(v);
          if (type === 'duration') return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(v);
          if (type === 'signed') return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?$/i.test(v);
          return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?(?:\s*(?:giờ|hours?))?$/i.test(v);
        };
        const isComposedDescendant = (child, ancestor) => {
          let x = child;
          for (let i=0;i<18 && x;i++,x=composedParent(x)) if (x === ancestor) return true;
          return false;
        };
        const commonAncestorDepth = (a,b) => {
          const set = new Map(); let x=a;
          for(let i=0;i<12&&x;i++,x=composedParent(x)) set.set(x,i);
          x=b;
          for(let j=0;j<12&&x;j++,x=composedParent(x)) if(set.has(x)) return set.get(x)+j;
          return 99;
        };

        const result = {};
        for (const [key, def] of Object.entries(wanted)) {
          const labelNorms = def.labels.map(norm);
          const labelEntries = entries.filter(e => labelNorms.some(l => e.norm === l || e.norm.startsWith(l + ' ') || (l.length > 10 && e.norm.includes(l))));
          let best = null;
          for (const lab of labelEntries) {
            for (const val of entries) {
              if (val.el === lab.el || !isValue(val.text, def.type)) continue;
              const dx = Math.abs(val.rect.cx - lab.rect.cx);
              const dy = Math.abs(val.rect.cy - lab.rect.cy);
              if (dx > 520 || dy > 230) continue;
              const overlapX = Math.max(0, Math.min(val.rect.right, lab.rect.right) - Math.max(val.rect.left, lab.rect.left));
              const xOverlapRatio = overlapX / Math.max(1, Math.min(val.rect.width, lab.rect.width));
              const ancDepth = commonAncestorDepth(lab.el, val.el);
              let score = 300 - (dx * 0.35 + dy * 0.9);
              if (xOverlapRatio > .25) score += 90;
              if (dy < 90) score += 70;
              if (ancDepth <= 4) score += 120 - ancDepth * 15;
              else if (ancDepth <= 7) score += 45;
              if (def.type === 'money' && /(?:US\$|USD|[$€£¥₫])/.test(val.text)) score += 50;
              if (def.type === 'percent' && /%/.test(val.text)) score += 50;
              if (def.type === 'duration' && /:/.test(val.text)) score += 45;
              // Exact full label beats generic/partial matches.
              if (labelNorms.some(l => lab.norm === l)) score += 40;
              if (!best || score > best.score) {
                best = { value: val.text, score, label: lab.text, labelRect: lab.rect, valueRect: val.rect };
              }
            }
          }

          // DOM-card fallback: walk upward from an exact label and inspect only
          // the same small card/container. This catches Polymer cards where text
          // coordinates are unusual but label/value share a host element.
          if (!best) {
            for (const lab of labelEntries) {
              let container = lab.el;
              for (let depth=0; depth<8 && container; depth++, container=composedParent(container)) {
                let text=''; try { text=shortText(container); } catch {}
                if (!text || text.length > 900) continue;
                const candidates = text.split(/\n+/).map(x=>x.trim()).filter(x=>isValue(x,def.type));
                if (candidates.length === 1) { best={value:candidates[0],score:120-depth*8,label:lab.text}; break; }
              }
              if (best) break;
            }
          }
          if (best && best.score > 40) result[key] = best;
        }
        return result;
      },
      args: [mode]
    }).catch(() => []);
    return out?.[0]?.result || {};
  }

  async function deepCollectAnalyticsPage(tabId,mode,compact=false){
    const ratios=compact?[0,.5,1]:(mode==='audience'?[0,.16,.32,.48,.64,.8,1]:[0,.2,.4,.6,.8,1]);
    const snaps=[];
    for(const ratio of ratios){await chrome.scripting.executeScript({target:{tabId},func:scrollStudioRatio,args:[ratio]}).catch(()=>{});await sleepAnalytics(compact?260:330);snaps.push(await executeAnalyticsSnapshot(tabId,mode));}
    if(mode==='audience'){await chrome.scripting.executeScript({target:{tabId},func:scrollAudienceHeatmapIntoView}).catch(()=>{});await sleepAnalytics(550);snaps.push(await executeAnalyticsSnapshot(tabId,mode));}
    await chrome.scripting.executeScript({target:{tabId},func:scrollStudioRatio,args:[0]}).catch(()=>{});
    return mergeAnalyticsSnapshots(snaps);
  }
  function scrollStudioRatio(ratio){const d=document.scrollingElement||document.documentElement;const max=Math.max(0,d.scrollHeight-innerHeight);scrollTo({top:Math.round(max*Math.max(0,Math.min(1,Number(ratio)||0))),behavior:'instant'});return true;}
  async function executeAnalyticsSnapshot(tabId,mode){const r=await chrome.scripting.executeScript({target:{tabId},func:studioAnalyticsSnapshot,args:[mode]});return r?.[0]?.result||{};}
  function mergeAnalyticsSnapshots(snaps){const good=(snaps||[]).filter(Boolean),texts=[],aria=[],seenT=new Set(),seenA=new Set(),metricCards={};let heatmap={cells:[],topSlots:[],rawLabels:[]},href='',channelId='',channelName='';for(const s of good){href||=s.href||'';channelId||=s.channelId||'';channelName||=s.channelName||'';if(s.text&&!seenT.has(s.text)){seenT.add(s.text);texts.push(s.text)}for(const a of s.aria||[])if(a&&!seenA.has(a)){seenA.add(a);aria.push(a)}Object.assign(metricCards,Object.fromEntries(Object.entries(s.metricCards||{}).filter(([,v])=>v?.value)));if((s.heatmap?.cells?.length||0)>(heatmap.cells?.length||0))heatmap=s.heatmap;}return{href,channelId,channelName,text:texts.join('\n---SCROLL---\n').slice(0,2_000_000),aria:aria.slice(0,16000),metricCards,heatmap};}

  function studioAnalyticsSnapshot(mode){
    const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const text=(document.body?.innerText||'').replace(/\u00a0/g,' ').slice(0,650000); const href=location.href; const channelId=href.match(/\/channel\/(UC[\w-]+)/)?.[1]||''; let channelName=(document.title||'').replace(/\s*-\s*YouTube Studio.*$/i,'').trim();
    const aria=[...document.querySelectorAll('[aria-label],[title]')].map(el=>(el.getAttribute('aria-label')||el.getAttribute('title')||'').trim()).filter(Boolean).slice(0,10000);
    const defs={views:['Số lượt xem','Lượt xem','Views'],watchTime:['Thời gian xem (giờ)','Thời gian xem','Watch time'],subscribers:['Số người đăng ký','Người đăng ký','Subscribers'],impressions:['Số lượt hiển thị hình thu nhỏ','Số lần hiển thị hình thu nhỏ','Số lần hiển thị','Impressions'],ctr:['Tỷ lệ nhấp vào hình thu nhỏ','Tỷ lệ nhấp của số lần hiển thị','Tỷ lệ nhấp lượt hiển thị','Impressions click-through rate','CTR'],averageViewDuration:['Thời lượng xem trung bình','Average view duration'],averagePercentageViewed:['Tỷ lệ phần trăm đã xem trung bình','Average percentage viewed'],estimatedRevenue:['Doanh thu ước tính','Estimated revenue'],adRevenue:['Doanh thu quảng cáo','Ad revenue'],rpm:['Doanh thu mỗi nghìn lượt xem có chủ đích (RPM)','Doanh thu trên mỗi 1.000 lượt xem (RPM)','RPM'],cpm:['CPM'],monetizedPlaybacks:['Lượt phát có bật tính năng kiếm tiền','Monetized playbacks'],newViewers:['Người xem mới','New viewers'],returningViewers:['Người xem quay lại','Returning viewers'],monthlyAudience:['Khán giả hằng tháng','Khán giả hàng tháng','Monthly audience'],uniqueViewers:['Người xem duy nhất','Unique viewers'],engagedViews:['Lượt xem có chủ đích','Engaged views'],shownInFeed:['Hiển thị trong nguồn cấp dữ liệu','Shown in feed'],stayedToWatch:['Ở lại xem','Stayed to watch','Viewed vs swiped away'],likes:['Lượt thích','Likes'],comments:['Bình luận','Comments'],shares:['Chia sẻ','Shares']};
    const metricTypes={views:'count',watchTime:'number',subscribers:'signed',impressions:'count',ctr:'percent',averageViewDuration:'duration',averagePercentageViewed:'percent',estimatedRevenue:'money',adRevenue:'money',rpm:'money',cpm:'money',monetizedPlaybacks:'count',newViewers:'count',returningViewers:'count',monthlyAudience:'count',uniqueViewers:'count',engagedViews:'count',shownInFeed:'count',stayedToWatch:'percent',likes:'count',comments:'count',shares:'count'};
    const looksValue=(v,type='')=>{v=String(v||'').trim();if(!v||v.length>70||!(/\d/.test(v)))return false;if(/_/.test(v)&&/[A-Za-z]/.test(v))return false;if(type==='percent')return /^[-+]?\d{1,3}(?:[.,]\d+)?\s*%$/.test(v);if(type==='money')return /(?:US\$|[$€£¥₫])/.test(v)&&/\d/.test(v);if(type==='duration')return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(v)||/^\d{1,2}:\d{2}$/.test(v);if(type==='signed')return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?$/i.test(v);return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?(?:\s*(?:giờ|hours?))?$/i.test(v);};
    const metricCards={}; const all=[...document.querySelectorAll('body *')];
    for(const [key,labels] of Object.entries(defs)){const nl=labels.map(norm);const type=metricTypes[key]||'';let best=null;for(const el of all){const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent||'').join(' ').trim();const t=norm(own||((el.children.length<=2?el.textContent:'')||''));if(!t||t.length>190||!nl.some(l=>t===l||t.includes(l)))continue;let node=el;for(let d=0;d<6&&node;d++,node=node.parentElement){const ctx=(node.innerText||'').trim();if(!ctx||ctx.length>1500)continue;const lines=ctx.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const i=lines.findIndex(x=>nl.some(l=>norm(x).includes(l)));if(i<0)continue;for(let off=1;off<=6;off++){for(const j of [i-off,i+off]){if(j>=0&&j<lines.length&&looksValue(lines[j],type)){let score=30-off;if(type==='money'&&/(?:US\$|[$€£¥₫])/.test(lines[j]))score+=8;if(type==='percent'&&/%/.test(lines[j]))score+=8;if(!best||score>best.score)best={value:lines[j],distance:off,score};}}}if(best&&best.score>=30)break}if(best&&best.score>=30)break}if(best)metricCards[key]=best;}
    let heatmap=mode==='audience'?extractHeatmap():null; return{href,channelId,channelName,text,aria,metricCards,heatmap};
    function extractHeatmap(){
      const tokens=['when your viewers are on youtube','khi người xem của bạn ở trên youtube','thời điểm người xem của bạn hoạt động trên youtube'];const h=all.find(el=>{const t=norm((el.textContent||'').trim());return t.length<220&&tokens.some(x=>t.includes(norm(x)))});let root=h;for(let i=0;i<8&&root?.parentElement;i++){root=root.parentElement;if(root.querySelectorAll('*').length>=80)break}root=root||document.body;
      const rawLabels=[...root.querySelectorAll('[aria-label],[title]')].map(el=>(el.getAttribute('aria-label')||el.getAttribute('title')||'').trim()).filter(x=>/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|thứ hai|thứ ba|thứ tư|thứ năm|thứ sáu|thứ bảy|chủ nhật|\d{1,2}:\d{2})/i.test(x)).slice(0,100);
      const groups=new Map();for(const el of root.querySelectorAll('*')){const r=el.getBoundingClientRect();if(r.width<4||r.width>120||r.height<2||r.height>50)continue;const bg=getComputedStyle(el).backgroundColor||'';const m=bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)continue;const rgb=[+m[1],+m[2],+m[3]],lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;if(lum>250)continue;const sig=`${el.tagName}|${el.className||''}`;(groups.get(sig)||groups.set(sig,[]).get(sig)).push({x:r.left,y:r.top,lum});}
      const cluster=vals=>{const o=[];for(const v of [...vals].sort((a,b)=>a-b)){const l=o[o.length-1];if(l==null||Math.abs(v-l)>4)o.push(v);else o[o.length-1]=(l+v)/2}return o};let best=null;for(const items of groups.values()){if(items.length<90||items.length>240)continue;const xs=cluster(items.map(x=>x.x)),ys=cluster(items.map(x=>x.y));const ok=(Math.abs(xs.length-7)<=1&&Math.abs(ys.length-24)<=3)||(Math.abs(xs.length-24)<=3&&Math.abs(ys.length-7)<=1);if(ok&&!best)best={items,xs,ys};}if(!best)return{cells:[],topSlots:[],rawLabels};const dayOnX=Math.abs(best.xs.length-7)<=Math.abs(best.ys.length-7),da=dayOnX?best.xs:best.ys,ha=dayOnX?best.ys:best.xs,near=(a,v)=>a.reduce((bi,x,i)=>Math.abs(x-v)<Math.abs(a[bi]-v)?i:bi,0),lums=best.items.map(x=>x.lum),min=Math.min(...lums),max=Math.max(...lums),span=Math.max(1,max-min),map=new Map();for(const it of best.items){const day=near(da,dayOnX?it.x:it.y),hour=near(ha,dayOnX?it.y:it.x);if(day>6||hour>23)continue;const intensity=Math.max(0,Math.min(4,Math.round(((max-it.lum)/span)*4)));map.set(`${hour}:${day}`,{day,hour,intensity});}const cells=[...map.values()],days=['T2','T3','T4','T5','T6','T7','CN'],topSlots=cells.filter(x=>x.intensity>=3).sort((a,b)=>b.intensity-a.intensity).slice(0,12).map(x=>({...x,label:`${days[x.day]} ${String(x.hour).padStart(2,'0')}:00–${String((x.hour+1)%24).padStart(2,'0')}:00`}));return{cells,days,topSlots,rawLabels};}
  }

  function scrollAudienceHeatmapIntoView(){const n=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const h=[...document.querySelectorAll('body *')].find(el=>{const t=n(el.textContent);return t.length<250&&(t.includes('khi nguoi xem cua ban o tren youtube')||t.includes('when your viewers are on youtube'))});h?.scrollIntoView({block:'center',behavior:'instant'});return!!h;}
  function pickBestHeatmap(list){return(list||[]).filter(Boolean).sort((a,b)=>(b.cells?.length||0)-(a.cells?.length||0))[0]||{cells:[],topSlots:[],rawLabels:[]};}

  function mergeAllAnalytics(pages,responses){
    const metrics={},sources={},scopes={};
    // Studio UI is the primary truth source. API is only allowed to fill a
    // missing metric; it never overwrites an exact value rendered by Studio.
    for(const key of Object.keys(METRIC_DEFS)){
      const exactHit=findExactFromPages(pages,key);
      if(exactHit?.value){metrics[key]=exactHit.value;sources[key]='Studio UI';scopes[key]=scopeForPage(exactHit.page,key);continue;}
      const hit=findFromPagesDetailed(pages,key,METRIC_DEFS[key].labels);
      if(hit?.value){metrics[key]=hit.value;sources[key]='Studio UI';scopes[key]=scopeForPage(hit.page,key);}
    }
    const apiJson=[];
    for(const [page,p] of Object.entries(pages)){if(p?.directApi?.ok&&p.directApi.json)apiJson.push({json:p.directApi.json,postData:`direct get_screen ${page}`,page});}
    for(const r of responses||[])apiJson.push(r);
    for(const key of Object.keys(METRIC_DEFS)){
      if(metrics[key]) continue;
      const hit=extractMetricFromApi(apiJson,METRIC_DEFS[key]);
      if(hit?.value && hit.confidence>=10){metrics[key]=hit.value;sources[key]='Studio API';scopes[key]='28 ngày';}
    }
    return{metrics,metricSources:sources,metricScopes:scopes};
  }

  function findExactFromPages(pages,key){
    for(const page of pagePriorityForMetric(key)){
      const hit=pages?.[page]?.exact?.[key];
      const v=hit?.value;
      if(isCleanStudioValue(v,METRIC_DEFS[key]?.type))return{value:v,page,exact:true};
    }
    return null;
  }
  function pagePriorityForMetric(key){
    const map={
      views:['overview','contentVideo','content','contentShorts'],
      watchTime:['overview','engagement','contentVideo','content'],
      subscribers:['overview','audience'],
      impressions:['contentVideo','reach','content'],
      ctr:['contentVideo','reach','content'],
      averageViewDuration:['engagement','contentVideo','content'],
      averagePercentageViewed:['engagement','contentVideo','contentShorts','content'],
      estimatedRevenue:['revenue','revenueVideo'],
      adRevenue:['revenue','revenueVideo'],
      rpm:['revenueVideo','revenue'],
      cpm:['revenueVideo','revenue'],
      monetizedPlaybacks:['revenueVideo','revenue'],
      newViewers:['audience'],returningViewers:['audience'],monthlyAudience:['audience'],uniqueViewers:['audience'],
      engagedViews:['contentShorts','content'],shownInFeed:['contentShorts','content'],stayedToWatch:['contentShorts','content'],
      likes:['content','contentVideo','contentShorts'],comments:['content','contentVideo','contentShorts'],shares:['content','contentVideo','contentShorts'],
      realtimeViews:['overview']
    };
    return map[key]||['overview','content','contentVideo','contentShorts','reach','engagement','audience','revenue','revenueVideo','revenueShorts'];
  }
  function scopeForPage(page,key){
    if(page==='contentVideo'||page==='revenueVideo')return 'Video • 28 ngày';
    if(page==='contentShorts'||page==='revenueShorts')return 'Shorts • 28 ngày';
    if(page==='audience')return 'Đối tượng người xem • 28 ngày';
    if(page==='revenue')return 'Doanh thu • 28 ngày';
    if(page==='reach')return 'Tiếp cận • 28 ngày';
    return 'Kênh • 28 ngày';
  }
  function findFromPagesDetailed(pages,key,labels){
    const order=pagePriorityForMetric(key);
    for(const page of order){const v=pages?.[page]?.dom?.metricCards?.[key]?.value;if(isCleanStudioValue(v,METRIC_DEFS[key]?.type))return{value:v,page};}
    // Text fallback stays page-scoped: do not concatenate all tabs because that
    // can pair a label from one section with a number from another.
    for(const page of order){const blob=`${pages?.[page]?.dom?.text||''}\n${(pages?.[page]?.dom?.aria||[]).join('\n')}`;const v=findStudioMetric(blob,labels,METRIC_DEFS[key]?.type);if(isCleanStudioValue(v,METRIC_DEFS[key]?.type))return{value:v,page};}
    return null;
  }

  function isCleanStudioValue(v,type=''){
    const s=String(v||'').trim(); if(!s||s.length>80)return false;
    if(/_/.test(s)&&/[A-Za-z]/.test(s))return false;
    if(/^(RECENT|ESTIMATED|ANALYTICS|METRIC|CHANNEL|VIDEO|SHORTS|AUDIENCE)/i.test(s)&&/[A-Za-z_]/.test(s))return false;
    if(type==='percent')return /^[-+]?\d{1,3}(?:[.,]\d+)?\s*%$/.test(s);
    if(type==='money')return /(?:US\$|[$€£¥₫])/.test(s)&&/\d/.test(s);
    if(type==='duration')return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(s)||/^\d{1,2}:\d{2}$/.test(s);
    if(type==='signed')return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?$/i.test(s);
    return /^[+−-]?\s*[\d.,]+(?:\s*(?:N|Tr|K|M|B|nghìn|triệu))?(?:\s*(?:giờ|hours?))?$/i.test(s);
  }

  function extractMetricFromApi(records,def){
    let best=null;
    const aliasNorm=[...def.labels,...def.tokens].map(normMetric);
    for(const rec of records||[]){walk(rec.json,[],null,0);}
    return best;
    function walk(node,path,parent,depth){
      if(depth>22||node==null)return;
      if(Array.isArray(node)){for(let i=0;i<node.length;i++)walk(node[i],path.concat(i),node,depth+1);return;}
      if(typeof node!=='object')return;
      let context='';try{context=collectContext(node,3,120).join(' ');}catch{}
      const nc=normMetric(context+' '+path.join(' '));
      if(aliasNorm.some(a=>a&&nc.includes(a))){
        const candidates=[];collectCandidates(node,[],candidates,0);
        for(const c of candidates){const formatted=formatApiCandidate(c.value,def.type,c.path);if(!formatted)continue;let score=3;const np=normMetric(c.path.join(' '));if(/primarycontent|total|formattedvalue|simpletext|currentvalue|metricvalue|amount/.test(np))score+=5;if(typeof c.value==='string')score+=2;if(candidateFitsType(formatted,def.type))score+=3;if(/date|timestamp|start|end|rank|index/.test(np))score-=5;const hit={value:formatted,confidence:score,path:c.path.join('.'),context:context.slice(0,400)};if(!best||hit.confidence>best.confidence)best=hit;}
      }
      for(const [k,v] of Object.entries(node))walk(v,path.concat(k),node,depth+1);
    }
  }
  function normMetric(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9%$₫€£¥]+/g,' ').replace(/\s+/g,' ').trim();}
  function collectContext(node,maxDepth,maxItems){const out=[];function r(v,d){if(out.length>=maxItems||d>maxDepth||v==null)return;if(typeof v==='string'||typeof v==='number'){out.push(String(v));return}if(Array.isArray(v)){for(const x of v.slice(0,40))r(x,d+1);return}if(typeof v==='object'){for(const [k,x] of Object.entries(v)){out.push(k);r(x,d+1);if(out.length>=maxItems)break}}}r(node,0);return out;}
  function collectCandidates(node,path,out,depth){if(depth>5||out.length>80||node==null)return;if(typeof node==='string'||typeof node==='number'){out.push({path,value:node});return}if(Array.isArray(node)){for(let i=0;i<Math.min(node.length,25);i++)collectCandidates(node[i],path.concat(i),out,depth+1);return}if(typeof node==='object')for(const [k,v] of Object.entries(node))collectCandidates(v,path.concat(k),out,depth+1);}
  function candidateFitsType(v,type){return isCleanStudioValue(v,type);}
  function formatApiCandidate(value,type,path){
    if(typeof value==='string'){
      const s=value.trim();
      if(!s||s.length>80||!/\d/.test(s))return'';
      if(/_/.test(s)&&/[A-Za-z]/.test(s))return'';
      if(/^(?:RECENT|ESTIMATED|ANALYTICS|METRIC|CHANNEL|VIDEO|SHORTS|AUDIENCE)/i.test(s)&&/[A-Za-z_]/.test(s))return'';
      return isCleanStudioValue(s,type)?s:'';
    }
    if(typeof value!=='number'||!Number.isFinite(value))return'';
    const p=normMetric(path.join(' ')); if(/TIMESTAMP|DATE|MILLIS|MICROS/.test(p)&&type!=='money')return'';
    if(type==='percent'){const n=value>=0&&value<=1?value*100:value;if(n<0||n>1000)return'';return `${formatNum(n,2)}%`;}
    if(type==='duration'){const seconds=value>100000?value/1000:value; if(seconds<0||seconds>86400)return'';return formatDuration(seconds);}
    if(type==='money'){return'';} // bare numeric API money is ambiguous; require Studio-formatted currency text
    return formatNum(value,2);
  }
  function formatNum(n,max=2){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:max}).format(n);}
  function formatDuration(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;}

  function addDerivedMetrics(){ /* 1.36: official-only. No inferred CTR/RPM/CPM/AVD. */ }
  function parseLocalizedNumber(v){let s=String(v||'').trim();if(!s)return NaN;let mult=1;if(/\b(?:N|K|nghin|nghìn)\b/i.test(s))mult=1e3;else if(/\b(?:Tr|trieu|triệu|M)\b/i.test(s))mult=1e6;else if(/\bB\b/i.test(s))mult=1e9;s=s.replace(/[^\d,\.\-+]/g,'');if(!s)return NaN;if(s.includes(',')&&s.includes('.')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}else if(s.includes(',')){const parts=s.split(',');s=parts.length===2&&parts[1].length<=2?s.replace(',','.'):s.replace(/,/g,'');}const n=Number(s);return Number.isFinite(n)?n*mult:NaN;}
  function parseMoney(v){const n=parseLocalizedNumber(v);return Number.isFinite(n)?n:NaN;}

  function findStudioMetric(text,labels,type=''){
    const lines=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const valid=x=>isCleanStudioValue(x,type);
    let best=null;
    for(const l of labels){const nl=norm(l);for(let i=0;i<lines.length;i++){
      const n=norm(lines[i]); if(!(n===nl||n.startsWith(nl+' ')||n.includes(nl)))continue;
      for(let off=1;off<=5;off++) for(const j of [i-1*off,i+1*off]) if(j>=0&&j<lines.length&&valid(lines[j])){
        const score=20-off+(type==='money'&&/(?:US\$|[$€£¥₫])/.test(lines[j])?5:0)+(type==='percent'&&/%/.test(lines[j])?5:0);
        if(!best||score>best.score)best={value:lines[j],score};
      }
    }}
    return best?.value||'';
  }

})();
