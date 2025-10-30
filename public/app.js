// public/app.js
// Uppdaterad: prioritera data-id selectors, normalisera ageRange innan sändning

(function () {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));
  const lower = (t = "") => t.toString().toLowerCase().trim();
  const warn = (...args) => console.warn("[BN]", ...args);

  function findButtonByText(...needles) {
    const btns = qsa('button, input[type="button"], input[type="submit"]');
    return btns.find(b => needles.some(n => lower(b.value || b.innerText).includes(lower(n))));
  }

  // Robust selectors: försök data-id först, sedan id/name fallbacks
  const ageEl    = qs('[data-id="age"]')    || qs('#age')    || qs('#ageRange') || qs('select[name="age"]') || null;
  const heroEl   = qs('[data-id="hero"]')   || qs('#hero')   || qs('#heroName') || qs('input[name="hero"]') || null;
  const promptEl = qs('[data-id="prompt"]') || qs('#prompt') || qs('#idea')     || qs('textarea[name="prompt"]') || null;
  const storyEl  = qs('[data-id="story"]')  || qs('#story')  || qs('#storyText') || qs('.story-output') || null;
  const errorEl  = qs('[data-id="error"]')  || qs('.error') || null;
  const spinner  = qs('[data-id="spinner"]') || null;

  function normalizeAgeForApi(v) {
    if (!v) return "";
    return v.toString().replace(/\s*år\s*/i, "").replace(/–/g, "-").trim();
  }

  async function createStory() {
    if (!promptEl) { warn("Ingen prompt-element hittades"); return; }

    if (errorEl) errorEl.textContent = "";
    if (storyEl) storyEl.textContent = "";
    if (spinner) spinner.style.display = "" ;

    const payload = {
      ageRange: normalizeAgeForApi(ageEl?.value || ""),
      heroName: (heroEl?.value || "").toString(),
      prompt: (promptEl?.value || "").toString()
    };

    try {
      const res = await fetch('/api/generate_story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (spinner) spinner.style.display = "none";

      if (!res.ok) {
        if (errorEl) errorEl.textContent = "Serverfel vid generering. Försök igen senare.";
        console.error("createStory: server returned not ok", res.status, data);
        return;
      }

      const story = data?.story || "";
      if (!story) {
        if (errorEl) errorEl.textContent = "Inget svar från servern. Försök med en annan idé.";
        return;
      }

      if (storyEl) storyEl.textContent = story;
    } catch (err) {
      if (spinner) spinner.style.display = "none";
      if (errorEl) errorEl.textContent = "Kunde inte nå servern. Kontrollera din internetuppkoppling.";
      console.error("createStory error:", err);
    }
  }

  async function playTTS() {
    try {
      const text = (storyEl?.textContent || "").trim();
      if (!text) return;
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
      const a = new Audio(audioUrl);
      a.play().catch(e => console.warn("playTTS: kunde inte spela upp:", e));
    } catch (e) {
      console.warn("playTTS error", e);
    }
  }

  window.createStory = createStory;
  window.playTTS = playTTS;

  // Bind create button — prefer data-id then text fallback
  const createBtn = qs('[data-id="btn-create"]') || findButtonByText('skapa saga', 'skapa & läs upp', 'skapa');
  if (createBtn) {
    createBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      createStory();
    });
  }
})();