
(() => {
  "use strict";

  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
  const YOUTUBE_CHANNEL_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";

  const TARGET_TIME_ZONES = [
    { code: "VN", flag: "🇻🇳", country: "Việt Nam", city: "Hồ Chí Minh", timeZone: "Asia/Ho_Chi_Minh" },
    { code: "US", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "New York • Eastern (ET)", timeZone: "America/New_York" },
    { code: "US_CT", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Chicago • Central (CT)", timeZone: "America/Chicago" },
    { code: "US_MT", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Denver • Mountain (MT)", timeZone: "America/Denver" },
    { code: "US_PT", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Los Angeles • Pacific (PT)", timeZone: "America/Los_Angeles" },
    { code: "US_AZ", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Phoenix • Arizona (MST, không DST)", timeZone: "America/Phoenix" },
    { code: "US_AK", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Anchorage • Alaska", timeZone: "America/Anchorage" },
    { code: "US_HI", flag: "🇺🇸", flagCode: "US", country: "Mỹ", city: "Honolulu • Hawaii", timeZone: "Pacific/Honolulu" },
    { code: "KR", flag: "🇰🇷", country: "Hàn Quốc", city: "Seoul", timeZone: "Asia/Seoul" },
    { code: "JP", flag: "🇯🇵", country: "Nhật Bản", city: "Tokyo", timeZone: "Asia/Tokyo" },
    { code: "DE", flag: "🇩🇪", country: "Đức", city: "Berlin", timeZone: "Europe/Berlin" },
    { code: "FR", flag: "🇫🇷", country: "Pháp", city: "Paris", timeZone: "Europe/Paris" },
    { code: "ES", flag: "🇪🇸", country: "Tây Ban Nha", city: "Madrid", timeZone: "Europe/Madrid" },
    { code: "PT", flag: "🇵🇹", country: "Bồ Đào Nha", city: "Lisbon", timeZone: "Europe/Lisbon" },
    { code: "NL", flag: "🇳🇱", country: "Hà Lan", city: "Amsterdam", timeZone: "Europe/Amsterdam" },
    { code: "IT", flag: "🇮🇹", country: "Ý", city: "Rome", timeZone: "Europe/Rome" }
  ];
  const US_CALCULATOR_EXTRA_CODES = ["US_CT", "US_MT", "US_PT", "US_AZ", "US_AK", "US_HI"];
  const DEFAULT_TIME_ZONE_CODES = TARGET_TIME_ZONES.map(item => item.code);

  // Múi giờ đại diện/có thể khớp theo UTC offset gốc. Với quốc gia nhiều múi giờ,
  // BaByLon ưu tiên múi giờ có offset trùng timestamp nguồn tại đúng thời điểm đăng.
  const COUNTRY_TIME_ZONES = {
    VN:["Asia/Ho_Chi_Minh"], KR:["Asia/Seoul"], JP:["Asia/Tokyo"], DE:["Europe/Berlin"],
    FR:["Europe/Paris"], ES:["Europe/Madrid","Atlantic/Canary"], GB:["Europe/London"],
    US:["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Anchorage","Pacific/Honolulu"],
    CA:["America/Toronto","America/Winnipeg","America/Edmonton","America/Vancouver"],
    AU:["Australia/Sydney","Australia/Adelaide","Australia/Perth"], NZ:["Pacific/Auckland"],
    CN:["Asia/Shanghai"], TW:["Asia/Taipei"], HK:["Asia/Hong_Kong"], SG:["Asia/Singapore"],
    MY:["Asia/Kuala_Lumpur"], TH:["Asia/Bangkok"], ID:["Asia/Jakarta","Asia/Makassar","Asia/Jayapura"],
    PH:["Asia/Manila"], IN:["Asia/Kolkata"], PK:["Asia/Karachi"], BD:["Asia/Dhaka"],
    AE:["Asia/Dubai"], SA:["Asia/Riyadh"], TR:["Europe/Istanbul"], RU:["Europe/Moscow","Asia/Yekaterinburg","Asia/Novosibirsk","Asia/Vladivostok"],
    IT:["Europe/Rome"], NL:["Europe/Amsterdam"], BE:["Europe/Brussels"], CH:["Europe/Zurich"],
    AT:["Europe/Vienna"], PL:["Europe/Warsaw"], PT:["Europe/Lisbon","Atlantic/Azores"],
    SE:["Europe/Stockholm"], NO:["Europe/Oslo"], DK:["Europe/Copenhagen"], FI:["Europe/Helsinki"],
    CZ:["Europe/Prague"], GR:["Europe/Athens"], RO:["Europe/Bucharest"], UA:["Europe/Kyiv"],
    BR:["America/Sao_Paulo","America/Manaus"], AR:["America/Argentina/Buenos_Aires"], MX:["America/Mexico_City","America/Tijuana"],
    CL:["America/Santiago"], CO:["America/Bogota"], PE:["America/Lima"], ZA:["Africa/Johannesburg"],
    EG:["Africa/Cairo"], NG:["Africa/Lagos"], KE:["Africa/Nairobi"]
  };

  const COUNTRY_ALIASES = {
    "united states":"US", "united states of america":"US", "usa":"US", "u.s.":"US", "us":"US", "my":"US", "hoa ky":"US",
    "vietnam":"VN", "viet nam":"VN", "south korea":"KR", "korea":"KR", "republic of korea":"KR", "han quoc":"KR",
    "japan":"JP", "nhat ban":"JP", "germany":"DE", "duc":"DE", "france":"FR", "phap":"FR", "spain":"ES", "tay ban nha":"ES",
    "portugal":"PT", "bo dao nha":"PT", "netherlands":"NL", "the netherlands":"NL", "ha lan":"NL", "italy":"IT", "y":"IT",
    "united kingdom":"GB", "uk":"GB", "vuong quoc anh":"GB", "canada":"CA", "australia":"AU", "uc":"AU", "new zealand":"NZ",
    "china":"CN", "trung quoc":"CN", "taiwan":"TW", "dai loan":"TW", "hong kong":"HK", "singapore":"SG", "malaysia":"MY",
    "thailand":"TH", "thai lan":"TH", "indonesia":"ID", "philippines":"PH", "india":"IN", "an do":"IN", "pakistan":"PK",
    "bangladesh":"BD", "united arab emirates":"AE", "saudi arabia":"SA", "turkey":"TR", "türkiye":"TR", "russia":"RU", "nga":"RU",
    "belgium":"BE", "switzerland":"CH", "austria":"AT", "poland":"PL", "sweden":"SE", "norway":"NO", "denmark":"DK", "finland":"FI",
    "czechia":"CZ", "czech republic":"CZ", "greece":"GR", "romania":"RO", "ukraine":"UA", "brazil":"BR", "argentina":"AR",
    "mexico":"MX", "chile":"CL", "colombia":"CO", "peru":"PE", "south africa":"ZA", "egypt":"EG", "nigeria":"NG", "kenya":"KE"
  };

  const el = (id) => document.getElementById(id);

  const urlInput = el("dateUrlInput");
  const checkBtn = el("dateCheckBtn");
  const currentBtn = el("dateCurrentBtn");
  const statusBox = el("dateStatus");
  const resultBox = el("dateResult");
  const youtubeApiKeyInput = el("dateYoutubeApiKey");
  const detectedBox = el("dateDetected");

  const platformEl = el("datePlatform");
  const publishedAtEl = el("datePublishedAt");
  const sourceEl = el("dateSource");
  const rawValueEl = el("dateRawValue");
  const authorCountryEl = el("dateAuthorCountry");
  const authorCountryMetaEl = el("dateAuthorCountryMeta");
  const authorLocalTimeEl = el("dateAuthorLocalTime");
  const authorTimeZoneEl = el("dateAuthorTimeZone");
  const timezoneGridEl = el("dateTimezoneGrid");
  const calcSourceZoneEl = el("dateCalcSourceZone");
  const calcSourceFlagEl = el("dateCalcSourceFlag");
  const calcDateEl = el("dateCalcDate");
  const calcTimeEl = el("dateCalcTime");
  const calcHourEl = el("dateCalcHour");
  const calcMinuteEl = el("dateCalcMinute");
  const calcGridEl = el("dateCalcGrid");
  const calcHintEl = el("dateCalcHint");
  const calcCountrySelectEl = el("dateCalcCountrySelect");
  const calcAddCountryBtn = el("dateCalcAddCountryBtn");
  const calcResetCountriesBtn = el("dateCalcResetCountriesBtn");
  const calcCountryChipsEl = el("dateCalcCountryChips");

  let initialized = false;
  let lastAutoCheckedUrl = "";
  let activePublishedRawValue = "";
  let activeCalculatorSourceCode = "VN";
  let selectedTimeZoneCodes = [...DEFAULT_TIME_ZONE_CODES];

  async function init() {
    if (initialized) return;
    initialized = true;

    const saved = await chrome.storage.local.get(["babylonDateLastUrl", "babylonYoutubeApiKey", "babylonDateCalculatorCountries", "babylonDateUsZonesV14278"]);
    urlInput.value = saved.babylonDateLastUrl || "";
    youtubeApiKeyInput.value = saved.babylonYoutubeApiKey || "";
    if (Array.isArray(saved.babylonDateCalculatorCountries)) {
      const validCodes = new Set(getTimeZoneCatalog().map(item => item.code));
      const valid = saved.babylonDateCalculatorCountries.filter(code => validCodes.has(code));
      if (valid.length) selectedTimeZoneCodes = [...new Set(valid)];
    }
    // v1.42.78: nếu người dùng đang giữ Mỹ trong danh sách, tự bổ sung các khu vực giờ chính của Mỹ đúng một lần.
    if (!saved.babylonDateUsZonesV14278) {
      if (selectedTimeZoneCodes.includes("US")) {
        const usIndex = selectedTimeZoneCodes.indexOf("US") + 1;
        const missing = US_CALCULATOR_EXTRA_CODES.filter(code => !selectedTimeZoneCodes.includes(code));
        selectedTimeZoneCodes.splice(usIndex, 0, ...missing);
      }
      await chrome.storage.local.set({
        babylonDateCalculatorCountries: selectedTimeZoneCodes,
        babylonDateUsZonesV14278: true
      });
    }

    checkBtn.addEventListener("click", () => checkContent(false));
    currentBtn.addEventListener("click", async () => {
      const found = await useCurrentContentUrl(true);
      if (found) await checkContent(false);
    });
    urlInput.addEventListener("input", updateDetectedPlatform);
    urlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) checkContent(false);
    });
    youtubeApiKeyInput.addEventListener("change", saveSettings);
    initTimeCalculator();

    updateDetectedPlatform();
  }

  async function onOpen() {
    await init();
    const found = await useCurrentContentUrl(false);
    if (found && urlInput.value && urlInput.value !== lastAutoCheckedUrl) {
      lastAutoCheckedUrl = urlInput.value;
      await checkContent(true);
    }
  }

  async function useCurrentContentUrl(showMessage) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        if (showMessage) setStatus("Không đọc được URL của tab hiện tại.", "error");
        return false;
      }

      const platform = detectPlatform(tab.url);
      if (!platform || !isSupportedContentUrl(tab.url, platform)) {
        if (showMessage) {
          setStatus("Tab hiện tại chưa phải link nội dung hoặc bài viết YouTube / Facebook / TikTok.", "warn");
        }
        return false;
      }

      urlInput.value = cleanContentUrl(tab.url, platform);
      await chrome.storage.local.set({ babylonDateLastUrl: urlInput.value });
      updateDetectedPlatform();

      if (showMessage) setStatus("Đã lấy link nội dung của tab hiện tại.", "ok");
      return true;
    } catch (error) {
      if (showMessage) setStatus(error?.message || String(error), "error");
      return false;
    }
  }

  async function checkContent(isAuto = false) {
    resetUI();

    const url = urlInput.value.trim();
    const youtubeApiKey = youtubeApiKeyInput.value.trim();

    if (!url) return setStatus("Hãy mở video/bài viết hiện tại hoặc dán link nội dung.", "error");
    if (!isValidUrl(url)) return setStatus("Link không hợp lệ.", "error");

    const platform = detectPlatform(url);
    if (!platform) return setStatus("Không nhận diện được nền tảng.", "error");
    if (!isSupportedContentUrl(url, platform)) {
      return setStatus(`Link ${platform} này chưa phải video hoặc bài viết được hỗ trợ.`, "error");
    }

    const enabledPlatforms = getEnabledPlatforms();
    if (!enabledPlatforms.includes(platform)) {
      return setStatus(`Bạn chưa bật nền tảng ${platform}.`, "warn");
    }

    await chrome.storage.local.set({
      babylonDateLastUrl: url,
      babylonYoutubeApiKey: youtubeApiKey
    });

    try {
      setLoading(true);
      setStatus(isAuto ? "Đã nhận nội dung hiện tại • đang kiểm tra..." : "Đang kiểm tra...");

      let data = null;
      let backgroundError = null;

      try {
        data = await runChecker(platform, url, youtubeApiKey);
      } catch (error) {
        backgroundError = error;
      }

      if (!data?.publishedAt) {
        setStatus("Đang đọc trực tiếp dữ liệu của tab hiện tại...");
        const tabData = await scanActiveTab(platform, url);
        data = { ...(data || {}), ...(tabData || {}) };
      }

      if (!data?.publishedAt) {
        if (backgroundError) console.warn("BaByLon date checker:", backgroundError);
        setStatus(
          platform === "YouTube"
            ? "Không tìm thấy thời gian đăng công khai. Bạn có thể nhập YouTube API key trong Tùy chọn nâng cao để lấy chính xác hơn."
            : "Không tìm thấy ngày giờ đăng công khai của nội dung này.",
          "error"
        );
        return;
      }

      showResult({
        platform,
        publishedAt: formatDate(data.publishedAt),
        source: data.source,
        rawValue: data.publishedAt,
        authorName: data.authorName || "",
        authorCountryCode: normalizeCountryCode(data.authorCountryCode || data.authorCountry || ""),
        authorCountrySource: data.authorCountrySource || ""
      });
      setStatus("Đã tìm thấy ngày giờ đăng.", "ok");
    } catch (error) {
      console.error("BaByLon date checker:", error);
      setStatus(`Lỗi khi kiểm tra: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  function runChecker(platform, url, youtubeApiKey) {
    if (platform === "YouTube") return checkYouTube(url, youtubeApiKey);
    if (platform === "TikTok") return checkTikTok(url);
    if (platform === "Facebook") return checkFacebook(url);
    return Promise.resolve(null);
  }

  async function scanActiveTab(platform, requestedUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab.url || !sameContentPage(tab.url, requestedUrl)) {
        return null;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageForPublishedAt,
        args: [platform]
      });

      return result?.result || null;
    } catch (error) {
      console.warn(error);
      return null;
    }
  }

  function sameContentPage(activeUrl, requestedUrl) {
    try {
      const aPlatform = detectPlatform(activeUrl);
      const rPlatform = detectPlatform(requestedUrl);
      if (aPlatform !== rPlatform) return false;

      const aId = getContentId(activeUrl, aPlatform);
      const rId = getContentId(requestedUrl, rPlatform);
      if (aId && rId) return aId === rId;

      const active = new URL(activeUrl);
      const requested = new URL(requestedUrl);
      return active.pathname.replace(/\/$/, "") === requested.pathname.replace(/\/$/, "");
    } catch {
      return false;
    }
  }

  function scanPageForPublishedAt(platform) {
    const html = document.documentElement.innerHTML;
    const text = document.body?.innerText || "";

    // 1) Nguồn có timestamp tuyệt đối đáng tin cậy nhất trong DOM.
    const directDomDate = scanDomDateNodes();
    if (directDomDate) return directDomDate;

    const metaDate = queryMetaDate([
      ["property", "article:published_time"],
      ["property", "video:release_date"],
      ["itemprop", "datePublished"],
      ["name", "date"],
      ["name", "publishdate"]
    ]);
    if (metaDate) return { publishedAt: metaDate, source: `${platform} current tab meta tag` };

    const jsonLdDate = scanJsonLd(["uploadDate", "datePublished", "dateCreated"]);
    if (jsonLdDate) return { publishedAt: jsonLdDate, source: `${platform} current tab JSON-LD` };

    // 2) YouTube player microformat cho video/Shorts/live.
    if (platform === "YouTube") {
      try {
        const micro = window.ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer;
        const date = micro?.uploadDate || micro?.publishDate;
        if (date) return { publishedAt: date, source: "YouTube current tab player microformat" };
      } catch (_) {}
    }

    // 3) Facebook/YouTube/TikTok thường nhúng timestamp vào dữ liệu trang.
    const contentId = extractContentIdFromLocation(platform);
    const nearbyTimestamp = contentId ? findTimestampNearId(html, contentId) : null;
    if (nearbyTimestamp) {
      return {
        publishedAt: new Date(nearbyTimestamp * 1000).toISOString(),
        source: `${platform} embedded timestamp gần đúng nội dung hiện tại`
      };
    }

    const timestamp = findFirst(html, [
      /"publish_time"\s*:\s*"?(\d{10,13})"?/,
      /"creation_time"\s*:\s*"?(\d{10,13})"?/,
      /"creationTime"\s*:\s*"?(\d{10,13})"?/,
      /"timestamp"\s*:\s*"?(\d{10,13})"?/,
      /"createTime"\s*:\s*"?(\d{10,13})"?/,
      /"create_time"\s*:\s*"?(\d{10,13})"?/,
      /data-utime=["'](\d{10})["']/i
    ]);
    if (timestamp) {
      const n = Number(timestamp);
      const ms = n > 1e12 ? n : n * 1000;
      return { publishedAt: new Date(ms).toISOString(), source: `${platform} current tab timestamp` };
    }

    const isoDate = findFirst(html, [
      /"publishDate"\s*:\s*"([^"]+)"/,
      /"uploadDate"\s*:\s*"([^"]+)"/,
      /"datePublished"\s*:\s*"([^"]+)"/,
      /"publishedAt"\s*:\s*"([^"]+)"/
    ]);
    if (isoDate) return { publishedAt: decodeText(isoDate), source: `${platform} current tab embedded data` };

    // 4) Cuối cùng mới dùng thời gian đang hiển thị. Relative time được quy đổi về mốc gần đúng.
    const visible = findVisibleDate(text);
    if (visible?.value) {
      return {
        publishedAt: visible.value,
        source: `${platform} current tab visible ${visible.approx ? "relative time (ước tính)" : "date"}`
      };
    }

    return null;

    function scanDomDateNodes() {
      const candidates = [];
      const now = Date.now();
      const push = (value, source, score = 0, approx = false) => {
        if (!value) return;
        let parsed = null;
        if (/^\d{10,13}$/.test(String(value).trim())) {
          const n = Number(value);
          parsed = new Date(n > 1e12 ? n : n * 1000);
        } else {
          const rel = parseHumanTime(String(value), now);
          if (rel) parsed = new Date(rel.value);
          else {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) parsed = d;
          }
        }
        if (!parsed || Number.isNaN(parsed.getTime())) return;
        if (parsed.getTime() > now + 86400000 || parsed.getFullYear() < 2005) return;
        candidates.push({ publishedAt: parsed.toISOString(), source, score, approx });
      };

      document.querySelectorAll('time[datetime]').forEach((node, i) => push(node.getAttribute('datetime'), `${platform} <time datetime>`, 100 - Math.min(i, 20)));
      document.querySelectorAll('abbr[data-utime], [data-utime]').forEach((node, i) => push(node.getAttribute('data-utime'), `${platform} data-utime`, 98 - Math.min(i, 20)));

      const currentId = extractContentIdFromLocation(platform);
      const nodes = [...document.querySelectorAll('a[aria-label], a[title], time, abbr, span[aria-label]')].slice(0, 1800);
      nodes.forEach((node, i) => {
        const raw = [node.getAttribute?.('aria-label'), node.getAttribute?.('title'), node.textContent].filter(Boolean).join(' ').trim();
        if (!raw || raw.length > 180) return;
        const human = parseHumanTime(raw, now);
        if (!human) return;
        let score = human.approx ? 45 : 70;
        const href = node.closest?.('a')?.href || node.href || '';
        if (currentId && href.includes(currentId)) score += 35;
        if (i < 120) score += 10;
        candidates.push({ publishedAt: new Date(human.value).toISOString(), source: `${platform} timestamp hiển thị${human.approx ? ' (ước tính)' : ''}`, score, approx: human.approx });
      });

      candidates.sort((a,b) => b.score - a.score);
      return candidates[0] || null;
    }

    function parseHumanTime(raw, nowMs) {
      const s = raw.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!s) return null;
      const now = new Date(nowMs);
      let m;
      if ((m = s.match(/(?:^|\s)(\d+)\s*(?:giây|second|seconds|sec|secs)(?:\s|$)/i))) return { value: nowMs - Number(m[1])*1000, approx: true };
      if ((m = s.match(/(?:^|\s)(\d+)\s*(?:phút|minute|minutes|min|mins)(?:\s|$)/i))) return { value: nowMs - Number(m[1])*60000, approx: true };
      if ((m = s.match(/(?:^|\s)(\d+)\s*(?:giờ|hour|hours|hr|hrs)(?:\s|$)/i))) return { value: nowMs - Number(m[1])*3600000, approx: true };
      if ((m = s.match(/(?:^|\s)(\d+)\s*(?:ngày|day|days)(?:\s|$)/i))) return { value: nowMs - Number(m[1])*86400000, approx: true };
      if ((m = s.match(/(?:^|\s)(\d+)\s*(?:tuần|week|weeks)(?:\s|$)/i))) return { value: nowMs - Number(m[1])*7*86400000, approx: true };

      // Facebook VI: "Hôm qua lúc 19:05"
      if ((m = s.match(/hôm qua(?:\s+lúc)?\s+(\d{1,2}):(\d{2})/i))) {
        const d = new Date(now);
        d.setDate(d.getDate()-1); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return { value: d.getTime(), approx: false };
      }
      if ((m = s.match(/hôm nay(?:\s+lúc)?\s+(\d{1,2}):(\d{2})/i))) {
        const d = new Date(now); d.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return { value: d.getTime(), approx: false };
      }

      // 31 tháng 8, 2026 lúc 19:05 / 31 tháng 8 2026
      if ((m = s.match(/(\d{1,2})\s+tháng\s+(\d{1,2}),?\s+(\d{4})(?:\s+(?:lúc|vào lúc)\s+(\d{1,2}):(\d{2}))?/i))) {
        const d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), Number(m[4]||0), Number(m[5]||0), 0, 0);
        return { value: d.getTime(), approx: false };
      }
      // dd/mm/yyyy [, lúc] HH:mm
      if ((m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s*(?:,|-|lúc)?\s*(\d{1,2}):(\d{2}))?/))) {
        const d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), Number(m[4]||0), Number(m[5]||0), 0, 0);
        return { value: d.getTime(), approx: false };
      }
      // 19:05 31/08/2026
      if ((m = s.match(/\b(\d{1,2}):(\d{2})\s+(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/))) {
        const d = new Date(Number(m[5]), Number(m[4])-1, Number(m[3]), Number(m[1]), Number(m[2]), 0, 0);
        return { value: d.getTime(), approx: false };
      }
      return null;
    }

    function extractContentIdFromLocation(kind) {
      try {
        const u = new URL(location.href);
        if (kind === 'Facebook') {
          return u.searchParams.get('fbid') || u.searchParams.get('story_fbid') || u.searchParams.get('v') ||
            u.pathname.match(/\/(?:posts|permalink|videos|reel)\/([^/?#]+)/i)?.[1] || null;
        }
        if (kind === 'YouTube') return u.searchParams.get('v') || u.searchParams.get('lb') || u.pathname.match(/\/(?:shorts|live|post)\/([^/?#]+)/)?.[1] || null;
        if (kind === 'TikTok') return u.pathname.match(/\/(?:video|photo)\/(\d+)/)?.[1] || null;
      } catch {}
      return null;
    }

    function findTimestampNearId(source, id) {
      const patterns = [
        /"publish_time"\s*:\s*"?(\d{10,13})"?/g,
        /"creation_time"\s*:\s*"?(\d{10,13})"?/g,
        /"creationTime"\s*:\s*"?(\d{10,13})"?/g,
        /"createTime"\s*:\s*"?(\d{10,13})"?/g,
        /data-utime=["'](\d{10})["']/gi
      ];
      const indices=[]; let from=0;
      while (indices.length < 8) { const idx=source.indexOf(id, from); if(idx<0) break; indices.push(idx); from=idx+id.length; }
      let best=null;
      for (const idx of indices) {
        const lo=Math.max(0, idx-90000), hi=Math.min(source.length, idx+90000), chunk=source.slice(lo,hi);
        for (const re of patterns) {
          re.lastIndex=0; let m;
          while ((m=re.exec(chunk))) {
            const n=Number(m[1]); const sec=n>1e12?Math.round(n/1000):n;
            if (sec < 1100000000 || sec > Date.now()/1000 + 86400) continue;
            const absolute=lo+m.index;
            const distance=Math.abs(absolute-idx);
            if(!best || distance<best.distance) best={sec,distance};
          }
        }
      }
      return best?.sec || null;
    }

    function queryMetaDate(pairs) {
      for (const [attr, value] of pairs) {
        const node = document.querySelector(`meta[${attr}="${cssEscapeLocal(value)}"]`);
        if (node?.content) return node.content;
      }
      return null;
    }
    function scanJsonLd(keys) {
      for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')]) {
        try { const json=JSON.parse(script.textContent.trim()); const found=findDate(json,keys); if(found) return found; } catch {}
      }
      return null;
    }
    function findDate(obj, keys) {
      if (!obj || typeof obj !== 'object') return null;
      if (Array.isArray(obj)) { for(const item of obj){ const f=findDate(item,keys); if(f) return f; } return null; }
      for(const key of keys) if(obj[key]) return obj[key];
      for(const value of Object.values(obj)){ const f=findDate(value,keys); if(f) return f; }
      return null;
    }
    function findFirst(source, regexes) { for(const regex of regexes){ const m=source.match(regex); if(m?.[1]) return m[1]; } return null; }
    function findVisibleDate(source) {
      const lines=source.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,500);
      for(const line of lines){ const parsed=parseHumanTime(line, Date.now()); if(parsed) return parsed; }
      return null;
    }
    function decodeText(value) { const textarea=document.createElement('textarea'); textarea.innerHTML=value; return textarea.value; }
    function cssEscapeLocal(value) { if(window.CSS?.escape) return CSS.escape(value); return value.replace(/"/g,'\\"'); }
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      babylonYoutubeApiKey: youtubeApiKeyInput.value.trim()
    });
  }

  function getEnabledPlatforms() {
    const platforms = [];
    if (el("dateYoutubeCheck").checked) platforms.push("YouTube");
    if (el("dateFacebookCheck").checked) platforms.push("Facebook");
    if (el("dateTiktokCheck").checked) platforms.push("TikTok");
    return platforms;
  }

  function detectPlatform(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "YouTube";
      if (host.endsWith("tiktok.com")) return "TikTok";
      if (host.endsWith("facebook.com") || host === "fb.watch") return "Facebook";
    } catch {}
    return null;
  }

  function updateDetectedPlatform() {
    const url = urlInput.value.trim();
    if (!url) {
      detectedBox.textContent = "Chưa nhận diện nền tảng.";
      detectedBox.className = "date-detected";
      return;
    }
    if (!isValidUrl(url)) {
      detectedBox.textContent = "Link chưa hợp lệ.";
      detectedBox.className = "date-detected warn";
      return;
    }
    const platform = detectPlatform(url);
    if (!platform) {
      detectedBox.textContent = "Không nhận diện được nền tảng.";
      detectedBox.className = "date-detected warn";
      return;
    }
    const isContent = isSupportedContentUrl(url, platform);
    detectedBox.textContent = isContent ? `Đã nhận diện: ${platform} • link nội dung` : `${platform} • chưa phải link nội dung`;
    detectedBox.className = `date-detected ${isContent ? "ok" : "warn"}`;
  }

  function isSupportedContentUrl(url, platform) {
    try {
      const u = new URL(url);
      if (platform === "YouTube") {
        if (getYouTubeVideoId(url)) return true;
        if (/\/(?:post)\/[^/?#]+/i.test(u.pathname)) return true;
        if (/\/community\/?$/i.test(u.pathname) && u.searchParams.has("lb")) return true;
        return false;
      }
      if (platform === "TikTok") return /\/(?:video|photo)\/\d+/i.test(u.pathname);
      if (platform === "Facebook") {
        return (
          u.hostname.replace(/^www\./, "") === "fb.watch" ||
          /\/(?:reel|videos|posts|permalink)\/[^/?#]+/i.test(u.pathname) ||
          /\/photo\/?$/i.test(u.pathname) ||
          /\/photo\.php$/i.test(u.pathname) ||
          /\/story\.php$/i.test(u.pathname) ||
          /\/watch\/?$/i.test(u.pathname) ||
          u.searchParams.has("v") || u.searchParams.has("fbid") || u.searchParams.has("story_fbid")
        );
      }
    } catch {}
    return false;
  }

  function cleanContentUrl(url, platform) {
    try {
      const u = new URL(url);
      u.hash = "";
      if (platform === "YouTube") {
        const id = getYouTubeVideoId(url);
        if (id) {
          if (/\/shorts\//.test(u.pathname)) return `https://www.youtube.com/shorts/${id}`;
          if (/\/live\//.test(u.pathname)) return `https://www.youtube.com/live/${id}`;
          return `https://www.youtube.com/watch?v=${id}`;
        }
        return u.toString();
      }
      return u.toString();
    } catch { return url; }
  }

  function getContentId(url, platform) {
    try {
      const u = new URL(url);
      if (platform === "YouTube") return getYouTubeVideoId(url) || u.searchParams.get("lb") || u.pathname.match(/\/post\/([^/?#]+)/i)?.[1] || null;
      if (platform === "TikTok") return u.pathname.match(/\/(?:video|photo)\/(\d+)/i)?.[1] || null;
      if (platform === "Facebook") {
        return u.searchParams.get("fbid") || u.searchParams.get("story_fbid") || u.searchParams.get("v") ||
          u.pathname.match(/\/(?:reel|videos|posts|permalink)\/([^/?#]+)/i)?.[1] || null;
      }
    } catch {}
    return null;
  }

  async function checkYouTube(url, apiKey) {
    const videoId = getYouTubeVideoId(url);
    let apiDetails = null;

    if (videoId && apiKey) {
      try {
        apiDetails = await fetchYouTubeApiDetails(videoId, apiKey);
      } catch (error) {
        console.warn("YouTube API fallback:", error);
      }
    }

    // 1.42.69: khóa danh tính vào ĐÚNG video/Short đang kiểm tra.
    // Không dùng channelId/author đầu tiên trong toàn HTML vì YouTube chứa rất nhiều video đề xuất.
    let tabIdentity = null;
    if (videoId) {
      try { tabIdentity = await getCurrentYouTubeVideoIdentity(url, videoId); }
      catch (error) { console.warn("YouTube current-tab identity:", error); }
    }

    const html = await fetchHtml(url);
    const doc = parseHtml(html);
    const htmlIdentity = extractYouTubeVideoIdentity(html, videoId);

    const channelId =
      apiDetails?.channelId ||
      tabIdentity?.channelId ||
      htmlIdentity?.channelId ||
      extractYouTubeChannelIdNearVideo(html, videoId) ||
      "";

    const authorName =
      apiDetails?.channelTitle ||
      tabIdentity?.author ||
      htmlIdentity?.author ||
      extractYouTubeAuthorNameNearVideo(html, doc, videoId) ||
      "";

    let authorCountryCode = normalizeCountryCode(apiDetails?.country || "");
    let authorCountrySource = authorCountryCode ? "YouTube Data API • quốc gia kênh" : "";

    if (!authorCountryCode && channelId) {
      try {
        const publicCountry = await fetchYouTubeChannelCountryFromPage(channelId);
        if (publicCountry?.code) {
          authorCountryCode = publicCountry.code;
          authorCountrySource = publicCountry.source;
        }
      } catch (error) {
        console.warn("YouTube channel country HTML fallback:", error);
      }
    }

    // Khi HTML thô chưa có About model (YouTube tải động), mở tab nền /about,
    // đọc ytInitialData.aboutChannelViewModel của đúng channel rồi đóng ngay.
    if (!authorCountryCode && channelId) {
      try {
        const renderedCountry = await fetchYouTubeChannelCountryRendered(channelId);
        if (renderedCountry?.code) {
          authorCountryCode = renderedCountry.code;
          authorCountrySource = renderedCountry.source;
        }
      } catch (error) {
        console.warn("YouTube rendered About country fallback:", error);
      }
    }

    let publishedAt = apiDetails?.publishedAt || null;
    let source = publishedAt ? "YouTube Data API" : "";

    if (!publishedAt) {
      publishedAt =
        getMetaContent(doc, "itemprop", "datePublished") ||
        getMetaContent(doc, "property", "article:published_time") ||
        getMetaContent(doc, "name", "date");
      if (publishedAt) source = "YouTube meta tag";
    }

    if (!publishedAt) {
      publishedAt = extractJsonLdDate(doc, ["uploadDate", "datePublished"]);
      if (publishedAt) source = "YouTube JSON-LD";
    }

    if (!publishedAt) {
      publishedAt =
        findByRegex(html, /"publishDate":"([^"]+)"/) ||
        findByRegex(html, /"uploadDate":"([^"]+)"/) ||
        findByRegex(html, /"datePublished":"([^"]+)"/);
      if (publishedAt) {
        publishedAt = decodeHtml(publishedAt);
        source = "YouTube initial data";
      }
    }

    return {
      publishedAt,
      source,
      authorName,
      authorCountryCode,
      authorCountrySource,
      channelId
    };
  }

  async function getCurrentYouTubeVideoIdentity(requestedUrl, expectedVideoId) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || !sameContentPage(tab.url, requestedUrl)) return null;

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (expectedId) => {
          const clean = value => String(value || "").trim();
          const candidates = [];

          try {
            const video = window.ytInitialPlayerResponse?.videoDetails;
            if (video) candidates.push({ videoId: clean(video.videoId), channelId: clean(video.channelId), author: clean(video.author) });
          } catch (_) {}

          try {
            const player = document.querySelector('ytd-player')?.getPlayerPromise ? null : null;
            void player;
          } catch (_) {}

          // Shorts hiện tại: lấy link channel ngay trong reel đang active nếu playerResponse chưa sẵn.
          const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]');
          if (activeShort) {
            const ownerLink = activeShort.querySelector('a[href^="/@"], a[href*="/channel/"], a[href*="youtube.com/@"]');
            const authorNode = activeShort.querySelector('#channel-name, .yt-core-attributed-string, [id*="channel"]');
            const href = ownerLink?.href || ownerLink?.getAttribute?.('href') || '';
            const m = href.match(/\/channel\/(UC[\w-]+)/);
            candidates.push({ videoId: expectedId, channelId: m?.[1] || '', author: clean(authorNode?.textContent) });
          }

          const exact = candidates.find(item => item.videoId === expectedId && item.channelId);
          return exact || candidates.find(item => item.channelId) || null;
        },
        args: [expectedVideoId]
      });
      return result?.result || null;
    } catch (error) {
      console.warn("BaByLon YouTube identity script:", error);
      return null;
    }
  }

  function decodeYouTubeJsonString(value) {
    if (!value) return "";
    try { return JSON.parse(`"${String(value).replace(/"/g, '\\"')}"`); }
    catch { return decodeHtml(String(value).replace(/\\u0026/g, "&")); }
  }

  function extractYouTubeVideoIdentity(html, expectedVideoId) {
    const raw = String(html || "");
    if (!raw) return null;

    const anchors = [];
    if (expectedVideoId) {
      const patterns = [`"videoId":"${expectedVideoId}"`, `\\"videoId\\":\\"${expectedVideoId}\\"`];
      for (const pattern of patterns) {
        let from = 0;
        while (from < raw.length) {
          const idx = raw.indexOf(pattern, from);
          if (idx < 0) break;
          anchors.push(idx);
          from = idx + pattern.length;
          if (anchors.length >= 10) break;
        }
      }
    }

    const playerIdx = raw.indexOf('"videoDetails"');
    if (playerIdx >= 0) anchors.unshift(playerIdx);

    for (const index of anchors) {
      const chunk = raw.slice(Math.max(0, index - 2500), Math.min(raw.length, index + 45000));
      const channelId =
        findByRegex(chunk, /"channelId"\s*:\s*"(UC[^"]+)"/) ||
        findByRegex(chunk, /\\"channelId\\"\s*:\s*\\"(UC[^\\"]+)\\"/);
      const authorRaw =
        findByRegex(chunk, /"author"\s*:\s*"((?:\\.|[^"\\])+)"/) ||
        findByRegex(chunk, /"ownerChannelName"\s*:\s*"((?:\\.|[^"\\])+)"/);
      if (channelId) {
        return { channelId, author: decodeYouTubeJsonString(authorRaw || ""), videoId: expectedVideoId || "" };
      }
    }
    return null;
  }

  function extractYouTubeChannelIdNearVideo(html, videoId) {
    return extractYouTubeVideoIdentity(html, videoId)?.channelId || "";
  }

  function extractYouTubeAuthorNameNearVideo(html, doc, videoId) {
    const strict = extractYouTubeVideoIdentity(html, videoId)?.author;
    if (strict) return strict;
    const raw = getMetaContent(doc, "itemprop", "author") || "";
    return raw ? decodeHtml(raw) : "";
  }

  async function fetchYouTubeApiDetails(videoId, apiKey) {
    const videoParams = new URLSearchParams({ part: "snippet", id: videoId, key: apiKey });
    const videoResponse = await fetch(`${YOUTUBE_API_ENDPOINT}?${videoParams.toString()}`);
    if (!videoResponse.ok) throw new Error(`YouTube API HTTP ${videoResponse.status}`);
    const videoData = await videoResponse.json();
    const snippet = videoData?.items?.[0]?.snippet;
    if (!snippet) return null;

    let country = "";
    if (snippet.channelId) {
      const channelParams = new URLSearchParams({ part: "snippet", id: snippet.channelId, key: apiKey });
      const channelResponse = await fetch(`${YOUTUBE_CHANNEL_API_ENDPOINT}?${channelParams.toString()}`);
      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        country = channelData?.items?.[0]?.snippet?.country || "";
      }
    }

    return {
      publishedAt: snippet.publishedAt || null,
      channelId: snippet.channelId || "",
      channelTitle: snippet.channelTitle || "",
      country
    };
  }

  function extractYouTubeChannelId(html) {
    return (
      findByRegex(html, /"externalChannelId":"(UC[^"]+)"/) ||
      findByRegex(html, /"channelId":"(UC[^"]+)"/) ||
      findByRegex(html, /"browseId":"(UC[^"]+)"/) ||
      ""
    );
  }

  function extractYouTubeAuthorName(html, doc) {
    const raw =
      findByRegex(html, /"ownerChannelName":"([^"]+)"/) ||
      findByRegex(html, /"author":"([^"]+)"/) ||
      getMetaContent(doc, "itemprop", "author") ||
      "";
    return raw ? decodeHtml(raw) : "";
  }

  function extractYouTubeCountryFromAboutHtml(html) {
    const raw = String(html || "");
    if (!raw) return "";

    const anchorNames = ["aboutChannelViewModel", "channelAboutFullMetadataRenderer", "channelAboutMetadataRenderer"];
    const chunks = [];
    for (const anchor of anchorNames) {
      let from = 0;
      for (let i = 0; i < 5; i++) {
        const index = raw.indexOf(anchor, from);
        if (index < 0) break;
        chunks.push(raw.slice(Math.max(0, index - 4000), Math.min(raw.length, index + 120000)));
        from = index + anchor.length;
      }
    }
    if (!chunks.length) chunks.push(raw.slice(0, Math.min(raw.length, 250000)));

    const candidatePatterns = [
      /"countryCode"\s*:\s*"([A-Za-z]{2})"/g,
      /"country"\s*:\s*"((?:\\.|[^"\\]){2,80})"/g,
      /"country"\s*:\s*\{[^{}]{0,500}"simpleText"\s*:\s*"((?:\\.|[^"\\]){2,80})"/g,
      /"country"\s*:\s*\{[^{}]{0,500}"content"\s*:\s*"((?:\\.|[^"\\]){2,80})"/g,
      /"country"\s*:\s*\{[^{}]{0,800}"text"\s*:\s*"((?:\\.|[^"\\]){2,80})"/g
    ];

    for (const chunk of chunks) {
      for (const regex of candidatePatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(chunk))) {
          const decoded = decodeYouTubeJsonString(match[1]);
          const code = normalizeCountryCode(decoded);
          if (code) return code;
        }
      }
    }
    return "";
  }

  async function fetchYouTubeChannelCountryFromPage(channelId) {
    const urls = [
      `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/about?hl=en&persist_hl=1`,
      `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/about?hl=vi&persist_hl=1`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { "Accept-Language": url.includes("hl=vi") ? "vi-VN,vi;q=0.9,en;q=0.7" : "en-US,en;q=0.9" }
        });
        if (!response.ok) continue;
        const html = await response.text();
        const code = extractYouTubeCountryFromAboutHtml(html);
        if (code) return { code, source: "YouTube About • quốc gia kênh công khai" };
      } catch (error) {
        console.warn("YouTube About fetch:", error);
      }
    }
    return null;
  }

  async function waitForTabComplete(tabId, timeoutMs = 9000) {
    const current = await chrome.tabs.get(tabId).catch(() => null);
    if (current?.status === "complete") return true;
    return await new Promise(resolve => {
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(value);
      };
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") finish(true);
      };
      chrome.tabs.onUpdated.addListener(listener);
      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  }

  async function fetchYouTubeChannelCountryRendered(channelId) {
    let tabId = null;
    try {
      const tab = await chrome.tabs.create({
        url: `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/about?hl=en&persist_hl=1`,
        active: false
      });
      tabId = tab?.id;
      if (!tabId) return null;
      await waitForTabComplete(tabId, 9000);
      await new Promise(resolve => setTimeout(resolve, 900));

      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const readText = value => {
            if (value == null) return "";
            if (typeof value === "string") return value;
            if (typeof value?.content === "string") return value.content;
            if (typeof value?.simpleText === "string") return value.simpleText;
            if (Array.isArray(value?.runs)) return value.runs.map(run => run?.text || "").join("");
            return "";
          };

          const seen = new WeakSet();
          const walk = (node, depth = 0) => {
            if (!node || typeof node !== "object" || depth > 20) return "";
            if (seen.has(node)) return "";
            seen.add(node);

            if (node.aboutChannelViewModel) {
              const direct = readText(node.aboutChannelViewModel.country);
              if (direct) return direct;
            }
            if (node.channelAboutFullMetadataRenderer) {
              const direct = readText(node.channelAboutFullMetadataRenderer.country);
              if (direct) return direct;
            }
            if (Object.prototype.hasOwnProperty.call(node, "country")) {
              const direct = readText(node.country);
              if (direct) return direct;
            }
            if (Object.prototype.hasOwnProperty.call(node, "countryCode")) {
              const direct = readText(node.countryCode);
              if (direct) return direct;
            }

            for (const value of Object.values(node)) {
              if (value && typeof value === "object") {
                const found = walk(value, depth + 1);
                if (found) return found;
              }
            }
            return "";
          };

          const initial = (() => { try { return window.ytInitialData; } catch (_) { return null; } })();
          const modelCountry = walk(initial);
          if (modelCountry) return { country: modelCountry, via: "ytInitialData.aboutChannelViewModel" };

          // DOM fallback: chỉ đọc vùng About/dialog, không quét toàn bộ video đề xuất.
          const roots = [
            document.querySelector('ytd-about-channel-renderer'),
            document.querySelector('ytd-channel-about-metadata-renderer'),
            document.querySelector('[role="dialog"]'),
            document.querySelector('yt-page-header-renderer')
          ].filter(Boolean);
          for (const root of roots) {
            const lines = (root.innerText || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
            const markerIndex = lines.findIndex(line => /^(country|quốc gia)$/i.test(line));
            if (markerIndex >= 0 && lines[markerIndex + 1]) return { country: lines[markerIndex + 1], via: "About DOM" };
          }
          return null;
        }
      });

      const rawCountry = result?.result?.country || "";
      const code = normalizeCountryCode(rawCountry);
      return code ? { code, source: `YouTube About • ${result?.result?.via || "dữ liệu render"}` } : null;
    } finally {
      if (tabId) {
        try { await chrome.tabs.remove(tabId); } catch (_) {}
      }
    }
  }

  async function fetchYouTubeApiDate(videoId, apiKey) {
    const details = await fetchYouTubeApiDetails(videoId, apiKey);
    return details?.publishedAt || null;
  }

  async function checkTikTok(url) {
    const html = await fetchHtml(url);
    const doc = parseHtml(html);

    const jsonLdDate = extractJsonLdDate(doc, ["uploadDate", "datePublished", "dateCreated"]);
    if (jsonLdDate) return { publishedAt: jsonLdDate, source: "TikTok JSON-LD" };

    const metaDate =
      getMetaContent(doc, "property", "article:published_time") ||
      getMetaContent(doc, "name", "publishdate") ||
      getMetaContent(doc, "name", "date");

    if (metaDate) return { publishedAt: metaDate, source: "TikTok meta tag" };

    const createTime =
      findByRegex(html, /"createTime":"?(\d{10})"?/) ||
      findByRegex(html, /"create_time":"?(\d{10})"?/);

    if (createTime) return { publishedAt: unixToIso(createTime), source: "TikTok createTime" };
    return null;
  }

  async function checkFacebook(url) {
    const html = await fetchHtml(url);
    const doc = parseHtml(html);

    const metaDate =
      getMetaContent(doc, "property", "article:published_time") ||
      getMetaContent(doc, "property", "video:release_date") ||
      getMetaContent(doc, "name", "date");

    if (metaDate) return { publishedAt: metaDate, source: "Facebook meta tag" };

    const timestamp =
      findByRegex(html, /"publish_time"\s*:\s*"?(\d{10,13})"?/) ||
      findByRegex(html, /"creation_time"\s*:\s*"?(\d{10,13})"?/) ||
      findByRegex(html, /"creationTime"\s*:\s*"?(\d{10,13})"?/) ||
      findByRegex(html, /"timestamp"\s*:\s*"?(\d{10,13})"?/) ||
      findByRegex(html, /data-utime=["'](\d{10})["']/i);

    if (timestamp) {
      const n = Number(timestamp);
      return { publishedAt: new Date(n > 1e12 ? n : n * 1000).toISOString(), source: "Facebook timestamp" };
    }
    return null;
  }

  async function fetchHtml(url) {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function getMetaContent(doc, attr, key) {
    const safe = window.CSS?.escape ? CSS.escape(key) : key.replace(/"/g, '\\"');
    return doc.querySelector(`meta[${attr}="${safe}"]`)?.content || null;
  }

  function extractJsonLdDate(doc, keys) {
    for (const script of [...doc.querySelectorAll('script[type="application/ld+json"]')]) {
      try {
        const json = JSON.parse(script.textContent.trim());
        const found = findDateInObject(json, keys);
        if (found) return found;
      } catch {}
    }
    return null;
  }

  function findDateInObject(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findDateInObject(item, keys);
        if (found) return found;
      }
      return null;
    }
    for (const key of keys) if (obj[key]) return obj[key];
    for (const value of Object.values(obj)) {
      const found = findDateInObject(value, keys);
      if (found) return found;
    }
    return null;
  }

  function getYouTubeVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.replace(/^www\./, "") === "youtu.be") {
        return u.pathname.split("/").filter(Boolean)[0] || null;
      }
      if (u.searchParams.has("v")) return u.searchParams.get("v");

      for (const pattern of [
        /\/shorts\/([^/?#]+)/,
        /\/embed\/([^/?#]+)/,
        /\/live\/([^/?#]+)/
      ]) {
        const match = u.pathname.match(pattern);
        if (match) return match[1];
      }
    } catch {}
    return null;
  }

  function findByRegex(text, regex) {
    return text.match(regex)?.[1] || null;
  }

  function unixToIso(value) {
    return new Date(Number(value) * 1000).toISOString();
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function normalizeCountryCode(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const normalized = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return COUNTRY_ALIASES[normalized] || COUNTRY_ALIASES[raw.toLowerCase()] || "";
  }

  function getCountryName(code) {
    if (!code) return "";
    try {
      return new Intl.DisplayNames(["vi"], { type: "region" }).of(code) || code;
    } catch {
      return code;
    }
  }

  function getRawOffsetMinutes(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (/Z$/i.test(raw)) return 0;
    const match = raw.match(/([+-])(\d{2}):?(\d{2})(?:\[[^\]]+\])?$/);
    if (!match) return null;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === "-" ? -minutes : minutes;
  }

  function getTimeZoneOffsetMinutes(date, timeZone) {
    try {
      const name = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "longOffset",
        year: "numeric"
      }).formatToParts(date).find(part => part.type === "timeZoneName")?.value || "";
      if (name === "GMT" || name === "UTC") return 0;
      const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
      if (!match) return null;
      const minutes = Number(match[2]) * 60 + Number(match[3]);
      return match[1] === "-" ? -minutes : minutes;
    } catch {
      return null;
    }
  }

  function formatUtcOffset(minutes) {
    if (minutes == null) return "";
    const sign = minutes >= 0 ? "+" : "−";
    const abs = Math.abs(minutes);
    return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  }

  function formatInTimeZone(date, timeZone) {
    const text = date.toLocaleString("vi-VN", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const offset = getTimeZoneOffsetMinutes(date, timeZone);
    return { text, offset, offsetText: formatUtcOffset(offset) };
  }

  function resolveAuthorTimeZone(countryCode, date, rawValue) {
    const zones = COUNTRY_TIME_ZONES[countryCode] || [];
    if (!zones.length) return null;
    const rawOffset = getRawOffsetMinutes(rawValue);

    if (rawOffset != null) {
      const matched = zones.filter(zone => getTimeZoneOffsetMinutes(date, zone) === rawOffset);
      if (matched.length) {
        return {
          timeZone: matched[0],
          matchedSourceOffset: true,
          multiZone: zones.length > 1,
          rawOffset
        };
      }
    }

    return {
      timeZone: zones[0],
      matchedSourceOffset: false,
      multiZone: zones.length > 1,
      rawOffset
    };
  }

  const TIME_ZONE_CITY_LABELS = {
    VN:"Hồ Chí Minh", US:"New York (ET)", KR:"Seoul", JP:"Tokyo", DE:"Berlin", FR:"Paris", ES:"Madrid",
    PT:"Lisbon", NL:"Amsterdam", IT:"Rome", GB:"London", CA:"Toronto", AU:"Sydney", NZ:"Auckland",
    CN:"Shanghai", TW:"Taipei", HK:"Hong Kong", SG:"Singapore", MY:"Kuala Lumpur", TH:"Bangkok",
    ID:"Jakarta", PH:"Manila", IN:"Kolkata", PK:"Karachi", BD:"Dhaka", AE:"Dubai", SA:"Riyadh",
    TR:"Istanbul", RU:"Moscow", BE:"Brussels", CH:"Zurich", AT:"Vienna", PL:"Warsaw", SE:"Stockholm",
    NO:"Oslo", DK:"Copenhagen", FI:"Helsinki", CZ:"Prague", GR:"Athens", RO:"Bucharest", UA:"Kyiv",
    BR:"São Paulo", AR:"Buenos Aires", MX:"Mexico City", CL:"Santiago", CO:"Bogotá", PE:"Lima",
    ZA:"Johannesburg", EG:"Cairo", NG:"Lagos", KE:"Nairobi"
  };

  function countryCodeToFlag(code) {
    const clean = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(clean)) return "🌍";
    return String.fromCodePoint(...[...clean].map(ch => 127397 + ch.charCodeAt(0)));
  }


  const LOCAL_FLAG_CODES = new Set(["VN","US","KR","JP","DE","FR","ES","PT","NL","IT"]);

  function getFlagAssetCode(code) {
    const clean = String(code || "").toUpperCase();
    if (clean === "US" || clean.startsWith("US_")) return "US";
    return clean;
  }

  function getLocalFlagPath(code) {
    const clean = getFlagAssetCode(code);
    return LOCAL_FLAG_CODES.has(clean) ? `icons/flags/${clean.toLowerCase()}.svg` : "";
  }

  function flagHtml(code, className = "date-flag-img") {
    const clean = String(code || "").toUpperCase();
    const assetCode = getFlagAssetCode(clean);
    const path = getLocalFlagPath(clean);
    if (path) return `<img class="${className}" src="${path}" alt="${assetCode}" loading="lazy">`;
    return clean ? `<span class="date-flag-code ${className}">${escapeDateHtml(clean)}</span>` : '<span class="date-flag-code date-flag-globe">🌍</span>';
  }

  function updateCalcSourceFlag() {
    if (!calcSourceFlagEl) return;
    const code = calcSourceZoneEl?.value || activeCalculatorSourceCode || "VN";
    calcSourceFlagEl.innerHTML = flagHtml(code, "date-source-flag-img");
  }

  function getTimeZoneCatalog() {
    const targetCodes = new Set(TARGET_TIME_ZONES.map(item => item.code));
    const featured = TARGET_TIME_ZONES.map(item => ({ ...item }));
    const otherCountries = Object.keys(COUNTRY_TIME_ZONES).filter(code => !targetCodes.has(code)).map(code => {
      const timeZone = COUNTRY_TIME_ZONES[code]?.[0];
      const fallbackCity = String(timeZone || "").split("/").pop().replace(/_/g, " ");
      return {
        code,
        flag: countryCodeToFlag(code),
        country: getCountryName(code),
        city: TIME_ZONE_CITY_LABELS[code] || fallbackCity,
        timeZone
      };
    });
    return [...featured, ...otherCountries].filter(item => item.timeZone).sort((a,b) => {
      const countryCmp = a.country.localeCompare(b.country, "vi");
      if (countryCmp) return countryCmp;
      return a.city.localeCompare(b.city, "vi");
    });
  }

  function getTargetZoneByCode(code) {
    const catalog = getTimeZoneCatalog();
    return catalog.find(item => item.code === code) || catalog.find(item => item.code === "VN") || catalog[0];
  }

  function getSelectedTimeZones() {
    return selectedTimeZoneCodes.map(getTargetZoneByCode).filter(Boolean);
  }

  function getFlagByCountryCode(code) {
    return getTargetZoneByCode(code)?.flag || countryCodeToFlag(code);
  }

  function getDateTimePartsInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    };
  }

  function toDateInputValue(parts) {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function toTimeInputValue(parts) {
    return `${parts.hour}:${parts.minute}`;
  }

  function setCalcTime24(value) {
    const match = String(value || "00:00").match(/^(\d{2}):(\d{2})/);
    const hour = match ? match[1] : "00";
    const minute = match ? match[2] : "00";
    if (calcHourEl) calcHourEl.value = hour;
    if (calcMinuteEl) calcMinuteEl.value = minute;
    if (calcTimeEl) calcTimeEl.value = `${hour}:${minute}`;
  }

  function syncCalcTime24() {
    const hour = calcHourEl?.value || "00";
    const minute = calcMinuteEl?.value || "00";
    if (calcTimeEl) calcTimeEl.value = `${hour}:${minute}`;
  }

  function parseDateTimeInput(dateValue, timeValue) {
    const dateMatch = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(timeValue || "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!dateMatch || !timeMatch) return null;
    return {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2]),
      second: Number(timeMatch[3] || 0)
    };
  }

  function zonedDateTimeToUtc(dateValue, timeValue, timeZone) {
    const parts = parseDateTimeInput(dateValue, timeValue);
    if (!parts) return null;
    const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    let offset = getTimeZoneOffsetMinutes(new Date(utcGuess), timeZone);
    if (offset == null) offset = 0;
    let resultMs = utcGuess - offset * 60000;
    const secondOffset = getTimeZoneOffsetMinutes(new Date(resultMs), timeZone);
    if (secondOffset != null && secondOffset !== offset) {
      resultMs = utcGuess - secondOffset * 60000;
    }
    const date = new Date(resultMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function initTimeCalculator() {
    renderTimeZoneCountryManager();
    if (calcHourEl && !calcHourEl.options.length) {
      calcHourEl.innerHTML = Array.from({ length: 24 }, (_, hour) => {
        const value = String(hour).padStart(2, "0");
        return `<option value="${value}">${value}</option>`;
      }).join("");
    }
    if (calcMinuteEl && !calcMinuteEl.options.length) {
      calcMinuteEl.innerHTML = Array.from({ length: 60 }, (_, minute) => {
        const value = String(minute).padStart(2, "0");
        return `<option value="${value}">${value}</option>`;
      }).join("");
    }
    setCalcTime24(calcTimeEl?.value || "00:00");

    calcAddCountryBtn?.addEventListener("click", async () => {
      const code = calcCountrySelectEl?.value || "";
      if (!code || selectedTimeZoneCodes.includes(code)) return;
      selectedTimeZoneCodes.push(code);
      await saveSelectedTimeZoneCountries();
      renderTimeZoneCountryManager();
      refreshTimeZoneDisplays();
    });
    calcResetCountriesBtn?.addEventListener("click", async () => {
      selectedTimeZoneCodes = [...DEFAULT_TIME_ZONE_CODES];
      activeCalculatorSourceCode = selectedTimeZoneCodes.includes(activeCalculatorSourceCode) ? activeCalculatorSourceCode : "VN";
      await saveSelectedTimeZoneCountries();
      renderTimeZoneCountryManager();
      refreshTimeZoneDisplays();
    });
    calcCountryChipsEl?.addEventListener("click", async (event) => {
      const removeBtn = event.target.closest('[data-remove-country]');
      if (!removeBtn) return;
      const code = removeBtn.dataset.removeCountry;
      if (selectedTimeZoneCodes.length <= 1) {
        if (calcHintEl) calcHintEl.textContent = "Cần giữ lại ít nhất 1 quốc gia để quy đổi giờ.";
        return;
      }
      selectedTimeZoneCodes = selectedTimeZoneCodes.filter(item => item !== code);
      if (!selectedTimeZoneCodes.includes(activeCalculatorSourceCode)) {
        activeCalculatorSourceCode = selectedTimeZoneCodes[0];
      }
      await saveSelectedTimeZoneCountries();
      renderTimeZoneCountryManager();
      refreshTimeZoneDisplays();
    });

    calcSourceZoneEl?.addEventListener("change", () => {
      activeCalculatorSourceCode = calcSourceZoneEl.value || "VN";
      updateCalcSourceFlag();
      updateTimeCalculator("Đã đổi nước gốc.");
      highlightPublishedTimezoneCard();
    });
    calcDateEl?.addEventListener("input", () => updateTimeCalculator());
    calcHourEl?.addEventListener("change", () => { syncCalcTime24(); updateTimeCalculator(); });
    calcMinuteEl?.addEventListener("change", () => { syncCalcTime24(); updateTimeCalculator(); });
    timezoneGridEl?.addEventListener("click", (event) => {
      const card = event.target.closest('.date-time-card[data-code]');
      if (!card) return;
      const code = card.dataset.code || "VN";
      const rawValue = card.dataset.raw || activePublishedRawValue;
      usePublishedCardAsTimeSource(code, rawValue);
    });
    calcGridEl?.addEventListener("click", (event) => {
      const card = event.target.closest('.date-time-card[data-code]');
      if (!card) return;
      const code = card.dataset.code || activeCalculatorSourceCode || "VN";
      const rawValue = card.dataset.raw || "";
      usePublishedCardAsTimeSource(code, rawValue);
    });

    // Máy tính giờ nay nằm trong “Check giờ”, nên nạp sẵn giờ hiện tại để dùng ngay cả khi chưa Check Giờ đăng.
    if (calcDateEl && calcTimeEl && !calcDateEl.value) {
      const source = getTargetZoneByCode(activeCalculatorSourceCode || "VN");
      const now = new Date();
      const parts = getDateTimePartsInZone(now, source.timeZone);
      calcDateEl.value = toDateInputValue(parts);
      setCalcTime24(toTimeInputValue(parts));
      updateTimeCalculator(`Đã nạp giờ hiện tại của ${source.flag} ${source.country} • ${source.city}.`);
    }
  }

  async function saveSelectedTimeZoneCountries() {
    await chrome.storage.local.set({ babylonDateCalculatorCountries: selectedTimeZoneCodes });
  }

  function renderTimeZoneCountryManager() {
    const catalog = getTimeZoneCatalog();
    if (calcSourceZoneEl) {
      const current = selectedTimeZoneCodes.includes(activeCalculatorSourceCode) ? activeCalculatorSourceCode : selectedTimeZoneCodes[0];
      activeCalculatorSourceCode = current || "VN";
      calcSourceZoneEl.innerHTML = getSelectedTimeZones().map(item => (
        `<option value="${item.code}">${item.flag} ${escapeDateHtml(item.country)} • ${escapeDateHtml(item.city)}</option>`
      )).join("");
      if (activeCalculatorSourceCode) calcSourceZoneEl.value = activeCalculatorSourceCode;
      updateCalcSourceFlag();
    }
    if (calcCountrySelectEl) {
      const available = catalog.filter(item => !selectedTimeZoneCodes.includes(item.code));
      calcCountrySelectEl.innerHTML = available.length
        ? `<option value="">＋ Chọn quốc gia muốn thêm...</option>` + available.map(item => (
            `<option value="${item.code}">${item.flag} ${escapeDateHtml(item.country)} • ${escapeDateHtml(item.city)}</option>`
          )).join("")
        : '<option value="">Đã thêm tất cả quốc gia có sẵn</option>';
      if (calcAddCountryBtn) calcAddCountryBtn.disabled = !available.length;
    }
    if (calcCountryChipsEl) {
      const usChipLabels = {
        US: "Mỹ · ET", US_CT: "Mỹ · CT", US_MT: "Mỹ · MT", US_PT: "Mỹ · PT",
        US_AZ: "Mỹ · Arizona", US_AK: "Mỹ · Alaska", US_HI: "Mỹ · Hawaii"
      };
      calcCountryChipsEl.innerHTML = getSelectedTimeZones().map(item => {
        const chipLabel = usChipLabels[item.code] || item.country;
        return `<span class="date-country-chip">${flagHtml(item.code, "date-chip-flag")}<span>${escapeDateHtml(chipLabel)}</span><button type="button" data-remove-country="${item.code}" title="Xóa ${escapeDateHtml(item.country)} • ${escapeDateHtml(item.city)}">×</button></span>`;
      }).join("");
    }
  }

  function refreshTimeZoneDisplays() {
    if (activePublishedRawValue) renderTimezoneConversions(activePublishedRawValue);
    updateTimeCalculator();
    highlightPublishedTimezoneCard();
  }

  function usePublishedCardAsTimeSource(code, rawValue) {
    const zone = getTargetZoneByCode(code);
    const date = new Date(rawValue || activePublishedRawValue);
    if (Number.isNaN(date.getTime())) return;
    activeCalculatorSourceCode = code;
    const parts = getDateTimePartsInZone(date, zone.timeZone);
    if (calcSourceZoneEl) calcSourceZoneEl.value = code;
    updateCalcSourceFlag();
    if (calcDateEl) calcDateEl.value = toDateInputValue(parts);
    setCalcTime24(toTimeInputValue(parts));
    updateTimeCalculator(`Đang lấy ${zone.flag} ${zone.country} làm giờ gốc.`);
    highlightPublishedTimezoneCard();
  }

  function highlightPublishedTimezoneCard() {
    if (!timezoneGridEl) return;
    timezoneGridEl.querySelectorAll('.date-time-card[data-code]').forEach(card => {
      card.classList.toggle('is-selected', card.dataset.code === activeCalculatorSourceCode);
    });
  }

  function renderTimeCards(container, date, sourceCode = "", rawValue = "") {
    if (!container) return;
    if (!date || Number.isNaN(date.getTime())) {
      container.innerHTML = '<div class="date-timezone-empty">Chưa có dữ liệu để quy đổi thời gian.</div>';
      return;
    }

    container.innerHTML = getSelectedTimeZones().map(item => {
      const formatted = formatInTimeZone(date, item.timeZone);
      const selectedClass = item.code === sourceCode ? ' is-selected' : '';
      const sourceBadge = item.code === sourceCode ? '<em class="date-time-source-badge">Giờ gốc</em>' : '';
      return `
        <button type="button" class="date-time-card${selectedClass}" data-code="${item.code}" data-raw="${escapeDateHtml(rawValue)}">
          <div class="date-time-card-top">
            <div class="date-time-country">${flagHtml(item.code)}<span>${item.country}</span></div>
            ${sourceBadge}
          </div>
          <strong>${escapeDateHtml(formatted.text)}</strong>
          <small>${escapeDateHtml(item.city)} • ${escapeDateHtml(formatted.offsetText)}</small>
        </button>`;
    }).join("");
  }

  function updateTimeCalculator(hintMessage = "") {
    if (!calcGridEl) return;
    const sourceCode = calcSourceZoneEl?.value || activeCalculatorSourceCode || "VN";
    activeCalculatorSourceCode = sourceCode;
    const zone = getTargetZoneByCode(sourceCode);
    const absoluteDate = zonedDateTimeToUtc(calcDateEl?.value, calcTimeEl?.value, zone.timeZone);
    if (!absoluteDate) {
      calcGridEl.innerHTML = '<div class="date-timezone-empty">Chọn nước gốc, ngày và giờ để BaByLon quy đổi tự động.</div>';
      if (calcHintEl) calcHintEl.textContent = hintMessage || 'Ví dụ nhấn Việt Nam 02:05 thì Mỹ sẽ ra 15:05 của ngày tương ứng.';
      return;
    }
    renderTimeCards(calcGridEl, absoluteDate, sourceCode, absoluteDate.toISOString());
    if (calcHintEl) {
      calcHintEl.textContent = hintMessage || `Đang lấy ${zone.flag} ${zone.country} ${calcTimeEl?.value || ''} ${calcDateEl?.value || ''} làm giờ gốc để quy đổi.`;
    }
  }

  function seedTimeCalculator(rawValue, preferredCode = "VN") {
    if (!calcSourceZoneEl || !calcDateEl || !calcTimeEl) return;
    if (!selectedTimeZoneCodes.includes(preferredCode)) preferredCode = selectedTimeZoneCodes[0] || "VN";
    const zone = getTargetZoneByCode(preferredCode);
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return;
    activeCalculatorSourceCode = preferredCode;
    calcSourceZoneEl.value = preferredCode;
    const parts = getDateTimePartsInZone(date, zone.timeZone);
    calcDateEl.value = toDateInputValue(parts);
    setCalcTime24(toTimeInputValue(parts));
    updateTimeCalculator(`Đã nạp sẵn ${zone.flag} ${zone.country} theo giờ đăng.`);
    highlightPublishedTimezoneCard();
  }

  function renderTimezoneConversions(rawValue) {
    if (!timezoneGridEl) return;
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      timezoneGridEl.innerHTML = '<div class="date-timezone-empty">Không thể quy đổi thời gian.</div>';
      return;
    }

    renderTimeCards(timezoneGridEl, date, activeCalculatorSourceCode || "VN", rawValue);
  }

  function escapeDateHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("vi-VN", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function isValidUrl(value) {
    try { new URL(value); return true; } catch { return false; }
  }

  function resetUI() {
    statusBox.textContent = "";
    statusBox.className = "date-status";
    resultBox.classList.add("hidden");
    activePublishedRawValue = "";
    if (timezoneGridEl) timezoneGridEl.innerHTML = "";
  }

  function setStatus(message, type = "") {
    statusBox.textContent = message;
    statusBox.className = `date-status ${type}`.trim();
  }

  function setLoading(isLoading) {
    checkBtn.disabled = isLoading;
    currentBtn.disabled = isLoading;
    checkBtn.textContent = isLoading ? "ĐANG KIỂM TRA..." : "KIỂM TRA GIỜ ĐĂNG";
  }

  function showResult(data) {
    platformEl.textContent = data.platform;
    publishedAtEl.textContent = data.publishedAt;
    sourceEl.textContent = data.source || "Không rõ";
    rawValueEl.textContent = data.rawValue;

    const date = new Date(data.rawValue);
    const countryCode = normalizeCountryCode(data.authorCountryCode || "");
    const countryName = getCountryName(countryCode);
    const countryFlag = getFlagByCountryCode(countryCode);
    const countryFlagVisual = countryCode ? flagHtml(countryCode, "date-inline-flag-img") : '<span class="date-inline-flag">🌍</span>';

    if (authorCountryEl) {
      authorCountryEl.innerHTML = countryCode
        ? `${countryFlagVisual}${escapeDateHtml(countryName)} (${escapeDateHtml(countryCode)})`
        : `<span class="date-inline-flag">🌍</span>Không xác định / tác giả không công khai quốc gia`;
    }
    if (authorCountryMetaEl) {
      const parts = [];
      if (data.authorName) parts.push(`Tác giả: ${data.authorName}`);
      if (data.authorCountrySource) parts.push(data.authorCountrySource);
      if (!countryCode) parts.push("BaByLon không suy đoán quốc gia khi nền tảng không cung cấp dữ liệu công khai.");
      authorCountryMetaEl.textContent = parts.join(" • ");
    }

    if (authorLocalTimeEl && authorTimeZoneEl) {
      if (countryCode && !Number.isNaN(date.getTime())) {
        const zoneInfo = resolveAuthorTimeZone(countryCode, date, data.rawValue);
        if (zoneInfo) {
          const formatted = formatInTimeZone(date, zoneInfo.timeZone);
          authorLocalTimeEl.innerHTML = `${countryFlagVisual}${escapeDateHtml(formatted.text)}`;
          const notes = [`${zoneInfo.timeZone} • ${formatted.offsetText}`];
          if (zoneInfo.matchedSourceOffset) notes.push("khớp UTC offset của timestamp gốc");
          else if (zoneInfo.multiZone) notes.push("quốc gia có nhiều múi giờ • đang dùng múi giờ đại diện");
          authorTimeZoneEl.textContent = notes.join(" • ");
        } else {
          authorLocalTimeEl.innerHTML = `${countryFlagVisual}Chưa xác định múi giờ`;
          authorTimeZoneEl.textContent = "Đã biết quốc gia nhưng chưa có ánh xạ múi giờ phù hợp.";
        }
      } else {
        authorLocalTimeEl.innerHTML = '<span class="date-inline-flag">🌍</span>Chưa xác định';
        const rawOffset = getRawOffsetMinutes(data.rawValue);
        authorTimeZoneEl.textContent = rawOffset == null
          ? "Cần quốc gia/múi giờ công khai từ nền tảng."
          : `Timestamp nguồn có ${formatUtcOffset(rawOffset)}, nhưng chưa đủ để khẳng định quốc gia của tác giả.`;
      }
    }

    activePublishedRawValue = data.rawValue;
    renderTimezoneConversions(data.rawValue);
    seedTimeCalculator(data.rawValue, "VN");
    resultBox.classList.remove("hidden");
  }

  window.BaByLonDateChecker = { onOpen, checkVideo: checkContent, checkContent, useCurrentVideoUrl: useCurrentContentUrl, useCurrentContentUrl };
  init();
})();
