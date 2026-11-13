/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Nova AI Moderation
   Backend: Cloudflare Worker (nova-worker.js)
   Set in Firebase RTDB: settings/nova/workerUrl
   Set in Firebase RTDB: settings/nova/adminKey  (= NOVA_ADMIN_KEY secret)
   Set in Firebase RTDB: settings/nova/autoKey   (= NOVA_AUTO_KEY secret)
   Feature flag: settings/features/novaAutoPilot (default false)
   ═══════════════════════════════════════════════════════ */

import { state }  from '../state.js';
import { writeDB } from '../firebase.js';

const TRIGGER_WORDS = ['hilfe', 'algorithmus', 'views', 'support', 'squad', 'shadowban', 'engagement', 'help', 'ayuda', 'yardım', 'مساعدة', '帮助', 'hjälp', 'pomoc'];
const RATE_MS = 10 * 60 * 1000; // 10 min per chat room

function _workerUrl() {
  return state.db?.settings?.nova?.workerUrl || '';
}

export async function callNova(message, instruction, targetLang, key) {
  const url = _workerUrl();
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nova-key': key },
      body: JSON.stringify({ message, instruction, targetLang }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.reply || null;
  } catch {
    return null;
  }
}

export async function postAsNova(text, chatId = 'pool') {
  if (!text) return;
  const msgId = `nova_${Date.now()}`;
  const msg = { from: 'nova-bot', text, ts: Date.now(), type: 'nova' };
  if (chatId === 'pool') {
    writeDB(`chat/pool/messages/${msgId}`, msg);
  }
}

export async function checkAutoTrigger(message, chatId, lang) {
  if (!state.db?.settings?.features?.novaAutoPilot) return;
  const url = _workerUrl();
  if (!url) return;
  const autoKey = state.db?.settings?.nova?.autoKey;
  if (!autoKey) return;

  const msgLower = message.toLowerCase();
  const hasTrigger = TRIGGER_WORDS.some(w => msgLower.includes(w));
  if (!hasTrigger) return;

  // Rate limit: 1 auto-reply per 10 min per room
  const lastReply = state.db?.settings?.nova?.lastAutoReply?.[chatId] || 0;
  if (Date.now() - lastReply < RATE_MS) return;

  // Update rate limit optimistically
  writeDB(`settings/nova/lastAutoReply/${chatId}`, Date.now());
  if (!state.db.settings) state.db.settings = {};
  if (!state.db.settings.nova) state.db.settings.nova = {};
  if (!state.db.settings.nova.lastAutoReply) state.db.settings.nova.lastAutoReply = {};
  state.db.settings.nova.lastAutoReply[chatId] = Date.now();

  const reply = await callNova(message, '', lang || 'de', autoKey);
  if (!reply) return;
  await postAsNova(reply, chatId);
}
