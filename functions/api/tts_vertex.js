// functions/api/tts_vertex.js
export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  // === Läs input ===
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const text = (body.text || "").toString().trim();
  if (!text) return json({ error: "Missing 'text'" }, 400);

  const voiceName = body.voice || "sv-SE-Wavenet-B";
  const speakingRate = clamp(parseFloat(body.speakingRate ?? 1.0), 0.25, 4.0);
  const pitch = clamp(parseFloat(body.pitch ?? 0), -20, 20); // semitones
  const audioEncoding = (body.audioEncoding || "MP3").toUpperCase();

  // === API key krävs ===
  const apiKey = env.GCP_TTS_API_KEY;
  if (!apiKey) return json({ error: "Missing env GCP_TTS_API_KEY" }, 500);

  // === Cache-nyckel (hash på text + voice + params) ===
  const cacheKey = await sha1Hex(JSON.stringify({ text, voiceName, speakingRate, pitch, audioEncoding }));

  // 1) Edge cache (Pages cache API)
  const cache = caches.default;
  const cacheReq = new Request(new URL(`/__tts_cache/${cacheKey}`, new URL(request.url).origin), { method: "GET" });
  let cached = await cache.match(cacheReq);
  if (cached) {
    return addCacheHeaders(cached);
  }

  // 2) R2 cache (om bunden)
  if (env.BN_AUDIO) {
    const obj = await env.BN_AUDIO.get(`tts/${cacheKey}.mp3`);
    if (obj) {
      const res = new Response(obj.body, {
        headers: { "Content-Type": "audio/mpeg" }
      });
      // lägg även i edge cache
      await cache.put(cacheReq, res.clone());
      return addCacheHeaders(res);
    }
  }

  // === Google TTS v1 ===
  const apiURL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    input: { text },
    // sv-SE röster (Wavenet/Neural2). Du kan även specificera languageCode separat.
    voice: { name: voiceName, languageCode: "sv-SE" },
    audioConfig: {
      audioEncoding,             // "MP3" | "OGG_OPUS" | "LINEAR16"
      speakingRate,              // 0.25–4.0
      pitch,                     // -20.0–20.0 semitones
      volumeGainDb: 0.0          // -96.0–16.0 (om du vill justera)
    }
  };

  const googleResp = await fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!googleResp.ok) {
    const errText = await googleResp.text().catch(() => "");
    return json({ ok:false, provider:"google-tts", error: errText || `HTTP ${googleResp.status}` }, 500);
  }

  const data = await googleResp.json();
  if (!data.audioContent) {
    return json({ ok:false, error:"No audioContent from Google TTS" }, 500);
  }

  const bin = base64ToUint8Array(data.audioContent);
  const res = new Response(bin, {
    headers: {
      "Content-Type": audioEncoding === "MP3" ? "audio/mpeg"
                   : audioEncoding === "OGG_OPUS" ? "audio/ogg"
                   : "application/octet-stream",
    }
  });

  // Spara i R2 om finns
  if (env.BN_AUDIO) {
    await env.BN_AUDIO.put(`tts/${cacheKey}.mp3`, bin, {
      httpMetadata: { contentType: "audio/mpeg" }
    });
  }

  // Lägg i edge cache
  await cache.put(cacheReq, res.clone());

  return addCacheHeaders(res);

  // === helpers ===
  function json(obj, status=200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
  function clamp(v, min, max){ if (Number.isNaN(v)) return min; return Math.max(min, Math.min(max, v)); }
  function base64ToUint8Array(b64){
    const s = atob(b64);
    const arr = new Uint8Array(s.length);
    for (let i=0;i<s.length;i++) arr[i] = s.charCodeAt(i);
    return arr;
  }
  async function sha1Hex(str){
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-1", buf);
    const b = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
    return b;
  }
  function addCacheHeaders(r){
    const h = new Headers(r.headers);
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(r.body, { status: r.status, headers: h });
    }
}
