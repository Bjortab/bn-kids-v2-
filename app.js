(() => {
  const $ = s => document.querySelector(s);
  const childName = $('#childName');
  const ageRange  = $('#ageRange');
  const promptEl  = $('#prompt');
  const promptWrap= $('#promptWrap');
  const btnGen    = $('#btnGenerate');
  const statusEl  = $('#status');
  const resultTxt = $('#resultText');
  const resultAud = $('#resultAudio');
  const ttsSpin   = $('#ttsSpinner');
  const cacheWrap = $('#cacheWrap');
  const cacheBar  = $('#cacheBar');
  const cacheText = $('#cacheText');
  const storyImgs = $('#storyImages');

  let busy = false;
  const setBusy = (b,msg='')=>{
    busy=b; btnGen.disabled=b; setStatus(msg);
    ttsSpin.style.display = b ? 'inline-block' : 'none';
  };
  const setStatus=(m,t='')=>{
    statusEl.textContent=m||''; statusEl.style.color=t==='error'?'#b00':t==='ok'?'#070':'#222';
  };
  const updateCacheMeter=(hits,total)=>{
    const ratio = total>0 ? hits/total : 0;
    const pct = Math.round(ratio*100);
    cacheBar.style.width = pct+'%';
    cacheText.textContent = `Återanvänt: ${pct}%`;
    cacheWrap.style.display = 'block';
  };

  ageRange.addEventListener('change',()=>{
    const val = ageRange.value;
    promptWrap.style.display = (val==='1-2') ? 'none':'block';
  });

  btnGen.addEventListener('click', async ()=>{
    if(busy) return;
    const age = ageRange.value;
    const payload = {
      childName: childName.value.trim(),
      ageRange: age,
      prompt: promptEl.value.trim()
    };

    resultTxt.textContent=''; resultAud.hidden=true; storyImgs.innerHTML='';
    setBusy(true,'Skapar saga…');

    try {
      const res = await fetch('/api/generate_story', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if(data.story) resultTxt.textContent=data.story;
      if(data.images) data.images.forEach(i=>{
        const img=document.createElement('img');
        img.src=i.url; img.alt=i.tags?.join(', ')||'';
        storyImgs.appendChild(img);
      });

      setStatus('Skapar uppläsning…');
      const resTTS = await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:data.story})});
      if(!resTTS.ok) throw new Error(await resTTS.text());
      const hits=parseInt(resTTS.headers.get('x-tts-hits')||'0',10);
      const total=parseInt(resTTS.headers.get('x-tts-total')||'0',10);
      if(!Number.isNaN(total)) updateCacheMeter(hits,total);
      const blob=await resTTS.blob(); const url=URL.createObjectURL(blob);
      resultAud.src=url; resultAud.hidden=false; await resultAud.play();
      setStatus('Klar!','ok');
    }catch(e){ setStatus(e.message,'error'); }
    finally{ setBusy(false); }
  });
})();
