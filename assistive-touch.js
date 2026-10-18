(() => {
  if (window.top !== window || document.getElementById('babylon-assistive-host')) return;
  // Do not show the floating control on the legacy BaByLon new-tab document.
  if (location.protocol === 'chrome-extension:' && location.pathname === '/newtab.html') return;

  const STORAGE_KEY = 'babylonAssistiveTouchPositionV1';
  const host = document.createElement('div');
  host.id = 'babylon-assistive-host';
  host.setAttribute('data-babylon-ui', 'assistive-touch');

  // Keep the floating UI immune to aggressive site CSS (TikTok/Google/Facebook/etc.).
  // The host itself is outside Shadow DOM, so give it strong inline !important rules.
  const protectHost = () => {
    const rules = {
      all: 'initial',
      display: 'block',
      position: 'fixed',
      inset: '0',
      width: '0',
      height: '0',
      margin: '0',
      padding: '0',
      border: '0',
      opacity: '1',
      visibility: 'visible',
      transform: 'none',
      filter: 'none',
      pointerEvents: 'none',
      zIndex: '2147483647'
    };
    for (const [key, value] of Object.entries(rules)) {
      host.style.setProperty(key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), value, 'important');
    }
  };
  protectHost();
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .bb-wrap {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .bb-fab {
      position: fixed;
      right: 14px;
      top: 46%;
      width: 54px;
      height: 54px;
      border: 1px solid rgba(255,255,255,.78);
      border-radius: 999px;
      padding: 0;
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 32% 28%, rgba(255,255,255,.98) 0 8%, transparent 9%),
        linear-gradient(145deg, #6e5cff 0%, #566cf4 42%, #08c8b4 100%);
      color: #fff;
      box-shadow: 0 8px 28px rgba(24,34,48,.30), inset 0 0 0 5px rgba(255,255,255,.13);
      opacity: .92;
      transition: opacity .16s ease, transform .16s ease, box-shadow .16s ease;
      outline: none;
    }
    .bb-fab:hover { opacity: 1; transform: scale(1.055); box-shadow: 0 10px 34px rgba(24,34,48,.34), inset 0 0 0 5px rgba(255,255,255,.16); }
    .bb-fab:active { cursor: grabbing; transform: scale(.98); }
    .bb-fab.bb-open { opacity: 1; box-shadow: 0 9px 32px rgba(85,75,224,.42), inset 0 0 0 5px rgba(255,255,255,.18); }
    .bb-letter { font-weight: 950; font-size: 23px; line-height: 1; letter-spacing: -.5px; text-shadow: 0 1px 3px rgba(0,0,0,.14); }
    .bb-dot { position:absolute; right:1px; bottom:2px; width:12px; height:12px; border-radius:50%; background:#23d39a; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,.2); }
    .bb-panel {
      position: fixed;
      top: 62px;
      right: 78px;
      width: min(500px, calc(100vw - 100px));
      height: min(820px, calc(100vh - 92px));
      min-width: 350px;
      min-height: 420px;
      border-radius: 18px;
      overflow: hidden;
      pointer-events: auto;
      background: #f7f8ff;
      border: 1px solid rgba(126,136,160,.24);
      box-shadow: 0 24px 70px rgba(17,24,39,.30), 0 4px 18px rgba(17,24,39,.14);
      opacity: 0;
      visibility: hidden;
      transform: translateY(7px) scale(.985);
      transform-origin: top right;
      transition: opacity .16s ease, transform .16s ease, visibility .16s;
    }
    .bb-panel.bb-open { opacity:1; visibility:visible; transform:translateY(0) scale(1); }
    .bb-frame { width:100%; height:100%; border:0; display:block; background:#f7f8ff; }
    .bb-tip {
      position: fixed;
      right: 78px;
      top: calc(46% + 11px);
      padding: 8px 11px;
      border-radius: 10px;
      background: rgba(20,26,38,.88);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 6px 18px rgba(0,0,0,.18);
      pointer-events: none;
      opacity: 0;
      transform: translateX(5px);
      transition: .16s ease;
      white-space: nowrap;
    }
    .bb-fab:hover + .bb-tip { opacity: 1; transform: translateX(0); }
    @media (max-width: 700px) {
      .bb-panel { right: 10px; top: 54px; width: calc(100vw - 20px); height: calc(100vh - 70px); min-width:0; min-height:300px; border-radius:14px; }
      .bb-tip { display:none; }
    }
  `;

  const wrap = document.createElement('div');
  wrap.className = 'bb-wrap';
  const btn = document.createElement('button');
  btn.className = 'bb-fab';
  btn.type = 'button';
  btn.title = 'BaByLon AssistiveTouch — nhấn để mở/đóng';
  btn.setAttribute('aria-label', 'Mở BaByLon');
  btn.innerHTML = '<span class="bb-letter">B</span><span class="bb-dot"></span>';

  const tip = document.createElement('div');
  tip.className = 'bb-tip';
  tip.textContent = 'Mở BaByLon';

  const panel = document.createElement('div');
  panel.className = 'bb-panel';
  const frame = document.createElement('iframe');
  frame.className = 'bb-frame';
  frame.title = 'BaByLon';
  frame.src = chrome.runtime.getURL('sidepanel.html?assistive=1');
  frame.setAttribute('allow', 'clipboard-read; clipboard-write');
  panel.appendChild(frame);
  wrap.append(btn, tip, panel);
  root.append(style, wrap);

  let open = false;
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const savePosition = () => {
    const r = btn.getBoundingClientRect();
    chrome.storage?.local?.set?.({ [STORAGE_KEY]: { left: r.left, top: r.top } });
  };
  const applyPosition = (left, top) => {
    const maxL = Math.max(6, window.innerWidth - 60);
    const maxT = Math.max(6, window.innerHeight - 60);
    btn.style.left = `${clamp(left, 6, maxL)}px`;
    btn.style.top = `${clamp(top, 6, maxT)}px`;
    btn.style.right = 'auto';
  };
  const positionPanelNearButton = () => {
    if (window.innerWidth <= 700) return;
    const b = btn.getBoundingClientRect();
    const panelW = Math.min(500, window.innerWidth - 100);
    const panelH = Math.min(820, window.innerHeight - 92);
    let left = b.left > window.innerWidth / 2 ? b.left - panelW - 14 : b.right + 14;
    left = clamp(left, 10, window.innerWidth - panelW - 10);
    let top = clamp(b.top - 80, 10, window.innerHeight - panelH - 10);
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    panel.style.top = `${top}px`;
  };
  const setOpen = (next) => {
    open = !!next;
    if (open) positionPanelNearButton();
    panel.classList.toggle('bb-open', open);
    btn.classList.toggle('bb-open', open);
    btn.setAttribute('aria-expanded', String(open));
    tip.textContent = open ? 'Đóng BaByLon' : 'Mở BaByLon';
  };

  btn.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; pointerId = e.pointerId;
    const r = btn.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY; startLeft = r.left; startTop = r.top;
    btn.setPointerCapture?.(pointerId);
    e.preventDefault();
  });
  btn.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (moved) {
      applyPosition(startLeft + dx, startTop + dy);
      if (open) positionPanelNearButton();
    }
    e.preventDefault();
  });
  btn.addEventListener('pointerup', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    try { btn.releasePointerCapture?.(pointerId); } catch (_) {}
    const r = btn.getBoundingClientRect();
    const snapLeft = r.left + r.width / 2 < window.innerWidth / 2 ? 8 : window.innerWidth - r.width - 8;
    applyPosition(snapLeft, r.top);
    savePosition();
    if (!moved) setOpen(!open);
    pointerId = null;
    e.preventDefault();
  });
  btn.addEventListener('pointercancel', () => { dragging = false; pointerId = null; });

  window.addEventListener('resize', () => {
    const r = btn.getBoundingClientRect();
    applyPosition(r.left, r.top);
    if (open) positionPanelNearButton();
  }, { passive: true });

  // Some SPA pages rebuild <html>/<body>. Re-attach/protect the host if a page removes or hides it.
  const keepAlive = () => {
    try {
      protectHost();
      if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
    } catch (_) {}
  };
  const observer = new MutationObserver(() => {
    if (!host.isConnected) keepAlive();
  });
  try { observer.observe(document.documentElement, { childList: true }); } catch (_) {}
  setInterval(keepAlive, 2500);

  try {
    chrome.storage?.local?.get?.([STORAGE_KEY], (data) => {
      const p = data && data[STORAGE_KEY];
      if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) applyPosition(p.left, p.top);
    });
  } catch (_) {}
})();
