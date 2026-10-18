
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function isNativeSidePanel() {
    return document.body?.classList.contains("native-sidepanel");
  }

  async function openNativeSidePanel() {
    const btn = $("dockLauncherBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "…";
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!tab?.id) {
        throw new Error("Không tìm thấy tab hiện tại.");
      }

      // Hide any old injected BaByLon overlay from previous versions.
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "BABYLON_DOCK_HIDE"
        });
      } catch (_) {}

      // Enable BaByLon's native panel for this tab.
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "sidepanel.html",
        enabled: true
      });

      // Must be called from the user's click gesture.
      await chrome.sidePanel.open({
        tabId: tab.id
      });

      // Native Side Panel is now owned by Chrome.
      // Chrome itself shrinks/reflows the webpage like Video DownloadHelper.
      window.close();
    } catch (error) {
      const message =
        error?.message ||
        "Không mở được Chrome Side Panel.";

      alert(
        `${message}\n\n` +
        `Hãy bảo đảm Chrome đã được cập nhật. ` +
        `Side Panel thật chỉ hỗ trợ cạnh trái/phải, không có vị trí dưới màn hình.`
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "▤";
      }
    }
  }

  function init() {
    const wrap = $("dockLauncherWrap");
    const btn = $("dockLauncherBtn");

    if (isNativeSidePanel()) {
      if (wrap) wrap.style.display = "none";
      document.body.classList.add("sidepanel-ready");
      return;
    }

    if (!btn) return;

    btn.addEventListener("click", openNativeSidePanel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
