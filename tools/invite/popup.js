const inviteCountInput = document.getElementById("inviteCount");
const delayTimeInput = document.getElementById("delayTime");
const waitTimeInput = document.getElementById("waitTime");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
let progressTimer = null;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function readNumber(input, fallback) {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

async function getActiveFacebookTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/^https:\/\/((www|m)\.)?facebook\.com\//.test(tab.url || "")) {
    throw new Error("Hãy mở trang Facebook có popup danh sách người đã thích trước.");
  }

  return tab;
}

async function runInActiveTab(func, args = []) {
  const tab = await getActiveFacebookTab();
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args
  });
}

function stopProgressPolling() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function startProgressPolling() {
  stopProgressPolling();

  progressTimer = setInterval(async () => {
    try {
      const [result] = await runInActiveTab(getInviteLikersProgress);
      const progress = result?.result;

      if (!progress?.message) return;

      setStatus(progress.message, progress.running ? "" : "ok");

      if (!progress.running) {
        stopProgressPolling();
        startBtn.disabled = false;
      }
    } catch {
      stopProgressPolling();
    }
  }, 1000);
}

startBtn.addEventListener("click", async () => {
  const inviteCount = Math.min(Math.max(readNumber(inviteCountInput, 20), 1), 500);
  const delayTime = Math.min(Math.max(readNumber(delayTimeInput, 1800), 500), 10000);
  const waitTime = Math.min(Math.max(readNumber(waitTimeInput, 120), 10), 600);

  inviteCountInput.value = String(inviteCount);
  delayTimeInput.value = String(delayTime);
  waitTimeInput.value = String(waitTime);

  startBtn.disabled = true;
  setStatus("Đang gửi lệnh mời...");
  let launched = false;

  try {
    await runInActiveTab(startInviteLikers, [inviteCount, delayTime, waitTime]);
    launched = true;
    setStatus("Đã bắt đầu. Xem tiến độ ngay trên trang Facebook.", "ok");
    startProgressPolling();
  } catch (error) {
    setStatus(error.message || "Không thể chạy tiện ích.", "error");
  } finally {
    if (!launched) {
      startBtn.disabled = false;
    }
  }
});

stopBtn.addEventListener("click", async () => {
  setStatus("Đang dừng...");

  try {
    await runInActiveTab(stopInviteLikers);
    setStatus("Đã gửi lệnh dừng.", "ok");
    startBtn.disabled = false;
  } catch (error) {
    setStatus(error.message || "Không thể dừng tiện ích.", "error");
  }
});

function stopInviteLikers() {
  window.__fbAutoInviteLikersStop = true;
}

function getInviteLikersProgress() {
  return window.__fbAutoInviteLikersProgress || null;
}

