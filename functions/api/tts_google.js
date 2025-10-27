// /functions/api/tts_google.js
export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const {
      text,
      voice = {},               // { languageCode, name }
      speakingRate = 1.0,       // 0.8–1.2 typ
      pitch = 0.0,              // -20.0 – +20.0
      volumeGainDb = 0.0,       // -96.0 – +16.0
      audioProfile = "",        // t.ex. "earpiece-class-device"
      audioEncoding = "MP3"     // MP3 eller LINEAR16
    } = await request.json();

    if (!env.GOOGLE_TTS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing secret GOOGLE_TTS_API_KEY" }), {
        status: 500, headers: { "content-type": "application/json", ...cors }
      });
    }
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "No text" }), {
        status: 400, headers: { "content-type": "application/json", ...cors }
      });
    }

    // Säkra defaults för svenska om inte UI skickar något.
    const lang = voice.languageCode || "sv-SE";
    // Bra standardröster: WaveNet-B (kvinna/varm), Neural2-A (man)
    const name = voice.name || "sv-SE-Wavenet-B";

    // Bygg request till Google TTS v1 (API key-läge – enkelt och stabilt).
    const payload = {
      input: { text },
      voice: { languageCode: lang, name },
      audioConfig: {
        audioEncoding,
        speakingRate,
        pitch,
        volumeGainDb,
        effectsProfileId: audioProfile ? [audioProfile] : []
      }
    };

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`;
    const gRes = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!gRes.ok) {
      const errText = await gRes.text().catch(() => "");
      return new Response(JSON.stringify({ ok: false, error: `Google TTS ${gRes.status}`, details: errText }), {
        status: 502, headers: { "content-type": "application/json", ...cors }
      });
    }

    const data = await gRes.json();
    if (!data.audioContent) {
      return new Response(JSON.stringify({ ok: false, error: "No audioContent from Google" }), {
        status: 502, headers: { "content-type": "application/json", ...cors }
      });
    }

    // Returnera base64 till frontenden; den gör Blob -> audio.src.
    return new Response(JSON.stringify({
      ok: true,
      contentType: audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg",
      audioBase64: data.audioContent
    }), { headers: { "content-type": "application/json", ...cors } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500, headers: { "content-type": "application/json", ...cors }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
