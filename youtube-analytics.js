(() => {
  const $ = (id) => document.getElementById(id);
  let running = false;
  let openedOnce = false;
  let progressTimer = null;

  function setStatus(text, type = '') {
    const el = $('ytAnalyticsStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = `status ${type}`;
  }

  function setProgress(percent, text) {
    const wrap = $('ytAnalyticsProgress');
    const bar = $('ytAnalyticsProgressBar');
    const label = $('ytAnalyticsProgressText');
    if (!wrap || !bar || !label) return;
    wrap.classList.remove('hidden');
    bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    label.textContent = text || '';
  }

  function hideProgress() {
    $('ytAnalyticsProgress')?.classList.add('hidden');
  }

  function cleanMetricDisplay(value) {
    const s = String(value ?? '').trim();
    if (!s) return '';
    // Never show internal Studio enum/token/id strings as analytics values.
    if (/^[A-Z][A-Z0-9_]{6,}$/i.test(s) && /_/.test(s)) return '';
    if (/^(?:RECENT|ESTIMATED|ANALYTICS|METRIC|CHANNEL|VIDEO|SHORTS|AUDIENCE)_[A-Z0-9_]+$/i.test(s)) return '';
    if (/^[A-Za-z0-9_-]{10,}$/.test(s) && !/[\s%$€£¥₫,:.]/.test(s) && /[A-Za-z]/.test(s)) return '';
    return s;
  }

  function metric(id, value, source = '', scope = '') {
    const el = $(id);
    if (!el) return;
    const shown = cleanMetricDisplay(value);
    el.textContent = shown || '—';
    const card = el.closest('.yt-metric');
    if (card) {
      if (source && shown) card.dataset.source = source;
      else delete card.dataset.source;
      card.title = shown ? `Nguồn: ${source || 'YouTube Studio'}${scope ? ` • Phạm vi: ${scope}` : ''}` : 'YouTube Studio chưa trả chỉ số này trong phạm vi đang đọc.';
    }
    const scopeEl = id === 'ytMetricRpm' ? $('ytMetricRpmScope') : id === 'ytMetricCtr' ? $('ytMetricCtrScope') : null;
    if (scopeEl) scopeEl.textContent = shown ? (scope || source || 'YouTube Studio') : 'Chưa có dữ liệu chính thức';
  }

  function renderHeatmap(heatmap) {
    const card = $('ytAudienceTimesCard');
    const wrap = $('ytAudienceHeatmapWrap');
    const grid = $('ytAudienceHeatmap');
    const empty = $('ytAudienceEmpty');
    const best = $('ytAudienceBestTimes');
    if (!card || !wrap || !grid || !empty || !best) return;

    card.classList.remove('hidden');
    grid.innerHTML = '';
    best.innerHTML = '';

    const cells = Array.isArray(heatmap?.cells) ? heatmap.cells : [];
    const days = Array.isArray(heatmap?.days) && heatmap.days.length === 7
      ? heatmap.days
      : ['T2','T3','T4','T5','T6','T7','CN'];

    if (cells.length >= 100) {
      wrap.classList.remove('hidden');
      empty.classList.add('hidden');
      const corner = document.createElement('div');
      corner.className = 'day';
      grid.appendChild(corner);
      for (const day of days) {
        const el = document.createElement('div');
        el.className = 'day';
        el.textContent = day;
        grid.appendChild(el);
      }
      const lookup = new Map(cells.map((x) => [`${x.hour}:${x.day}`, x]));
      for (let hour = 0; hour < 24; hour++) {
        const hourEl = document.createElement('div');
        hourEl.className = 'hour';
        hourEl.textContent = hour % 3 === 0 ? `${String(hour).padStart(2,'0')}:00` : '';
        grid.appendChild(hourEl);
        for (let day = 0; day < 7; day++) {
          const cell = lookup.get(`${hour}:${day}`) || { intensity: 0 };
          const el = document.createElement('div');
          const intensity = Math.max(0, Math.min(4, Number(cell.intensity) || 0));
          el.className = `cell i${intensity}`;
          el.title = `${days[day]} ${String(hour).padStart(2,'0')}:00 • mức ${intensity}/4`;
          grid.appendChild(el);
        }
      }
    } else {
      wrap.classList.add('hidden');
      empty.classList.remove('hidden');
    }

    const top = Array.isArray(heatmap?.topSlots) ? heatmap.topSlots.slice(0, 8) : [];
    for (const item of top) {
      const chip = document.createElement('span');
      chip.className = 'yt-best-time';
      chip.textContent = item.label || `${days[item.day] || ''} ${String(item.hour || 0).padStart(2,'0')}:00`;
      best.appendChild(chip);
    }

    if (!top.length && Array.isArray(heatmap?.rawLabels)) {
      for (const label of heatmap.rawLabels.slice(0, 5)) {
        const chip = document.createElement('span');
        chip.className = 'yt-best-time';
        chip.textContent = label;
        best.appendChild(chip);
      }
    }
  }

  function renderInsights(result) {
    const box = $('ytAnalyticsInsights');
    const list = $('ytAnalyticsInsightList');
    if (!box || !list) return;
    box.classList.remove('hidden');
    list.innerHTML = '';
    const m = result?.metrics || {};
    const rows = [];
    if (m.ctr) rows.push(['🎯','CTR',`Tỷ lệ nhấp hiện tại: ${m.ctr}. Dùng chỉ số này cùng Impressions để đánh giá sức hút của tiêu đề + thumbnail.`]);
    if (m.averageViewDuration) rows.push(['⏱️','Thời lượng xem TB',`Người xem trung bình ở lại ${m.averageViewDuration}. So sánh thêm với độ dài video và retention.`]);
    if (m.rpm) rows.push(['💰','RPM',`RPM chính thức Studio: ${m.rpm}${result.metricScopes?.rpm ? ` • ${result.metricScopes.rpm}` : ''}.`]);
    if (m.returningViewers || m.newViewers) rows.push(['👥','Khán giả',`Người xem mới: ${m.newViewers || '—'} • quay lại: ${m.returningViewers || '—'}.`]);
    if (m.averagePercentageViewed) rows.push(['📉','% xem trung bình',`Tỷ lệ nội dung được xem trung bình: ${m.averagePercentageViewed}.`]);
    if (m.uniqueViewers) rows.push(['👤','Người xem duy nhất',`Số người xem duy nhất trong kỳ: ${m.uniqueViewers}.`]);
    if (result?.heatmap?.topSlots?.length) rows.push(['🟣','Giờ người xem hoạt động',`Khung nổi bật nhất: ${result.heatmap.topSlots.slice(0,3).map(x=>x.label).join(' • ')}.`]);
    if (result?.missingMetrics?.length) rows.push(['ℹ️','Chỉ số chưa được Studio cấp', result.missingMetrics.slice(0,8).join(' • ')]);
    if (!rows.length) rows.push(['ℹ️','Dữ liệu', 'YouTube Studio chưa trả đủ các thẻ phân tích nâng cao cho kênh này.']);
    for (const [icon,title,text] of rows) {
      const row = document.createElement('div');
      row.className = 'yt-insight';
      row.innerHTML = `<span>${icon}</span><div><b>${title}</b><p>${text}</p></div>`;
      list.appendChild(row);
    }
  }

  function render(result) {
    if (!result) return;
    $('ytAnalyticsSummary')?.classList.remove('hidden');
    $('ytAnalyticsChannelName').textContent = result.channelName || 'Kênh YouTube đang đăng nhập';
    $('ytAnalyticsUpdated').textContent = result.updatedAt ? new Date(result.updatedAt).toLocaleString('vi-VN') : '';
    const m = result.metrics || {};
    const src = result.metricSources || {};
    metric('ytMetricViews', m.views, src.views);
    metric('ytMetricWatchTime', m.watchTime, src.watchTime);
    metric('ytMetricSubscribers', m.subscribers, src.subscribers);
    metric('ytMetricImpressions', m.impressions, src.impressions);
    metric('ytMetricCtr', m.ctr, src.ctr, result.metricScopes?.ctr || 'Video • 28 ngày');
    metric('ytMetricAvd', m.averageViewDuration, src.averageViewDuration);
    metric('ytMetricRevenue', m.estimatedRevenue, src.estimatedRevenue);
    metric('ytMetricRpm', m.rpm, src.rpm, result.metricScopes?.rpm || 'Video • 28 ngày');
    metric('ytMetricCpm', m.cpm, src.cpm);
    metric('ytMetricNewViewers', m.newViewers, src.newViewers);
    metric('ytMetricReturningViewers', m.returningViewers, src.returningViewers);
    metric('ytMetricMonthlyAudience', m.monthlyAudience, src.monthlyAudience);
    metric('ytMetricAvgPercent', m.averagePercentageViewed, src.averagePercentageViewed);
    metric('ytMetricUniqueViewers', m.uniqueViewers, src.uniqueViewers);
    metric('ytMetricMonetizedPlaybacks', m.monetizedPlaybacks, src.monetizedPlaybacks);
    metric('ytMetricAdRevenue', m.adRevenue, src.adRevenue);
    metric('ytMetricEngagedViews', m.engagedViews, src.engagedViews);
    metric('ytMetricShownInFeed', m.shownInFeed, src.shownInFeed);
    metric('ytMetricStayedToWatch', m.stayedToWatch, src.stayedToWatch);
    metric('ytMetricLikes', m.likes, src.likes);
    metric('ytMetricComments', m.comments, src.comments);
    metric('ytMetricShares', m.shares, src.shares);
    metric('ytMetricRealtimeViews', m.realtimeViews, src.realtimeViews);
    const deep = $('ytAnalyticsDeepStatus');
    if (deep) {
      const found = Object.values(m).filter(Boolean).length;
      const apiCount = Object.values(result.metricSources || {}).filter(x => x === 'Studio API').length;
      const officialCount = Object.values(result.metricSources || {}).filter(x => x === 'Studio UI' || x === 'Studio API').length;
      deep.textContent = `Đã đối chiếu ${result.pagesRead || 4} khu vực • ${result.apiResponses || 0} response Studio API • ${officialCount} chỉ số chính thức. CTR/RPM/CPM không tự tính.`;
    }
    renderHeatmap(result.heatmap || {});
    renderInsights(result);
  }

  async function pollProgress() {
    clearInterval(progressTimer);
    progressTimer = setInterval(async () => {
      try {
        const { babylonYtAnalyticsProgress } = await chrome.storage.local.get(['babylonYtAnalyticsProgress']);
        const p = babylonYtAnalyticsProgress;
        if (p?.running) setProgress(p.percent || 0, p.text || 'Đang đọc YouTube Studio...');
      } catch (_) {}
    }, 500);
  }

  async function analyze() {
    if (running) return;
    running = true;
    const btn = $('ytAnalyticsRunBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'ĐANG PHÂN TÍCH...'; }
    setStatus('Đang mở YouTube Studio bằng phiên đăng nhập hiện tại...', '');
    setProgress(3, 'Khởi động YouTube Studio...');
    pollProgress();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'BABYLON_YT_ANALYTICS_RUN' });
      if (!response?.ok) throw new Error(response?.error || 'Không đọc được YouTube Studio.');
      render(response.result);
      setProgress(100, 'Hoàn tất.');
      setStatus('Đã phân tích kênh YouTube đang đăng nhập.', 'ok');
      setTimeout(hideProgress, 1000);
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
      setProgress(100, 'Phân tích chưa hoàn tất.');
    } finally {
      running = false;
      clearInterval(progressTimer);
      if (btn) { btn.disabled = false; btn.textContent = 'PHÂN TÍCH LẠI'; }
    }
  }

  async function openStudio() {
    await chrome.tabs.create({ url: 'https://studio.youtube.com/', active: true });
  }

  async function restore() {
    try {
      const { babylonYtAnalyticsResult } = await chrome.storage.local.get(['babylonYtAnalyticsResult']);
      const valid = babylonYtAnalyticsResult?.source === 'youtube-studio-exact-ui-v138';
      if (valid) {
        render(babylonYtAnalyticsResult);
        setStatus('Đang hiển thị lần phân tích chính xác gần nhất. Bấm Phân tích lại để cập nhật.', 'ok');
        return babylonYtAnalyticsResult;
      }
      return null;
    } catch (_) { return null; }
  }

  async function onOpen() {
    if (!openedOnce) {
      openedOnce = true;
      $('ytAnalyticsRunBtn')?.addEventListener('click', analyze);
      $('ytAnalyticsOpenStudioBtn')?.addEventListener('click', openStudio);

      // Chỉ hiển thị dữ liệu cũ nếu đã từng phân tích.
      // KHÔNG tự chạy phân tích khi người dùng chỉ mở tab "Phân tích YT".
      // Việc đọc YouTube Studio chỉ bắt đầu sau khi người dùng bấm
      // nút "PHÂN TÍCH KÊNH CỦA TÔI" / "PHÂN TÍCH LẠI".
      const old = await restore();
      const btn = $('ytAnalyticsRunBtn');
      if (old) {
        if (btn) btn.textContent = 'PHÂN TÍCH LẠI';
      } else {
        hideProgress();
        setStatus('Nhấn PHÂN TÍCH KÊNH CỦA TÔI để bắt đầu đọc số liệu YouTube Studio.', '');
        if (btn) btn.textContent = 'PHÂN TÍCH KÊNH CỦA TÔI';
      }
    }
  }

  window.BaByLonYoutubeAnalytics = { onOpen, analyze, render };
})();
