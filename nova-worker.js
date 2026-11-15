/* ═══════════════════════════════════════════════════════
   Nova AI Worker — Cloudflare Workers
   Variablen: NOVA_ADMIN_KEY=nova2024
              NOVA_AUTO_KEY=7758f239-31c4-4886-88ab-00056d2bb88b
              GEMINI_API_KEY=<dein key>
   ═══════════════════════════════════════════════════════ */

const GEMINI_PRIMARY   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const GEMINI_FALLBACK1 = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const GEMINI_FALLBACK2 = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent';

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
    'Access-Control-Max-Age': '86400',
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

    // Accept form-encoded (no CORS preflight) or JSON (fallback)
    let key, message, instruction, targetLang;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      try {
        const form = await request.formData();
        key         = form.get('key')         || request.headers.get('x-nova-key') || '';
        message     = form.get('message')     || '';
        instruction = form.get('instruction') || '';
        targetLang  = form.get('targetLang')  || '';
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid form data' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }
    } else {
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }
      key         = request.headers.get('x-nova-key') || body?.key || '';
      message     = body?.message     || '';
      instruction = body?.instruction || '';
      targetLang  = body?.targetLang  || '';
    }

    if (key !== env.NOVA_ADMIN_KEY && key !== env.NOVA_AUTO_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    if (!message.trim()) {
      return new Response(JSON.stringify({ error: 'Empty message' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const langHint = targetLang ? `\nAntworte auf ${targetLang}.` : '';
    const instrHint = instruction.trim() ? `\nZusätzliche Anweisung: ${instruction.trim()}` : '';
    const userPrompt = `${message.trim()}${langHint}${instrHint}`;

    const payload = {
      systemInstruction: { parts: [{ text: NOVA_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
    };

    // 4 attempts across 3 models (separate server pools); delays fit within 20s budget
    const ATTEMPTS = [
      { url: GEMINI_PRIMARY,   delay: 0    },
      { url: GEMINI_PRIMARY,   delay: 1500 },
      { url: GEMINI_FALLBACK1, delay: 1000 },
      { url: GEMINI_FALLBACK2, delay: 1000 },
    ];
    const BUDGET_MS = 19000;
    const startTime = Date.now();

    let reply = '';
    let lastErrType = '';

    for (const { url, delay } of ATTEMPTS) {
      const elapsed = Date.now() - startTime;
      // Skip if adding delay + minimum call time would exceed budget
      if (elapsed + delay + 4000 > BUDGET_MS) break;
      if (delay > 0) await new Promise(r => setTimeout(r, delay));

      const callBudget = Math.min(8000, BUDGET_MS - (Date.now() - startTime) - 500);
      if (callBudget < 2000) break;

      try {
        const geminiResp = await fetch(`${url}?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(callBudget),
        });
        const data = await geminiResp.json();

        if (geminiResp.status === 503) { lastErrType = '503'; continue; }

        if (!geminiResp.ok) {
          const geminiMsg = data?.error?.message || JSON.stringify(data);
          const isRegionBlock = /location|region|not supported|user location/i.test(geminiMsg);
          const errorOut = isRegionBlock
            ? 'Nova: Region blockiert – bitte Support informieren'
            : `Gemini ${geminiResp.status}: ${geminiMsg}`;
          return new Response(JSON.stringify({ error: errorOut }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
          });
        }

        const parts = data?.candidates?.[0]?.content?.parts || [];
        reply = parts.find(p => p.text && !p.thought)?.text?.trim() || '';
        if (reply) break;

        const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';
        lastErrType = `empty:${finishReason}`;
      } catch (e) {
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
          lastErrType = 'timeout'; continue;
        }
        return new Response(JSON.stringify({ error: 'Gemini call failed', detail: e.message }), {
          status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }
    }

    if (!reply) {
      const isOverload = lastErrType === '503' || lastErrType === 'timeout';
      const errorOut = isOverload
        ? 'Nova: Google ist gerade überlastet. Bitte in 1 Minute nochmal versuchen.'
        : `Keine Antwort von Gemini (${lastErrType})`;
      return new Response(JSON.stringify({ error: errorOut }), {
        status: isOverload ? 503 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
