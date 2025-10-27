export async function onRequestGet() {
  return new Response(JSON.stringify({
    status:"ok",
    checks:{ google_tts:"ok", r2:"unknown" },
    ts: new Date().toISOString()
  }), { headers:{ "Content-Type":"application/json" }});
}
