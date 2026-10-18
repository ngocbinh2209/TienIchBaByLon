/* Creating Flow: pure queue and streaming file helpers. */
(function (root) {
  'use strict';
  function parsePrompts(text) {
    const prompts = String(text || '').split(/\r\n?|\n/).map(s => s.trim()).filter(Boolean);
    if (!prompts.length) throw Error('Hãy nhập ít nhất một prompt. Mỗi dòng là một prompt.');
    if (prompts.length > 100) throw Error('Mỗi đợt tối đa 100 prompt. Hãy chia thành nhiều đợt.');
    return prompts;
  }
  function isFlowProject(url) {
    try { const u = new URL(url); return u.protocol === 'https:' && ((['flow.google', 'flow.google.com'].includes(u.hostname) && /^\/project\/[^/]+/.test(u.pathname)) || (u.hostname === 'labs.google' && /\/tools\/flow\/project\/[^/]+/.test(u.pathname))); } catch { return false; }
  }
  async function nextNumber(directory) {
    let max = 0;
    for await (const [name] of directory.entries()) {
      const match = /^(\d+)(?:\.[^.]+)?$/.exec(name);
      if (match) max = Math.max(max, Number(match[1]));
    }
    if (!Number.isSafeInteger(max + 1)) throw Error('Số thứ tự trong thư mục quá lớn.');
    return max + 1;
  }
  function extensionFor(type, mode) {
    const mime = String(type || '').split(';')[0].toLowerCase().trim();
    const allowed = mode === 'video' ? {'video/mp4':'mp4','video/webm':'webm'} : {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'};
    if (!allowed[mime]) throw Error('Nguồn trả về không đúng loại ' + (mode === 'video' ? 'video MP4/WebM' : 'ảnh') + '. Không lưu HTML hoặc bản xem trước sai loại.');
    return allowed[mime];
  }
  function startNumber(value) {
    if(!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)>=Number.MAX_SAFE_INTEGER)
      throw Error('Số bắt đầu phải là số nguyên từ 1 và không quá lớn.');
    return Number(value);
  }
  async function saveStream(directory, source, mode, signal, progress = () => {}, requestedNumber) {
    let writer, created = false, size = 0, name;
    try {
    const ext = extensionFor(source.type, mode);
    const number = requestedNumber === undefined ? await nextNumber(directory) : startNumber(requestedNumber); name = `${number}.${ext}`;
    // Never overwrite any existing entry, including a directory with this name.
    try { await directory.getFileHandle(name); throw Error('Tên file đã tồn tại. Hãy chọn thư mục riêng cho đợt này.'); }
    catch (e) { if (e.name !== 'NotFoundError') throw e; }
    signal?.throwIfAborted();

      const handle = await directory.getFileHandle(name, {create:true}); created = true;
      writer = await handle.createWritable();
      for (;;) {
        signal?.throwIfAborted();
        const {done, value} = await source.read();
        if (done) break;
        if (value?.byteLength) { await writer.write(value); size += value.byteLength; progress(size); }
      }
      signal?.throwIfAborted();
      if (!size) throw Error('File trả về rỗng.');
      await writer.close(); writer = null;
      return {name, number, size};
    } catch (e) {
      if (writer) await writer.abort().catch(() => {});
      // This entry was created by this attempt, never an existing user file.
      if (created) await directory.removeEntry(name).catch(() => {});
      throw e;
    } finally { await Promise.resolve(source.close?.()).catch(() => {}); }
  }
  const api = {startNumber, parsePrompts, isFlowProject, nextNumber, extensionFor, saveStream};
  root.CreatingFlowCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);