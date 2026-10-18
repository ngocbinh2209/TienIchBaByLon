
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const DNSBLS = [
    { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
    { name: "SpamCop", zone: "bl.spamcop.net" },
    { name: "Barracuda", zone: "b.barracudacentral.org" },
    { name: "SORBS", zone: "dnsbl.sorbs.net" },
    { name: "SORBS Spam", zone: "spam.dnsbl.sorbs.net" },
    { name: "SORBS DUL", zone: "dul.dnsbl.sorbs.net" },
    { name: "UCEPROTECT L1", zone: "dnsbl-1.uceprotect.net" },
    { name: "DroneBL", zone: "dnsbl.dronebl.org" },
    { name: "PSBL", zone: "psbl.surriel.com" },
    { name: "Abuse.ch", zone: "combined.abuse.ch" },
    { name: "Cymru Bogons", zone: "bogons.cymru.com" },
    { name: "SPFBL", zone: "dnsbl.spfbl.net" },
    { name: "Mailspike", zone: "z.mailspike.net" },
    { name: "SpamRATS Dyna", zone: "dyna.spamrats.com" },
    { name: "SpamRATS NoPtr", zone: "noptr.spamrats.com" },
    { name: "SpamRATS Spam", zone: "spam.spamrats.com" }
  ];

  let initialized = false;
  let running = false;

  async function init() {
    if (initialized) return;
    initialized = true;

    $("ipCurrentBtn").addEventListener("click", () => runCurrentCheck());
    $("ipFillCurrentBtn").addEventListener("click", fillCurrentIp);
    $("ipManualBtn").addEventListener("click", () => runManualCheck());

    $("ipManualInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") runManualCheck();
    });
  }

  async function onOpen() {
    await init();
  }

  function setStatus(text, type = "") {
    const el = $("ipCheckStatus");
    el.textContent = text;
    el.className = `ipcheck-status ${type}`.trim();
  }

  function stateClass(state) {
    if (state === "good") return "good";
    if (state === "bad") return "bad";
    if (state === "warn") return "warn";
    return "";
  }

  async function runCurrentCheck() {
    if (running) return;
    running = true;

    setButtonsDisabled(true);
    $("ipCurrentBtn").textContent = "ĐANG KIỂM TRA...";

    $("ipCheckSummary").classList.remove("hidden");
    $("ipInfoCard").classList.remove("hidden");
    $("ipPlatformCard").classList.remove("hidden");
    $("ipYoutubeCard").classList.remove("hidden");
    $("ipBlacklistCard").classList.remove("hidden");

    resetUi();

    try {
      setStatus("Đang lấy IP công khai hiện tại...");
      const ip = await getPublicIp();
      $("ipManualInput").value = ip;
      $("ipPublicValue").textContent = ip;

      const isV4 = isValidIPv4(ip);
      if (!isV4) {
        setStatus("IP hiện tại là IPv6. DNSBL truyền thống chủ yếu kiểm tra IPv4; YouTube vẫn được kiểm tra.", "warn");
      } else {
        setStatus("Đã lấy IP hiện tại • đang kiểm tra YouTube và blacklist...");
      }

      const youtubePromise = checkYouTubeSignal();
      const facebookPromise = checkFacebookSignal();
      const tiktokPromise = checkTikTokSignal();
      const blacklistPromise = isV4 ? checkBlacklists(ip) : Promise.resolve([]);
      const ipInfoPromise = getIpInfo(ip);

      const [yt, fb, tt, blacklist, ipInfo] = await Promise.all([
        youtubePromise,
        facebookPromise,
        tiktokPromise,
        blacklistPromise,
        ipInfoPromise
      ]);

      renderIpInfo(ipInfo, ip);
      renderPlatformSignals({ youtube: yt, facebook: fb, tiktok: tt });
      renderYouTube(yt);
      renderBlacklist(blacklist, isV4);

      const listed = blacklist.filter((x) => x.state === "listed").length;
      const checked = blacklist.filter((x) => x.state === "ok" || x.state === "listed").length;

      $("ipBlacklistValue").textContent = isV4 ? `${listed}/${checked}` : "IPv6";
      $("ipBlacklistValue").className =
        listed >= 3 ? "bad" : listed > 0 ? "warn" : checked ? "good" : "";

      const overall = overallRisk(yt, listed, checked, { facebook: fb, tiktok: tt });
      $("ipRiskValue").textContent = overall.label;
      $("ipRiskValue").className = stateClass(overall.state);

      setStatus(overall.message, overall.state === "bad" ? "error" : overall.state);
    } catch (error) {
      setStatus(`Không kiểm tra được IP hiện tại: ${error?.message || error}`, "error");
    } finally {
      running = false;
      setButtonsDisabled(false);
      $("ipCurrentBtn").textContent = "🌐 CHECK IP HIỆN TẠI";
    }
  }

  async function runManualCheck() {
    if (running) return;

    const ip = String($("ipManualInput").value || "").trim();
    if (!isValidIPv4(ip)) {
      setStatus("Hãy nhập IPv4 hợp lệ, ví dụ 1.53.49.100.", "error");
      return;
    }

    running = true;
    setButtonsDisabled(true);
    $("ipManualBtn").textContent = "ĐANG CHECK...";

    $("ipCheckSummary").classList.remove("hidden");
    $("ipInfoCard").classList.remove("hidden");
    $("ipPlatformCard").classList.remove("hidden");
    $("ipYoutubeCard").classList.remove("hidden");
    $("ipBlacklistCard").classList.remove("hidden");

    resetUi();
    $("ipPublicValue").textContent = ip;

    // IP nhập tay không thể tạo request YouTube từ chính IP đó.
    const manualYt = {
      state: "warn",
      label: "Không áp dụng",
      httpStatus: 0,
      unusual: false,
      note: "IP nhập tay chỉ kiểm tra được blacklist công khai. Muốn kiểm tra 429/403 YouTube, hãy dùng CHECK IP HIỆN TẠI trên máy đang dùng IP đó."
    };
    renderYouTube(manualYt);
    renderPlatformSignals({
      youtube: manualYt,
      facebook: {
        state: "warn",
        label: "Chỉ IP hiện tại",
        note: "IP nhập tay không thể test Facebook trực tiếp từ IP đó."
      },
      tiktok: {
        state: "warn",
        label: "Chỉ IP hiện tại",
        note: "IP nhập tay không thể test TikTok trực tiếp từ IP đó."
      }
    });

    try {
      setStatus(`Đang kiểm tra thông tin và blacklist của ${ip}...`);

      const [blacklist, ipInfo] = await Promise.all([
        checkBlacklists(ip),
        getIpInfo(ip)
      ]);

      renderIpInfo(ipInfo, ip);
      renderBlacklist(blacklist, true);

      const listed = blacklist.filter((x) => x.state === "listed").length;
      const checked = blacklist.filter((x) => x.state === "ok" || x.state === "listed").length;

      $("ipBlacklistValue").textContent = `${listed}/${checked}`;
      $("ipBlacklistValue").className =
        listed >= 3 ? "bad" : listed > 0 ? "warn" : checked ? "good" : "";

      $("ipYoutubeValue").textContent = "Chỉ IP hiện tại";
      $("ipYoutubeValue").className = "warn";

      let state = "good";
      let label = "Không thấy blacklist";
      let message = `IP ${ip} không xuất hiện trên các DNS blacklist kiểm tra được.`;

      if (listed >= 3) {
        state = "bad";
        label = "Reputation xấu";
        message = `IP ${ip} xuất hiện trên ${listed} blacklist. Điều này không đồng nghĩa YouTube blacklist IP.`;
      } else if (listed > 0) {
        state = "warn";
        label = "Cần chú ý";
        message = `IP ${ip} xuất hiện trên ${listed} blacklist. Chưa thể kết luận IP bị YouTube hạn chế.`;
      } else if (!checked) {
        state = "warn";
        label = "Chưa đủ dữ liệu";
        message = "Không có đủ blacklist phản hồi để kết luận.";
      }

      $("ipRiskValue").textContent = label;
      $("ipRiskValue").className = stateClass(state);
      setStatus(message, state === "bad" ? "error" : state);
    } catch (error) {
      setStatus(`Không kiểm tra được ${ip}: ${error?.message || error}`, "error");
    } finally {
      running = false;
      setButtonsDisabled(false);
      $("ipManualBtn").textContent = "CHECK IP NÀY";
    }
  }

  async function fillCurrentIp() {
    if (running) return;
    const btn = $("ipFillCurrentBtn");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "ĐANG LẤY...";
    try {
      const ip = await getPublicIp();
      $("ipManualInput").value = ip;
      setStatus(`Đã lấy IP hiện tại: ${ip}`, "ok");
    } catch (error) {
      setStatus(`Không lấy được IP hiện tại: ${error?.message || error}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  function setButtonsDisabled(disabled) {
    $("ipCurrentBtn").disabled = disabled;
    $("ipManualBtn").disabled = disabled;
    $("ipFillCurrentBtn").disabled = disabled;
  }

  function isValidIPv4(value) {
    const parts = String(value || "").trim().split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) return false;
      const n = Number(part);
      return n >= 0 && n <= 255 && String(n) === String(Number(part));
    });
  }

  function resetUi() {
    $("ipPublicValue").textContent = "Đang lấy...";
    $("ipYoutubeValue").textContent = "Đang kiểm tra...";
    $("ipBlacklistValue").textContent = "Đang kiểm tra...";
    $("ipRiskValue").textContent = "Đang tính...";

    const infoIds = [
      "ipInfoCountry",
      "ipInfoRegion",
      "ipInfoCity",
      "ipInfoCountryCode",
      "ipInfoIsp",
      "ipInfoOrg",
      "ipInfoAsn",
      "ipInfoTimezone",
      "ipInfoCoords",
      "ipInfoType"
    ];
    for (const id of infoIds) {
      const el = $(id);
      if (el) el.textContent = "Đang lấy...";
    }
    if ($("ipInfoBadge")) {
      $("ipInfoBadge").textContent = "Đang lấy";
      $("ipInfoBadge").className = "ip-result-badge neutral";
    }
    if ($("ipPlatformBadge")) {
      $("ipPlatformBadge").textContent = "Đang kiểm tra";
      $("ipPlatformBadge").className = "ip-result-badge neutral";
    }
    for (const id of [
      "ipPlatformYoutube",
      "ipPlatformFacebook",
      "ipPlatformTiktok"
    ]) {
      if ($(id)) {
        $(id).textContent = "Đang kiểm tra...";
        $(id).className = "";
      }
    }
    for (const id of [
      "ipPlatformYoutubeNote",
      "ipPlatformFacebookNote",
      "ipPlatformTiktokNote"
    ]) {
      if ($(id)) $(id).textContent = "Đang kiểm tra...";
    }
    $("ipYoutubeBadge").textContent = "Đang kiểm tra";
    $("ipYoutubeBadge").className = "ip-result-badge neutral";
    $("ipYoutubeDetails").innerHTML = "";
    $("ipBlacklistMeta").textContent = `${DNSBLS.length} danh sách`;
    $("ipBlacklistRows").innerHTML = "";

    for (const item of DNSBLS) {
      const row = document.createElement("div");
      row.className = "ip-blacklist-row";
      row.dataset.zone = item.zone;

      const name = document.createElement("span");
      name.textContent = item.name;
      name.title = item.zone;

      const state = document.createElement("span");
      state.className = "ip-blacklist-state checking";
      state.textContent = "…";

      row.append(name, state);
      $("ipBlacklistRows").appendChild(row);
    }
  }


  async function getIpInfo(ip) {
    try {
      const response = await timeoutFetch(
        `https://ipwho.is/${encodeURIComponent(ip)}`,
        {
          method: "GET",
          cache: "no-store"
        },
        9000
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data?.success === false) {
        throw new Error(data?.message || "Không tra được thông tin IP.");
      }

      return {
        ok: true,
        ip: data?.ip || ip,
        type: data?.type || "",
        continent: data?.continent || "",
        country: data?.country || "",
        countryCode: data?.country_code || "",
        region: data?.region || "",
        city: data?.city || "",
        latitude: data?.latitude,
        longitude: data?.longitude,
        isp: data?.connection?.isp || "",
        org: data?.connection?.org || "",
        asn: data?.connection?.asn || "",
        domain: data?.connection?.domain || "",
        timezone:
          data?.timezone?.id ||
          data?.timezone?.abbr ||
          ""
      };
    } catch (error) {
      return {
        ok: false,
        ip,
        error: error?.message || String(error)
      };
    }
  }

  function renderIpInfo(info, ip) {
    const badge = $("ipInfoBadge");

    if (!info?.ok) {
      if (badge) {
        badge.textContent = "Không lấy được";
        badge.className = "ip-result-badge warn";
      }

      const fallback = "Không xác định";
      $("ipInfoCountry").textContent = fallback;
      $("ipInfoRegion").textContent = fallback;
      $("ipInfoCity").textContent = fallback;
      $("ipInfoCountryCode").textContent = fallback;
      $("ipInfoIsp").textContent = fallback;
      $("ipInfoOrg").textContent = fallback;
      $("ipInfoAsn").textContent = fallback;
      $("ipInfoTimezone").textContent = fallback;
      $("ipInfoCoords").textContent = fallback;
      $("ipInfoType").textContent = fallback;
      return;
    }

    if (badge) {
      badge.textContent = "Đã nhận diện";
      badge.className = "ip-result-badge good";
    }

    $("ipInfoCountry").textContent = info.country || "Không xác định";
    $("ipInfoRegion").textContent = info.region || "Không xác định";
    $("ipInfoCity").textContent = info.city || "Không xác định";
    $("ipInfoCountryCode").textContent = info.countryCode || "—";
    $("ipInfoIsp").textContent = info.isp || "Không xác định";
    $("ipInfoOrg").textContent = info.org || info.domain || "Không xác định";
    $("ipInfoAsn").textContent = info.asn ? `AS${info.asn}` : "Không xác định";
    $("ipInfoTimezone").textContent = info.timezone || "Không xác định";

    const latOk = Number.isFinite(Number(info.latitude));
    const lonOk = Number.isFinite(Number(info.longitude));
    $("ipInfoCoords").textContent =
      latOk && lonOk
        ? `${Number(info.latitude).toFixed(3)}, ${Number(info.longitude).toFixed(3)}`
        : "Không xác định";

    $("ipInfoType").textContent =
      info.type === "IPv4" || info.type === "IPv6"
        ? info.type
        : (String(ip).includes(":") ? "IPv6" : "IPv4");
  }

  async function getPublicIp() {
    const services = [
      ["https://api64.ipify.org?format=json", "json"],
      ["https://api.ipify.org?format=json", "json"]
    ];

    let lastError = null;
    for (const [url, mode] of services) {
      try {
        const response = await timeoutFetch(url, { cache: "no-store" }, 8000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = mode === "json" ? await response.json() : await response.text();
        const ip = typeof data === "string" ? data.trim() : String(data?.ip || "").trim();
        if (ip) return ip;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Không lấy được IP công khai${lastError ? `: ${lastError.message}` : ""}`);
  }


  async function checkFacebookSignal() {
    try {
      const response = await timeoutFetch(
        `https://www.facebook.com/robots.txt?babylon=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store"
        },
        10000
      );

      const status = response.status;
      const finalUrl = response.url || "";
      const text = (await response.text()).slice(0, 250000).toLowerCase();

      const challenged =
        /checkpoint|challenge|login\/identify|captcha/i.test(finalUrl) ||
        text.includes("temporarily blocked") ||
        text.includes("you’re temporarily blocked") ||
        text.includes("you're temporarily blocked") ||
        text.includes("security check") ||
        text.includes("suspicious activity");

      if (status === 429) {
        return {
          state: "bad",
          label: "Rate-limit 429",
          httpStatus: status,
          note: "Facebook đang giới hạn request từ IP/mạng hiện tại."
        };
      }

      if (status === 403 || challenged) {
        return {
          state: "bad",
          label: challenged ? "Challenge/Block" : "403",
          httpStatus: status,
          note: challenged
            ? "Facebook trả dấu hiệu checkpoint/challenge/block."
            : "Facebook từ chối request kiểm tra."
        };
      }

      if (response.ok) {
        return {
          state: "good",
          label: "Bình thường",
          httpStatus: status,
          note: `Facebook phản hồi HTTP ${status}.`
        };
      }

      return {
        state: "warn",
        label: `HTTP ${status || "?"}`,
        httpStatus: status,
        note: "Facebook phản hồi khác trạng thái bình thường."
      };
    } catch (error) {
      return {
        state: "warn",
        label: "Không xác định",
        httpStatus: 0,
        note: `Không kiểm tra được Facebook: ${error?.message || error}`
      };
    }
  }

  async function checkTikTokSignal() {
    try {
      const response = await timeoutFetch(
        `https://www.tiktok.com/robots.txt?babylon=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store"
        },
        10000
      );

      const status = response.status;
      const finalUrl = response.url || "";
      const text = (await response.text()).slice(0, 250000).toLowerCase();

      const challenged =
        /captcha|verify|challenge/i.test(finalUrl) ||
        text.includes("captcha") ||
        text.includes("verify to continue") ||
        text.includes("too many requests") ||
        text.includes("access denied");

      if (status === 429) {
        return {
          state: "bad",
          label: "Rate-limit 429",
          httpStatus: status,
          note: "TikTok đang giới hạn request từ IP/mạng hiện tại."
        };
      }

      if (status === 403 || challenged) {
        return {
          state: "bad",
          label: challenged ? "Challenge/Block" : "403",
          httpStatus: status,
          note: challenged
            ? "TikTok trả dấu hiệu captcha/challenge/block."
            : "TikTok từ chối request kiểm tra."
        };
      }

      if (response.ok) {
        return {
          state: "good",
          label: "Bình thường",
          httpStatus: status,
          note: `TikTok phản hồi HTTP ${status}.`
        };
      }

      return {
        state: "warn",
        label: `HTTP ${status || "?"}`,
        httpStatus: status,
        note: "TikTok phản hồi khác trạng thái bình thường."
      };
    } catch (error) {
      return {
        state: "warn",
        label: "Không xác định",
        httpStatus: 0,
        note: `Không kiểm tra được TikTok: ${error?.message || error}`
      };
    }
  }

  function renderPlatformSignals(signals) {
    const map = [
      ["Youtube", signals.youtube],
      ["Facebook", signals.facebook],
      ["Tiktok", signals.tiktok]
    ];

    let bad = 0;
    let warn = 0;

    for (const [suffix, result] of map) {
      const valueEl = $(`ipPlatform${suffix}`);
      const noteEl = $(`ipPlatform${suffix}Note`);

      if (!valueEl || !noteEl) continue;

      valueEl.textContent = result?.label || "Không xác định";
      valueEl.className = stateClass(result?.state);
      noteEl.textContent = result?.note || "—";

      if (result?.state === "bad") bad++;
      else if (result?.state === "warn") warn++;
    }

    const badge = $("ipPlatformBadge");
    if (!badge) return;

    if (bad > 0) {
      badge.textContent = `${bad} nền tảng có cảnh báo`;
      badge.className = "ip-result-badge bad";
    } else if (warn > 0) {
      badge.textContent = "Có mục chưa xác định";
      badge.className = "ip-result-badge warn";
    } else {
      badge.textContent = "Cả 3 bình thường";
      badge.className = "ip-result-badge good";
    }
  }

  async function checkYouTubeSignal() {
    let status = 0;
    let finalUrl = "";
    let unusual = false;
    let note = "";

    try {
      const response = await timeoutFetch(
        `https://www.youtube.com/generate_204?babylon=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store"
        },
        10000
      );

      status = response.status;
      finalUrl = response.url || "";

      if (status === 204) {
        return {
          state: "good",
          label: "Bình thường",
          httpStatus: status,
          unusual: false,
          note: "YouTube phản hồi 204 bình thường."
        };
      }

      if (status === 429) {
        return {
          state: "bad",
          label: "Rate-limit 429",
          httpStatus: status,
          unusual: true,
          note: "YouTube đang giới hạn request từ IP/mạng này."
        };
      }

      if (status === 403) {
        return {
          state: "bad",
          label: "403 / bị từ chối",
          httpStatus: status,
          unusual: true,
          note: "YouTube từ chối request kiểm tra."
        };
      }
    } catch (error) {
      note = `generate_204 lỗi: ${error?.message || error}`;
    }

    // Fallback kiểm tra trang YouTube thực tế để nhận unusual traffic / sorry.
    try {
      const response = await timeoutFetch(
        `https://www.youtube.com/?hl=vi&babylon_ip_check=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store"
        },
        12000
      );

      status = response.status || status;
      finalUrl = response.url || finalUrl;
      const text = (await response.text()).slice(0, 600000).toLowerCase();

      unusual =
        /\/sorry\//i.test(finalUrl) ||
        text.includes("unusual traffic") ||
        text.includes("automated queries") ||
        text.includes("lưu lượng truy cập bất thường") ||
        text.includes("our systems have detected unusual traffic");

      if (status === 429 || unusual) {
        return {
          state: "bad",
          label: unusual ? "Unusual traffic" : "Rate-limit 429",
          httpStatus: status,
          unusual: true,
          note: unusual
            ? "Google/YouTube đang hiển thị dấu hiệu lưu lượng bất thường."
            : "YouTube đang rate-limit IP/mạng này."
        };
      }

      if (status === 403) {
        return {
          state: "bad",
          label: "403 / bị từ chối",
          httpStatus: status,
          unusual: false,
          note: "Trang YouTube trả HTTP 403."
        };
      }

      if (response.ok) {
        return {
          state: "good",
          label: "Truy cập được",
          httpStatus: status,
          unusual: false,
          note: "Trang YouTube truy cập bình thường."
        };
      }

      return {
        state: "warn",
        label: `HTTP ${status || "?"}`,
        httpStatus: status,
        unusual: false,
        note: note || "Phản hồi YouTube không giống trạng thái bình thường."
      };
    } catch (error) {
      return {
        state: "warn",
        label: "Không xác định",
        httpStatus: status,
        unusual: false,
        note: note || `Không kết nối được YouTube: ${error?.message || error}`
      };
    }
  }

  async function checkBlacklists(ip) {
    const reversed = ip.split(".").reverse().join(".");
    const results = new Array(DNSBLS.length);
    let next = 0;
    const workers = Math.min(6, DNSBLS.length);

    async function worker() {
      while (true) {
        const index = next++;
        if (index >= DNSBLS.length) return;
        const item = DNSBLS[index];

        const result = await queryDnsbl(reversed, item);
        results[index] = result;
        updateBlacklistRow(item.zone, result);
      }
    }

    await Promise.all(Array.from({ length: workers }, worker));
    return results.filter(Boolean);
  }

  async function queryDnsbl(reversed, item) {
    const name = `${reversed}.${item.zone}`;
    try {
      const response = await timeoutFetch(
        `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=A`,
        { cache: "no-store" },
        9000
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // NXDOMAIN = không nằm trong DNSBL.
      if (data.Status === 3) {
        return { ...item, state: "ok", answers: [] };
      }

      const answers = (data.Answer || [])
        .filter((a) => Number(a.type) === 1)
        .map((a) => String(a.data || ""));

      // Một số DNSBL từ chối public resolver và trả 127.255.255.x.
      if (answers.some((a) => /^127\.255\.255\./.test(a))) {
        return { ...item, state: "na", answers, note: "DNSBL chặn public resolver" };
      }

      if (answers.some((a) => /^127\./.test(a))) {
        return { ...item, state: "listed", answers };
      }

      if (data.Status === 0 && !answers.length) {
        return { ...item, state: "ok", answers: [] };
      }

      return { ...item, state: "na", answers, note: `DNS status ${data.Status}` };
    } catch (error) {
      return { ...item, state: "na", answers: [], note: error?.message || String(error) };
    }
  }

  function updateBlacklistRow(zone, result) {
    const row = [...document.querySelectorAll(".ip-blacklist-row")]
      .find((el) => el.dataset.zone === zone);
    if (!row) return;

    const state = row.querySelector(".ip-blacklist-state");
    if (result.state === "listed") {
      state.textContent = "LISTED";
      state.className = "ip-blacklist-state bad";
      state.title = result.answers.join(", ");
    } else if (result.state === "ok") {
      state.textContent = "OK";
      state.className = "ip-blacklist-state ok";
    } else {
      state.textContent = "N/A";
      state.className = "ip-blacklist-state na";
      state.title = result.note || "";
    }
  }

  function renderYouTube(yt) {
    $("ipYoutubeValue").textContent = yt.label;
    $("ipYoutubeValue").className = stateClass(yt.state);

    const badge = $("ipYoutubeBadge");
    badge.textContent = yt.label;
    badge.className = `ip-result-badge ${yt.state === "bad" ? "bad" : yt.state}`;

    const lines = [
      ["HTTP", yt.httpStatus ? String(yt.httpStatus) : "Không xác định", yt.state],
      ["Unusual traffic", yt.unusual ? "Có dấu hiệu" : "Không phát hiện", yt.unusual ? "bad" : "good"],
      ["Kết luận", yt.note || "—", yt.state]
    ];

    const container = $("ipYoutubeDetails");
    container.innerHTML = "";
    for (const [label, value, state] of lines) {
      const row = document.createElement("div");
      row.className = "ipcheck-line";

      const a = document.createElement("span");
      a.textContent = label;

      const b = document.createElement("strong");
      b.textContent = value;
      b.className = stateClass(state);

      row.append(a, b);
      container.appendChild(row);
    }
  }

  function renderBlacklist(results, isV4) {
    const listed = results.filter((x) => x.state === "listed").length;
    const ok = results.filter((x) => x.state === "ok").length;
    const na = results.filter((x) => x.state === "na").length;

    $("ipBlacklistMeta").textContent = isV4
      ? `${listed} listed • ${ok} OK • ${na} không xác định`
      : "IPv6: DNSBL IPv4 không áp dụng";
  }

  function overallRisk(yt, listed, checked, platforms = {}) {
    const platformResults = [yt, platforms.facebook, platforms.tiktok].filter(Boolean);
    const platformBadCount = platformResults.filter((x) => x.state === "bad").length;
    const platformWarnCount = platformResults.filter((x) => x.state === "warn").length;

    if (platformBadCount >= 2) {
      return {
        state: "bad",
        label: "Rủi ro đa nền tảng",
        message: `Có ${platformBadCount} nền tảng đang trả dấu hiệu giới hạn/challenge từ IP hiện tại.`
      };
    }

    if (yt.state === "bad") {
      return {
        state: "bad",
        label: "Rủi ro cao",
        message: "Có dấu hiệu Google/YouTube đang giới hạn IP hoặc mạng hiện tại."
      };
    }

    if (listed >= 3) {
      return {
        state: "bad",
        label: "IP reputation xấu",
        message: `IP xuất hiện trên ${listed} blacklist. Không chứng minh YouTube blacklist, nhưng nên kiểm tra mạng/IP.`
      };
    }

    if (listed > 0 || yt.state === "warn" || platformWarnCount > 0 || platformBadCount > 0) {
      return {
        state: "warn",
        label: "Cần chú ý",
        message: listed
          ? `IP xuất hiện trên ${listed} blacklist; YouTube chưa cho thấy block rõ ràng.`
          : "YouTube không cho tín hiệu rõ ràng; nên thử lại sau hoặc so sánh bằng mạng khác."
      };
    }

    if (checked > 0 && yt.state === "good") {
      return {
        state: "good",
        label: "Bình thường",
        message: "Không thấy dấu hiệu YouTube giới hạn IP và không thấy IP trên các DNSBL kiểm tra được."
      };
    }

    return {
      state: "warn",
      label: "Chưa đủ dữ liệu",
      message: "Một số dịch vụ blacklist không cho truy vấn qua public DNS; kết quả chỉ mang tính kiểm tra tín hiệu."
    };
  }

  function stateClass(state) {
    if (state === "good") return "good";
    if (state === "bad") return "bad";
    if (state === "warn") return "warn";
    return "";
  }

  function timeoutFetch(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  window.BaByLonIPChecker = { onOpen, runCurrentCheck, runManualCheck };
  init();
})();