function startInviteLikers(inviteLimit, delayMs, waitTimeSeconds) {
  void (async () => {
  if (window.__fbAutoInviteLikersRunning) {
    alert("Tiện ích đang chạy. Bấm Dừng nếu muốn dừng lại.");
    return;
  }

  window.__fbAutoInviteLikersRunning = true;
  window.__fbAutoInviteLikersStop = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clickedButtons = new WeakSet();

  function normalizeText(text) {
    return (text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "D")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isInviteButton(element) {
    const text = normalizeText(element.innerText || element.textContent);
    const label = normalizeText(element.getAttribute("aria-label"));
    const combined = `${text} ${label}`.trim();

    if (!combined) return false;
    if (/(da moi|invited|following|ban be|friend)/i.test(combined)) return false;

    return combined === "moi" ||
      combined === "invite" ||
      combined.includes("moi ") ||
      combined.includes("invite ");
  }

  function getVisibleDialog() {
    return Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 250 &&
          rect.height > 250 &&
          style.display !== "none" &&
          style.visibility !== "hidden";
      })
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      })[0] || null;
  }

  function findScrollableContainers() {
    const dialog = getVisibleDialog();
    const root = dialog || document.body;
    const candidates = [root, ...Array.from(root.querySelectorAll("div, section, main"))];

    return candidates
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.height > 120 &&
          rect.width > 180 &&
          element.scrollHeight > element.clientHeight + 20;
      })
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const aRange = a.scrollHeight - a.clientHeight;
        const bRange = b.scrollHeight - b.clientHeight;
        const aArea = aRect.width * aRect.height;
        const bArea = bRect.width * bRect.height;

        return (bRange + bArea / 1000) - (aRange + aArea / 1000);
      });
  }

  function findInviteButtons() {
    const selectors = [
      'div[role="button"]',
      'button',
      'a[role="button"]',
      '[aria-label]'
    ];

    return Array.from(document.querySelectorAll(selectors.join(",")))
      .filter(element => !clickedButtons.has(element))
      .filter(isInviteButton);
  }

  function showProgress(message) {
    window.__fbAutoInviteLikersProgress = {
      message,
      running: window.__fbAutoInviteLikersRunning,
      updatedAt: Date.now()
    };

    let box = document.getElementById("__fb_auto_invite_likers_status");

    if (!box) {
      box = document.createElement("div");
      box.id = "__fb_auto_invite_likers_status";
      box.style.cssText = [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:2147483647",
        "max-width:320px",
        "padding:12px 14px",
        "border-radius:8px",
        "background:#1c1e21",
        "color:#fff",
        "font:13px/1.4 Arial,sans-serif",
        "box-shadow:0 8px 24px rgba(0,0,0,.22)"
      ].join(";");
      document.documentElement.appendChild(box);
    }

    box.textContent = message;
  }

  function removeProgressSoon() {
    setTimeout(() => {
      document.getElementById("__fb_auto_invite_likers_status")?.remove();
    }, 5000);
  }

  async function scrollForMore() {
    const scrollers = findScrollableContainers();
    const targets = scrollers.length > 0
      ? scrollers
      : [getVisibleDialog(), document.scrollingElement, document.documentElement].filter(Boolean);

    for (const target of targets) {
      const beforeTop = target.scrollTop || 0;
      const beforeHeight = target.scrollHeight || 0;

      target.scrollTop = beforeTop + 900;
      target.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 900,
        deltaMode: 0
      }));

      await sleep(450);

      const afterTop = target.scrollTop || 0;
      const afterHeight = target.scrollHeight || 0;

      if (afterTop !== beforeTop || afterHeight !== beforeHeight) {
        await sleep(900);
        return true;
      }
    }

    const dialog = getVisibleDialog();
    if (dialog) {
      const rect = dialog.getBoundingClientRect();
      const eventTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 60) || dialog;

      eventTarget.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 1200,
        deltaMode: 0
      }));

      await sleep(1200);
    }

    return false;
  }

  let invited = 0;
  let lastUsefulActivityAt = Date.now();
  let waitRound = 0;
  const maxWaitMs = Math.max(waitTimeSeconds || 120, 10) * 1000;

  try {
    showProgress(`Bắt đầu mời ${inviteLimit} người...`);

    while (invited < inviteLimit && !window.__fbAutoInviteLikersStop) {
      const buttons = findInviteButtons();

      if (buttons.length === 0) {
        waitRound += 1;
        const waitedSeconds = Math.round((Date.now() - lastUsefulActivityAt) / 1000);
        const maxWaitSeconds = Math.round(maxWaitMs / 1000);

        showProgress(`Đang chờ Facebook tải thêm... ${waitedSeconds}/${maxWaitSeconds}s`);
        const moved = await scrollForMore();

        if (moved) {
          lastUsefulActivityAt = Date.now();
        } else {
          await sleep(Math.min(1500 + waitRound * 250, 5000));
        }

        if (Date.now() - lastUsefulActivityAt >= maxWaitMs) {
          showProgress(`Đã chờ ${maxWaitSeconds}s nhưng không có nút Mời mới. Đã mời ${invited} người.`);
          return;
        }

        continue;
      }

      waitRound = 0;
      lastUsefulActivityAt = Date.now();

      for (const button of buttons) {
        if (invited >= inviteLimit || window.__fbAutoInviteLikersStop) break;

        clickedButtons.add(button);
        button.scrollIntoView({ block: "center", behavior: "smooth" });
        await sleep(350);
        button.click();
        invited += 1;
        lastUsefulActivityAt = Date.now();
        showProgress(`Đã mời ${invited}/${inviteLimit} người.`);
        await sleep(delayMs);
      }

      await scrollForMore();
    }

    if (window.__fbAutoInviteLikersStop) {
      showProgress(`Đã dừng. Tổng đã mời: ${invited}.`);
    } else {
      showProgress(`Hoàn tất. Đã mời ${invited} người.`);
    }
  } finally {
    window.__fbAutoInviteLikersRunning = false;
    if (window.__fbAutoInviteLikersProgress) {
      window.__fbAutoInviteLikersProgress.running = false;
      window.__fbAutoInviteLikersProgress.updatedAt = Date.now();
    }
    removeProgressSoon();
  }
  })();
}
