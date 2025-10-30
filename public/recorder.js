// Robust klientkod: MediaRecorder -> POST /api/transcribe -> fyller textarea med transkript
const micBtn = document.getElementById('mic');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const sendBtn = document.getElementById('sendPrompt');

let mediaRecorder = null;
let chunks = [];

function setStatus(text) { statusEl.textContent = text; }

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = handleStop;
    mediaRecorder.start();
    setStatus('Spelar in…');
    micBtn.textContent = 'Stoppa inspelning';
  } catch (err) {
    console.error('getUserMedia error', err);
    alert('Kunde inte få åtkomst till mikrofonen: ' + err.message);
    setStatus('Fel');
  }
}

async function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    setStatus('Stoppar och skickar…');
    micBtn.disabled = true;
  }
}

async function handleStop() {
  // skapa blob (webm/ogg beroende på browser)
  const blob = new Blob(chunks, { type: 'audio/webm' });
  try {
    // Bygg formdata
    const fd = new FormData();
    fd.append('file', blob, 'recording.webm');
    // POST till vår Worker/endpoint
    const resp = await fetch('/api/transcribe', { method: 'POST', body: fd });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Transcribe error', resp.status, text);
      alert('Transkribering misslyckades: ' + resp.status);
      setStatus('Fel vid transkribering');
      micBtn.disabled = false;
      micBtn.textContent = 'Starta inspelning';
      return;
    }
    const data = await resp.json();
    // OpenAI returnerar text i data.text eller data.transcript (beroende)
    const text = data.text || data.transcript || (data?.result && data.result[0] && data.result[0].text) || JSON.stringify(data);
    // Lägg in i textarea (append om något tidigare fanns)
    transcriptEl.value = (transcriptEl.value ? transcriptEl.value + '\n' : '') + text;
    setStatus('Inaktiv');
  } catch (err) {
    console.error('Upload/transcribe failed', err);
    alert('Fel vid uppladdning eller transkribering: ' + err.message);
    setStatus('Fel');
  } finally {
    micBtn.disabled = false;
    micBtn.textContent = 'Starta inspelning';
  }
}

// Klickhantering
micBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    startRecording();
  } else if (mediaRecorder.state === 'recording') {
    stopRecording();
  }
});

// Exempel: skicka transkriptet vidare till din prompt‑hantering
sendBtn.addEventListener('click', () => {
  const prompt = transcriptEl.value.trim();
  if (!prompt) return alert('Inget att skicka');
  // Lägg in din egen logik här för att använda prompten, t.ex. anropa din story‑API
  console.log('Skickar prompt:', prompt);
  // TODO: fetch('/api/generate', { method:'POST', body: JSON.stringify({ prompt })})
});
