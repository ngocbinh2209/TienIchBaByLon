
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const LOCATIONS = [
    { country:"Việt Nam", flag:"🇻🇳", city:"Hà Nội / TP. Hồ Chí Minh", area:"Việt Nam", zone:"Asia/Ho_Chi_Minh" },

    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Los Angeles, California", area:"California", zone:"America/Los_Angeles" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"New York", area:"New York", zone:"America/New_York" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Chicago, Illinois", area:"Central", zone:"America/Chicago" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Denver, Colorado", area:"Mountain", zone:"America/Denver" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Phoenix, Arizona", area:"Arizona", zone:"America/Phoenix" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Anchorage, Alaska", area:"Alaska", zone:"America/Anchorage" },
    { country:"Hoa Kỳ", flag:"🇺🇸", city:"Honolulu, Hawaii", area:"Hawaii", zone:"Pacific/Honolulu" },

    { country:"Canada", flag:"🇨🇦", city:"Toronto", area:"Ontario", zone:"America/Toronto" },
    { country:"Canada", flag:"🇨🇦", city:"Vancouver", area:"British Columbia", zone:"America/Vancouver" },
    { country:"Canada", flag:"🇨🇦", city:"Edmonton", area:"Alberta", zone:"America/Edmonton" },
    { country:"Canada", flag:"🇨🇦", city:"Halifax", area:"Nova Scotia", zone:"America/Halifax" },
    { country:"Canada", flag:"🇨🇦", city:"St. John's", area:"Newfoundland", zone:"America/St_Johns" },

    { country:"Mexico", flag:"🇲🇽", city:"Mexico City", area:"Central Mexico", zone:"America/Mexico_City" },
    { country:"Brazil", flag:"🇧🇷", city:"São Paulo", area:"São Paulo", zone:"America/Sao_Paulo" },
    { country:"Argentina", flag:"🇦🇷", city:"Buenos Aires", area:"Buenos Aires", zone:"America/Argentina/Buenos_Aires" },

    { country:"Vương quốc Anh", flag:"🇬🇧", city:"London", area:"England", zone:"Europe/London" },
    { country:"Ireland", flag:"🇮🇪", city:"Dublin", area:"Ireland", zone:"Europe/Dublin" },
    { country:"Pháp", flag:"🇫🇷", city:"Paris", area:"Île-de-France", zone:"Europe/Paris" },
    { country:"Đức", flag:"🇩🇪", city:"Berlin", area:"Berlin", zone:"Europe/Berlin" },
    { country:"Tây Ban Nha", flag:"🇪🇸", city:"Madrid", area:"Madrid", zone:"Europe/Madrid" },
    { country:"Ý", flag:"🇮🇹", city:"Rome", area:"Lazio", zone:"Europe/Rome" },
    { country:"Hà Lan", flag:"🇳🇱", city:"Amsterdam", area:"North Holland", zone:"Europe/Amsterdam" },
    { country:"Bỉ", flag:"🇧🇪", city:"Brussels", area:"Brussels", zone:"Europe/Brussels" },
    { country:"Thụy Sĩ", flag:"🇨🇭", city:"Zurich", area:"Zurich", zone:"Europe/Zurich" },
    { country:"Bồ Đào Nha", flag:"🇵🇹", city:"Lisbon", area:"Lisbon", zone:"Europe/Lisbon" },
    { country:"Ba Lan", flag:"🇵🇱", city:"Warsaw", area:"Masovian", zone:"Europe/Warsaw" },
    { country:"Hy Lạp", flag:"🇬🇷", city:"Athens", area:"Attica", zone:"Europe/Athens" },
    { country:"Thổ Nhĩ Kỳ", flag:"🇹🇷", city:"Istanbul", area:"Istanbul", zone:"Europe/Istanbul" },

    { country:"Nga", flag:"🇷🇺", city:"Moscow", area:"Moscow", zone:"Europe/Moscow" },
    { country:"Nga", flag:"🇷🇺", city:"Yekaterinburg", area:"Ural", zone:"Asia/Yekaterinburg" },
    { country:"Nga", flag:"🇷🇺", city:"Vladivostok", area:"Primorsky", zone:"Asia/Vladivostok" },

    { country:"Các Tiểu vương quốc Ả Rập Thống nhất", flag:"🇦🇪", city:"Dubai", area:"Dubai", zone:"Asia/Dubai" },
    { country:"Ả Rập Xê Út", flag:"🇸🇦", city:"Riyadh", area:"Riyadh", zone:"Asia/Riyadh" },
    { country:"Israel", flag:"🇮🇱", city:"Jerusalem", area:"Jerusalem", zone:"Asia/Jerusalem" },
    { country:"Ai Cập", flag:"🇪🇬", city:"Cairo", area:"Cairo", zone:"Africa/Cairo" },
    { country:"Nam Phi", flag:"🇿🇦", city:"Johannesburg", area:"Gauteng", zone:"Africa/Johannesburg" },

    { country:"Ấn Độ", flag:"🇮🇳", city:"New Delhi / Kolkata", area:"Ấn Độ", zone:"Asia/Kolkata" },
    { country:"Pakistan", flag:"🇵🇰", city:"Karachi", area:"Sindh", zone:"Asia/Karachi" },
    { country:"Bangladesh", flag:"🇧🇩", city:"Dhaka", area:"Dhaka", zone:"Asia/Dhaka" },
    { country:"Nepal", flag:"🇳🇵", city:"Kathmandu", area:"Bagmati", zone:"Asia/Kathmandu" },

    { country:"Trung Quốc", flag:"🇨🇳", city:"Bắc Kinh / Thượng Hải", area:"China Standard Time", zone:"Asia/Shanghai" },
    { country:"Hồng Kông", flag:"🇭🇰", city:"Hong Kong", area:"Hong Kong", zone:"Asia/Hong_Kong" },
    { country:"Đài Loan", flag:"🇹🇼", city:"Taipei", area:"Taipei", zone:"Asia/Taipei" },
    { country:"Nhật Bản", flag:"🇯🇵", city:"Tokyo", area:"Tokyo", zone:"Asia/Tokyo" },
    { country:"Hàn Quốc", flag:"🇰🇷", city:"Seoul", area:"Seoul", zone:"Asia/Seoul" },

    { country:"Thái Lan", flag:"🇹🇭", city:"Bangkok", area:"Bangkok", zone:"Asia/Bangkok" },
    { country:"Campuchia", flag:"🇰🇭", city:"Phnom Penh", area:"Phnom Penh", zone:"Asia/Phnom_Penh" },
    { country:"Lào", flag:"🇱🇦", city:"Vientiane", area:"Vientiane", zone:"Asia/Vientiane" },
    { country:"Myanmar", flag:"🇲🇲", city:"Yangon", area:"Yangon", zone:"Asia/Yangon" },
    { country:"Malaysia", flag:"🇲🇾", city:"Kuala Lumpur", area:"Kuala Lumpur", zone:"Asia/Kuala_Lumpur" },
    { country:"Singapore", flag:"🇸🇬", city:"Singapore", area:"Singapore", zone:"Asia/Singapore" },
    { country:"Indonesia", flag:"🇮🇩", city:"Jakarta", area:"Western Indonesia", zone:"Asia/Jakarta" },
    { country:"Indonesia", flag:"🇮🇩", city:"Makassar", area:"Central Indonesia", zone:"Asia/Makassar" },
    { country:"Indonesia", flag:"🇮🇩", city:"Jayapura", area:"Eastern Indonesia", zone:"Asia/Jayapura" },
    { country:"Philippines", flag:"🇵🇭", city:"Manila", area:"Metro Manila", zone:"Asia/Manila" },

    { country:"Australia", flag:"🇦🇺", city:"Sydney", area:"New South Wales", zone:"Australia/Sydney" },
    { country:"Australia", flag:"🇦🇺", city:"Melbourne", area:"Victoria", zone:"Australia/Melbourne" },
    { country:"Australia", flag:"🇦🇺", city:"Brisbane", area:"Queensland", zone:"Australia/Brisbane" },
    { country:"Australia", flag:"🇦🇺", city:"Perth", area:"Western Australia", zone:"Australia/Perth" },
    { country:"Australia", flag:"🇦🇺", city:"Adelaide", area:"South Australia", zone:"Australia/Adelaide" },
    { country:"New Zealand", flag:"🇳🇿", city:"Auckland", area:"Auckland", zone:"Pacific/Auckland" },
    { country:"Fiji", flag:"🇫🇯", city:"Suva", area:"Fiji", zone:"Pacific/Fiji" }
  ];

  let initialized = false;
  let timer = null;
  let selected = LOCATIONS[0];
  let lastSecondKey = "";
  let dayCalcDirection = null;
  let dayCalcBaseKey = "";

  function flagCodeFromEmoji(flag) {
    if (!flag) return "";
    let code = "";
    for (const ch of flag) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x1F1E6 && cp <= 0x1F1FF) {
        code += String.fromCharCode(65 + (cp - 0x1F1E6));
      }
    }
    return code.toLowerCase();
  }

  function getFlagAsset(item) {
    const code = flagCodeFromEmoji(item?.flag || "");
    return code ? chrome.runtime.getURL(`icons/flags/${code}.png`) : "";
  }

  function setFlagImage(id, item) {
    const img = $(id);
    if (!img) return;
    const src = getFlagAsset(item);
    if (!src) {
      img.hidden = true;
      img.removeAttribute("src");
      img.alt = "";
      img.title = "";
      return;
    }
    img.hidden = false;
    img.src = src;
    img.alt = `Cờ ${item.country}`;
    img.title = item.country;
  }

  async function onOpen() {
    init();
    updateClock(true);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    buildCountrySelect();

    $("worldCountrySelect").addEventListener("change", () => {
      buildCitySelect($("worldCountrySelect").value);
      selectFromControls();
    });

    $("worldCitySelect").addEventListener("change", selectFromControls);

    $("worldLocalBtn").addEventListener("click", selectLocalTimezone);
    $("worldCopyBtn").addEventListener("click", copyCurrentTime);

    const dayInput = $("worldDayCount");
    const dayBeforeBtn = $("worldDayBeforeBtn");
    const dayAfterBtn = $("worldDayAfterBtn");

    if (dayBeforeBtn) dayBeforeBtn.addEventListener("click", () => calculateDayOffset("before"));
    if (dayAfterBtn) dayAfterBtn.addEventListener("click", () => calculateDayOffset("after"));
    if (dayInput) {
      dayInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        calculateDayOffset(dayCalcDirection || "after");
      });
      dayInput.addEventListener("input", () => {
        if (dayCalcDirection) calculateDayOffset(dayCalcDirection);
      });
    }

    const dateDiffStart = $("worldDiffDateStart");
    const dateDiffEnd = $("worldDiffDateEnd");
    const timeDiffStart = $("worldDiffTimeStart");
    const timeDiffEnd = $("worldDiffTimeEnd");
    const dateDiffBtn = $("worldDateDiffBtn");
    const timeDiffBtn = $("worldTimeDiffBtn");

    // Native date picker for calendar fields only. Time uses our own 24-hour selector
    // so Chrome/Windows locale can never switch it back to SA/CH (AM/PM).
    [dateDiffStart, dateDiffEnd].filter(Boolean).forEach((input) => {
      input.addEventListener("click", () => {
        if (typeof input.showPicker !== "function") return;
        try { input.showPicker(); } catch (_) {}
      });
    });

    setup24HourPicker("worldDiffTimeStart");
    setup24HourPicker("worldDiffTimeEnd");

    if (dateDiffBtn) dateDiffBtn.addEventListener("click", calculateDateDifference);
    if (timeDiffBtn) timeDiffBtn.addEventListener("click", calculateTimeDifference);

    [dateDiffStart, dateDiffEnd].filter(Boolean).forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        calculateDateDifference();
      });
      input.addEventListener("input", () => {
        if (dateDiffStart?.value.trim() && dateDiffEnd?.value.trim()) calculateDateDifference(true);
      });
    });

    [timeDiffStart, timeDiffEnd].filter(Boolean).forEach((input) => {
      input.addEventListener("input", () => {
        if (timeDiffStart?.value.trim() && timeDiffEnd?.value.trim()) calculateTimeDifference(true);
      });
    });

    $("worldQuickZones").addEventListener("click", (event) => {
      const button = event.target.closest("[data-world-zone]");
      if (!button) return;
      selectByZone(button.dataset.worldZone);
    });

    // Restore prior selection when available.
    chrome.storage.local.get(["babylonWorldTimeZone"]).then((saved) => {
      const zone = saved.babylonWorldTimeZone;
      if (zone) selectByZone(zone, false);
      else selectByZone("Asia/Ho_Chi_Minh", false);
    }).catch(() => {});

    timer = setInterval(() => updateClock(false), 200);
  }

  function buildCountrySelect() {
    const select = $("worldCountrySelect");
    select.innerHTML = "";

    const countries = [];
    const seen = new Set();
    for (const item of LOCATIONS) {
      if (seen.has(item.country)) continue;
      seen.add(item.country);
      countries.push({ country:item.country, flag:item.flag });
    }

    for (const item of countries) {
      const option = document.createElement("option");
      option.value = item.country;
      option.textContent = `${item.flag} ${item.country}`;
      select.appendChild(option);
    }

    select.value = selected.country;
    buildCitySelect(selected.country);
  }

  function buildCitySelect(country) {
    const select = $("worldCitySelect");
    select.innerHTML = "";

    const items = LOCATIONS.filter((x) => x.country === country);
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.zone;
      option.textContent = `${item.city} — ${item.zone}`;
      select.appendChild(option);
    }

    if (items.some((x) => x.zone === selected.zone)) {
      select.value = selected.zone;
    } else if (items[0]) {
      select.value = items[0].zone;
    }
  }

  function selectFromControls() {
    const zone = $("worldCitySelect").value;
    const item = LOCATIONS.find((x) => x.zone === zone);
    if (!item) return;
    selected = item;
    chrome.storage.local.set({ babylonWorldTimeZone:selected.zone }).catch(() => {});
    updateClock(true);
  }

  function selectByZone(zone, save = true) {
    const item = LOCATIONS.find((x) => x.zone === zone);
    if (!item) return false;

    selected = item;
    $("worldCountrySelect").value = item.country;
    buildCitySelect(item.country);
    $("worldCitySelect").value = item.zone;

    if (save) {
      chrome.storage.local.set({ babylonWorldTimeZone:item.zone }).catch(() => {});
    }
    updateClock(true);
    return true;
  }

  function selectLocalTimezone() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";

    if (selectByZone(zone)) return;

    // Zone máy không có trong preset: vẫn hiển thị chính xác giờ.
    selected = {
      country:"Múi giờ của máy",
      flag:"📍",
      city:zone.replace(/_/g, " "),
      area:"Theo hệ điều hành",
      zone
    };

    // Add temporary country/city options.
    let countryOption = [...$("worldCountrySelect").options]
      .find((o) => o.value === selected.country);

    if (!countryOption) {
      countryOption = document.createElement("option");
      countryOption.value = selected.country;
      countryOption.textContent = `📍 ${selected.country}`;
      $("worldCountrySelect").appendChild(countryOption);
    }

    $("worldCountrySelect").value = selected.country;
    $("worldCitySelect").innerHTML = "";

    const cityOption = document.createElement("option");
    cityOption.value = zone;
    cityOption.textContent = `${selected.city} — ${zone}`;
    $("worldCitySelect").appendChild(cityOption);
    $("worldCitySelect").value = zone;

    chrome.storage.local.set({ babylonWorldTimeZone:zone }).catch(() => {});
    updateClock(true);
  }

  function updateClock(force) {
    if (!selected?.zone) return;

    const now = new Date();
    const timeText = formatTime(now, selected.zone);

    if (!force && timeText === lastSecondKey) return;
    lastSecondKey = timeText;

    $("worldClock").textContent = timeText;
    $("worldDate").textContent = formatDate(now, selected.zone);

    $("worldLocationTitle").textContent =
      `${selected.city}, ${selected.country}`;

    $("worldCountryName").textContent = selected.country;
    setFlagImage("worldCountryFlag", selected);
    setFlagImage("worldTitleFlag", selected);
    setFlagImage("worldCountryMetaFlag", selected);

    $("worldAreaName").textContent = selected.area || selected.city;
    $("worldZoneName").textContent = selected.zone;
    $("worldUtcOffset").textContent = getUtcOffset(now, selected.zone);

    updateLunarCalendar(now, selected.zone);
    updateDayCalculatorBase(now);
  }

  function formatTime(date, zone) {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone:zone,
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit",
      hourCycle:"h23"
    }).format(date);
  }

  function formatDate(date, zone) {
    const text = new Intl.DateTimeFormat("vi-VN", {
      timeZone:zone,
      weekday:"long",
      day:"2-digit",
      month:"long",
      year:"numeric"
    }).format(date);

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatCalendarDateShort(parts) {
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
  }

  function formatCalendarDateLong(parts) {
    const safeDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
    const text = new Intl.DateTimeFormat("vi-VN", {
      timeZone:"UTC",
      weekday:"long",
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }).format(safeDate);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function addCalendarDays(parts, amount) {
    const base = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    const target = new Date(base + amount * 86400000);
    return {
      year:target.getUTCFullYear(),
      month:target.getUTCMonth() + 1,
      day:target.getUTCDate()
    };
  }

  function updateDayCalculatorBase(now = new Date()) {
    const label = $("worldDayCalcBase");
    if (!label || !selected?.zone) return;

    const base = getDatePartsInZone(now, selected.zone);
    const key = `${base.year}-${base.month}-${base.day}-${selected.zone}`;
    label.textContent = `Hôm nay: ${formatCalendarDateShort(base)}`;

    if (key !== dayCalcBaseKey) {
      dayCalcBaseKey = key;
      if (dayCalcDirection) calculateDayOffset(dayCalcDirection, base);
    }
  }

  function calculateDayOffset(direction, suppliedBase = null) {
    const input = $("worldDayCount");
    const result = $("worldDayCalcResult");
    if (!input || !result || !selected?.zone) return;

    const raw = String(input.value || "").trim();
    const days = Number(raw);
    const strong = result.querySelector("strong");
    const small = result.querySelector("small");

    if (!raw || !Number.isInteger(days) || days < 0 || days > 36500) {
      result.classList.add("is-error");
      if (strong) strong.textContent = "Vui lòng nhập số ngày nguyên từ 0 đến 36.500.";
      if (small) small.textContent = "Ví dụ: 10 ngày trước hoặc 10 ngày sau.";
      return;
    }

    dayCalcDirection = direction === "before" ? "before" : "after";
    result.classList.remove("is-error");

    const base = suppliedBase || getDatePartsInZone(new Date(), selected.zone);
    const delta = dayCalcDirection === "before" ? -days : days;
    const target = addCalendarDays(base, delta);
    const directionText = dayCalcDirection === "before" ? "trước" : "sau";

    if (strong) {
      strong.textContent = days === 0
        ? `Hôm nay: ${formatCalendarDateLong(target)}`
        : `${days} ngày ${directionText}: ${formatCalendarDateLong(target)}`;
    }
    if (small) {
      small.textContent = `Tính từ ${formatCalendarDateShort(base)} theo ngày hiện tại ở ${selected.city}, ${selected.country}.`;
    }
  }


  function parseFlexibleCalendarDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    let year;
    let month;
    let day;
    let match = raw.match(/^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})$/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      match = raw.match(/^(\d{4})\s*[\-\/.]\s*(\d{1,2})\s*[\-\/.]\s*(\d{1,2})$/);
      if (!match) return null;
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }

    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const test = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day) return null;
    return { year, month, day };
  }

  function calendarDayNumber(parts) {
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
  }

  function setDiffResult(result, strongText, smallText, isError = false) {
    if (!result) return;
    result.classList.toggle("is-error", Boolean(isError));
    const strong = result.querySelector("strong");
    const small = result.querySelector("small");
    if (strong) strong.textContent = strongText;
    if (small) small.textContent = smallText;
  }

  function calculateDateDifference(quiet = false) {
    const startInput = $("worldDiffDateStart");
    const endInput = $("worldDiffDateEnd");
    const result = $("worldDateDiffResult");
    if (!startInput || !endInput || !result) return;

    const startRaw = startInput.value.trim();
    const endRaw = endInput.value.trim();
    const start = parseFlexibleCalendarDate(startRaw);
    const end = parseFlexibleCalendarDate(endRaw);

    if (!start || !end) {
      if (quiet) return;
      setDiffResult(
        result,
        "Vui lòng chọn đủ 2 ngày.",
        "Bấm vào từng ô ngày để mở lịch và chọn ngày bắt đầu / kết thúc.",
        true
      );
      return;
    }

    const days = Math.abs(calendarDayNumber(end) - calendarDayNumber(start));
    const dayLabel = days === 1 ? "ngày" : "ngày";
    setDiffResult(
      result,
      `${formatCalendarDateShort(start)} → ${formatCalendarDateShort(end)} = ${days} ${dayLabel}`,
      days === 0
        ? "Hai mốc là cùng một ngày."
        : "Tính theo số ngày lịch, không bị ảnh hưởng bởi múi giờ."
    );
  }

  function setup24HourPicker(targetId) {
    const hidden = $(targetId);
    const picker = hidden?.closest(".worldtime-time24-picker");
    if (!hidden || !picker || picker.dataset.ready === "1") return;

    const hourSelect = picker.querySelector(".worldtime-time24-hour");
    const minuteSelect = picker.querySelector(".worldtime-time24-minute");
    if (!hourSelect || !minuteSelect) return;

    picker.dataset.ready = "1";

    const fill = (select, max, placeholder) => {
      select.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = placeholder;
      select.appendChild(empty);
      for (let value = 0; value <= max; value += 1) {
        const option = document.createElement("option");
        option.value = String(value).padStart(2, "0");
        option.textContent = option.value;
        select.appendChild(option);
      }
    };

    fill(hourSelect, 23, "--");
    fill(minuteSelect, 59, "--");

    const sync = () => {
      const hour = hourSelect.value;
      const minute = minuteSelect.value;
      hidden.value = hour && minute ? `${hour}:${minute}` : "";
      hidden.dispatchEvent(new Event("input", { bubbles:true }));
    };

    [hourSelect, minuteSelect].forEach((select) => {
      select.addEventListener("change", sync);
      select.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        sync();
        if (hidden.value) calculateTimeDifference();
      });
    });

    // Restore a prefilled HH:MM value if one exists.
    const existing = parseFlexibleClockTime(hidden.value);
    if (existing) {
      hourSelect.value = String(existing.hour).padStart(2, "0");
      minuteSelect.value = String(existing.minute).padStart(2, "0");
    }
  }

  function parseFlexibleClockTime(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!raw) return null;

    let hour;
    let minute = 0;
    let match = raw.match(/^(\d{1,2})(?:(?:h|:|\.)(\d{1,2}))?$/i);
    if (!match) return null;
    hour = Number(match[1]);
    if (match[2] !== undefined) minute = Number(match[2]);

    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute, totalMinutes:hour * 60 + minute };
  }

  function formatClockParts(parts) {
    return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  }

  function formatDurationMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours} giờ ${minutes} phút`;
    if (hours) return `${hours} giờ`;
    return `${minutes} phút`;
  }

  function calculateTimeDifference(quiet = false) {
    const startInput = $("worldDiffTimeStart");
    const endInput = $("worldDiffTimeEnd");
    const result = $("worldTimeDiffResult");
    if (!startInput || !endInput || !result) return;

    const start = parseFlexibleClockTime(startInput.value);
    const end = parseFlexibleClockTime(endInput.value);
    if (!start || !end) {
      if (quiet) return;
      setDiffResult(
        result,
        "Vui lòng chọn đủ 2 mốc giờ.",
        "Bấm vào từng ô giờ để chọn giờ bắt đầu / kết thúc.",
        true
      );
      return;
    }

    // Tính theo chiều thời gian từ mốc bắt đầu đến mốc kết thúc.
    // Nếu giờ kết thúc nhỏ hơn giờ bắt đầu thì tự hiểu là đã qua 0:00 sang ngày hôm sau.
    let totalMinutes = end.totalMinutes - start.totalMinutes;
    const crossesMidnight = totalMinutes < 0;
    if (crossesMidnight) totalMinutes += 24 * 60;

    const duration = formatDurationMinutes(totalMinutes);
    setDiffResult(
      result,
      `${formatClockParts(start)} → ${formatClockParts(end)} = ${duration}`,
      totalMinutes === 0
        ? "Hai mốc giờ giống nhau."
        : crossesMidnight
          ? `Qua ngày hôm sau • tổng cộng ${totalMinutes} phút.`
          : `Cùng ngày • tổng cộng ${totalMinutes} phút.`
    );
  }

  function getUtcOffset(date, zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone:zone,
        timeZoneName:"longOffset",
        hour:"2-digit"
      }).formatToParts(date);

      const name = parts.find((p) => p.type === "timeZoneName")?.value || "";
      return name.replace("GMT", "UTC") || "UTC";
    } catch (_) {
      return "UTC";
    }
  }


  const LUNAR_CAN = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
  const LUNAR_CHI = ["Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi"];

  function lunarInt(value) {
    return Math.floor(value);
  }

  function lunarJdFromDate(dd, mm, yy) {
    const a = lunarInt((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + lunarInt((153 * m + 2) / 5) + 365 * y + lunarInt(y / 4)
      - lunarInt(y / 100) + lunarInt(y / 400) - 32045;
    if (jd < 2299161) {
      jd = dd + lunarInt((153 * m + 2) / 5) + 365 * y + lunarInt(y / 4) - 32083;
    }
    return jd;
  }

  function lunarNewMoon(k) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = Math.PI / 180;

    let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

    let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr)
      + 0.0021 * Math.sin(2 * M * dr)
      - 0.4068 * Math.sin(Mpr * dr)
      + 0.0161 * Math.sin(2 * Mpr * dr)
      - 0.0004 * Math.sin(3 * Mpr * dr)
      + 0.0104 * Math.sin(2 * F * dr)
      - 0.0051 * Math.sin((M + Mpr) * dr)
      - 0.0074 * Math.sin((M - Mpr) * dr)
      + 0.0004 * Math.sin((2 * F + M) * dr)
      - 0.0004 * Math.sin((2 * F - M) * dr)
      - 0.0006 * Math.sin((2 * F + Mpr) * dr)
      + 0.0010 * Math.sin((2 * F - Mpr) * dr)
      + 0.0005 * Math.sin((2 * Mpr + M) * dr);

    let deltaT;
    if (T < -11) {
      deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3
        - 0.000000081 * T * T3;
    } else {
      deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }

    return jd1 + c1 - deltaT;
  }

  function lunarNewMoonDay(k, timeZone) {
    return lunarInt(lunarNewMoon(k) + 0.5 + timeZone / 24);
  }

  function lunarSunLongitude(jdn) {
    const T = (jdn - 2451545.0) / 36525;
    const T2 = T * T;
    const dr = Math.PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL += (0.019993 - 0.000101 * T) * Math.sin(2 * dr * M) + 0.000290 * Math.sin(3 * dr * M);
    let L = (L0 + DL) * dr;
    L -= Math.PI * 2 * lunarInt(L / (Math.PI * 2));
    return L;
  }

  function lunarSunLongitudeSector(dayNumber, timeZone) {
    return lunarInt(lunarSunLongitude(dayNumber - 0.5 - timeZone / 24) / Math.PI * 6);
  }

  function lunarMonth11(yy, timeZone) {
    const off = lunarJdFromDate(31, 12, yy) - 2415021;
    const k = lunarInt(off / 29.530588853);
    let nm = lunarNewMoonDay(k, timeZone);
    const sunLong = lunarSunLongitudeSector(nm, timeZone);
    if (sunLong >= 9) nm = lunarNewMoonDay(k - 1, timeZone);
    return nm;
  }

  function lunarLeapMonthOffset(a11, timeZone) {
    const k = lunarInt(0.5 + (a11 - 2415021.076998695) / 29.530588853);
    let last = 0;
    let i = 1;
    let arc = lunarSunLongitudeSector(lunarNewMoonDay(k + i, timeZone), timeZone);
    do {
      last = arc;
      i += 1;
      arc = lunarSunLongitudeSector(lunarNewMoonDay(k + i, timeZone), timeZone);
    } while (arc !== last && i < 14);
    return i - 1;
  }

  function solarToVietnameseLunar(dd, mm, yy) {
    const timeZone = 7;
    const dayNumber = lunarJdFromDate(dd, mm, yy);
    const k = lunarInt((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = lunarNewMoonDay(k + 1, timeZone);
    if (monthStart > dayNumber) monthStart = lunarNewMoonDay(k, timeZone);

    let a11 = lunarMonth11(yy, timeZone);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = lunarMonth11(yy - 1, timeZone);
    } else {
      lunarYear = yy + 1;
      b11 = lunarMonth11(yy + 1, timeZone);
    }

    const lunarDay = dayNumber - monthStart + 1;
    const diff = lunarInt((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;

    if (b11 - a11 > 365) {
      const leapMonthDiff = lunarLeapMonthOffset(a11, timeZone);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) lunarLeap = 1;
      }
    }

    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

    return {
      day:lunarDay,
      month:lunarMonth,
      year:lunarYear,
      leap:Boolean(lunarLeap),
      jd:dayNumber
    };
  }

  function getDatePartsInZone(date, zone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:zone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).formatToParts(date);
    const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    return { year:pick("year"), month:pick("month"), day:pick("day") };
  }

  function getLunarCanChi(lunar) {
    return {
      day:`${LUNAR_CAN[(lunar.jd + 9) % 10]} ${LUNAR_CHI[(lunar.jd + 1) % 12]}`,
      month:`${LUNAR_CAN[(lunar.year * 12 + lunar.month + 3) % 10]} ${LUNAR_CHI[(lunar.month + 1) % 12]}`,
      year:`${LUNAR_CAN[(lunar.year + 6) % 10]} ${LUNAR_CHI[(lunar.year + 8) % 12]}`
    };
  }

  function updateLunarCalendar(date, zone) {
    const full = $("worldLunarFull");
    if (!full) return;

    try {
      const solar = getDatePartsInZone(date, zone);
      if (!solar.day || !solar.month || !solar.year) throw new Error("invalid-date");

      const lunar = solarToVietnameseLunar(solar.day, solar.month, solar.year);
      const canChi = getLunarCanChi(lunar);
      const leapText = lunar.leap ? " nhuận" : "";

      $("worldLunarDay").textContent = String(lunar.day).padStart(2, "0");
      $("worldLunarMonth").textContent = String(lunar.month).padStart(2, "0");
      full.textContent = `${lunar.day}/${lunar.month}/${lunar.year} âm lịch${leapText}`;
      $("worldLunarDayCanChi").textContent = canChi.day;
      $("worldLunarMonthCanChi").textContent = canChi.month;
      $("worldLunarYearCanChi").textContent = canChi.year;

      const leap = $("worldLunarLeap");
      if (leap) leap.classList.toggle("hidden", !lunar.leap);
    } catch (_) {
      full.textContent = "Không tính được lịch âm";
      $("worldLunarDay").textContent = "--";
      $("worldLunarMonth").textContent = "--";
      $("worldLunarDayCanChi").textContent = "—";
      $("worldLunarMonthCanChi").textContent = "—";
      $("worldLunarYearCanChi").textContent = "—";
      const leap = $("worldLunarLeap");
      if (leap) leap.classList.add("hidden");
    }
  }

  async function copyCurrentTime() {
    try {
      const lunarLine = $("worldLunarFull")?.textContent && $("worldLunarFull").textContent !== "—"
        ? `\nÂm lịch: ${$("worldLunarFull").textContent} • ${$("worldLunarDayCanChi").textContent}, ${$("worldLunarMonthCanChi").textContent}, ${$("worldLunarYearCanChi").textContent}`
        : "";

      const text =
        `${selected.city}, ${selected.country}\n` +
        `${$("worldClock").textContent}\n` +
        `${$("worldDate").textContent}` + lunarLine + `\n` +
        `${selected.zone} • ${$("worldUtcOffset").textContent}`;

      await navigator.clipboard.writeText(text);

      const btn = $("worldCopyBtn");
      const old = btn.textContent;
      btn.textContent = "✓ Đã copy";
      setTimeout(() => { btn.textContent = old; }, 1200);
    } catch (_) {}
  }

  window.BaByLonWorldTime = { onOpen };
  init();
})();
