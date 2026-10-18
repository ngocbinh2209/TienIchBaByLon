(() => {
  "use strict";
  function clampScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.35, Math.max(.9, n));
  }
  function apply(theme, scale) {
    const dark = theme === "dark";
    document.body?.classList.toggle("theme-dark", dark);
    document.body?.classList.toggle("theme-light", !dark);
    document.documentElement.style.setProperty("--babylon-font-scale", String(clampScale(scale)));
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }
  async function init() {
    try {
      const saved = await chrome.storage.local.get(["babylonUiTheme", "babylonUiFontScale"]);
      apply(saved.babylonUiTheme, saved.babylonUiFontScale);
    } catch (_) { apply("light", 1); }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes.babylonUiTheme && !changes.babylonUiFontScale) return;
      chrome.storage.local.get(["babylonUiTheme", "babylonUiFontScale"]).then((saved) => {
        apply(saved.babylonUiTheme, saved.babylonUiFontScale);
      }).catch(() => {});
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
