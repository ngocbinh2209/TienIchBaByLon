/* BaByLon 1.43.11 — Read public YouTube captions from player or native transcript panel.
   Runs only in the YouTube tab MAIN world after the user requests subtitles.
   Does not request tokens, access private captions or depend on other extensions. */
(() => {
  'use strict';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const textOf = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const parseTime = value => {
    const m = String(value || '').trim().match(/(?:^|\s)(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?(?:\s|$)/);
    if (!m) return null;
    const h = m[1] ? Number(m[1].slice(0, -1)) : 0;
    return h * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(('0.' + (m[4] || '0')));
  };
  const cleanEvents = rows => {
    const unique = new Map();
    for (const row of rows || []) {
      const start = Number(row.start);
      const content = String(row.text || '').replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(start) || start < 0 || !content) continue;
      const key = start.toFixed(3) + ':' + content;
      if (!unique.has(key)) unique.set(key, {start, duration: Math.max(.5, Number(row.duration) || 3), text: content});
    }
    const events = [...unique.values()].sort((a,b) => a.start - b.start);
    for (let i = 0; i < events.length - 1; i++) {
      const gap = events[i+1].start - events[i].start;
      if (gap > 0 && (!Number.isFinite(events[i].duration) || events[i].duration > gap)) events[i].duration = gap;
    }
    return events;
  };
  const extractJson3 = data => cleanEvents((data?.events || []).filter(x => x.segs?.length).map(x => ({
    start: Number(x.tStartMs || 0)/1000,
    duration: Number(x.dDurationMs || 3000)/1000,
    text: x.segs.map(s => s.utf8 || '').join('')
  })));
  const videoId = () => new URL(location.href).searchParams.get('v') || '';
  const getTracks = () => {
    const player = window.ytInitialPlayerResponse || document.querySelector('ytd-watch-flexy')?.playerData?.playerResponse;
    return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  };
  async function fetchCaption(url) {
    const parsed = new URL(url, location.href);
    if (parsed.hostname !== 'www.youtube.com' && parsed.hostname !== 'youtube.com') return [];
    if (!parsed.pathname.endsWith('/api/timedtext')) return [];
    parsed.searchParams.set('fmt','json3');
    const response = await fetch(parsed.href, {credentials:'same-origin'});
    if (!response.ok) return [];
    const raw = await response.text();
    if (!raw.trim()) return []; // 200 + empty body is common when YouTube requires PoToken
    try { return extractJson3(JSON.parse(raw)); } catch (_) { return []; }
  }
  function playerCaptionUrls(id) {
    // URLs already requested by the native YouTube player can contain player-issued
    // parameters absent from captionTracks[].baseUrl. Never generate a token.
    const entries = performance.getEntriesByType('resource').map(x => x.name);
    return [...new Set(entries.filter(name => {
      try {
        const u = new URL(name);
        return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname.endsWith('/api/timedtext') && u.searchParams.get('v') === id && u.searchParams.has('pot');
      } catch (_) { return false; }
    }))].reverse().slice(0, 8);
  }
  const panel = () => document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
  const panelVisible = () => {
    const p = panel();
    return !!p && p.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN' && !p.hasAttribute('hidden');
  };
  function readTranscriptDom() {
    const root = panel() || document;
    const nodes = root.querySelectorAll('ytd-transcript-segment-renderer, yt-transcript-segment-view-model, transcript-segment-view-model');
    const rows = [];
    for (const node of nodes) {
      const timeEl = node.querySelector('.segment-timestamp, #start-offset, .timestamp, [class*="segmentTimestamp"], [class*="segment-timestamp"]');
      let start = parseTime(textOf(timeEl));
      if (start === null) {
        const attr = node.getAttribute('start-time-ms') || node.getAttribute('start-offset-ms');
        if (attr !== null) start = Number(attr)/1000;
      }
      if (start === null || !Number.isFinite(start)) {
        const firstLine = (node.innerText || '').split('\n')[0];
        start = parseTime(firstLine);
      }
      if (start === null || !Number.isFinite(start)) continue;
      const textEl = node.querySelector('.segment-text, #segment-text, yt-formatted-string.segment-text, [class*="segmentText"], yt-attributed-string');
      let content = textOf(textEl);
      if (!content) content = textOf(node).replace(/^\s*\d{1,2}(?::\d{1,2})?:\d{2}\s*/, '').trim();
      if (!content || content === textOf(timeEl)) continue;
      rows.push({start, duration:3, text:content});
    }
    const events = cleanEvents(rows);
    // The native Transcript panel exposes start times; infer each end from the
    // next segment start for more accurate SRT timing.
    for (let i=0; i<events.length-1; i++) {
      events[i].duration = Math.max(.5, events[i+1].start-events[i].start);
    }
    return events;
  }
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const isTranscriptButton = el => {
    if (!visible(el)) return false;
    const value = [el.getAttribute('aria-label'), el.getAttribute('title'), textOf(el)].filter(Boolean).join(' ').toLowerCase();
    return /(?:show|open|view|hiện|hiển thị|mở|xem|afficher|mostrar|anzeigen|表示|스크립트).{0,28}(?:transcript|bản chép lời|bản ghi|lời thoại|phiên âm|phụ đề|transcripción|transkription|文字起こし)|(?:transcript|bản chép lời|bản ghi|lời thoại|transcripción|transkription)/i.test(value);
  };
  function findTranscriptButton() {
    const preferred = [
      ...document.querySelectorAll('ytd-video-description-transcript-section-renderer button, ytd-video-description-transcript-section-renderer [role="button"]'),
      ...document.querySelectorAll('button[aria-label], button[title], yt-button-shape button, ytd-button-renderer button, [role="button"][aria-label]')
    ];
    return preferred.find(el => isTranscriptButton(el) && !el.closest('ytd-engagement-panel-section-list-renderer')) || null;
  }
  async function openNativeTranscript() {
    if (panelVisible()) return false;
    let button = findTranscriptButton();
    if (!button) {
      // YouTube sometimes hides the transcript entry in the expanded description.
      const more = [...document.querySelectorAll('ytd-watch-metadata #expand, ytd-text-inline-expander #expand, #description-inline-expander #expand, tp-yt-paper-button#expand')].find(visible);
      if (more) { more.click(); await wait(450); }
      button = findTranscriptButton();
    }
    if (!button) return false;
    button.click();
    return true;
  }
  function closeNativeTranscript() {
    const p = panel();
    const close = p?.querySelector('#close-button button, #close-button, button[aria-label="Close"], button[aria-label="Đóng"]');
    if (close && visible(close)) close.click();
  }
  window.BaByLonReadYouTubeCaptions = async () => {
    const id = videoId();
    if (!id) return {error:'Không tìm thấy mã video trên trang YouTube.'};
    const tracks = getTracks();
    const ranked = [...tracks].sort((a,b) => {
      const priority = t => (t.languageCode === 'vi' ? 0 : t.languageCode === 'en' ? 10 : 20) + (t.kind === 'asr' ? 1 : 0);
      return priority(a)-priority(b);
    });
    const urls = [...playerCaptionUrls(id), ...ranked.map(t => t.baseUrl).filter(url => {
      try { return new URL(url).searchParams.get('v') === id; } catch (_) { return false; }
    })];
    for (const url of urls.slice(0, 12)) {
      try {
        const events = await fetchCaption(url);
        if (events.length) {
          const lang = ranked.find(t => url === t.baseUrl || (new URL(url)).searchParams.get('lang') === t.languageCode)?.languageCode || '';
          return {events, language:lang, source:'player'};
        }
      } catch (_) { /* Fall back to the native YouTube transcript panel. */ }
    }
    const existing = readTranscriptDom();
    if (existing.length) return {events:existing, language:ranked[0]?.languageCode || document.documentElement.lang || '', source:'transcript'};
    const alreadyOpen = panelVisible();
    let opened = false;
    try {
      opened = await openNativeTranscript();
      for (let i=0; i<28; i++) {
        const events = readTranscriptDom();
        if (events.length) return {events, language:ranked[0]?.languageCode || document.documentElement.lang || '', source:'transcript'};
        if (!opened && !alreadyOpen && i >= 2) break;
        await wait(350);
      }
    } finally {
      if (opened && !alreadyOpen) closeNativeTranscript();
    }
    return {error: tracks.length
      ? 'YouTube đang hạn chế tải phụ đề trực tiếp và BaByLon chưa đọc được bảng Transcript. Hãy mở phần “Hiện bản chép lời” trên YouTube rồi thử lại.'
      : 'Không tìm thấy phụ đề có thể truy cập. Hãy kiểm tra video có phụ đề hoặc mở “Hiện bản chép lời” trên YouTube rồi thử lại.'};
  };
})();
