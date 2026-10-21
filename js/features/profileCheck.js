/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Profile Check Feature
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc }      from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast }    from '../components/toast.js';
import { on }       from '../events.js';

let _tab = 'check'; // 'check' | 'story'

export function openProfileCheck() {
  _tab = 'check';
  _renderModal();
}

export function switchTab(tab) {
  _tab = tab || 'check';
  _renderModal();
}

function _renderModal() {
  const cu = state.currentUser;
  if (!cu) return;

  const u      = state.db.members?.[cu] || {};
  const stats  = u.stats || {};
  const given  = stats.given    || 0;
  const recv   = stats.received || 0;
  const bal    = Math.min(given - recv, 20);
  const vids   = u.postsTotal || 0;
  const wGiven = u.weeklyGiven || 0;
  const joined = u.joinedAt || u.joined || Date.now();
  const memberDays = Math.max(0, Math.floor((Date.now() - joined) / 86400000));

  // Active days last 7
  const today   = new Date();
  const supportDays = u.supportDays || [];
  let activeLast7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (supportDays.includes(ds)) activeLast7++;
  }

  // Inactivity
  let inactiveDays = 0;
  if (supportDays.length) {
    const lastDay = [...supportDays].sort().reverse()[0];
    inactiveDays = Math.max(0, Math.floor((Date.now() - new Date(lastDay).getTime()) / 86400000));
  } else {
    inactiveDays = memberDays;
  }

  // Score
  const balGood = bal >= 0;
  const hasPin  = !!u.memberPin;
  const hasPush = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  let score = 0;
  if (balGood) score++;
  if (vids > 0) score++;
  if (given >= 10) score++;
  if (wGiven >= 3) score++;
  if (activeLast7 >= 4) score++;

  const tabBar = `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn--sm ${_tab==='check'?'btn--primary':'btn--ghost'}" data-action="profile:tab" data-tab="check">
        📊 ${t('profCheckTitle') || 'PROFIL-CHECK'}
      </button>
      <button class="btn btn--sm ${_tab==='story'?'btn--primary':'btn--ghost'}" data-action="profile:tab" data-tab="story">
        📱 Story
      </button>
    </div>`;

  const body = _tab === 'check'
    ? tabBar + _buildCheckHTML(cu, u, given, recv, bal, balGood, vids, wGiven, memberDays, activeLast7, inactiveDays, hasPin, hasPush, score)
    : tabBar + _buildStoryHTML(cu, u, given, activeLast7, memberDays);

  openModal({ id: 'profile-check', title: t('profCheckTitle') || 'PROFIL-CHECK', body });
}

function _row(icon, label, good) {
  const tick = good === true ? '✅' : good === false ? '⚠️' : '○';
  return `<div class="list-item" style="padding:10px 0;border-bottom:1px solid var(--border-subtle)">
    <div class="list-item__icon">${icon}</div>
    <div class="list-item__body"><div class="list-item__title">${esc(label)}</div></div>
    <div class="list-item__aside">${tick}</div>
  </div>`;
}

function _buildCheckHTML(cu, u, given, recv, bal, balGood, vids, wGiven, memberDays, activeLast7, inactiveDays, hasPin, hasPush, score) {
  const sumText = score >= 4 ? t('profCheckSumGood') : score >= 2 ? t('profCheckSumOk') : t('profCheckSumBad');
  const sumColor= score >= 4 ? 'var(--success)' : score >= 2 ? 'var(--warning,#f59e0b)' : 'var(--danger)';
  const sinceLabel = (t('profCheckSince') || '{n} Tage im Pool').replace('{n}', memberDays);
  const daysLabel  = (t('profCheckDays')  || '{n} von 7 aktiv').replace('{n}', activeLast7);
  const _todayKey  = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  const todayCount = u.todayGiven?.[_todayKey] || 0;
  const todayLabel = (t('profCheckToday') || 'Heute: {n}').replace('{n}', todayCount);

  let html = `<div style="font-size:12px;font-weight:600;color:var(--text-tertiary,var(--text-secondary));text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${t('profCheckPos') || 'POSITIVES'}</div>`;
  html += _row('💰', `${t('profCheckBal')}: ${balGood ? t('profCheckBalGood') : t('profCheckBalBad')}`, balGood);
  html += _row('📹', `${t('profCheckVids')}: ${vids}`, vids > 0);
  html += _row('🤝', `${t('profCheckGiven')}: ${given}`, given >= 5);
  html += _row('📅', `${t('profCheckWeek')}: ${wGiven}`, wGiven >= 1);
  html += _row('🗓️', sinceLabel, memberDays >= 1);
  html += _row('🔥', daysLabel, activeLast7 >= 4);
  html += _row('⚡', todayLabel, todayCount >= 1);

  html += `<div style="margin:14px 0;border-top:1px solid var(--border-subtle)"></div>`;
  html += `<div style="font-size:12px;font-weight:600;color:var(--text-tertiary,var(--text-secondary));text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${t('profCheckOpt') || 'OPTIONAL'}</div>`;
  html += _row('🔒', t('profCheckPin'), hasPin ? true : null);
  html += _row('🔔', t('profCheckPush'), hasPush ? true : null);

  html += `<div style="margin:14px 0;border-top:1px solid var(--border-subtle)"></div>`;
  html += `<div style="font-size:12px;font-weight:600;color:var(--text-tertiary,var(--text-secondary));text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${t('profCheckSum') || 'ERGEBNIS'}</div>`;
  html += `<div style="padding:14px;border-radius:12px;background:${sumColor}18;border:1px solid ${sumColor}44;color:${sumColor};font-size:13px;line-height:1.5;margin-bottom:12px">${esc(sumText)}</div>`;

  if (inactiveDays >= 3) {
    const inactText = (t('profCheckInact') || 'Inaktiv seit {n} Tagen').replace('{n}', inactiveDays);
    html += `<div style="padding:12px;border-radius:10px;background:var(--warning,#f59e0b)18;border:1px solid var(--warning,#f59e0b)44;color:var(--warning,#f59e0b);font-size:12px;margin-bottom:12px">${esc(inactText)}</div>`;
  }

  html += `<div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:8px">${t('profCheckCert') || 'NOVA Support Pool · novapool.official'}</div>`;
  html += `<button class="btn btn--ghost btn--full btn--sm" data-action="profile:check:copy" style="margin-top:12px">📋 ${t('profCheckCopy') || 'Kopieren'}</button>`;

  return html;
}

