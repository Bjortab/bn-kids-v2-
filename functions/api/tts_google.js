// /functions/api/tts_google.js
export async function onRequestPost(context) {
  const { request, env } = context;

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const {
      text,
      voice = {},
      speakingRate = 1.0,
      pitch = 0.0,
      volumeGainDb = 0.0,
      audioProfile = "",
      audioEncoding = "MP3"
    } = await request.json();

    if (!env.GOOGLE_TTS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing secret GOOGLE_TTS_API_KEY" }), {
        status: 500, headers: { "content-type": "application/json", ...CORS }
      });
    }

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "No text provided" }), {
        status: 400, headers: { "content-type": "application/json", ...CORS }
      });
    }

    const languageCode = voice.languageCode || "sv-SE";
    const name = voice.name || "sv-SE-Wavenet-B";

    const payload = {
      input: { text },
      voice: { languageCode, name },
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
        status: 502, headers: { "content-type": "application/json", ...CORS }
      });
    }

    const data = await gRes.json();
    if (!data.audioContent) {
      return new Response(JSON.stringify({ ok: false, error: "No audioContent returned" }), {
        status: 502, headers: { "content-type": "application/json", ...CORS }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      contentType: audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg",
      audioBase64: data.audioContent
    }), { headers: { "content-type": "application/json", ...CORS } });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500, headers: { "content-type": "application/json", ...CORS }
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
