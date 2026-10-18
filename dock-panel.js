/* LEGACY: BaByLon 1.16 uses Chrome native Side Panel instead. */

(() => {
  "use strict";

  if (window.__BABYLON_DOCK_SCRIPT_V115__) return;
  window.__BABYLON_DOCK_SCRIPT_V115__ = true;

  const HOST_ID = "babylon-dock-host-v115";
  const DEFAULT_SIDE_WIDTH = 560;
  const DEFAULT_BOTTOM_HEIGHT = Math.round(
    Math.min(500, Math.max(400, innerHeight * 0.45))
  );

  let host = null;
  let shadow = null;
  let panel = null;
  let frame = null;
  let frameReady = false;

  let currentPosition = "right";
  let sideWidth = DEFAULT_SIDE_WIDTH;
  let bottomHeight = DEFAULT_BOTTOM_HEIGHT;
  let responsiveEnabled = true;

  let responsiveStyle = null;
  let dragRaf = 0;
  let pendingDragSize = null;
  let realResizeTimer = 0;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!String(message?.type || "").startsWith("BABYLON_DOCK_")) return false;

    (async () => {
      try {
        if (message.type === "BABYLON_DOCK_SHOW") {
          await createOrShow(message.position || "right");
          sendResponse({ ok: true, position: currentPosition });
          return;
        }

        if (message.type === "BABYLON_DOCK_HIDE") {
          hideDock();
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "BABYLON_DOCK_MOVE") {
          setPosition(message.position || "right");
          sendResponse({ ok: true, position: currentPosition });
          return;
        }

        sendResponse({ ok: false, error: "Dock action không hợp lệ." });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();

    return true;
  });

  async function createOrShow(position) {
    if (!host) createDock();

    const saved = await chrome.storage.local.get([
      "babylonDockPosition",
      "babylonDockSideWidth",
      "babylonDockBottomHeight",
      "babylonDockResponsive"
    ]);

    sideWidth = clamp(
      Number(saved.babylonDockSideWidth) || DEFAULT_SIDE_WIDTH,
      360,
      Math.max(380, Math.min(760, innerWidth - 180))
    );

    bottomHeight = clamp(
      Number(saved.babylonDockBottomHeight) || DEFAULT_BOTTOM_HEIGHT,
      320,
      Math.max(340, Math.min(560, innerHeight - 180))
    );

    responsiveEnabled = saved.babylonDockResponsive !== false;

    host.style.display = "block";
    setPosition(position || saved.babylonDockPosition || "right");

    const responsiveBtn = panel?.querySelector('[data-role="responsive"]');
    if (responsiveBtn) {
      responsiveBtn.classList.toggle("active", responsiveEnabled);
      responsiveBtn.textContent = responsiveEnabled ? "↔" : "⊘";
    }
  }

  function createDock() {
    // Remove every older BaByLon dock from prior versions.
    document
      .querySelectorAll('[id^="babylon-dock-host-"]')
      .forEach((node) => {
        try { node.remove(); } catch (_) {}
      });

    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.display = "none";
    host.style.pointerEvents = "auto";
    host.style.contain = "layout style paint";

    shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all:initial; }
      * { box-sizing:border-box; }

      .panel {
        position:relative;
        width:100%;
        height:100%;
        overflow:hidden;
        background:#fff;
        border:1px solid rgba(16,24,40,.13);
        box-shadow:0 12px 34px rgba(16,24,40,.22);
        font-family:Arial,Helvetica,sans-serif;
      }

      .toolbar {
        height:42px;
        display:flex;
        align-items:center;
        gap:5px;
        padding:4px 6px;
        background:linear-gradient(135deg,#5f55f5,#12b7b1);
        color:#fff;
        user-select:none;
      }

      .title {
        flex:1;
        min-width:0;
        padding-left:4px;
        font-size:13px;
        font-weight:900;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .toolbtn {
        width:32px;
        height:30px;
        display:grid;
        place-items:center;
        border:1px solid rgba(255,255,255,.28);
        border-radius:8px;
        background:rgba(255,255,255,.12);
        color:#fff;
        padding:0;
        font-size:14px;
        font-weight:900;
        cursor:pointer;
      }
      .toolbtn:hover,
      .toolbtn.active {
        background:rgba(255,255,255,.28);
      }

      iframe {
        display:block;
        width:100%;
        height:calc(100% - 42px);
        border:0;
        background:#f7f8ff;
      }

      .resize-handle {
        position:absolute;
        z-index:5;
        background:transparent;
        touch-action:none;
      }
      .resize-handle.side {
        top:42px;
        bottom:0;
        width:10px;
        cursor:ew-resize;
      }
      .resize-handle.bottom {
        left:0;
        right:0;
        top:0;
        height:10px;
        cursor:ns-resize;
      }
    `;

    panel = document.createElement("div");
    panel.className = "panel";

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "BaByLon";

    toolbar.appendChild(title);

    const buttons = [
      ["left", "◀", "Ghim bên trái"],
      ["right", "▶", "Ghim bên phải"],
      ["bottom", "▼", "Ghim phía dưới"]
    ];

    for (const [pos, icon, label] of buttons) {
      const btn = document.createElement("button");
      btn.className = "toolbtn";
      btn.dataset.pos = pos;
      btn.textContent = icon;
      btn.title = label;
      btn.addEventListener("click", () => setPosition(pos));
      toolbar.appendChild(btn);
    }

    const responsiveBtn = document.createElement("button");
    responsiveBtn.className = "toolbtn active";
    responsiveBtn.dataset.role = "responsive";
    responsiveBtn.textContent = "↔";
    responsiveBtn.title = "Responsive đang bật";
    responsiveBtn.addEventListener("click", async () => {
      responsiveEnabled = !responsiveEnabled;
      responsiveBtn.classList.toggle("active", responsiveEnabled);
      responsiveBtn.textContent = responsiveEnabled ? "↔" : "⊘";
      responsiveBtn.title = responsiveEnabled
        ? "Responsive đang bật"
        : "Responsive đang tắt";

      if (responsiveEnabled) applyResponsiveLayout();
      else clearResponsiveLayout();

      await chrome.storage.local.set({
        babylonDockResponsive: responsiveEnabled
      });
    });
    toolbar.appendChild(responsiveBtn);

    const close = document.createElement("button");
    close.className = "toolbtn";
    close.textContent = "✕";
    close.title = "Đóng BaByLon";
    close.addEventListener("click", hideDock);
    toolbar.appendChild(close);

    frame = document.createElement("iframe");
    frame.allow = "clipboard-read; clipboard-write";
    frame.referrerPolicy = "no-referrer";

    // IMPORTANT: load iframe ONCE. Moving dock must never reload it.
    frame.src = chrome.runtime.getURL("popup.html?dock=1");
    frame.addEventListener("load", () => {
      frameReady = true;
      notifyFramePosition();
    });

    const resize = document.createElement("div");
    resize.className = "resize-handle";

    panel.append(toolbar, frame, resize);
    shadow.append(style, panel);
    document.documentElement.appendChild(host);

    setupResize(resize);

    // iframe can also tell us it is ready via postMessage.
    window.addEventListener("message", (event) => {
      const data = event?.data;
      if (!data || data.source !== "BABYLON_DOCK_FRAME") return;
      if (data.type === "READY") {
        frameReady = true;
        notifyFramePosition();
      }
    });
  }

  function setPosition(position) {
    if (!["left", "right", "bottom"].includes(position)) {
      position = "right";
    }

    currentPosition = position;

    if (!host || !panel) return;

    layoutHost();

    const resize = panel.querySelector(".resize-handle");
    if (position === "bottom") {
      resize.className = "resize-handle bottom";
      resize.style.left = "0";
      resize.style.right = "0";
      resize.style.top = "0";
      resize.style.bottom = "";
      resize.style.width = "";
    } else {
      resize.className = "resize-handle side";
      resize.style.top = "42px";
      resize.style.bottom = "0";
      resize.style.width = "10px";
      resize.style.left = position === "right" ? "0" : "";
      resize.style.right = position === "left" ? "0" : "";
    }

    panel.querySelectorAll(".toolbtn[data-pos]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.pos === position);
    });

    notifyFramePosition();

    if (responsiveEnabled) applyResponsiveLayout();
    else clearResponsiveLayout();

    chrome.storage.local.set({ babylonDockPosition: position });
  }

  function layoutHost() {
    if (!host) return;

    // Host occupies ONLY the real panel area.
    // This fixes the bottom-dock bug where the page above became unclickable.
    host.style.top = "";
    host.style.right = "";
    host.style.bottom = "";
    host.style.left = "";
    host.style.width = "";
    host.style.height = "";

    if (currentPosition === "right") {
      host.style.top = "0";
      host.style.right = "0";
      host.style.width = `${Math.min(sideWidth, innerWidth - 80)}px`;
      host.style.height = "100vh";
      panel.style.borderRadius = "14px 0 0 14px";
    } else if (currentPosition === "left") {
      host.style.top = "0";
      host.style.left = "0";
      host.style.width = `${Math.min(sideWidth, innerWidth - 80)}px`;
      host.style.height = "100vh";
      panel.style.borderRadius = "0 14px 14px 0";
    } else {
      host.style.left = "0";
      host.style.bottom = "0";
      host.style.width = "100vw";
      host.style.height = `${Math.min(bottomHeight, innerHeight - 100)}px`;
      panel.style.borderRadius = "14px 14px 0 0";
    }
  }

  function notifyFramePosition() {
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage({
        source: "BABYLON_DOCK_HOST",
        type: "POSITION",
        position: currentPosition
      }, "*");
    } catch (_) {}
  }

  function setupResize(handle) {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = host.getBoundingClientRect().width;
      const startHeight = host.getBoundingClientRect().height;

      const onMove = (e) => {
        let next;

        if (currentPosition === "right") {
          next = clamp(
            startWidth + (startX - e.clientX),
            360,
            Math.max(380, Math.min(760, innerWidth - 160))
          );
          pendingDragSize = { side: next };
        } else if (currentPosition === "left") {
          next = clamp(
            startWidth + (e.clientX - startX),
            360,
            Math.max(380, Math.min(760, innerWidth - 160))
          );
          pendingDragSize = { side: next };
        } else {
          next = clamp(
            startHeight + (startY - e.clientY),
            300,
            Math.max(320, Math.min(560, innerHeight - 140))
          );
          pendingDragSize = { bottom: next };
        }

        scheduleDragLayout();
      };

      const onUp = async () => {
        removeEventListener("pointermove", onMove, true);
        removeEventListener("pointerup", onUp, true);

        if (dragRaf) {
          cancelAnimationFrame(dragRaf);
          dragRaf = 0;
        }
        flushPendingDrag();

        await chrome.storage.local.set({
          babylonDockSideWidth: Math.round(sideWidth),
          babylonDockBottomHeight: Math.round(bottomHeight)
        });
      };

      addEventListener("pointermove", onMove, true);
      addEventListener("pointerup", onUp, true);
    });
  }

  function scheduleDragLayout() {
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0;
      flushPendingDrag();
    });
  }

  function flushPendingDrag() {
    if (!pendingDragSize) return;

    if (Number.isFinite(pendingDragSize.side)) {
      sideWidth = pendingDragSize.side;
    }
    if (Number.isFinite(pendingDragSize.bottom)) {
      bottomHeight = pendingDragSize.bottom;
    }
    pendingDragSize = null;

    layoutHost();

    if (responsiveEnabled) {
      applyResponsiveLayout();
    }
  }

  function hideDock() {
    if (host) host.style.display = "none";
    clearResponsiveLayout();
  }

  function ensureResponsiveStyle() {
    if (responsiveStyle?.isConnected) return;

    responsiveStyle = document.createElement("style");
    responsiveStyle.id = "babylon-responsive-layout-style-v115";
    responsiveStyle.textContent = `
      /*
       * STABLE responsive reserve.
       * Only one shift is applied. No nested duplicate margins.
       * No forced body height and no synthetic resize event.
       */

      html[data-babylon-responsive="right"] body,
      html[data-babylon-responsive="left"] body {
        box-sizing:border-box !important;
        width:calc(100vw - var(--babylon-side, 0px)) !important;
        max-width:calc(100vw - var(--babylon-side, 0px)) !important;
        min-width:0 !important;
      }

      html[data-babylon-responsive="right"] body {
        margin-left:0 !important;
        margin-right:var(--babylon-side, 0px) !important;
      }

      html[data-babylon-responsive="left"] body {
        margin-left:var(--babylon-side, 0px) !important;
        margin-right:0 !important;
      }

      /*
       * YouTube follows BODY width.
       * Do NOT add a second margin to ytd-app/page-manager.
       */
      html[data-babylon-responsive="right"] ytd-app,
      html[data-babylon-responsive="left"] ytd-app,
      html[data-babylon-responsive="right"] #content.ytd-app,
      html[data-babylon-responsive="left"] #content.ytd-app,
      html[data-babylon-responsive="right"] #page-manager.ytd-app,
      html[data-babylon-responsive="left"] #page-manager.ytd-app {
        width:100% !important;
        max-width:100% !important;
        margin-left:0 !important;
        margin-right:0 !important;
      }

      html[data-babylon-responsive="right"] ytd-masthead {
        left:0 !important;
        right:var(--babylon-side, 0px) !important;
        width:auto !important;
      }

      html[data-babylon-responsive="left"] ytd-masthead {
        left:var(--babylon-side, 0px) !important;
        right:0 !important;
        width:auto !important;
      }

      html[data-babylon-responsive="left"] ytd-mini-guide-renderer {
        left:var(--babylon-side, 0px) !important;
      }

      /*
       * Bottom dock deliberately does NOT force body/app height.
       * That old rule caused the upper page to stop receiving clicks.
       * We only reserve scrollable space at the bottom.
       */
      html[data-babylon-responsive="bottom"] body {
        box-sizing:border-box !important;
        padding-bottom:var(--babylon-bottom, 0px) !important;
      }

      html[data-babylon-responsive="bottom"] ytd-app {
        padding-bottom:var(--babylon-bottom, 0px) !important;
        box-sizing:border-box !important;
      }
    `;

    (document.head || document.documentElement).appendChild(responsiveStyle);
  }

  function applyResponsiveLayout() {
    if (!host || host.style.display === "none") return;

    ensureResponsiveStyle();

    const root = document.documentElement;
    root.dataset.babylonResponsive = currentPosition;

    if (currentPosition === "left" || currentPosition === "right") {
      const width = Math.round(host.getBoundingClientRect().width || sideWidth);
      root.style.setProperty("--babylon-side", `${width}px`);
      root.style.removeProperty("--babylon-bottom");
    } else {
      const height = Math.round(host.getBoundingClientRect().height || bottomHeight);
      root.style.setProperty("--babylon-bottom", `${height}px`);
      root.style.removeProperty("--babylon-side");
    }

    /*
     * IMPORTANT:
     * Do NOT dispatch window.resize here.
     * v1.14 did that, while its own resize listener called setPosition again.
     * That created the visible jumping/jitter loop in the user's recording.
     */
  }

  function clearResponsiveLayout() {
    const root = document.documentElement;
    delete root.dataset.babylonResponsive;
    root.style.removeProperty("--babylon-side");
    root.style.removeProperty("--babylon-bottom");
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Only react to REAL browser viewport resizing.
  addEventListener("resize", () => {
    clearTimeout(realResizeTimer);
    realResizeTimer = setTimeout(() => {
      if (!host || host.style.display === "none") return;

      sideWidth = clamp(
        sideWidth,
        360,
        Math.max(380, Math.min(760, innerWidth - 160))
      );
      bottomHeight = clamp(
        bottomHeight,
        300,
        Math.max(320, Math.min(560, innerHeight - 140))
      );

      layoutHost();
      if (responsiveEnabled) applyResponsiveLayout();
    }, 100);
  }, { passive:true });
})();
