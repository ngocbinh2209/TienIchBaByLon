(() => {
  if (window.__tichBanBeVoGroupLoaded) {
    return;
  }

  window.__tichBanBeVoGroupLoaded = true;

  let autoCheckRunning = false;
  let lastRunId = 0;

  const BLOCKED_TEXT_PATTERNS = [
    "da moi",
    "da gui",
    "loi moi da gui",
    "khong the moi",
    "khong gui duoc",
    "khong moi duoc",
    "khong hop le",
    "bi loi",
    "da tham gia",
    "already invited",
    "invited",
    "invite sent",
    "unable to invite",
    "couldn't invite",
    "could not invite",
    "error",
    "joined"
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function removeVietnameseMarks(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function normalizeText(text) {
    return removeVietnameseMarks(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity || 1) > 0.05
    );
  }

  function getOpenDialog() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(isVisible);
    return dialogs.at(-1) || document.body;
  }

  function isCheckedCheckbox(element) {
    return element.getAttribute("aria-checked") === "true";
  }

  function isEnabledCheckbox(element) {
    return element.getAttribute("aria-disabled") !== "true" && !element.hasAttribute("disabled");
  }

  function isUncheckedCheckbox(element) {
    return !isCheckedCheckbox(element) && isEnabledCheckbox(element) && isVisible(element);
  }

  function getRowForCheckbox(checkbox, scope) {
    let current = checkbox;

    while (current && current !== scope && current !== document.body) {
      const parent = current.parentElement;
      if (!parent) break;

      const parentCheckboxes = parent.querySelectorAll('[role="checkbox"]');
      const text = normalizeText(parent.innerText || parent.textContent || "");
      const rect = parent.getBoundingClientRect();

      if (parentCheckboxes.length === 1 && text.length >= 2 && rect.width >= 160 && rect.height >= 32) {
        return parent;
      }

      current = parent;
    }

    return checkbox.parentElement || checkbox;
  }

  function hasRealPersonText(row) {
    const text = normalizeText(row.innerText || row.textContent || "");
    const words = text.split(" ").filter(Boolean);

    return words.length >= 2 && !/^\d+$/.test(text);
  }

  function hasBlockedText(row) {
    const text = normalizeText(row.innerText || row.textContent || "");
    const ariaText = normalizeText(
      Array.from(row.querySelectorAll("[aria-label]"))
        .map((element) => element.getAttribute("aria-label"))
        .join(" ")
    );
    const combined = `${text} ${ariaText}`;

    return BLOCKED_TEXT_PATTERNS.some((pattern) => combined.includes(pattern));
  }

  function looksLikeSkeleton(row) {
    const text = normalizeText(row.innerText || row.textContent || "");
    const rect = row.getBoundingClientRect();

    return text.length < 2 || rect.height < 32;
  }

  function canInviteCheckbox(checkbox, scope) {
    if (!isUncheckedCheckbox(checkbox)) return false;

    const row = getRowForCheckbox(checkbox, scope);
    return hasRealPersonText(row) && !looksLikeSkeleton(row) && !hasBlockedText(row);
  }

  function getInviteableUncheckedCheckboxes(scope) {
    return Array.from(scope.querySelectorAll('[role="checkbox"]')).filter((checkbox) =>
      canInviteCheckbox(checkbox, scope)
    );
  }

  function getSelectedCheckboxes(scope) {
    return Array.from(scope.querySelectorAll('[role="checkbox"]')).filter(
      (checkbox) => isCheckedCheckbox(checkbox) && isEnabledCheckbox(checkbox) && isVisible(checkbox)
    );
  }

  function getScrollableContainers(scope) {
    const elements = [scope, ...Array.from(scope.querySelectorAll("*"))];

    return elements.filter((element) => {
      const style = window.getComputedStyle(element);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);
      return canScrollY && element.scrollHeight > element.clientHeight + 20 && isVisible(element);
    });
  }

  function getBestScrollTarget(scope) {
    const containers = getScrollableContainers(scope);
    if (containers.length === 0) return window;

    return containers.sort((a, b) => b.clientHeight - a.clientHeight)[0];
  }

  function scrollTarget(target) {
    if (target === window) {
      window.scrollBy({ top: 520, behavior: "smooth" });
      return;
    }

    target.scrollBy({ top: 520, behavior: "smooth" });
  }

  function showToast(message) {
    const id = "auto-tich-moi-nhom-toast";
    let toast = document.getElementById(id);

    if (!toast) {
      toast = document.createElement("div");
      toast.id = id;
      toast.style.position = "fixed";
      toast.style.zIndex = "2147483647";
      toast.style.right = "16px";
      toast.style.bottom = "16px";
      toast.style.maxWidth = "340px";
      toast.style.padding = "10px 12px";
      toast.style.borderRadius = "8px";
      toast.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.25)";
      toast.style.color = "#fff";
      toast.style.font = "13px/1.35 Arial, sans-serif";
      toast.style.background = "rgba(28, 30, 33, 0.94)";
      document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
  }

  async function clickCheckbox(box, delay) {
    box.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    await sleep(Math.max(200, Math.floor(delay / 2)));

    const dialog = getOpenDialog();
    if (canInviteCheckbox(box, dialog)) {
      box.click();
      return true;
    }

    return false;
  }

  async function cleanupSelectedInvalid(delay = 250) {
    const dialog = getOpenDialog();
    const selected = getSelectedCheckboxes(dialog);
    let removedCount = 0;

    for (const checkbox of selected) {
      const row = getRowForCheckbox(checkbox, dialog);
      const invalid = !hasRealPersonText(row) || looksLikeSkeleton(row) || hasBlockedText(row);

      if (invalid) {
        checkbox.scrollIntoView({ behavior: "smooth", block: "center" });
        await sleep(delay);

        if (isCheckedCheckbox(checkbox)) {
          checkbox.click();
          removedCount += 1;
        }
      }
    }

    showToast(
      removedCount > 0
        ? `Đã bỏ chọn ${removedCount} người có dấu hiệu lỗi/không mời được.`
        : "Không thấy người lỗi đang được chọn."
    );

    return removedCount;
  }

  async function autoCheck({ limit, delay, runId }) {
    let checkedCount = 0;
    let skippedCount = 0;
    let emptyRounds = 0;

    await cleanupSelectedInvalid(120);
    showToast(`Đang chỉ tick người có thể gửi lời mời, tối đa ${limit} người...`);

    while (autoCheckRunning && runId === lastRunId && checkedCount < limit) {
      const dialog = getOpenDialog();
      const scrollable = getBestScrollTarget(dialog);
      const allUnchecked = Array.from(dialog.querySelectorAll('[role="checkbox"]')).filter(isUncheckedCheckbox);
      const checkboxes = getInviteableUncheckedCheckboxes(dialog);

      skippedCount += Math.max(0, allUnchecked.length - checkboxes.length);

      if (checkboxes.length === 0) {
        emptyRounds += 1;
        scrollTarget(scrollable);
        await sleep(delay + 300);

        if (emptyRounds >= 8) break;
        continue;
      }

      emptyRounds = 0;

      for (const checkbox of checkboxes) {
        if (!autoCheckRunning || runId !== lastRunId || checkedCount >= limit) break;

        const clicked = await clickCheckbox(checkbox, delay);
        if (clicked) {
          checkedCount += 1;
          showToast(`Đã tick ${checkedCount}/${limit}. Đã bỏ qua ${skippedCount} dòng không hợp lệ.`);
        } else {
          skippedCount += 1;
        }

        await sleep(delay);
      }

      scrollTarget(scrollable);
      await sleep(delay + 300);
    }

    if (runId === lastRunId) {
      autoCheckRunning = false;
      showToast(
        `Đã dừng sau khi tick ${checkedCount} người. Đã bỏ qua ${skippedCount} dòng lỗi/không mời được.`
      );
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "START_AUTO_CHECK") {
      if (autoCheckRunning) {
        sendResponse({ message: "Tiện ích đang chạy rồi." });
        return true;
      }

      const limit = Math.min(Math.max(Number(message.limit) || 20, 1), 500);
      const delay = Math.min(Math.max(Number(message.delay) || 700, 200), 5000);
      const runId = Date.now();

      autoCheckRunning = true;
      lastRunId = runId;
      autoCheck({ limit, delay, runId });
      sendResponse({ message: `Đã bắt đầu lọc và tick tối đa ${limit} người mời được.` });
      return true;
    }

    if (message.action === "CLEANUP_INVALID_SELECTED") {
      cleanupSelectedInvalid().then((removedCount) => {
        sendResponse({
          message:
            removedCount > 0
              ? `Đã bỏ chọn ${removedCount} người lỗi/không mời được.`
              : "Không thấy người lỗi đang được chọn."
        });
      });
      return true;
    }

    if (message.action === "STOP_AUTO_CHECK") {
      autoCheckRunning = false;
      lastRunId = Date.now();
      showToast("Đã dừng tự động tick.");
      sendResponse({ message: "Đã dừng tự động tick." });
      return true;
    }

    return false;
  });
})();
