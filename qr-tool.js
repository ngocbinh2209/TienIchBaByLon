(() => {
  "use strict";

  const QR_API = "https://api.qrserver.com/v1/create-qr-code/";
  const VIETQR_BANK_API = "https://api.vietqr.io/v2/banks";
  const VIETQR_IMAGE_BASE = "https://img.vietqr.io/image/";
  const TMPFILES_UPLOAD_API = "https://tmpfiles.org/api/v1/upload";
  const QR_AUTO_CURRENT_STORAGE = "babylon_qr_auto_current";
  const $ = (id) => document.getElementById(id);

  const FALLBACK_BANKS = [
    { bin:"970436", shortName:"Vietcombank", name:"Ngân hàng TMCP Ngoại thương Việt Nam" },
    { bin:"970415", shortName:"VietinBank", name:"Ngân hàng TMCP Công thương Việt Nam" },
    { bin:"970418", shortName:"BIDV", name:"Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
    { bin:"970405", shortName:"Agribank", name:"Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
    { bin:"970422", shortName:"MB Bank", name:"Ngân hàng TMCP Quân đội" },
    { bin:"970407", shortName:"Techcombank", name:"Ngân hàng TMCP Kỹ thương Việt Nam" },
    { bin:"970416", shortName:"ACB", name:"Ngân hàng TMCP Á Châu" },
    { bin:"970432", shortName:"VPBank", name:"Ngân hàng TMCP Việt Nam Thịnh Vượng" },
    { bin:"970423", shortName:"TPBank", name:"Ngân hàng TMCP Tiên Phong" },
    { bin:"970403", shortName:"Sacombank", name:"Ngân hàng TMCP Sài Gòn Thương Tín" },
    { bin:"970441", shortName:"VIB", name:"Ngân hàng TMCP Quốc tế Việt Nam" },
    { bin:"970437", shortName:"HDBank", name:"Ngân hàng TMCP Phát triển TP.HCM" },
    { bin:"970443", shortName:"SHB", name:"Ngân hàng TMCP Sài Gòn - Hà Nội" },
    { bin:"970431", shortName:"Eximbank", name:"Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
    { bin:"970426", shortName:"MSB", name:"Ngân hàng TMCP Hàng Hải Việt Nam" },
    { bin:"970448", shortName:"OCB", name:"Ngân hàng TMCP Phương Đông" },
    { bin:"970440", shortName:"SeABank", name:"Ngân hàng TMCP Đông Nam Á" },
    { bin:"970425", shortName:"ABBANK", name:"Ngân hàng TMCP An Bình" },
    { bin:"970428", shortName:"Nam A Bank", name:"Ngân hàng TMCP Nam Á" },
    { bin:"970409", shortName:"Bac A Bank", name:"Ngân hàng TMCP Bắc Á" },
    { bin:"970452", shortName:"KienlongBank", name:"Ngân hàng TMCP Kiên Long" },
    { bin:"970412", shortName:"PVcomBank", name:"Ngân hàng TMCP Đại Chúng Việt Nam" },
    { bin:"970419", shortName:"NCB", name:"Ngân hàng TMCP Quốc Dân" },
    { bin:"970433", shortName:"VietBank", name:"Ngân hàng TMCP Việt Nam Thương Tín" },
    { bin:"970438", shortName:"BaoViet Bank", name:"Ngân hàng TMCP Bảo Việt" },
    { bin:"970430", shortName:"PGBank", name:"Ngân hàng TMCP Thịnh vượng và Phát triển" }
  ];

  let initialized = false;
  let qrObjectUrl = "";
  let lastContent = "";
  let lastBankData = null;
  let lastImageData = null;
  let selectedImageFile = null;
  let selectedImagePreviewUrl = "";
  let autoCurrentEnabled = true;
  let autoRefreshTimer = null;
  let autoRefreshBusy = false;
  let activeMode = "text";
  let banks = [...FALLBACK_BANKS];

  function isProbablyUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/i.test(url.protocol);
    } catch { return false; }
  }

  function cleanFilename(value) {
    let name = String(value || "BaByLon-QR.png").trim();
    if (!name) name = "BaByLon-QR.png";
    name = name.replace(/[\\/:*?"<>|]/g, "_");
    if (!/\.png$/i.test(name)) name += ".png";
    return name.slice(0, 120);
  }

  function setStatus(message, type = "") {
    const el = $("qrStatus");
    if (!el) return;
    el.textContent = message;
    el.className = `status qr-status ${type}`.trim();
  }

  function updateInputMeta() {
    const input = $("qrContentInput");
    if (!input) return;
    const value = input.value.trim();
    $("qrCharCount").textContent = `${input.value.length} / 1500`;
    $("qrDetectedType").textContent = !value ? "Chưa có nội dung" : (isProbablyUrl(value) ? "🔗 Link web" : "📝 Văn bản");
  }

  function formatVndDigits(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 13);
    if (!digits) return "";
    return Number(digits).toLocaleString("vi-VN");
  }

  function bankByBin(bin) {
    return banks.find(bank => String(bank.bin) === String(bin)) || null;
  }

  function updateBankSummary() {
    const bank = bankByBin($("qrBankSelect")?.value);
    const account = String($("qrBankAccount")?.value || "").replace(/\D/g, "").slice(0, 19);
    const amount = String($("qrBankAmount")?.value || "").replace(/\D/g, "").slice(0, 13);
    const info = String($("qrBankInfo")?.value || "").trim();
    const box = $("qrBankSummary");
    if (!box) return;
    if (!bank && !account) return void (box.textContent = "Chọn ngân hàng và nhập số tài khoản để tạo QR.");
    const parts = [bank ? `🏦 ${bank.shortName}` : "🏦 Chưa chọn ngân hàng", account ? `STK ${account}` : "Chưa nhập STK"];
    if (amount) parts.push(`${Number(amount).toLocaleString("vi-VN")} ₫`);
    if (info) parts.push(info);
    box.textContent = parts.join(" • ");
  }

  function revokeObjectUrl() {
    if (qrObjectUrl) {
      try { URL.revokeObjectURL(qrObjectUrl); } catch (_) {}
      qrObjectUrl = "";
    }
  }

  function hideResult() {
    $("qrResult")?.classList.add("hidden");
    const image = $("qrImage");
    if (image) image.removeAttribute("src");
    revokeObjectUrl();
    lastContent = "";
    lastBankData = null;
    lastImageData = null;
  }

  function setMode(mode, options = {}) {
    activeMode = ["text", "image", "bank"].includes(mode) ? mode : "text";
    const textMode = activeMode === "text";
    const imageMode = activeMode === "image";
    const bankMode = activeMode === "bank";

    $("qrTextMode")?.classList.toggle("hidden", !textMode);
    $("qrImageMode")?.classList.toggle("hidden", !imageMode);
    $("qrBankMode")?.classList.toggle("hidden", !bankMode);
    $("qrTextNote")?.classList.toggle("hidden", !textMode);
    $("qrImageNote")?.classList.toggle("hidden", !imageMode);
    $("qrBankNote")?.classList.toggle("hidden", !bankMode);

    $("qrModeTextBtn")?.classList.toggle("active", textMode);
    $("qrModeImageBtn")?.classList.toggle("active", imageMode);
    $("qrModeBankBtn")?.classList.toggle("active", bankMode);
    $("qrModeTextBtn")?.setAttribute("aria-selected", textMode ? "true" : "false");
    $("qrModeImageBtn")?.setAttribute("aria-selected", imageMode ? "true" : "false");
    $("qrModeBankBtn")?.setAttribute("aria-selected", bankMode ? "true" : "false");
    hideResult();

    if (textMode) {
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP NỘI DUNG";
      $("qrResultLabel").textContent = "Nội dung QR";
      if (!options.silent) {
        if (autoCurrentEnabled) useCurrentPage(true, false);
        else setStatus("Dán link/văn bản rồi tạo QR.", "");
      }
    } else if (imageMode) {
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP LINK ẢNH";
      $("qrResultLabel").textContent = "Link tải ảnh";
      if (!options.silent) setStatus(selectedImageFile ? "Ảnh đã sẵn sàng. Bấm Tạo QR chuyển ảnh." : "Chọn ảnh trên máy tính để tạo QR chuyển sang điện thoại.", "");
    } else {
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP SỐ TK";
      $("qrResultLabel").textContent = "Thông tin chuyển khoản";
      if (!options.silent) setStatus("Chọn ngân hàng và nhập số tài khoản để tạo VietQR.", "");
      updateBankSummary();
    }
  }

  async function loadBankList() {
    const select = $("qrBankSelect");
    if (!select) return;
    select.innerHTML = '<option value="">Đang tải danh sách ngân hàng...</option>';
    try {
      const response = await fetch(VIETQR_BANK_API, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const live = Array.isArray(json?.data) ? json.data : [];
      const usable = live
        .filter(item => item?.bin && item?.shortName && item?.transferSupported !== 0)
        .map(item => ({ bin:String(item.bin), shortName:String(item.shortName), name:String(item.name || item.shortName) }));
      if (usable.length) banks = usable;
    } catch (error) {
      console.warn("[BaByLon QR] Không tải được danh sách VietQR, dùng danh sách dự phòng:", error);
      banks = [...FALLBACK_BANKS];
    }

    const sorted = [...banks].sort((a,b) => a.shortName.localeCompare(b.shortName, "vi"));
    select.innerHTML = '<option value="">-- Chọn ngân hàng --</option>' + sorted.map(bank =>
      `<option value="${bank.bin}">${escapeHtml(bank.shortName)} — ${escapeHtml(bank.name)}</option>`
    ).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  async function useCurrentPage(autoGenerate = true, silent = false) {
    if (activeMode !== "text") return false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = String(tab?.url || "").trim();
      if (!url || /^(chrome|edge|about|chrome-extension):/i.test(url)) {
        if (!silent) setStatus("Trang hiện tại không thể tạo QR trực tiếp.", "warn");
        return false;
      }
      const input = $("qrContentInput");
      if (!input) return false;
      const nextValue = url.slice(0, 1500);
      const changed = input.value.trim() !== nextValue;
      input.value = nextValue;
      updateInputMeta();
      if (changed && lastContent && nextValue !== lastContent) hideResult();
      if (autoGenerate) {
        if (!silent) setStatus("Đã tự lấy link trang hiện tại • đang tạo QR...", "");
        await generateQr({ silentStart: silent });
      } else if (!silent) setStatus("Đã lấy link trang hiện tại.", "ok");
      return true;
    } catch (error) {
      if (!silent) setStatus(`Không đọc được trang hiện tại: ${error?.message || error}`, "error");
      return false;
    }
  }

  async function blobToResult(blob, resultText, type, options = {}) {
    if (!blob?.type?.startsWith("image/")) throw new Error("Dữ liệu QR không hợp lệ");
    revokeObjectUrl();
    qrObjectUrl = URL.createObjectURL(blob);
    const image = $("qrImage");
    image.src = qrObjectUrl;
    if (options.size) {
      image.width = options.size;
      image.height = options.size;
    } else {
      image.removeAttribute("width");
      image.removeAttribute("height");
    }
    $("qrResultText").textContent = resultText;
    $("qrResultType").textContent = type;
    $("qrPreviewTitle").textContent = options.title || "MÃ QR SẴN SÀNG";
    $("qrPreviewSubtitle").textContent = options.subtitle || "Dùng camera hoặc ứng dụng QR trên điện thoại để quét.";
    $("qrResult").classList.remove("hidden");
  }

  function revokeSelectedImagePreview() {
    if (selectedImagePreviewUrl) {
      try { URL.revokeObjectURL(selectedImagePreviewUrl); } catch (_) {}
      selectedImagePreviewUrl = "";
    }
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setSelectedImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type || "")) {
      return setStatus("Chỉ hỗ trợ PNG, JPG, WebP hoặc GIF.", "error");
    }
    if (file.size > 20 * 1024 * 1024) {
      return setStatus("Ảnh lớn hơn 20 MB. Hãy chọn ảnh nhỏ hơn.", "error");
    }
    selectedImageFile = file;
    revokeSelectedImagePreview();
    selectedImagePreviewUrl = URL.createObjectURL(file);
    const preview = $("qrImagePreview");
    if (preview) preview.src = selectedImagePreviewUrl;
    if ($("qrImageFileName")) $("qrImageFileName").textContent = file.name || "Ảnh";
    if ($("qrImageFileMeta")) $("qrImageFileMeta").textContent = `${formatBytes(file.size)} • ${file.type || "image"}`;
    $("qrImageSelected")?.classList.remove("hidden");
    hideResult();
    setStatus("Đã chọn ảnh. Bấm Tạo QR chuyển ảnh để tải ảnh tạm và nhận QR.", "ok");
  }

  function clearSelectedImage() {
    selectedImageFile = null;
    revokeSelectedImagePreview();
    const input = $("qrImageFileInput");
    if (input) input.value = "";
    $("qrImageSelected")?.classList.add("hidden");
    hideResult();
    setStatus("Đã bỏ ảnh. Chọn ảnh khác để tiếp tục.", "");
  }

  function tmpfilesDirectUrl(pageUrl) {
    try {
      const url = new URL(pageUrl);
      if (!/^(www\.)?tmpfiles\.org$/i.test(url.hostname)) return pageUrl;
      if (!url.pathname.startsWith("/dl/")) url.pathname = `/dl${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;
      return url.toString();
    } catch { return pageUrl; }
  }

  async function generateImageQr() {
    if (!selectedImageFile) return setStatus("Hãy chọn ảnh trước.", "error");
    const expire = Math.max(60, Math.min(172800, Number($("qrImageExpireSelect")?.value || 3600)));
    const size = Math.max(180, Math.min(512, Number($("qrImageQrSizeSelect")?.value || 320)));
    const button = $("qrImageGenerateBtn");
    if (button) { button.disabled = true; button.textContent = "ĐANG TẢI ẢNH..."; }
    hideResult();
    setStatus("Đang tải ảnh lên máy chủ tạm thời...", "");

    try {
      const form = new FormData();
      form.append("file", selectedImageFile, selectedImageFile.name || "image.jpg");
      form.append("expire", String(expire));
      const uploadResponse = await fetch(TMPFILES_UPLOAD_API, { method:"POST", body:form, cache:"no-store" });
      if (!uploadResponse.ok) throw new Error(`Upload HTTP ${uploadResponse.status}`);
      const json = await uploadResponse.json();
      const pageUrl = String(json?.data?.url || "").trim();
      if (json?.status !== "success" || !pageUrl) throw new Error("Không nhận được link ảnh");
      const directUrl = tmpfilesDirectUrl(pageUrl);

      if (button) button.textContent = "ĐANG TẠO QR...";
      setStatus("Ảnh đã tải xong • đang tạo QR để quét trên điện thoại...", "");
      const qrUrl = `${QR_API}?size=${size}x${size}&format=png&ecc=M&margin=12&data=${encodeURIComponent(directUrl)}`;
      const qrResponse = await fetch(qrUrl, { cache:"no-store" });
      if (!qrResponse.ok) throw new Error(`QR HTTP ${qrResponse.status}`);
      const blob = await qrResponse.blob();

      lastImageData = {
        fileName:selectedImageFile.name || "image",
        fileSize:selectedImageFile.size,
        expire,
        directUrl,
        pageUrl
      };
      lastContent = "";
      lastBankData = null;
      await blobToResult(blob, directUrl, "IMAGE", {
        size,
        title:"QR CHUYỂN ẢNH SẴN SÀNG",
        subtitle:"Quét bằng điện thoại để mở hoặc tải ảnh trước khi link hết hạn."
      });
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP LINK ẢNH";
      $("qrResultLabel").textContent = "Link tải ảnh";
      setStatus(`Đã tạo QR chuyển ảnh • link tạm sẽ hết hạn sau ${formatExpire(expire)}.`, "ok");
    } catch (error) {
      console.error("[BaByLon Image QR]", error);
      setStatus("Không chuyển được ảnh. Hãy kiểm tra Internet rồi thử lại.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "🖼️ TẠO QR CHUYỂN ẢNH"; }
    }
  }

  function formatExpire(seconds) {
    if (seconds < 3600) return `${Math.round(seconds / 60)} phút`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} giờ`;
    return `${Math.round(seconds / 86400)} ngày`;
  }

  async function generateQr(options = {}) {
    if (activeMode === "image") return generateImageQr();
    if (activeMode === "bank") return generateBankQr();
    const input = $("qrContentInput");
    const content = String(input?.value || "").trim();
    if (!content) { hideResult(); return setStatus("Hãy dán link/văn bản hoặc bấm Trang hiện tại.", "error"); }
    if (content.length > 1500) return setStatus("Nội dung quá dài. Giới hạn hiện tại là 1.500 ký tự.", "error");

    const button = $("qrGenerateBtn");
    const size = Math.max(180, Math.min(512, Number($("qrSizeSelect")?.value || 320)));
    const apiUrl = `${QR_API}?size=${size}x${size}&format=png&ecc=M&margin=12&data=${encodeURIComponent(content)}`;
    if (button) { button.disabled = true; button.textContent = "ĐANG TẠO QR..."; }
    if (!options.silentStart) setStatus("Đang tạo mã QR...", "");
    hideResult();
    try {
      const response = await fetch(apiUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      lastContent = content;
      lastBankData = null;
      await blobToResult(blob, content, isProbablyUrl(content) ? "LINK" : "TEXT", { size });
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP NỘI DUNG";
      $("qrResultLabel").textContent = "Nội dung QR";
      setStatus("Đã tạo QR. Mở camera điện thoại và quét trực tiếp.", "ok");
    } catch (error) {
      console.error("[BaByLon QR]", error);
      setStatus("Không tạo được QR. Hãy kiểm tra Internet rồi thử lại.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "▦ TẠO MÃ QR"; }
    }
  }

  async function generateBankQr() {
    const bank = bankByBin($("qrBankSelect")?.value);
    const account = String($("qrBankAccount")?.value || "").replace(/\D/g, "").slice(0, 19);
    const amount = String($("qrBankAmount")?.value || "").replace(/\D/g, "").slice(0, 13);
    const info = String($("qrBankInfo")?.value || "").trim().slice(0, 50);

    if (!bank) return setStatus("Hãy chọn ngân hàng nhận.", "error");
    if (!/^\d{6,19}$/.test(account)) return setStatus("Số tài khoản phải gồm 6–19 chữ số.", "error");
    if (amount && !/^\d{1,13}$/.test(amount)) return setStatus("Số tiền không hợp lệ.", "error");

    const params = new URLSearchParams();
    if (amount) params.set("amount", amount);
    if (info) params.set("addInfo", info);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const imageUrl = `${VIETQR_IMAGE_BASE}${encodeURIComponent(bank.bin)}-${encodeURIComponent(account)}-compact2.png${suffix}`;
    const button = $("qrBankGenerateBtn");
    if (button) { button.disabled = true; button.textContent = "ĐANG TẠO VIETQR..."; }
    hideResult();
    setStatus("Đang tạo VietQR ngân hàng...", "");

    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const summary = [bank.shortName, `STK ${account}`];
      if (amount) summary.push(`${Number(amount).toLocaleString("vi-VN")} ₫`);
      if (info) summary.push(info);
      lastBankData = { bank, account, amount, info, imageUrl };
      lastContent = "";
      await blobToResult(blob, summary.join(" • "), "VIETQR", {
        title: "VIETQR SẴN SÀNG",
        subtitle: "Mở ứng dụng ngân hàng trên điện thoại và quét mã để điền thông tin chuyển khoản."
      });
      $("qrCopyContentBtn").textContent = "📋 SAO CHÉP SỐ TK";
      $("qrResultLabel").textContent = "Thông tin chuyển khoản";
      setStatus("Đã tạo VietQR. Hãy kiểm tra tên người nhận trong app ngân hàng trước khi xác nhận.", "ok");
    } catch (error) {
      console.error("[BaByLon VietQR]", error);
      setStatus("Không tạo được VietQR. Hãy kiểm tra Internet/thông tin rồi thử lại.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = "🏦 TẠO VIETQR NGÂN HÀNG"; }
    }
  }

  function downloadQr() {
    if (!qrObjectUrl) return setStatus("Chưa có QR để tải.", "warn");
    let filename;
    if (lastBankData) filename = cleanFilename(`VietQR-${lastBankData.bank.shortName}-${lastBankData.account}.png`);
    else if (lastImageData) filename = cleanFilename(`BaByLon-Image-QR-${lastImageData.fileName}.png`);
    else filename = cleanFilename($("qrFilenameInput")?.value);
    const link = document.createElement("a");
    link.href = qrObjectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus(lastBankData ? "Đã tải ảnh VietQR PNG." : (lastImageData ? "Đã tải QR chuyển ảnh PNG." : "Đã tải mã QR PNG."), "ok");
  }

  async function copyContent() {
    const value = lastBankData?.account || lastImageData?.directUrl || lastContent;
    if (!value) return setStatus("Chưa có nội dung để sao chép.", "warn");
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {
      const temp = document.createElement("textarea");
      temp.value = value;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
    setStatus(lastBankData ? "Đã sao chép số tài khoản." : (lastImageData ? "Đã sao chép link tải ảnh." : "Đã sao chép nội dung QR."), "ok");
  }

  function clearQr() {
    if (activeMode === "image") {
      clearSelectedImage();
      return;
    }
    if (activeMode === "bank") {
      if ($("qrBankAccount")) $("qrBankAccount").value = "";
      if ($("qrBankAmount")) $("qrBankAmount").value = "";
      if ($("qrBankInfo")) $("qrBankInfo").value = "";
      updateBankSummary();
      hideResult();
      setStatus("Đã xóa thông tin chuyển khoản. Chọn/nhập thông tin mới để tạo VietQR.", "");
      return;
    }
    const input = $("qrContentInput");
    if (input) input.value = "";
    hideResult();
    updateInputMeta();
    setStatus(autoCurrentEnabled ? "Đã xóa. Tắt Tự động nếu không muốn BaByLon lấy lại trang hiện tại." : "Đã xóa. Dán nội dung mới để tạo QR.", "");
  }

  async function loadAutoCurrentSetting() {
    try {
      const stored = await chrome.storage.local.get(QR_AUTO_CURRENT_STORAGE);
      autoCurrentEnabled = stored[QR_AUTO_CURRENT_STORAGE] !== false;
    } catch (_) { autoCurrentEnabled = true; }
    const toggle = $("qrAutoCurrentToggle");
    if (toggle) toggle.checked = autoCurrentEnabled;
  }

  async function setAutoCurrentSetting(enabled) {
    autoCurrentEnabled = !!enabled;
    try { await chrome.storage.local.set({ [QR_AUTO_CURRENT_STORAGE]: autoCurrentEnabled }); } catch (_) {}
    if (autoCurrentEnabled && activeMode === "text") await useCurrentPage(true, false);
    else if (activeMode === "text") setStatus("Đã tắt tự động. Bạn có thể dán nội dung hoặc bấm Trang hiện tại.", "");
  }

  function scheduleAutoCurrentRefresh(delay = 250) {
    if (!autoCurrentEnabled || activeMode !== "text") return;
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = setTimeout(async () => {
      if (autoRefreshBusy || !autoCurrentEnabled || activeMode !== "text") return;
      if (!$("qrPage")?.classList.contains("active")) return;
      autoRefreshBusy = true;
      try { await useCurrentPage(true, true); } finally { autoRefreshBusy = false; }
    }, delay);
  }

  function bindBankInputs() {
    $("qrBankSelect")?.addEventListener("change", updateBankSummary);
    $("qrBankAccount")?.addEventListener("input", event => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 19);
      updateBankSummary();
    });
    $("qrBankAmount")?.addEventListener("input", event => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 13);
      event.target.value = formatVndDigits(digits);
      updateBankSummary();
    });
    $("qrBankInfo")?.addEventListener("input", updateBankSummary);
    $("qrBankGenerateBtn")?.addEventListener("click", generateBankQr);
  }

  function bindImageInputs() {
    $("qrImageFileInput")?.addEventListener("change", event => setSelectedImage(event.target.files?.[0]));
    $("qrImageRemoveBtn")?.addEventListener("click", clearSelectedImage);
    $("qrImageGenerateBtn")?.addEventListener("click", generateImageQr);
    const drop = $("qrImageDrop");
    if (drop) {
      ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => {
        event.preventDefault();
        drop.classList.add("is-dragover");
      }));
      ["dragleave", "drop"].forEach(type => drop.addEventListener(type, event => {
        event.preventDefault();
        drop.classList.remove("is-dragover");
      }));
      drop.addEventListener("drop", event => {
        const file = Array.from(event.dataTransfer?.files || []).find(item => item.type?.startsWith("image/"));
        if (file) setSelectedImage(file);
        else setStatus("Không tìm thấy file ảnh hợp lệ trong dữ liệu kéo thả.", "error");
      });
    }
  }

  function init() {
    if (initialized) return;
    if (!$("qrContentInput")) return;
    initialized = true;

    loadAutoCurrentSetting();
    loadBankList();
    $("qrModeTextBtn")?.addEventListener("click", () => setMode("text"));
    $("qrModeImageBtn")?.addEventListener("click", () => setMode("image"));
    $("qrModeBankBtn")?.addEventListener("click", () => setMode("bank"));
    $("qrContentInput").addEventListener("input", () => {
      updateInputMeta();
      if (lastContent && $("qrContentInput").value.trim() !== lastContent) hideResult();
    });
    $("qrContentInput").addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) generateQr();
    });
    $("qrCurrentPageBtn").addEventListener("click", () => useCurrentPage(true, false));
    $("qrGenerateBtn").addEventListener("click", () => generateQr());
    $("qrDownloadBtn").addEventListener("click", downloadQr);
    $("qrCopyContentBtn").addEventListener("click", copyContent);
    $("qrClearBtn").addEventListener("click", clearQr);
    $("qrAutoCurrentToggle")?.addEventListener("change", event => setAutoCurrentSetting(event.target.checked));
    bindBankInputs();
    bindImageInputs();

    try {
      chrome.tabs.onActivated.addListener(() => scheduleAutoCurrentRefresh(180));
      chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
        if (changeInfo.url || changeInfo.status === "complete") scheduleAutoCurrentRefresh(320);
      });
    } catch (_) {}
    updateInputMeta();
    setMode("text", { silent:true });
  }

  async function onOpen() {
    init();
    await loadAutoCurrentSetting();
    updateInputMeta();
    if (activeMode === "text" && autoCurrentEnabled) await useCurrentPage(true, false);
  }

  window.BaByLonQR = { onOpen, generateQr, generateImageQr, generateBankQr, useCurrentPage };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
