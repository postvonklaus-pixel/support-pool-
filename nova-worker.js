/* ═══════════════════════════════════════════════════════
   Nova AI Worker — Cloudflare Workers
   Deploy at: https://dash.cloudflare.com → Workers → Create
   Set secrets in Worker Settings → Variables → Secrets:
     NOVA_ADMIN_KEY  = 51c41817-9ef8-4eff-bbd9-98b1f8059bb2
     NOVA_AUTO_KEY   = 7758f239-31c4-4886-88ab-00056d2bb88b
     GEMINI_API_KEY  = <your key from aistudio.google.com>
   ═══════════════════════════════════════════════════════ */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const ALLOWED_ORIGIN = 'https://autosocial.cc';

const NOVA_SYSTEM = `Du bist Nova, die freundliche KI-Moderatorin des NOVA Support Pools auf TikTok.
Dein Stil: motivierend, direkt, kurz (max. 3 Sätze), kein Jargon.
Du hilfst bei Fragen zu: TikTok-Algorithmus, Engagement, Shadowban, Views, Support-Pool-Regeln.
Antworte IMMER in der Sprache, in der die Frage gestellt wurde.
Wenn eine andere Sprache per instruction angegeben wird, antworte in dieser.
Niemals beleidigend, niemals politisch, niemals über irrelevante Themen.`;

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-nova-key',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Key validation
    const key = request.headers.get('x-nova-key') || '';
    const isAdmin = key === env.NOVA_ADMIN_KEY;
    const isAuto  = key === env.NOVA_AUTO_KEY;
    if (!isAdmin && !isAuto) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const { message = '', instruction = '', targetLang = '' } = body;
    if (!message.trim()) {
      return new Response(JSON.stringify({ error: 'Empty message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Build prompt
    const langHint = targetLang ? `\nAntworte auf ${targetLang}.` : '';
    const instrHint = instruction.trim() ? `\nZusätzliche Anweisung: ${instruction.trim()}` : '';
    const userPrompt = `${message.trim()}${langHint}${instrHint}`;

    // Call Gemini
    let reply = '';
    try {
      const geminiResp = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: NOVA_SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
        }),
      });
      const data = await geminiResp.json();
      if (!geminiResp.ok) {
        return new Response(JSON.stringify({ error: 'Gemini error', status: geminiResp.status, detail: data }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
      reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Gemini call failed', detail: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!reply) {
      return new Response(JSON.stringify({ error: 'Empty Gemini response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