function _buildStoryHTML(cu, u, given, activeLast7, memberDays) {
  const hint = t('storyHint') || '📱 Bild speichern → TikTok Stories teilen';
  // Draw after modal DOM settles
  setTimeout(() => drawStoryCanvas(), 80);
  return `
    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">${esc(hint)}</p>
    <canvas id="pc-story-canvas" width="1080" height="1920"
      style="width:100%;border-radius:16px;border:1px solid var(--border-subtle);display:block;margin-bottom:16px"></canvas>
    <button class="btn btn--gold btn--full" data-action="story:save">
      📥 ${t('storySave') || 'Bild speichern'}
    </button>
  `;
}

function _rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawStoryCanvas() {
  const canvas = document.getElementById('pc-story-canvas');
  if (!canvas) return;

  const cu = state.currentUser;
  const u  = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const given = stats.given || 0;
  const recv  = stats.received || 0;
  const bal   = Math.min(given - recv, 20);
  const joined = u.joinedAt || u.joined || Date.now();
  const memberDays = Math.max(0, Math.floor((Date.now() - joined) / 86400000));
  const supportDays = u.supportDays || [];
  let activeLast7 = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (supportDays.includes(d.toISOString().slice(0, 10))) activeLast7++;
  }

  const W = 1080, H = 1920;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#07020f');
  bg.addColorStop(0.4, '#130428');
  bg.addColorStop(0.7, '#0d0620');
  bg.addColorStop(1,   '#07020f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars
  const rng = (seed) => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }; };
  const rand = rng(42);
  for (let i = 0; i < 140; i++) {
    const x = rand() * W, y = rand() * H, r = rand() * 2.2 + 0.4;
    const a = rand() * 0.5 + 0.06;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Purple glow behind avatar
  const glow = ctx.createRadialGradient(W/2, H * 0.33, 0, W/2, H * 0.33, 580);
  glow.addColorStop(0,   'rgba(124,58,237,0.42)');
  glow.addColorStop(0.5, 'rgba(6,182,212,0.08)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Cyan accent glow (bottom)
  const glow2 = ctx.createRadialGradient(W/2, H * 0.72, 0, W/2, H * 0.72, 400);
  glow2.addColorStop(0,   'rgba(6,182,212,0.18)');
  glow2.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ── Top label ───────────────────────────────────────────
  ctx.font = '500 30px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(124,58,237,0.85)';
  ctx.fillText('✦  NOVA SUPPORT POOL  ✦', W/2, 88);

  // ── Avatar ──────────────────────────────────────────────
  const cx = W/2, cy = H * 0.33;

  // Outer glow ring
  const ringG = ctx.createRadialGradient(cx, cy, 148, cx, cy, 210);
  ringG.addColorStop(0, 'rgba(124,58,237,0.55)');
  ringG.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(cx, cy, 210, 0, Math.PI * 2); ctx.fill();

  // Avatar fill
  ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2);
  const avG = ctx.createLinearGradient(cx - 160, cy - 160, cx + 160, cy + 160);
  avG.addColorStop(0, '#7c3aed'); avG.addColorStop(1, '#06b6d4');
  ctx.fillStyle = avG; ctx.fill();

  // Avatar border
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 5; ctx.stroke();

  // Avatar initials
  ctx.font = 'bold 104px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12;
  ctx.fillText((cu || '?').slice(0, 2).toUpperCase(), cx, cy);
  ctx.shadowBlur = 0;

  // ── Username ────────────────────────────────────────────
  ctx.font = 'bold 68px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('@' + (u.name || cu || ''), cx, cy + 232);

  // Subtitle
  ctx.font = '500 34px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(124,58,237,0.9)';
  ctx.fillText('NOVA Support Pool', cx, cy + 306);

  // ── Divider ─────────────────────────────────────────────
  const divY = cy + 378;
  const divG = ctx.createLinearGradient(W/2 - 320, divY, W/2 + 320, divY);
  divG.addColorStop(0,   'rgba(124,58,237,0)');
  divG.addColorStop(0.5, 'rgba(124,58,237,0.75)');
  divG.addColorStop(1,   'rgba(124,58,237,0)');
  ctx.strokeStyle = divG; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W/2 - 320, divY); ctx.lineTo(W/2 + 320, divY); ctx.stroke();

  // ── Stats 2×2 Grid ──────────────────────────────────────
  const statsData = [
    { v: String(given),                      l: t('given')    || 'Gegeben'      },
    { v: (bal >= 0 ? '+' : '') + String(bal), l: t('balance')  || 'Guthaben'     },
    { v: String(memberDays),                  l: t('daysInPool') || 'Tage im Pool' },
    { v: activeLast7 + '/7',                  l: t('activeDays') || 'Tage aktiv'  },
  ];

  const cW = 450, cH = 230, gX = 48, gY = 40;
  const startX = (W - (2 * cW + gX)) / 2;
  const startY = divY + 72;

  statsData.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const bx = startX + col * (cW + gX);
    const by = startY + row * (cH + gY);

    // Card background
    _rrect(ctx, bx, by, cW, cH, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5; ctx.stroke();

    // Value
    const valG = ctx.createLinearGradient(bx, by, bx + cW, by + cH);
    valG.addColorStop(0, '#9f60ff'); valG.addColorStop(1, '#22d3ee');
    ctx.font = 'bold 92px Inter, Arial, sans-serif';
    ctx.fillStyle = valG;
    ctx.fillText(s.v, bx + cW / 2, by + cH / 2 - 20);

    // Label
    ctx.font = '400 30px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.48)';
    ctx.fillText(s.l, bx + cW / 2, by + cH / 2 + 58);
  });

  // ── Footer ──────────────────────────────────────────────
  ctx.font = '400 27px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillText('novapool.official · TikTok Community', W/2, H - 88);
}

