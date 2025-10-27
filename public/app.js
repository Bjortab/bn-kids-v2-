// /public/app.js
document.addEventListener("DOMContentLoaded", () => {
  const btnGenerate = document.querySelector("#btnGenerate");
  const btnSpeak = document.querySelector("#btnSpeak");
  const textInput = document.querySelector("#prompt");
  const storyBox = document.querySelector("#story");
  const audioEl = document.querySelector("#player") || new Audio();
  const spinner = document.querySelector(".spinner");

  async function generateStory() {
    const prompt = textInput.value.trim();
    if (!prompt) return alert("Skriv något i sagorutan först.");

    if (spinner) spinner.style.display = "inline-block";
    try {
      const res = await fetch("/api/generate_story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!res.ok || !data.story) throw new Error(data.error || "Fel vid sagogenerering");
      storyBox.textContent = data.story;
    } catch (err) {
      alert("Fel: " + err.message);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  async function readStory() {
    const text = storyBox.textContent.trim();
    if (!text) return alert("Ingen saga att läsa upp.");

    if (spinner) spinner.style.display = "inline-block";
    try {
      await window.bnTTS.speakToAudio(text, audioEl, {
        languageCode: "sv-SE",
        voiceName: "sv-SE-Wavenet-B",
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      });
    } catch (e) {
      alert("TTS-fel: " + e.message);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  if (btnGenerate) btnGenerate.addEventListener("click", generateStory);
  if (btnSpeak) btnSpeak.addEventListener("click", readStory);
});
