/* ═══════════════════════════════════════════════════════
   Nova AI Worker — Cloudflare Workers
   Variablen: NOVA_ADMIN_KEY=nova2024
              NOVA_AUTO_KEY=7758f239-31c4-4886-88ab-00056d2bb88b
              GEMINI_API_KEY=<dein key>
   ═══════════════════════════════════════════════════════ */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
// Model-hopping: each has its own server pool; 503/429 → next model immediately
const MODELS = [
  'gemini-3.5-flash-lite',  // primary: stable, low load
  'gemini-3.8-flash',       // fallback 1
  'gemini-2.5-flash-lite',  // fallback 2: older pool
  'gemini-1.5-flash-8b',    // fallback 3: smallest, least overloaded
];

const NOVA_SYSTEM = `Du bist Nova – die scharfzüngige, direkte Bossin des NOVA Support Pools auf TikTok. Kein Standard-KI-Blabla.

CHARAKTER:
- Du bist nicht nett, du bist ehrlich. Nicht sanft, sondern präzise.
- Frechheit mit Substanz: ein sarkastischer Einstieg, dann echter Mehrwert.
- Emojis: 😏 👑 🚀 🤷 – sparsam, aber gezielt.
- Max. 3 Sätze. Kein Jargon. Kein Fülltext.

VERBOTEN:
- Niemals mit "Hey!", "Ich bin Nova", "Lass uns", "Wie kann ich helfen?" anfangen.
- Keine Assistenten-Floskeln. Du bist die Bossin, keine Hotline.
- Niemals beleidigend, politisch oder off-topic.

THEMEN: TikTok-Algorithmus, Engagement, Shadowban, Views, Support-Pool-Regeln.

SPRACHE: Immer in der Sprache der Frage. Bei instruction-Angabe: in der angegebenen Sprache.

BEISPIEL:
User: Bist du nur eine KI, die mir sagt, ich soll öfter posten?
Nova: Blindes Posten bringt dir null Views – Strategie schon. 😏 Was genau läuft bei deinen letzten Videos nicht? Dann reden wir über Substanz, nicht Quantität.`;

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

    const BUDGET_MS = 18000;
    const startTime = Date.now();

    let reply = '';
    let lastErrType = '';

    for (const model of MODELS) {
      const elapsed = Date.now() - startTime;
      if (elapsed + 3000 > BUDGET_MS) {
        console.log(`[nova] skip ${model}: budget exhausted (${elapsed}ms)`);
        break;
      }

      const callBudget = Math.min(8000, BUDGET_MS - (Date.now() - startTime) - 500);
      const url = `${GEMINI_BASE}${model}:generateContent`;

      try {
        const geminiResp = await fetch(`${url}?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(callBudget),
        });

        console.log(`[nova] ${model} → ${geminiResp.status} (${Date.now() - startTime}ms)`);

        // Overload or rate-limit or model not found → try next immediately
        if (geminiResp.status === 503 || geminiResp.status === 429 || geminiResp.status === 404) {
          lastErrType = String(geminiResp.status);
          continue;
        }

        const data = await geminiResp.json();

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
        console.log(`[nova] ${model} → ${e.name} (${Date.now() - startTime}ms)`);
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
          lastErrType = 'timeout'; continue; // try next model on timeout too
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
