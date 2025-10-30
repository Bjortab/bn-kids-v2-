// public/recorder.js
// Robust MediaRecorder-klient för BN: spelar in, begränsar till 60s, POST -> /api/transcribe
(() => {
  const micBtn = document.getElementById('mic');
  const cancelBtn = document.getElementById('cancel');
  const statusEl = document.getElementById('status');
  const transcriptEl = document.getElementById('transcript');
  const sendBtn = document.getElementById('sendPrompt');
  const clearBtn = document.getElementById('clear');

  let mediaRecorder = null;
  let chunks = [];
  let streamRef = null;
  let stopTimeout = null;
  const MAX_SECONDS = 60;

  function setStatus(s) { statusEl.textContent = s; }

  async function startRecording() {
    try {
      setStatus('Får åtkomst till mikrofon…');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef = stream;
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = onStopRecording;
      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error', e);
        setStatus('Fel vid inspelning');
        cleanupStream();
      };
      mediaRecorder.start();
      // stoppa automatiskt efter MAX_SECONDS
      stopTimeout = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, MAX_SECONDS * 1000);
      micBtn.textContent = 'Stoppa inspelning';
      cancelBtn.style.display = 'inline-block';
      setStatus('Spelar in… (max ' + MAX_SECONDS + 's)');
    } catch (err) {
      console.error('getUserMedia error', err);
      alert('Kunde inte få åtkomst till mikrofonen: ' + (err.message || err));
      setStatus('Fel: ingen åtkomst');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setStatus('Stoppar inspelning…');
      micBtn.disabled = true;
    }
  }

  function cancelRecording() {
    // Stoppa och släng data
    if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
    if (mediaRecorder) {
      try {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      } catch (e) {}
    }
    chunks = [];
    cleanupStream();
    setStatus('Avbröts');
    micBtn.textContent = 'Starta inspelning';
    micBtn.disabled = false;
    cancelBtn.style.display = 'none';
  }

  function cleanupStream() {
    if (streamRef) {
      streamRef.getTracks().forEach(t => t.stop());
      streamRef = null;
    }
    mediaRecorder = null;
  }

  async function onStopRecording() {
    if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
    setStatus('Skapar ljudfil…');
    const blob = new Blob(chunks, { type: 'audio/webm' });
    chunks = [];
    cleanupStream();

    // Enkel storlekskontroll
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (blob.size > maxBytes) {
      alert('Inspelningen är för stor (' + Math.round(blob.size/1024/1024) + ' MB). Försök kortare inspelning.');
      setStatus('Fel: fil för stor');
      micBtn.disabled = false;
      micBtn.textContent = 'Starta inspelning';
      cancelBtn.style.display = 'none';
      return;
    }

    // Skicka till /api/transcribe
    try {
      setStatus('Skickar ljud för transkribering…');
      const fd = new FormData();
      fd.append('file', blob, 'recording.webm');

      const resp = await fetch('/api/transcribe', {
        method: 'POST',
        body: fd
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error('Transcribe svar: ', resp.status, txt);
        alert('Transkribering misslyckades: ' + resp.status);
        setStatus('Fel vid transkribering');
        micBtn.disabled = false;
        micBtn.textContent = 'Starta inspelning';
        cancelBtn.style.display = 'none';
        return;
      }

      // Försök tolka JSON, annars text
      const contentType = resp.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await resp.json();
      } else {
        const txt = await resp.text();
        try { data = JSON.parse(txt); } catch (e) { data = { text: txt }; }
      }

      const text = data.text || data.transcript || (data?.result && data.result[0] && data.result[0].text) || '';
      if (text) {
        transcriptEl.value = (transcriptEl.value ? transcriptEl.value + '\n' : '') + text;
        setStatus('Klar');
      } else {
        setStatus('Klar (men inget transkript returned)');
      }
    } catch (err) {
      console.error('Upload/transcribe failed', err);
      alert('Fel vid uppladdning eller transkribering: ' + err.message);
      setStatus('Fel');
    } finally {
      micBtn.disabled = false;
      micBtn.textContent = 'Starta inspelning';
      cancelBtn.style.display = 'none';
    }
  }

  // Event listeners
  micBtn.addEventListener('click', () => {
    if (!mediaRecorder || (mediaRecorder && mediaRecorder.state === 'inactive')) {
      startRecording();
    } else if (mediaRecorder.state === 'recording') {
      stopRecording();
    }
  });

  cancelBtn.addEventListener('click', () => {
    cancelRecording();
  });

  sendBtn.addEventListener('click', () => {
    const prompt = (transcriptEl.value || '').trim();
    if (!prompt) return alert('Inget transkript att skicka.');
    // Anropa din prompt/generator-API här. Exempel:
    // fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt })})
    console.log('Skickar prompt (placeholder):', prompt);
    alert('Prompt skickas (placeholder). Implementera /api/generate för att använda den här prompten.');
  });

  clearBtn.addEventListener('click', () => {
    transcriptEl.value = '';
  });

  // Säkerhetsnotiser
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('Mikrofon ej tillgänglig i denna webbläsare.');
    micBtn.disabled = true;
  }
})();
