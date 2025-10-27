// === Konfigurera så det matchar classic ===
const STORY_URL = "/api/story";   // ÄNDRA vid behov: "/story"
const TTS_URL   = "/api/tts_vertex"; // pekar på vår nya Google-TTS endpoint

// === Hjälpare ===
const $ = (id) => document.getElementById(id);
const showSpinner = (b) => { $('spinner').style.display = b ? 'flex' : 'none'; };
const showErr = (msg) => { const e=$('error'); e.style.display='block'; e.textContent=msg; };
const clearErr = () => { const e=$('error'); e.style.display='none'; e.textContent=''; };
const getForm = () => ({
  age: $('age').value,
  hero: $('hero').value.trim(),
  prompt: $('prompt').value.trim(),
  voice: $('voice').value,
  rate: parseFloat($('rate').value || "1.0"),
  pitch: parseFloat($('pitch').value || "0")
});

// Render story
function renderStory(text){
  $('story').classList.remove('muted');
  $('story').textContent = text || '';
}

// Play audio blob
async function playBlob(blob){
  const url = URL.createObjectURL(blob);
  $('audio').src = url;
  $('audio').play().catch(()=>{ /* user gesture */ });
}

async function createStory(payload){
  clearErr(); showSpinner(true);
  try {
    const r = await fetch(STORY_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    renderStory(data.story || data.text || "");
    return (data.story || data.text || "");
  } catch (e) {
    showErr("Kunde inte skapa saga:\n" + e.message);
    return "";
  } finally {
    showSpinner(false);
  }
}

async function speak(text, opts){
  if(!text) { showErr("Ingen text att läsa upp."); return; }
  clearErr(); showSpinner(true);
  try {
    const r = await fetch(TTS_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        text,
        voice: opts.voice,
        speakingRate: opts.rate,
        pitch: opts.pitch,
        audioEncoding: "MP3"
      })
    });
    if(!r.ok){
      let t=""; try{t=await r.text();}catch{}
      throw new Error(t || `HTTP ${r.status}`);
    }
    const blob = await r.blob();
    await playBlob(blob);
  } catch (e){
    showErr("TTS fel:\n" + e.message);
  } finally {
    showSpinner(false);
  }
}

// === Knappar ===
$('btnCreateRead').onclick = async () => {
  const f = getForm();
  const story = await createStory({ prompt: f.prompt, age: f.age, hero: f.hero });
  if (story) await speak(story, f);
};

$('btnSpeakOnly').onclick = async () => {
  const f = getForm();
  const story = $('story').textContent.trim();
  await speak(story, f);
};

$('btnTestVoice').onclick = async () => {
  const f = getForm();
  await speak("Detta är ett röstprov i BN Kids.", f);
};

// (Micken/“Tala in”-knappen kopplas senare, lämnas tom för nu)
// $('btnSpeak').onclick = () => {};
