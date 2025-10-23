export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { childName, ageRange, prompt } = await request.json();
    const apiKey = env.OPENROUTER_API_KEY;
    let storyText = "";

    // Åldersstyrda berättelser
    if (ageRange === '1-2') {
      // Hämta från fasta sagor
      const preset = await fetch(`${env.ASSETS}/presetStories.json`).then(r=>r.json());
      const random = preset[Math.floor(Math.random()*preset.length)];
      return Response.json(random);
    }

    const controls = {
      "3-4":  {min:100,max:200,style:"enkel rytmisk saga om vänskap"},
      "5-6":  {min:250,max:400,style:"fantasifull saga med början, mitt och slut"},
      "7-8":  {min:400,max:600,style:"miniäventyr med humor och spänning"},
      "9-10": {min:700,max:1000,style:"spännande äventyr med mod, humor och action"},
      "11-12":{min:1000,max:1400,style:"filmisk berättelse med känslor, kärlek och hjältar"}
    }[ageRange] || {min:200,max:400,style:"barnvänlig saga"};

    const fullPrompt = `
Du är en barnboksförfattare. Skriv en saga för barn ${ageRange} år,
mellan ${controls.min} och ${controls.max} ord, i stilen "${controls.style}".
Barnets namn är ${childName||'barnet'}.
${prompt ? "Sagan ska handla om: "+prompt : ""}
Avsluta berättelsen naturligt, utan klyschigt "slut".`;

    const ai = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: fullPrompt }]
      })
    });

    const result = await ai.json();
    storyText = result?.choices?.[0]?.message?.content || "Kunde inte skapa saga.";

    const images = [
      { url: "/images/default_dragon.jpg", tags:["drake"] },
      { url: "/images/default_forest.jpg", tags:["skog"] }
    ];

    return Response.json({ story: storyText, images });
  } catch (err) {
    return new Response(`Fel: ${err.message}`, { status: 500 });
  }
}
