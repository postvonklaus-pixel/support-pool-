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
  const joined = u.joined || Date.now();
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
  const todayLabel = (t('profCheckToday') || 'Heute: {n}').replace('{n}', u.todayCount || 0);

  let html = `<div style="font-size:12px;font-weight:600;color:var(--text-tertiary,var(--text-secondary));text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${t('profCheckPos') || 'POSITIVES'}</div>`;
  html += _row('💰', `${t('profCheckBal')}: ${balGood ? t('profCheckBalGood') : t('profCheckBalBad')}`, balGood);
  html += _row('📹', `${t('profCheckVids')}: ${vids}`, vids > 0);
  html += _row('🤝', `${t('profCheckGiven')}: ${given}`, given >= 5);
  html += _row('📅', `${t('profCheckWeek')}: ${wGiven}`, wGiven >= 1);
  html += _row('🗓️', sinceLabel, memberDays >= 1);
  html += _row('🔥', daysLabel, activeLast7 >= 4);
  html += _row('⚡', todayLabel, (u.todayCount || 0) >= 1);

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

export function drawStoryCanvas() {
  const canvas = document.getElementById('pc-story-canvas');
  if (!canvas) return;

  const cu = state.currentUser;
  const u  = state.db.members?.[cu] || {};
  const stats = u.stats || {};
  const given = stats.given || 0;
  const recv  = stats.received || 0;
  const bal   = Math.min(given - recv, 20);
  const joined= u.joined || Date.now();
  const memberDays = Math.max(0, Math.floor((Date.now() - joined) / 86400000));
  const supportDays= u.supportDays || [];
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

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a0a14');
  bg.addColorStop(0.5, '#14082a');
  bg.addColorStop(1, '#0a0a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars / dots
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*W, Math.random()*H, Math.random()*3+1, 0, Math.PI*2);
    ctx.fill();
  }

  // Glow circle
  const grd = ctx.createRadialGradient(W/2, H*0.38, 0, W/2, H*0.38, 520);
  grd.addColorStop(0, 'rgba(124,58,237,0.35)');
  grd.addColorStop(1, 'rgba(6,182,212,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Avatar circle
  const cx = W/2, cy = H*0.32;
  ctx.beginPath();
  ctx.arc(cx, cy, 152, 0, Math.PI*2);
  const avGrd = ctx.createLinearGradient(cx-152, cy-152, cx+152, cy+152);
  avGrd.addColorStop(0, '#7c3aed');
  avGrd.addColorStop(1, '#06b6d4');
  ctx.fillStyle = avGrd;
  ctx.fill();
  ctx.font = 'bold 96px Inter, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText((cu || '?').slice(0,2).toUpperCase(), cx, cy);

  // Username
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('@' + (u.name || cu || ''), cx, H*0.32 + 220);

  // NOVA label
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillStyle = '#7c3aed';
  ctx.fillText('NOVA Support Pool', cx, H*0.32 + 296);

  // Stats
  const stats2 = [
    { v: String(given), l: t('given') || 'Gegeben' },
    { v: String(bal >= 0 ? '+' + bal : bal), l: t('balance') || 'Guthaben' },
    { v: String(memberDays), l: t('streakDays') || 'Tage' },
    { v: String(activeLast7) + '/7', l: t('profCheckDays')?.split('{n}')[1]?.trim() || 'aktiv' },
  ];
  const cols = stats2.length;
  const cw   = W / cols;
  const sy   = H * 0.62;
  stats2.forEach((s, i) => {
    const x = cw * i + cw / 2;
    const grd2 = ctx.createLinearGradient(x-80, sy, x+80, sy);
    grd2.addColorStop(0, '#7c3aed'); grd2.addColorStop(1, '#06b6d4');
    ctx.font = 'bold 72px Inter, sans-serif';
    ctx.fillStyle = grd2;
    ctx.fillText(s.v, x, sy);
    ctx.font = '400 30px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(s.l, x, sy + 88);
  });

  // Footer
  ctx.font = '400 28px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('novapool.official · TikTok Community', W/2, H - 96);
}

export function downloadStoryCard() {
  drawStoryCanvas();
  const canvas = document.getElementById('pc-story-canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'nova-profile-story.png';
  link.href     = canvas.toDataURL('image/png');
  link.click();
  toast('Story-Bild gespeichert! 📱', 'success');
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
