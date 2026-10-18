/* BaByLon Universal Captions · read accessible text tracks, never bypass DRM */
(() => {
  'use strict';
  const stamp=t=>{
    const m=String(t).trim().replace(',', '.').match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/);
    if(!m)return null;
    return (Number(m[1]||0)*3600)+(Number(m[2])*60)+Number(m[3])+Number((m[4]||'').padEnd(3,'0'))/1000;
  };
  const decode=s=>String(s).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
  function parse(text){
    const source=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const rows=[];
    for(const block of source.split(/\n\s*\n/)){
      const lines=block.split('\n');const i=lines.findIndex(line=>/-->/.test(line));
      if(i<0)continue;
      const parts=lines[i].split('-->');const start=stamp(parts[0]),end=stamp(parts[1]);
      if(start===null||end===null||end<=start)continue;
      const body=decode(lines.slice(i+1).join(' ').replace(/<v\s+[^>]*>/gi,''));
      if(body)rows.push({start,duration:end-start,text:body});
    }
    return rows.slice(0,15000).sort((a,b)=>a.start-b.start);
  }
  async function read(tabId){
    // The injected function is self-contained, including when executed in cross-origin frames.
    const frameReader=async()=>{
      const videos=[...document.querySelectorAll('video')];
      const result={tracks:[],events:[],videos:videos.length,frame:location.href};
      for(const video of videos){
        for(const track of [...video.textTracks]){
          try{
            if(track.mode==='disabled')track.mode='hidden';
            await new Promise(resolve=>setTimeout(resolve,200));
            const cues=[...(track.cues||[])].slice(0,15000);
            const events=cues.map(c=>({start:c.startTime,duration:c.endTime-c.startTime,text:String(c.text||'').replace(/<[^>]*>/g,'').trim()})).filter(c=>c.text&&c.duration>0);
            if(events.length>result.events.length){result.events=events;result.language=track.language||'';result.source='HTML5 textTracks';}
          }catch{}
        }
        for(const track of video.querySelectorAll('track[src]')){
          try{
            const url=new URL(track.getAttribute('src'),document.baseURI);
            if(['http:','https:'].includes(url.protocol))result.tracks.push({url:url.href,lang:track.srclang||''});
            if(url.protocol==='blob:'){
              const r=await fetch(url.href);if(r.ok){const text=await r.text();if(text.length<2e6)result.blobTexts=(result.blobTexts||[]).concat([{text,lang:track.srclang||''}]);}
            }
          }catch{}
        }
      }
      return result;
    };
    let frames=[];
    try{frames=await chrome.scripting.executeScript({target:{tabId,allFrames:true},world:'MAIN',func:frameReader});}
    catch(e){throw Error('Không thể truy cập trình phát trên trang này: '+(e.message||e));}
    const candidates=frames.map(f=>f.result).filter(Boolean);
    const best=candidates.filter(c=>c.events?.length).sort((a,b)=>b.events.length-a.events.length)[0];
    if(best)return {events:best.events,language:best.language,source:best.source};
    for(const frame of candidates){
      for(const blob of frame.blobTexts||[]){const events=parse(blob.text);if(events.length)return {events,language:blob.lang,source:'Phụ đề VTT/SRT nhúng'};}
      for(const track of frame.tracks||[]){
        try{
          const u=new URL(track.url);
          if(!['https:','http:'].includes(u.protocol))continue;
          const response=await fetch(u.href,{credentials:'omit',cache:'no-store'});
          if(!response.ok||Number(response.headers.get('content-length')||0)>2e6)continue;
          const text=await response.text();if(text.length>2e6)continue;
          const events=parse(text);if(events.length)return {events,language:track.lang,source:'Phụ đề SRT/VTT của website'};
        }catch{}
      }
    }
    return {error:'Trang này không cung cấp phụ đề HTML5/VTT/SRT có thể đọc. Có thể tải tệp phụ đề hoặc chép lời từ tệp âm thanh.'};
  }
  window.BaByLonUniversalCaptions={parse,read};
})();
