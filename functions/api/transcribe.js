// Pages Function: ta emot multipart/form-data med 'file' och vidarebefordra till OpenAI Whisper.
// Kräver att du sätter OPENAI_API_KEY som secret i Pages (Settings -> Variables & Secrets).
export default {
  async fetch(request, env) {
    // Hantera preflight (CORS) för fetch från klienten
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Expected multipart/form-data' }, 400);
    }

    // Läs formdata och fil
    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return jsonResponse({ error: 'Could not parse form data', detail: err.message }, 400);
    }
    const file = formData.get('file');
    if (!file) {
      return jsonResponse({ error: "Missing 'file' field" }, 400);
    }

    const OPENAI_KEY = env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return jsonResponse({ error: 'Server misconfiguration: missing OPENAI_API_KEY' }, 500);
    }

    try {
      // Bygg vidarebefordran till OpenAI (multipart/form-data)
      const forward = new FormData();
      // file kan vara en Blob/File från request.formData()
      forward.append('file', file, 'recording.webm');
      forward.append('model', 'whisper-1');

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          // Låt fetch/FormData sätta Content-Type (boundary) automatiskt
        },
        body: forward,
      });

      const respText = await resp.text();
      const contentTypeResp = resp.headers.get('content-type') || 'application/json';

      // Framåtreturnera OpenAI:s svar (samma statuskod)
      return new Response(respText, {
        status: resp.status,
        headers: {
          'Content-Type': contentTypeResp,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return jsonResponse({ error: 'Upstream request failed', detail: err.message }, 502);
    }
  },
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
