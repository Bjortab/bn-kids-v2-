// /public/tts.js
(() => {
  function b64ToBlobUrl(b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime || "audio/mpeg" });
    return URL.createObjectURL(blob);
  }

  async function speak(text, opts = {}) {
    const payload = {
      text: String(text || "").trim(),
      voice: {
        languageCode: opts.languageCode || "sv-SE",
        name: opts.voiceName || ""
      },
      speakingRate: typeof opts.speakingRate === "number" ? opts.speakingRate : 1.0,
      pitch: typeof opts.pitch === "number" ? opts.pitch : 0.0,
      volumeGainDb: typeof opts.volumeGainDb === "number" ? opts.volumeGainDb : 0.0,
      audioProfile: opts.audioProfile || "",
      audioEncoding: opts.audioEncoding || "MP3"
    };

    if (!payload.text) throw new Error("Ingen text att läsa upp.");

    const res = await fetch("/api/tts_google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data?.error || `TTS error ${res.status}`);

    return b64ToBlobUrl(data.audioBase64, data.contentType);
  }

  async function speakToAudio(text, audioEl, opts = {}) {
    const url = await speak(text, opts);
    audioEl.src = url;
    try { await audioEl.play(); } catch {}
    return url;
  }

  window.bnTTS = { speak, speakToAudio };
})();
