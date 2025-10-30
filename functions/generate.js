// functions/generate.js
// Uppdaterad: använd BN_ALLOWED_ORIGIN som primär CORS‑env, fallback till äldre KIDSBN_ALLOWED_ORIGIN för kompatibilitet

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(env.BN_ALLOWED_ORIGIN || env.KIDSBN_ALLOWED_ORIGIN || "*") });
}

export async function onRequestPost({ request, env }) {
  const allow = env.BN_ALLOWED_ORIGIN || env.KIDSBN_ALLOWED_ORIGIN || "*";

  try {
    // Tolerera tom/icke-json body
    let body = {};
    try { body = await request.json(); } catch(e) { body = {}; }

    const { prompt, kidName = "Vännen", ageGroup = "3–5 år" } = body;

    if (!prompt || !prompt.trim()) return json({ error: "Skriv vad sagan ska handla om." }, 400, allow);
    if (!env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY) return json({ error: "OPENAI_API_KEY eller OPENROUTER_API_KEY saknas." }, 500, allow);

    const apiKey = env.OPENAI_API_KEY || env.OPENROUTER_API_KEY;
    const useOpenRouter = Boolean(env.OPENROUTER_API_KEY) && !env.OPENAI_API_KEY;
    const endpoint = useOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const model = env.OPENROUTER_MODEL || env.OPENAI_MODEL || "gpt-4o-mini";

    const sys = [
      "Du är en trygg sagoberättare för barn på svenska.",
      "Skriv en 6–9 min saga (≈700–900 ord).",
      `Åldersanpassa språk och längd för ${ageGroup}.`,
      `Barnets namn är ${kidName}. Inkludera namnet naturligt.`,
      "Snäll ton, utan skräck/våld. Avsluta lugnt och hoppfullt."
    ].join(" ");

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages: [{ role: "system", content: sys }, { role: "user", content: `Sagaidé: ${prompt}` }]
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      return json({ error: "AI-tjänst fel", details: t }, 502, allow);
    }

    const data = await res.json().catch(() => ({}));
    const story = data?.choices?.[0]?.message?.content?.trim?.() || "";

    if (!story) return json({ error: "Tomt svar." }, 502, allow);

    const hero = { name: kidName, tagline: "Barnets favorit", createdAt: Date.now() };
    return json({ story, hero }, 200, allow);
  } catch (e) {
    console.error("generate error:", e);
    return json({ error: e?.message || "Serverfel" }, 500, env.BN_ALLOWED_ORIGIN || env.KIDSBN_ALLOWED_ORIGIN || "*");
  }
}

function cors(origin){
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(obj, status, origin){
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type":"application/json", ...cors(origin) } });
}
