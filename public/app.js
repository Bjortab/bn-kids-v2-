// app.js – BN Kids v2 frontend
const el = (id) => document.getElementById(id);

const age = el('age');
const hero = el('hero');
const promptBox = el('prompt');

const voice = el('voice');
const rate = el('rate');
const pitch = el('pitch');
const gain = el('gain');
const pitchVal = el('pitchVal');
const gainVal = el('gainVal');

const btnSpeak = el('btnSpeak');
const btnMake  = el('btnMake');
const btnPlay  = el('btnPlay');
const btnTest  = el('btnTest');

const spin  = el('spin');
const status = el('status');
const out = el('out');
const audio = el('audio');

let lastAudioBlob = null;
let currentText = "";

// UI helpers
function working(on, msg="Arbetar …") {
  spin.style.display = on ? 'inline-flex' : 'none';
  btnMake.disabled = on;
  btnTest.disabled = on;
  btnSpeak.disabled = on;
  status.textContent = on ? msg : "";
}

function showError(e) {
  console.error(e);
  status.innerHTML = `<span style="color:#ff8a8a">Fel: ${typeof e==='string'?e:(e.message||'okänt fel')}</span>`;
}

// live labels
pitch.addEventListener('input', () => pitchVal.textContent = `${pitch.value} st`);
gain.addEventListener('input', () => gainVal.textContent = `${gain.value} dB`);

// ---- SPEAK PLACEHOLDER (tills vi kopplar STT) ----
btnSpeak.addEventListener('click', () => {
  alert('Tala in kommer strax (vi kopplar Google STT). Skriv gärna gnistan så länge ✨');
});

// ---- TESTA RÖST ----
btnTest.addEventListener('click', async () => {
  try {
    working(true, 'Skapar teströst …');
    const body = {
      text: "Hej! Jag är din högläsningsröst i BN Kids.",
      voice: voice.value || undefined,
      rate: parseFloat(rate.value),
      pitch: parseFloat(pitch.value),
      gainDb: parseFloat(gain.value)
    };
    const res = await fetch('/tts', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const t = await res.text();
      throw new Error(`TTS ${res.status}: ${t}`);
    }
    const blob = await res.blob();
    lastAudioBlob = blob;
    audio.src = URL.createObjectURL(blob);
    audio.play().catch(()=>{});
    btnPlay.disabled = false;
  } catch (e) {
    showError(e);
  } finally {
    working(false);
  }
});

// ---- SKAPA SAGA + UPPLÄSNING ----
btnMake.addEventListener('click', async () => {
  try {
    working(true, 'Skapar saga …');
    status.textContent = 'Skapar saga …';

    // 1) Generera saga
    const storyRes = await fetch('/api/generate_story', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({
        age: age.value,
        hero: hero.value.trim() || null,
        prompt: promptBox.value.trim() || null
      })
    });
    if(!storyRes.ok){
      const t = await storyRes.text();
      throw new Error(`Story ${storyRes.status}: ${t}`);
    }
    const { ok, story, error } = await storyRes.json();
    if(!ok) throw new Error(error || 'Kunde inte skapa berättelse');

    currentText = story;
    out.textContent = story;

    // 2) TTS (Google)
    status.textContent = 'Skapar uppläsning …';
    const ttsRes = await fetch('/tts', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({
        text: story,
        voice: voice.value || undefined,
        rate: parseFloat(rate.value),
        pitch: parseFloat(pitch.value),
        gainDb: parseFloat(gain.value)
      })
    });
    if(!ttsRes.ok){
      const t = await ttsRes.text();
      throw new Error(`TTS ${ttsRes.status}: ${t}`);
    }
    const blob = await ttsRes.blob();
    lastAudioBlob = blob;
    audio.src = URL.createObjectURL(blob);
    await audio.play().catch(()=>{});
    btnPlay.disabled = false;
    status.textContent = 'Klart!';
  } catch (e) {
    showError(e);
  } finally {
    working(false);
  }
});

// ---- SPELA IGEN ----
btnPlay.addEventListener('click', () => {
  if(lastAudioBlob){
    audio.play().catch(()=>{});
  }
});
