(() => {
  'use strict';

  let timer = null;
  let activeConfig = null;

  const $2 = (id) => document.getElementById(id);

  function set2faStatus(text, type = '') {
    const el = $2('twofaStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `status ${type}`;
  }

  function normalizeBase32(raw) {
    return String(raw || '')
      .toUpperCase()
      .replace(/^SECRET\s*=\s*/i, '')
      .replace(/[\s-]+/g, '')
      .replace(/=+$/g, '');
  }

  function decodeBase32(secret) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = normalizeBase32(secret);
    if (!clean || !/^[A-Z2-7]+$/.test(clean)) {
      throw new Error('Secret Base32 không hợp lệ. Chỉ dùng A-Z và 2-7.');
    }

    let bits = '';
    for (const ch of clean) {
      const val = alphabet.indexOf(ch);
      if (val < 0) throw new Error('Secret Base32 không hợp lệ.');
      bits += val.toString(2).padStart(5, '0');
    }

    const out = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      out.push(parseInt(bits.slice(i, i + 8), 2));
    }
    if (!out.length) throw new Error('Secret 2FA quá ngắn hoặc không hợp lệ.');
    return new Uint8Array(out);
  }

  function parse2faInput(raw) {
    const text = String(raw || '').trim();
    if (!text) throw new Error('Hãy nhập secret 2FA hoặc link otpauth://.');

    if (/^otpauth:\/\//i.test(text)) {
      let url;
      try { url = new URL(text); } catch (_) { throw new Error('Link otpauth:// không hợp lệ.'); }
      if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
        throw new Error('Hiện BaByLon hỗ trợ TOTP, chưa hỗ trợ HOTP.');
      }
      const secret = normalizeBase32(url.searchParams.get('secret') || '');
      const algorithmRaw = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const algorithms = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };
      const algorithm = algorithms[algorithmRaw];
      if (!algorithm) throw new Error('Thuật toán 2FA chưa được hỗ trợ.');
      const digits = Number(url.searchParams.get('digits') || 6);
      const period = Number(url.searchParams.get('period') || 30);
      if (![6, 8].includes(digits)) throw new Error('BaByLon chỉ hỗ trợ mã TOTP 6 hoặc 8 số.');
      if (!Number.isFinite(period) || period < 10 || period > 120) throw new Error('Chu kỳ TOTP không hợp lệ.');
      decodeBase32(secret); // validate now
      let label = '';
      try { label = decodeURIComponent(url.pathname.replace(/^\//, '')); } catch (_) { label = url.pathname.replace(/^\//, ''); }
      const issuer = url.searchParams.get('issuer') || '';
      return { secret, algorithm, algorithmRaw, digits, period, label, issuer };
    }

    const secret = normalizeBase32(text);
    decodeBase32(secret);
    return { secret, algorithm: 'SHA-1', algorithmRaw: 'SHA1', digits: 6, period: 30, label: '', issuer: '' };
  }

  async function totp(config, now = Date.now()) {
    const keyBytes = decodeBase32(config.secret);
    const counter = Math.floor(now / 1000 / config.period);
    const msg = new Uint8Array(8);
    let n = BigInt(counter);
    for (let i = 7; i >= 0; i--) {
      msg[i] = Number(n & 0xffn);
      n >>= 8n;
    }

    const key = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: { name: config.algorithm } },
      false, ['sign']
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
    const offset = sig[sig.length - 1] & 0x0f;
    const binary = ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);
    return String(binary % (10 ** config.digits)).padStart(config.digits, '0');
  }

  function displayCode(code) {
    if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
    if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
    return code;
  }

  function updateMeta(config) {
    const meta = $2('twofaMeta');
    if (!meta) return;
    const account = $2('twofaAccount');
    const algo = $2('twofaAlgorithm');
    const name = [config.issuer, config.label].filter(Boolean).join(' • ') || 'TOTP';
    account.textContent = name;
    algo.textContent = `${config.algorithmRaw} • ${config.digits} số • ${config.period}s`;
    meta.classList.remove('hidden');
  }

  async function refresh2fa() {
    if (!activeConfig) return;
    try {
      const now = Date.now();
      const code = await totp(activeConfig, now);
      const elapsed = (now / 1000) % activeConfig.period;
      const left = Math.max(1, Math.ceil(activeConfig.period - elapsed));
      const pct = Math.max(0, Math.min(100, ((activeConfig.period - elapsed) / activeConfig.period) * 100));
      $2('twofaCode').textContent = displayCode(code);
      $2('twofaCode').dataset.rawCode = code;
      $2('twofaCountdownText').textContent = `${left} giây`;
      $2('twofaCountdownBar').style.width = `${pct}%`;
      $2('twofaResult').classList.remove('hidden');
    } catch (err) {
      stop2faTimer();
      set2faStatus(err?.message || 'Không tạo được mã 2FA.', 'error');
    }
  }

  function stop2faTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  async function start2fa() {
    try {
      const config = parse2faInput($2('twofaSecretInput')?.value || '');
      activeConfig = config;
      syncQuickClearButton();
      updateMeta(config);
      stop2faTimer();
      await refresh2fa();
      timer = setInterval(refresh2fa, 1000);
      set2faStatus('Đã đọc TOTP. Mã tự đổi theo chu kỳ và chỉ được tính cục bộ trên máy.', 'ok');
    } catch (err) {
      activeConfig = null;
      stop2faTimer();
      $2('twofaResult')?.classList.add('hidden');
      $2('twofaMeta')?.classList.add('hidden');
      set2faStatus(err?.message || 'Không đọc được 2FA.', 'error');
    }
  }

  async function copyCode() {
    const raw = $2('twofaCode')?.dataset.rawCode || '';
    if (!raw) {
      set2faStatus('Chưa có mã 2FA để sao chép. Hãy bấm Đọc mã 2FA trước.', 'warn');
      return;
    }
    const btn = $2('twofaCopyBtn');
    try {
      await navigator.clipboard.writeText(raw);
      set2faStatus(`Đã sao chép mã ${raw}.`, 'ok');
      if (btn) {
        btn.textContent = '✓ ĐÃ SAO CHÉP';
        btn.classList.add('copied');
        clearTimeout(btn._copyResetTimer);
        btn._copyResetTimer = setTimeout(() => {
          btn.textContent = '📋 SAO CHÉP MÃ 2FA';
          btn.classList.remove('copied');
        }, 1400);
      }
    } catch (_) {
      set2faStatus('Không sao chép được mã. Hãy thử lại hoặc copy thủ công.', 'warn');
    }
  }

  async function copySecret() {
    const input = $2('twofaSecretInput');
    const rawInput = String(input?.value || '').trim();
    if (!rawInput) {
      set2faStatus('Chưa có Secret 2FA để sao chép.', 'warn');
      input?.focus();
      return;
    }

    let secretToCopy = rawInput;
    try {
      // Nếu người dùng dán otpauth://, nút này sao chép riêng Secret Base32 để tiện dùng ở nơi khác.
      secretToCopy = parse2faInput(rawInput).secret || rawInput;
    } catch (_) {
      // Nếu nội dung chưa hoàn chỉnh, vẫn sao chép đúng chuỗi đang nằm trong ô thay vì chặn thao tác copy.
      secretToCopy = rawInput;
    }

    const btn = $2('twofaCopySecretBtn');
    try {
      await navigator.clipboard.writeText(secretToCopy);
      set2faStatus('Đã sao chép Secret 2FA.', 'ok');
      if (btn) {
        const oldText = btn.textContent;
        btn.textContent = '✓';
        btn.classList.add('copied');
        clearTimeout(btn._copySecretResetTimer);
        btn._copySecretResetTimer = setTimeout(() => {
          btn.textContent = oldText || '📋';
          btn.classList.remove('copied');
        }, 1200);
      }
    } catch (_) {
      set2faStatus('Không sao chép được Secret 2FA. Hãy thử lại.', 'warn');
    }
  }

  function syncQuickClearButton() {
    const btn = $2('twofaQuickClearBtn');
    const input = $2('twofaSecretInput');
    if (!btn) return;
    const hasValue = Boolean(String(input?.value || '').trim()) || Boolean(activeConfig);
    btn.classList.toggle('hidden', !hasValue);
  }

  function clear2fa(options = {}) {
    stop2faTimer();
    activeConfig = null;
    const input = $2('twofaSecretInput');
    if (input) {
      input.value = '';
      input.type = 'password';
    }
    const codeEl = $2('twofaCode');
    if (codeEl) {
      codeEl.textContent = '------';
      delete codeEl.dataset.rawCode;
    }
    $2('twofaResult')?.classList.add('hidden');
    const copyBtn = $2('twofaCopyBtn');
    if (copyBtn) {
      clearTimeout(copyBtn._copyResetTimer);
      copyBtn.textContent = '📋 SAO CHÉP MÃ 2FA';
      copyBtn.classList.remove('copied');
    }
    $2('twofaMeta')?.classList.add('hidden');
    const copySecretBtn = $2('twofaCopySecretBtn');
    if (copySecretBtn) {
      clearTimeout(copySecretBtn._copySecretResetTimer);
      copySecretBtn.textContent = '📋';
      copySecretBtn.classList.remove('copied');
    }
    if ($2('twofaRevealBtn')) $2('twofaRevealBtn').textContent = '👁';
    syncQuickClearButton();
    set2faStatus(options.quick ? 'Đã xóa mã cũ. Dán secret mới để đọc mã 2FA tiếp theo.' : 'Đã xóa secret khỏi phiên hiện tại.', 'ok');
    if (options.focus && input) {
      requestAnimationFrame(() => input.focus());
    }
  }

  function toggleSecret() {
    const input = $2('twofaSecretInput');
    const btn = $2('twofaRevealBtn');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (btn) btn.textContent = show ? '🙈' : '👁';
  }

  function init2fa() {
    if (!$2('twofaGenerateBtn')) return;
    $2('twofaGenerateBtn').addEventListener('click', start2fa);
    $2('twofaCodeBtn')?.addEventListener('click', copyCode);
    $2('twofaCopyBtn')?.addEventListener('click', copyCode);
    $2('twofaCopySecretBtn')?.addEventListener('click', copySecret);
    $2('twofaClearBtn')?.addEventListener('click', () => clear2fa({ focus: true }));
    $2('twofaQuickClearBtn')?.addEventListener('click', () => clear2fa({ quick: true, focus: true }));
    $2('twofaRevealBtn')?.addEventListener('click', toggleSecret);
    const secretInput = $2('twofaSecretInput');
    secretInput?.addEventListener('input', syncQuickClearButton);
    secretInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') start2fa();
      if (event.key === 'Escape' && secretInput.value) clear2fa({ quick: true, focus: true });
    });
    syncQuickClearButton();
  }

  window.addEventListener('DOMContentLoaded', init2fa);
  window.addEventListener('unload', stop2faTimer);
})();
