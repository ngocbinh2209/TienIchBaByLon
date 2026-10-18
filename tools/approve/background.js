/* Facebook group auto moderator • BaByLon 1.42.77 Gemini shared API pool */
(() => {
const GEMINI_KEYS_STORAGE = 'babylon_gemini_api_keys_sync_v1';
const GEMINI_ACTIVE_STORAGE = 'babylon_gemini_active_key_index_v1';
const GEMINI_LEGACY_STORAGE = 'babylon_gemini_api_key';
const DEFAULT_GEMINI_API_KEYS = [];
const MODERATION_MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro'
];

function sanitizeGeminiKeys(value) {
  const raw = Array.isArray(value) ? value : [];
  const out=[]; const seen=new Set();
  for (const item of raw) { const key=String(item||'').trim(); if(!key||seen.has(key)) continue; seen.add(key); out.push(key); }
  return out.slice(0,20);
}

async function storageGet(area, keys) {
  return new Promise((resolve)=>{ try { chrome.storage[area].get(keys,(r)=>resolve(chrome.runtime.lastError?{}:(r||{}))); } catch(_){ resolve({}); } });
}
async function storageSetBoth(obj) {
  await Promise.all([
    new Promise((resolve)=>{ try{chrome.storage.sync.set(obj,()=>resolve());}catch(_){resolve();} }),
    new Promise((resolve)=>{ try{chrome.storage.local.set(obj,()=>resolve());}catch(_){resolve();} })
  ]);
}

async function getSharedGeminiPool() {
  const sync=await storageGet('sync',[GEMINI_KEYS_STORAGE,GEMINI_ACTIVE_STORAGE]);
  const local=await storageGet('local',[GEMINI_KEYS_STORAGE,GEMINI_ACTIVE_STORAGE,GEMINI_LEGACY_STORAGE]);
  const syncKeys=sanitizeGeminiKeys(sync[GEMINI_KEYS_STORAGE]);
  const localKeys=sanitizeGeminiKeys(local[GEMINI_KEYS_STORAGE]);
  const legacy=String(local[GEMINI_LEGACY_STORAGE]||'').trim();
  let keys=sanitizeGeminiKeys([...DEFAULT_GEMINI_API_KEYS,...syncKeys,...localKeys,legacy]);
  let active=Number(sync[GEMINI_ACTIVE_STORAGE]);
  if(!Number.isInteger(active)) active=Number(local[GEMINI_ACTIVE_STORAGE]);
  if(!Number.isInteger(active)) active=0;
  active=Math.max(0,Math.min(active,Math.max(0,keys.length-1)));
  if(keys.length) await storageSetBoth({[GEMINI_KEYS_STORAGE]:keys,[GEMINI_ACTIVE_STORAGE]:active});
  return {keys,active};
}

function safeParseJson(value) {
  try { return JSON.parse(value); }
  catch (_) {
    const match=String(value||'').match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if(match) { try{return JSON.parse(match[0]);}catch(__){} }
    return null;
  }
}

async function listGenerateModels(apiKey) {
  try {
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':apiKey}});
    if(!response.ok) return [];
    const data=await response.json();
    return (Array.isArray(data?.models)?data.models:[])
      .filter((m)=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent'))
      .map((m)=>String(m.name||'').replace(/^models\//,''))
      .filter(Boolean);
  } catch(_) { return []; }
}

async function resolveModerationModels(apiKey) {
  const available=await listGenerateModels(apiKey);
  if(!available.length) return [...MODERATION_MODEL_PRIORITY];
  const out=[];
  for(const model of MODERATION_MODEL_PRIORITY) if(available.includes(model)) out.push(model);
  for(const model of available) if(/flash/i.test(model)&&!out.includes(model)) out.push(model);
  for(const model of available) if(/pro/i.test(model)&&!out.includes(model)) out.push(model);
  for(const model of available) if(!out.includes(model)) out.push(model);
  return out.slice(0,10);
}

function extractGeminiText(data) {
  const parts=data?.candidates?.[0]?.content?.parts;
  if(!Array.isArray(parts)) return '';
  return parts.map((p)=>typeof p?.text==='string'?p.text:'').join('').trim();
}

async function callGeminiWithPool(prompt) {
  const {keys,active}=await getSharedGeminiPool();
  if(!keys.length) throw new Error('Chưa có Gemini API trong Trung tâm API chung của BaByLon.');
  const order=[...Array(keys.length).keys()].map((_,offset)=>(active+offset)%keys.length);
  let lastError=null;

  for(const keyIndex of order) {
    const apiKey=keys[keyIndex];
    const models=await resolveModerationModels(apiKey);
    for(const model of models) {
      try {
        const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          body:JSON.stringify({
            contents:[{role:'user',parts:[{text:prompt}]}],
            generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:3000}
          })
        });
        if(!response.ok) {
          const text=await response.text().catch(()=> '');
          const err=new Error(`Gemini ${response.status}${text?`: ${text.slice(0,240)}`:''}`);
          err.status=response.status; err.model=model; throw err;
        }
        const data=await response.json();
        const content=extractGeminiText(data);
        if(!content) throw new Error(`Gemini ${model} không trả nội dung.`);
        if(keyIndex!==active) await storageSetBoth({[GEMINI_ACTIVE_STORAGE]:keyIndex});
        return {content,model,keyIndex};
      } catch(error) {
        lastError=error;
        const status=Number(error?.status||0);
        if(status===401||status===403) break;      // key lỗi quyền -> API kế tiếp
        if(status===429) continue;                 // model hết quota -> thử model khác, rồi key khác
        if(status===404||status===400) continue;   // model không dùng được -> model khác
        continue;
      }
    }
  }
  throw lastError || new Error('Không còn Gemini API khả dụng trong kho chung.');
}

function buildAiPrompt(posts) {
  const header = `Bạn là trợ lý kiểm duyệt cho Facebook Group chuyên TUYỂN NGƯỜI và TÌM VIỆC tại Việt Nam.
Quy tắc:
- APPROVE: người đăng đang tìm việc/ứng tuyển; ưu tiên duyệt.
- APPROVE: tin tuyển nhân viên/tuyển lao động/phục vụ/bán hàng/sale/shipper/thời vụ/part-time/full-time nếu thực sự là việc làm. Từ "sale", "inbox", "TikTok" một mình KHÔNG phải lý do từ chối.
- REJECT NGAY: bài được chia sẻ/repost từ Facebook Group khác; không cần kiểm tra nội dung hay thông tin khác.
- REJECT: quảng cáo bán sản phẩm/dịch vụ không liên quan việc làm; vay tiền/giải ngân/đa cấp/scam/cá cược hoặc spam rõ ràng.
- REVIEW: chưa chắc có liên quan việc làm; không tự REJECT chỉ vì thiếu thông tin.
- NEED_INFO: chắc chắn là bài việc làm nhưng cần quản trị viên xem thêm.
Chỉ trả về mảng JSON [{"id": số, "decision": "APPROVE"|"NEED_INFO"|"REJECT"|"REVIEW", "reason": "..."}]. Không thêm nội dung ngoài JSON.`;
  const postsText=posts.map((item)=>`POST_ID:${item.id}\n${item.text}`).join('\n\n---\n\n');
  return `${header}\n\nDưới đây là các bài đăng cần phân loại:\n\n${postsText}`;
}


// Optional multi-AI moderation engine. Automatic mode retains Gemini's existing
// moderation behavior; selecting Groq/OpenRouter explicitly enables these APIs.
async function callSelectedModerationAI(prompt){
  const saved=(await chrome.storage.local.get('babylon_ai_hub_v1')).babylon_ai_hub_v1||{};
  const provider=saved.provider;
  if(!['groq','openrouter'].includes(provider))return callGeminiWithPool(prompt);
  const keys=Array.isArray(saved.keys?.[provider])?saved.keys[provider]:[];
  if(!keys.length)throw Error(`Chưa có API key ${provider} trong Trung tâm AI BaByLon.`);
  const base=provider==='groq'?'https://api.groq.com/openai/v1':'https://openrouter.ai/api/v1';
  let lastError;
  for(const key of keys){
    try{
      const listRes=await fetch(`${base}/models`,{headers:{Authorization:`Bearer ${key}`}});
      const list=await listRes.json().catch(()=>({}));
      if(!listRes.ok)throw Error(`${provider} không lấy được danh sách model (HTTP ${listRes.status}).`);
      let models=(list.data||[]).map(m=>m.id).filter(x=>typeof x==='string');
      if(provider==='openrouter')models=models.filter(x=>x.endsWith(':free'));
      else models=models.filter(x=>!/whisper|tts|guard|vision|playai|orpheus|distil/i.test(x));
      models.sort((a,b)=>Number(/20b|flash|mini|8b/i.test(b))-Number(/20b|flash|mini|8b/i.test(a)));
      for(const model of models.slice(0,3)){
        const response=await fetch(`${base}/chat/completions`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:0,max_tokens:3000,stream:false})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok){lastError=Error(`${provider}/${model}: ${data.error?.message||response.status}`);continue;}
        const content=String(data.choices?.[0]?.message?.content||'').trim();
        if(content)return {content,model:`${provider}/${model}`,keyIndex:0};
      }
    }catch(e){lastError=e;}
  }
  throw lastError||Error(`${provider} không trả kết quả kiểm duyệt.`);
}

async function classifyPosts(posts) {
  if(!Array.isArray(posts)||!posts.length) return {results:[]};
  const {content,model,keyIndex}=await callSelectedModerationAI(buildAiPrompt(posts));
  const parsed=safeParseJson(content);
  if(!Array.isArray(parsed)) throw new Error('AI trả JSON kiểm duyệt không hợp lệ; chưa thực hiện duyệt bài.');
  const normalized=parsed.map((item)=>({
    id:item.id,
    decision:String(item.decision||'').trim().toUpperCase(),
    reason:item.reason?String(item.reason).trim():''
  }));
  return {results:normalized,geminiModel:model,geminiApiIndex:keyIndex};
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message.action==='classifyPosts') {
    classifyPosts(message.posts)
      .then((result)=>sendResponse(result))
      .catch((error)=>sendResponse({error:error.message||String(error)}));
    return true;
  }
  return false;
});
})();
