/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Profile Check Feature
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc }      from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast }    from '../components/toast.js';
import { on }       from '../events.js';
import { isVerified, VERIFIED_BADGE } from './verification.js';

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

  const verified = isVerified(u);
  const gradient = `linear-gradient(135deg,#7c3aed,#06b6d4)`;
  const avatarHeader = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.18)">
      <div style="width:52px;height:52px;border-radius:50%;background:${gradient};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,0.15)">
        ${esc((cu || '?').slice(0, 2).toUpperCase())}
      </div>
      <div>
        <div style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px">
          @${esc(u.name || cu || '')}${verified ? VERIFIED_BADGE : ''}
        </div>
        <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">NOVA Support Pool</div>
      </div>
    </div>`;

  const tabBar = `
    ${avatarHeader}
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn--sm ${_tab==='check'?'btn--primary':'btn--ghost'}" data-action="profile:tab" data-tab="check">
        📊 ${t('profCheckTitle') || 'PROFIL-CHECK'}
      </button>
      <button class="btn btn--sm ${_tab==='story'?'btn--primary':'btn--ghost'}" data-action="profile:tab" data-tab="story">
        📱 Story
      </button>
    </div>`;

  const body = _tab === 'check'
    ? tabBar + _buildCheckHTML(cu, u, given, recv, bal, balGood, vids, wGiven, memberDays, activeLast7, inactiveDays, hasPin, hasPush, score, verified)
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

function _buildCheckHTML(cu, u, given, recv, bal, balGood, vids, wGiven, memberDays, activeLast7, inactiveDays, hasPin, hasPush, score, verified) {
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

  if (verified) {
    html += `<div style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;font-size:13px;font-weight:600;margin-bottom:12px">
      ${VERIFIED_BADGE} Verifiziertes Mitglied · 50+ Videos · 5/7 Tage aktiv
    </div>`;
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

export async function drawStoryCanvas() {
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
  const verified = isVerified(u);

  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Load background photo
  await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
    img.onerror = () => { ctx.fillStyle = '#010008'; ctx.fillRect(0, 0, W, H); resolve(); };
    img.src = '/support-pool-/assets/story-bg.jpg';
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ── BANNER PILL ─────────────────────────────────────────────
  const banW = 800, banH = 76, banX = (W - banW) / 2, banY = 96;
  // Glow behind pill
  ctx.save();
  ctx.shadowColor = 'rgba(167,139,250,0.55)'; ctx.shadowBlur = 32;
  _rrect(ctx, banX, banY - banH/2, banW, banH, 38);
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fill();
  ctx.restore();
  // Glass fill
  _rrect(ctx, banX, banY - banH/2, banW, banH, 38);
  const banFill = ctx.createLinearGradient(banX, banY - banH/2, banX, banY + banH/2);
  banFill.addColorStop(0, 'rgba(255,255,255,0.22)');
  banFill.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  banFill.addColorStop(1, 'rgba(20,5,60,0.72)');
  ctx.fillStyle = banFill; ctx.fill();
  // Border
  _rrect(ctx, banX, banY - banH/2, banW, banH, 38);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  // Inner top shine
  ctx.save(); _rrect(ctx, banX, banY - banH/2, banW, banH, 38); ctx.clip();
  const bSh = ctx.createLinearGradient(banX, banY - banH/2, banX, banY);
  bSh.addColorStop(0, 'rgba(255,255,255,0.30)'); bSh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bSh; ctx.fillRect(banX, banY - banH/2, banW, banH/2); ctx.restore();
  // Text
  ctx.font = 'bold 34px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(200,170,255,0.90)'; ctx.shadowBlur = 14;
  ctx.fillText('⭐  NOVA SUPPORT POOL  ⭐', W/2, banY);
  ctx.shadowBlur = 0;

  // ── AVATAR ──────────────────────────────────────────────────
  const cx = W/2, cy = 520, avR = 160;

  // Outer glow rings
  for (const [rr, rw, ra] of [[avR+12, 3.5, 0.65], [avR+28, 1.5, 0.30], [avR+52, 1, 0.14]]) {
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(200,170,255,${ra})`; ctx.lineWidth = rw; ctx.stroke();
  }

  // Avatar fill
  ctx.beginPath(); ctx.arc(cx, cy, avR, 0, Math.PI*2);
  const avG = ctx.createLinearGradient(cx - avR, cy - avR, cx + avR, cy + avR);
  avG.addColorStop(0, '#a855f7'); avG.addColorStop(0.45, '#7c3aed'); avG.addColorStop(1, '#2563eb');
  ctx.fillStyle = avG; ctx.fill();
  ctx.strokeStyle = 'rgba(235,220,255,0.38)'; ctx.lineWidth = 3.5; ctx.stroke();

  // 3D sphere shading
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, avR, 0, Math.PI*2); ctx.clip();
  const sHi = ctx.createRadialGradient(cx - avR*0.42, cy - avR*0.45, 0, cx - avR*0.42, cy - avR*0.45, avR*1.1);
  sHi.addColorStop(0, 'rgba(255,255,255,0.60)'); sHi.addColorStop(0.3, 'rgba(255,255,255,0.20)'); sHi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sHi; ctx.fillRect(cx - avR, cy - avR, avR*2, avR*2);
  const sSh = ctx.createRadialGradient(cx + avR*0.45, cy + avR*0.42, 0, cx + avR*0.45, cy + avR*0.42, avR);
  sSh.addColorStop(0, 'rgba(0,0,50,0.60)'); sSh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sSh; ctx.fillRect(cx - avR, cy - avR, avR*2, avR*2);
  ctx.restore();

  // Crown
  if (verified) { ctx.font = '85px serif'; ctx.textBaseline = 'middle'; ctx.fillText('👑', cx, cy - avR - 44); }

  // Initials
  ctx.font = 'bold 115px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.60)'; ctx.shadowBlur = 22;
  ctx.textBaseline = 'middle';
  ctx.fillText((cu || '?').slice(0, 2).toUpperCase(), cx, cy);
  ctx.shadowBlur = 0;

  // ── USERNAME ────────────────────────────────────────────────
  const nameY = 920;
  ctx.font = 'bold 66px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.85)'; ctx.shadowBlur = 22;
  const uname = '@' + (u.name || cu || '');
  ctx.fillText(uname, cx, nameY);
  ctx.shadowBlur = 0;

  // Verified badge
  if (verified) {
    const tw = ctx.measureText(uname).width;
    const bx2 = cx + tw/2 + 42, by2 = nameY;
    ctx.save();
    ctx.shadowColor = 'rgba(59,130,246,0.90)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(bx2, by2, 24, 0, Math.PI*2);
    ctx.fillStyle = '#3b82f6'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(bx2 - 11, by2 + 2); ctx.lineTo(bx2 - 2, by2 + 12); ctx.lineTo(bx2 + 13, by2 - 9); ctx.stroke();
  }

  // ── SUBTITLES ────────────────────────────────────────────────
  ctx.font = '600 38px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(196,181,253,0.96)';
  ctx.shadowColor = 'rgba(124,58,237,0.65)'; ctx.shadowBlur = 12;
  ctx.fillText('NOVA Support Pool', cx, 1008);
  ctx.shadowBlur = 0;

  ctx.font = '400 28px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillText('novapool.official · TikTok Community', cx, 1058);

  // Divider
  const divY = 1118;
  const divG = ctx.createLinearGradient(cx - 410, divY, cx + 410, divY);
  divG.addColorStop(0, 'rgba(196,181,253,0)'); divG.addColorStop(0.5, 'rgba(196,181,253,0.85)'); divG.addColorStop(1, 'rgba(196,181,253,0)');
  ctx.strokeStyle = divG; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(cx - 410, divY); ctx.lineTo(cx + 410, divY); ctx.stroke();

  // ── STAT CARDS ───────────────────────────────────────────────
  const statsData = [
    { v: String(given),                       l: t('given') || 'Gegeben' },
    { v: (bal >= 0 ? '+' : '') + String(bal), l: t('balance') || 'Guthaben' },
    { v: String(memberDays),                  l: t('daysInPool') || 'Tage im Pool' },
    { v: activeLast7 + '/7',                  l: t('activeDays') || 'Aktiv' },
  ];

  const cW = 474, cH = 268, gap = 48;
  const startX = (W - (2*cW + gap)) / 2;
  const startY = 1148;

  statsData.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const bx = startX + col*(cW + gap), by = startY + row*(cH + gap);
    const bcx = bx + cW/2, bcy = by + cH/2;

    // Glow shadow
    ctx.save();
    ctx.shadowColor = 'rgba(109,40,217,0.55)'; ctx.shadowBlur = 38; ctx.shadowOffsetY = 16;
    _rrect(ctx, bx, by + 14, cW, cH, 24); ctx.fillStyle = 'rgba(45,20,90,0.01)'; ctx.fill();
    ctx.restore();

    // Glass body
    _rrect(ctx, bx, by, cW, cH, 24);
    const cF = ctx.createLinearGradient(bx, by, bx + cW, by + cH);
    cF.addColorStop(0, 'rgba(65,20,140,0.82)');
    cF.addColorStop(0.5, 'rgba(30,8,72,0.88)');
    cF.addColorStop(1, 'rgba(15,20,75,0.80)');
    ctx.fillStyle = cF; ctx.fill();

    // Gradient border
    _rrect(ctx, bx, by, cW, cH, 24);
    const bord = ctx.createLinearGradient(bx, by, bx + cW, by + cH);
    bord.addColorStop(0,    'rgba(120,180,255,0.70)');
    bord.addColorStop(0.35, 'rgba(196,181,253,0.80)');
    bord.addColorStop(0.65, 'rgba(100,160,255,0.35)');
    bord.addColorStop(1,    'rgba(55,18,120,0.12)');
    ctx.strokeStyle = bord; ctx.lineWidth = 2; ctx.stroke();

    // Top rim shine
    ctx.save(); _rrect(ctx, bx, by, cW, cH, 24); ctx.clip();
    const rim = ctx.createLinearGradient(bx, by, bx, by + 58);
    rim.addColorStop(0, 'rgba(255,255,255,0.26)'); rim.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rim; ctx.fillRect(bx, by, cW, 58); ctx.restore();

    // Value
    ctx.save();
    ctx.shadowColor = 'rgba(167,139,250,0.80)'; ctx.shadowBlur = 22;
    const valG = ctx.createLinearGradient(bx, by, bx + cW, by + cH);
    valG.addColorStop(0, '#c4b5fd'); valG.addColorStop(0.5, '#a78bfa'); valG.addColorStop(1, '#60a5fa');
    ctx.font = 'bold 104px Inter, Arial, sans-serif';
    ctx.fillStyle = valG; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.v, bcx, bcy - 14); ctx.restore();

    // Label
    ctx.font = '600 32px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.l, bcx, bcy + 66);
  });

  // ── FOOTER ───────────────────────────────────────────────────
  ctx.font = '400 27px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦  novapool.official  ·  TikTok Community  ✦', W/2, H - 90);
}

export async function downloadStoryCard() {
  await drawStoryCanvas();
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
on('story:save', () => downloadStoryCard().catch(e => toast('Fehler: ' + e.message, 'error')));

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
