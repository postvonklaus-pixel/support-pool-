/* ═══════════════════════════════════════════════════════
   Nova AI Worker — Cloudflare Workers
   Deploy at: https://dash.cloudflare.com → Workers → Create
   Set secrets in Worker Settings → Variables → Secrets:
     NOVA_ADMIN_KEY  = nova2024
     NOVA_AUTO_KEY   = 7758f239-31c4-4886-88ab-00056d2bb88b
     GEMINI_API_KEY  = <your key from aistudio.google.com>
   ═══════════════════════════════════════════════════════ */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const NOVA_SYSTEM = `Du bist Nova, die freundliche KI-Moderatorin des NOVA Support Pools auf TikTok.
Dein Stil: motivierend, direkt, kurz (max. 3 Sätze), kein Jargon.
Du hilfst bei Fragen zu: TikTok-Algorithmus, Engagement, Shadowban, Views, Support-Pool-Regeln.
Antworte IMMER in der Sprache, in der die Frage gestellt wurde.
Wenn eine andere Sprache per instruction angegeben wird, antworte in dieser.
Niemals beleidigend, niemals politisch, niemals über irrelevante Themen.`;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-nova-key',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const key = request.headers.get('x-nova-key') || '';
    if (key !== env.NOVA_ADMIN_KEY && key !== env.NOVA_AUTO_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const { message = '', instruction = '', targetLang = '' } = body;
    if (!message.trim()) {
      return new Response(JSON.stringify({ error: 'Empty message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const langHint = targetLang ? `\nAntworte auf ${targetLang}.` : '';
    const instrHint = instruction.trim() ? `\nZusätzliche Anweisung: ${instruction.trim()}` : '';
    const userPrompt = `${message.trim()}${langHint}${instrHint}`;

    let reply = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
      try {
        const geminiResp = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: NOVA_SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              maxOutputTokens: 256,
              temperature: 0.7,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });
        const data = await geminiResp.json();
        if (!geminiResp.ok) {
          return new Response(JSON.stringify({ error: 'Gemini error', status: geminiResp.status, detail: data }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          });
        }
        const parts = data?.candidates?.[0]?.content?.parts || [];
        reply = parts.find(p => p.text && !p.thought)?.text?.trim() || '';
        if (reply) break;
        if (attempt === 1) {
          const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';
          const blockReason  = data?.promptFeedback?.blockReason || 'none';
          return new Response(JSON.stringify({ error: 'Empty Gemini response', finishReason, blockReason }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Gemini call failed', detail: e.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }
    }

    if (!reply) {
      return new Response(JSON.stringify({ error: 'Empty Gemini response after retry' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