export function downloadStoryCard() {
  drawStoryCanvas();
  const canvas = document.getElementById('pc-story-canvas');
  if (!canvas) { toast('Canvas nicht gefunden', 'error'); return; }

  canvas.toBlob(async (blob) => {
    if (!blob) { toast('Fehler beim Erstellen', 'error'); return; }

    // Web Share API with file (iOS 15+, Android Chrome) — opens native share sheet
    if (navigator.canShare) {
      const file = new File([blob], 'nova-story.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'NOVA Support Pool Story' });
          toast('Teilen-Sheet geöffnet 📱', 'success');
          return;
        } catch (e) {
          if (e.name === 'AbortError') return; // user cancelled — no error needed
        }
      }
    }

    // Fallback: blob-URL download (Desktop / Android ohne Share API)
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'nova-profile-story.png';
    link.href     = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Story heruntergeladen! 📱', 'success');
  }, 'image/png');
}

// Tab switch
on('profile:tab', (el) => switchTab(el.dataset.tab));

// Story save
on('story:save', () => downloadStoryCard());

// Copy text summary
on('profile:check:copy', () => {
  const cu = state.currentUser;
  if (!cu) return;
  const u     = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const given = stats.given || 0;
  const recv  = stats.received || 0;
  const bal   = given - recv;
  const text  = [
    `📊 ${t('profCheckTitle') || 'PROFIL-CHECK'} @${cu}`,
    `💰 ${t('profCheckBal')}: ${bal >= 0 ? '✅' : '⚠️'}`,
    `🤝 ${t('profCheckGiven')}: ${given}`,
    `📅 ${t('profCheckWeek')}: ${u.weeklyGiven || 0}`,
    ``,
    t('profCheckCert') || 'NOVA Support Pool',
  ].join('\n');

  navigator.clipboard?.writeText(text)
    .then(() => toast(t('profCheckCopied') || 'Kopiert! 📋', 'success'))
    .catch(() => toast(text, 'info', 6000));
});
