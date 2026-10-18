(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SYNC_KEYS = 'babylon_gemini_api_keys_sync_v1';
  const ACTIVE_KEY = 'babylon_gemini_active_key_index_v1';
  const LEGACY_KEY = 'babylon_gemini_api_key';
  const DEFAULT_KEYS = Object.freeze([]);
  const MAX_KEYS = 20;

  let keys = [];
  let activeIndex = 0;
  const health = new Map();
  let readyPromise = null;

  const localGet = (name) => new Promise((resolve) => {
    try { chrome.storage.local.get([name], (r) => resolve(chrome.runtime.lastError ? undefined : r?.[name])); }
    catch (_) { resolve(undefined); }
  });
  const localSet = (obj) => new Promise((resolve) => {
    try { chrome.storage.local.set(obj, () => resolve(!chrome.runtime.lastError)); }
    catch (_) { resolve(false); }
  });
  const syncGet = (name) => new Promise((resolve) => {
    try { chrome.storage.sync.get([name], (r) => resolve(chrome.runtime.lastError ? undefined : r?.[name])); }
    catch (_) { resolve(undefined); }
  });
  const syncSet = (obj) => new Promise((resolve) => {
    try { chrome.storage.sync.set(obj, () => resolve(!chrome.runtime.lastError)); }
    catch (_) { resolve(false); }
  });

  function sanitize(value) {
    const src = Array.isArray(value) ? value : [];
    const out = [];
    const seen = new Set();
    for (const item of src) {
      const key = String(item || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(key);
    }
    return out.slice(0, MAX_KEYS);
  }

  function mask(key) {
    const v = String(key || '').trim();
    if (!v) return '••••••';
    return `••••••••••••${v.slice(-6)}`;
  }

  function keyOrder() {
    if (!keys.length) return [];
    const start = Math.max(0, Math.min(activeIndex, keys.length - 1));
    return [...Array(keys.length).keys()].map((_, offset) => (start + offset) % keys.length);
  }

  async function persist() {
    keys = sanitize(keys);
    activeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, keys.length - 1)));
    const keyObj = { [SYNC_KEYS]: keys, [ACTIVE_KEY]: activeIndex };
    await Promise.all([syncSet(keyObj), localSet(keyObj)]);
    render();
    window.dispatchEvent(new CustomEvent('babylon-gemini-pool-changed', { detail: snapshot() }));
  }

  async function load() {
    const syncKeys = sanitize(await syncGet(SYNC_KEYS));
    const localKeys = sanitize(await localGet(SYNC_KEYS));
    const legacy = String(await localGet(LEGACY_KEY) || '').trim();
    // 1.42.58: 5 API mặc định được đóng gói trong BaByLon. Luôn merge để cài trên Chrome khác vẫn có sẵn.
    const incoming = sanitize([...DEFAULT_KEYS, ...syncKeys, ...localKeys, legacy]);
    keys = incoming;
    const syncIndex = Number(await syncGet(ACTIVE_KEY));
    const localIndex = Number(await localGet(ACTIVE_KEY));
    activeIndex = Number.isInteger(syncIndex) ? syncIndex : (Number.isInteger(localIndex) ? localIndex : 0);
    activeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, keys.length - 1)));
    await persist();
    return snapshot();
  }

  function snapshot() {
    return { keys:[...keys], activeIndex, order:keyOrder() };
  }

  function healthInfo(index) {
    return health.get(index) || { state:'unknown', label:'Chưa kiểm tra' };
  }

  function updateSummary() {
    const count = $('globalGeminiApiCount');
    const summary = $('globalGeminiApiSummary');
    const usable = [...health.values()].filter((x) => x.state === 'ok').length;
    const bad = [...health.values()].filter((x) => ['bad','quota'].includes(x.state)).length;
    if (count) count.textContent = `${keys.length} API`;
    if (summary) {
      if (!keys.length) summary.textContent = 'Chưa có API';
      else if (!health.size) summary.textContent = `API ${activeIndex + 1} đang ưu tiên`;
      else summary.textContent = `${usable} sẵn sàng${bad ? ` • ${bad} cần chú ý` : ''}`;
    }
    for (const id of ['globalGeminiTranslatorUsage','globalGeminiApproveUsage']) {
      const el=$(id); if (el) el.textContent = keys.length ? `${keys.length} API • tự dự phòng` : 'Chưa có API';
    }
    document.querySelectorAll('[data-gemini-shared-count]').forEach((el) => { el.textContent = `${keys.length} API`; });
  }

  function render() {
    updateSummary();
    const list = $('globalGeminiApiList');
    if (!list) return;
    if (!keys.length) {
      list.innerHTML = '<div class="gemini-api-empty">Chưa có Gemini API. Thêm API ở đây một lần để mọi chức năng AI cùng sử dụng.</div>';
      return;
    }
    list.innerHTML = keys.map((key,index) => {
      const h=healthInfo(index);
      return `<div class="gemini-api-item ${index===activeIndex?'is-active':''}" data-key-index="${index}">
        <div class="gemini-api-order">${index+1}</div>
        <div class="gemini-api-info">
          <strong>Gemini API ${index+1}${index===activeIndex?' • ĐANG ƯU TIÊN':''}</strong>
          <span>${mask(key)}</span>
        </div>
        <span class="gemini-api-health is-${h.state}">${h.label}</span>
        <button class="gemini-api-use" type="button" data-use="${index}" ${index===activeIndex?'disabled':''}>Ưu tiên</button>
        <button class="gemini-api-delete" type="button" data-delete="${index}" title="Xóa API này">✕</button>
      </div>`;
    }).join('');
  }

  async function addKey() {
    const input=$('globalGeminiNewKey');
    const key=String(input?.value || '').trim();
    if (!key) return setCenterMessage('Hãy dán Gemini API key cần thêm.','warn');
    if (keys.includes(key)) { if(input) input.value=''; return setCenterMessage('API này đã có trong kho chung.','warn'); }
    if (keys.length >= MAX_KEYS) return setCenterMessage(`Tối đa ${MAX_KEYS} Gemini API.`, 'warn');
    keys.push(key); if(input) input.value=''; health.clear(); await persist();
    setCenterMessage(`Đã lưu Gemini API ${keys.length}.`, 'ok');
  }

  async function removeKey(index) {
    index=Number(index); if(!Number.isInteger(index)||index<0||index>=keys.length) return;
    keys.splice(index,1); health.clear();
    if(activeIndex>=keys.length) activeIndex=Math.max(0,keys.length-1);
    await persist(); setCenterMessage(keys.length?'Đã xóa API.':'Kho API đang trống.','ok');
  }

  async function setActive(index) {
    if(!keys.length) return;
    activeIndex=Math.max(0,Math.min(Number(index)||0,keys.length-1));
    await persist(); setCenterMessage(`Đã ưu tiên Gemini API ${activeIndex+1}.`,'ok');
  }

  function setCenterMessage(text,type='') {
    const el=$('globalGeminiApiSummary'); if(!el) return;
    el.textContent=text; el.dataset.state=type;
  }

  async function testKey(key,index) {
    health.set(index,{state:'checking',label:'Đang kiểm tra…'}); render();
    try {
      const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers:{'x-goog-api-key':key} });
      if(res.ok) {
        const data=await res.json().catch(()=>({}));
        const usable=Array.isArray(data?.models) && data.models.some((m)=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent'));
        health.set(index,{state:usable?'ok':'bad',label:usable?'Sẵn sàng':'Không có model'});
      } else if(res.status===429) health.set(index,{state:'quota',label:'Giới hạn quota'});
      else if(res.status===401||res.status===403) health.set(index,{state:'bad',label:'Lỗi quyền/API'});
      else health.set(index,{state:'bad',label:`Lỗi ${res.status}`});
    } catch (_) { health.set(index,{state:'bad',label:'Lỗi kết nối'}); }
    render();
  }

  async function testAll() {
    if(!keys.length) return setCenterMessage('Chưa có API để kiểm tra.','warn');
    const btn=$('globalGeminiTestAllBtn'); if(btn){btn.disabled=true;btn.textContent='⏳ ĐANG KIỂM TRA…';}
    health.clear(); render();
    for(let i=0;i<keys.length;i+=1) await testKey(keys[i],i);
    if(btn){btn.disabled=false;btn.textContent='✓ KIỂM TRA TẤT CẢ';}
    updateSummary();
  }

  function toggleInput() {
    const input=$('globalGeminiNewKey'); const btn=$('globalGeminiNewKeyToggle'); if(!input) return;
    input.type=input.type==='password'?'text':'password'; if(btn) btn.textContent=input.type==='password'?'👁':'🙈';
  }

  function wire() {
    $('globalGeminiAddKeyBtn')?.addEventListener('click', addKey);
    $('globalGeminiNewKeyToggle')?.addEventListener('click', toggleInput);
    $('globalGeminiNewKey')?.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){e.preventDefault();addKey();} });
    $('globalGeminiTestAllBtn')?.addEventListener('click', testAll);
    $('globalGeminiApiList')?.addEventListener('click',(e)=>{
      const use=e.target.closest('[data-use]'); const del=e.target.closest('[data-delete]');
      if(use) return setActive(Number(use.dataset.use));
      if(del) return removeKey(Number(del.dataset.delete));
    });
  }

  chrome.storage.onChanged.addListener((changes,areaName)=>{
    if(!['sync','local'].includes(areaName)) return;
    let changed=false;
    if(changes[SYNC_KEYS]) { keys=sanitize(changes[SYNC_KEYS].newValue); changed=true; }
    if(changes[ACTIVE_KEY]) { const next=Number(changes[ACTIVE_KEY].newValue); if(Number.isInteger(next)){activeIndex=Math.max(0,Math.min(next,Math.max(0,keys.length-1)));changed=true;} }
    if(changed){ health.clear(); render(); window.dispatchEvent(new CustomEvent('babylon-gemini-pool-changed',{detail:snapshot()})); }
  });

  window.BaByLonGeminiPool = {
    load:()=>readyPromise || (readyPromise=load()),
    snapshot,
    getKeys:()=>[...keys],
    getActiveIndex:()=>activeIndex,
    getOrder:keyOrder,
    setActive,
    openCenter:()=>{ const outer=$('globalAiCenter');if(outer)outer.open=true; const d=$('globalGeminiApiCenter'); if(d){d.open=true; d.scrollIntoView({behavior:'smooth',block:'start'});} }
  };

  wire();
  readyPromise=load();
})();
