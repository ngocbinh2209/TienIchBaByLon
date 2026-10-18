/* BaByLon 1.43.16 · shared AI providers, OpenRouter restricted to free models */
(() => {
'use strict';
const $=id=>document.getElementById(id),STORE='babylon_ai_hub_v1';
let cfg={provider:'auto',keys:{groq:[],openrouter:[]}},ready;
const cache=new Map(),urls={groq:'https://api.groq.com/openai/v1',openrouter:'https://openrouter.ai/api/v1'};
function sanitize(v){return {provider:['auto','groq','gemini','openrouter'].includes(v?.provider)?v.provider:'auto',keys:{groq:(Array.isArray(v?.keys?.groq)?v.keys.groq:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,5),openrouter:(Array.isArray(v?.keys?.openrouter)?v.keys.openrouter:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,5)}};}
async function load(){try{cfg=sanitize((await chrome.storage.local.get(STORE))[STORE]);}catch{}render();return cfg;}
function ensure(){return ready||(ready=load());}
async function save(){await chrome.storage.local.set({[STORE]:cfg});render();window.dispatchEvent(new Event('babylon-ai-hub-changed'));}
function msg(s,error=false){const el=$('bahStatus');if(el){el.textContent=s;el.dataset.error=error?'true':'false';}}
function render(){if($('bahProvider'))$('bahProvider').value=cfg.provider;if($('bahKeyCount'))$('bahKeyCount').textContent=`${cfg.keys.groq.length+cfg.keys.openrouter.length} API ngoài`;
for(const p of ['groq','openrouter']){const el=$(`bah${p}Keys`);if(!el)continue;el.replaceChildren();if(!cfg.keys[p].length){const note=document.createElement('small');note.textContent='Chưa có API key';el.append(note);}
cfg.keys[p].forEach((key,i)=>{const row=document.createElement('div');row.className='bah-key-row';const span=document.createElement('span');span.textContent=`API ${i+1} · •••••${key.slice(-5)}`;const del=document.createElement('button');del.type='button';del.textContent='Xóa';del.addEventListener('click',async()=>{cfg.keys[p].splice(i,1);await save();msg('Đã xóa API key.');});row.append(span,del);el.append(row);});}}
function apiError(res,data,p){const e=new Error(`${p}: ${String(data?.error?.message||data?.message||`HTTP ${res.status}`).slice(0,300)}`);e.status=res.status;return e;}
async function getModels(p,key){const ck=p+':'+key;const old=cache.get(ck);if(old&&old.time>Date.now()-20*60*1000)return old.models;
const url=p==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100':`${urls[p]}/models`;
const headers=p==='gemini'?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`};
const res=await fetch(url,{headers,cache:'no-store'}),data=await res.json().catch(()=>({}));if(!res.ok)throw apiError(res,data,p);
let models=p==='gemini'?(data.models||[]).filter(x=>x.supportedGenerationMethods?.includes('generateContent')).map(x=>String(x.name||'').replace(/^models\//,'')):(data.data||[]).map(x=>x.id);
models=models.filter(x=>typeof x==='string');
if(p==='gemini')models=models.filter(x=>/^gemini-/i.test(x)&&!/image|tts|audio|live|embedding/i.test(x)).sort((a,b)=>rank(a)-rank(b)||b.localeCompare(a,undefined,{numeric:true}));
if(p==='groq')models=models.filter(x=>!/whisper|tts|guard|vision|playai|orpheus|distil/i.test(x)).sort((a,b)=>rank(a)-rank(b));
if(p==='openrouter')models=models.filter(x=>x.endsWith(':free')).sort((a,b)=>rank(a)-rank(b));
if(!models.length)throw Error(`Không có model văn bản ${p==='openrouter'?'miễn phí ':''}phù hợp trên ${p}.`);
cache.set(ck,{time:Date.now(),models});return models;}
function rank(x){return /flash-lite|gpt-oss-20b|mini|small/i.test(x)?0:/flash|llama-3\.3-70b|8b/i.test(x)?1:/gpt-oss-120b/i.test(x)?2:5;}
async function openai(p,key,model,prompt,opts){
const streaming=typeof opts.onPartial==='function';const res=await fetch(`${urls[p]}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],temperature:.3,max_tokens:opts.maxTokens||1400,stream:streaming}),signal:opts.signal,cache:'no-store'});
if(!res.ok)throw apiError(res,await res.json().catch(()=>({})),p);
if(!streaming){const data=await res.json();const answer=data.choices?.[0]?.message?.content;if(!answer)throw Error('AI trả kết quả trống.');return String(answer);}
if(!res.body)throw Error('API không hỗ trợ streaming.');const reader=res.body.getReader(),decoder=new TextDecoder();let pending='',answer='';
const parse=event=>{const raw=event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('');if(!raw||raw==='[DONE]')return;let obj;try{obj=JSON.parse(raw);}catch{return;}if(obj.error)throw Error(obj.error.message||'Streaming error');const delta=obj.choices?.[0]?.delta?.content;if(typeof delta==='string'){answer+=delta;opts.onPartial(answer);}};
while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');let i;while((i=pending.indexOf('\n\n'))>=0){parse(pending.slice(0,i));pending=pending.slice(i+2);}}
pending+=decoder.decode();if(pending.trim())parse(pending);if(!answer.trim())throw Error('AI trả kết quả trống.');return answer.trim();}
async function gemini(key,model,prompt,opts){const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.3,maxOutputTokens:opts.maxTokens||1400}}),signal:opts.signal,cache:'no-store'});
const data=await res.json().catch(()=>({}));if(!res.ok)throw apiError(res,data,'Gemini');const answer=(data.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('').trim();if(!answer)throw Error('Gemini trả kết quả trống.');opts.onPartial?.(answer);return answer;}
async function run(prompt,opts={}){await ensure();const chosen=opts.provider||cfg.provider,providers=chosen==='auto'?['groq','gemini','openrouter']:[chosen];const failures=[];
for(const p of providers){if(p==='gemini')await window.BaByLonGeminiPool?.load();const keys=p==='gemini'?(window.BaByLonGeminiPool?.getKeys()||[]):(cfg.keys[p]||[]);if(!keys.length){failures.push(`${p}: chưa có API key`);continue;}
for(const key of keys){let models;try{models=await getModels(p,key);}catch(e){failures.push(e.message);continue;}
for(const model of models.slice(0,3)){try{const text=p==='gemini'?await gemini(key,model,prompt,opts):await openai(p,key,model,prompt,opts);return {text,provider:p,model};}
catch(e){if(e.name==='AbortError')throw e;failures.push(`${p}/${model}: ${e.message}`);if([400,413,422].includes(e.status)&&!/context|token|length|too large/i.test(e.message))throw e;opts.onPartial?.('');}}}}
throw Error(`Không có AI khả dụng. ${failures.slice(0,5).join(' | ')}`);}
async function transcribe(file){await ensure();const key=cfg.keys.groq[0];if(!key)throw Error('Hãy thêm Groq API key trước.');if(!file||file.size>20*1024*1024)throw Error('Tệp âm thanh phải nhỏ hơn 20 MB.');const form=new FormData();form.append('file',file,file.name);form.append('model','whisper-large-v3-turbo');form.append('response_format','json');const res=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form});const data=await res.json().catch(()=>({}));if(!res.ok)throw apiError(res,data,'Groq Whisper');if(!data.text)throw Error('Không có bản chép lời.');return data.text;}
async function transcribeTimed(file){
await ensure();const key=cfg.keys.groq[0];if(!key)throw Error('Hãy thêm Groq API key trong Trung tâm AI.');
if(!file||file.size>20*1024*1024)throw Error('Tệp phải nhỏ hơn 20 MB.');
const form=new FormData();form.append('file',file,file.name);form.append('model','whisper-large-v3-turbo');form.append('response_format','verbose_json');
const res=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form});
const data=await res.json().catch(()=>({}));if(!res.ok)throw apiError(res,data,'Groq Whisper');
const events=(data.segments||[]).map(s=>({start:Number(s.start),duration:Number(s.end)-Number(s.start),text:String(s.text||'').trim()})).filter(s=>Number.isFinite(s.start)&&s.duration>0&&s.text);
return {events,language:data.language||'',text:data.text||''};
}
function wire(){
$('bahProvider')?.addEventListener('change',async e=>{cfg.provider=e.target.value;await save();msg('Đã cập nhật nhà cung cấp AI mặc định.');});
for(const p of ['groq','openrouter']){$(`bah${p}Add`)?.addEventListener('click',async()=>{const el=$(`bah${p}Input`),key=String(el.value||'').trim();if(!key)return msg('Hãy nhập API key.',true);if(cfg.keys[p].includes(key))return msg('API key đã tồn tại.',true);if(cfg.keys[p].length>=5)return msg('Tối đa 5 key mỗi nhà cung cấp.',true);cfg.keys[p].push(key);el.value='';await save();msg(`Đã lưu API key ${p} trên thiết bị.`);});
$(`bah${p}Test`)?.addEventListener('click',async()=>{if(!cfg.keys[p].length)return msg('Chưa có API key.',true);msg(`Đang kiểm tra ${p}…`);try{const models=await getModels(p,cfg.keys[p][0]);msg(`${p}: kết nối thành công · ${models.length} model phù hợp.`);}catch(e){msg(e.message,true);}});}}
window.BaByLonAIHub={ready:ensure,getProvider:()=>cfg.provider,run,transcribe,transcribeTimed,openCenter:()=>{const d=$('globalAiCenter');if(d){d.open=true;d.scrollIntoView({block:'start',behavior:'smooth'});}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wire();ensure();},{once:true});else{wire();ensure();}
})();
