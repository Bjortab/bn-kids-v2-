// functions/api/generate_story.js
// Uppdaterad: normalisera ageRange (tolererar "3-4 år", "3–4 år", "3-4")

export async function onRequestPost(context) {
  const { request, env } = context;

  // Läs body försiktigt (tolerera tom eller icke-json)
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  const rawAge = (body?.ageRange || "").toString();
  const ageRange = normalizeAge(rawAge); // normaliserat t.ex. "3-4"
  const heroName = (body?.heroName || "").toString().trim();
  const userPrompt = (body?.prompt || "").toString().trim();

  if (!ageRange || !userPrompt) {
    // håll respons-formatet stabilt även vid fel
    return json({ story: "" }, 200);
  }

  // Modellkonfig (stöd för OpenRouter eller OpenAI som fallback)
  const OPENROUTER_API_KEY = env?.OPENROUTER_API_KEY || "";
  const OPENAI_API_KEY = env?.OPENAI_API_KEY || "";
  const MODEL = env?.OPENROUTER_MODEL || env?.OPENAI_MODEL || "openai/gpt-4o-mini";

  if (!OPENROUTER_API_KEY && !OPENAI_API_KEY) {
    // Ingen AI-nyckel konfigurerad — returnera tom saga så frontend inte kraschar
    return json({ story: "" }, 200);
  }

  const { tone, words, maxTokens, temperature } = ageConfig(ageRange);

  const system = [
    "Du skriver engagerande barnberättelser på svenska.",
    "Undvik moraliska pekpinnar och 'lärdom'-slut.",
    "Fokusera på handling, miljö, spänning och konkreta scener.",
    `Målgrupp: ${ageRange}. Ton: ${tone}. Längd: cirka ${words} ord.`,
    "Skriv en sammanhängande saga i löpande text utan rubriker som 'Lärdom'."
  ].join(" ");

  const heroLine = heroName ? `Hjältens namn: ${heroName}.` : "";
  const user = [
    `Sagaidé: ${userPrompt}`,
    heroLine,
    "Skriv med naturlig svenska och tempo som passar målgruppen.",
    "Ha en tydlig början, en driven mitt med händelser och en kraftfull slutbild (ingen pekpinne)."
  ].filter(Boolean).join("\n");

  try {
    // Välj endpoint beroende på vilken nyckel som finns
    const useOpenRouter = Boolean(OPENROUTER_API_KEY) && !OPENAI_API_KEY;
    const endpoint = useOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const apiKey = useOpenRouter ? OPENROUTER_API_KEY : OPENAI_API_KEY;
    const authHeader = useOpenRouter ? { "Authorization": `Bearer ${apiKey}` } : { "Authorization": `Bearer ${apiKey}` };

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature,
        top_p: 0.95,
        max_tokens: maxTokens
      })
    });

    if (!aiRes.ok) {
      // Om AI-tjänsten svarar fel, returnera tom sträng (frontend visar vänligt meddelande)
      return json({ story: "" }, 200);
    }

    const data = await aiRes.json().catch(() => ({}));
    const story =
      data?.choices?.[0]?.message?.content?.trim?.() ||
      (Array.isArray(data?.choices?.[0]?.message?.content) ? (data.choices[0].message.content[0]?.text || "").trim() : "") ||
      "";

    return json({ story: story || "" }, 200);
  } catch (err) {
    console.error("generate_story error:", err?.message || err);
    return json({ story: "" }, 200);
  }
}

// --- Helpers ---

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function normalizeAge(value) {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .replace(/\s*år\s*/g, "")   // ta bort "år"
    .replace(/–/g, "-")         // lång streck → kort bindestreck
    .trim();
}

function ageConfig(age) {
  switch (age) {
    case "1-2":  return { tone: "rytmisk, trygg, upprepningar, ljudord",      words: 90,   maxTokens: 400,  temperature: 0.6 };
    case "3-4":  return { tone: "lekfull, humor, liten konflikt",             words: 180,  maxTokens: 600,  temperature: 0.7 };
    case "5-6":  return { tone: "äventyrlig, varm, mer handling",             words: 320,  maxTokens: 900,  temperature: 0.8 };
    case "7-8":  return { tone: "målande, spännande, tydliga scener",         words: 550,  maxTokens: 1400, temperature: 0.9 };
    case "9-10": return { tone: "dramatisk, dialog, twist, action",           words: 900,  maxTokens: 2000, temperature: 0.95 };
    case "11-12":return { tone: "episk känsla, mystik, filmisk, starkt slut", words: 1200, maxTokens: 2600, temperature: 0.95 };
    default:
      console.warn("generate_story: okänt ageRange, använder default:", age);
      return { tone: "äventyrlig och målande", words: 500, maxTokens: 1600, temperature: 0.9 };
  }
}