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
  const verified = isVerified(u);

  const W = 1080, H = 1920;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
  const rand = rng(42);

  // ── Background ─────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0,   '#030110');
  bg.addColorStop(0.3, '#0f0428');
  bg.addColorStop(0.65,'#08031a');
  bg.addColorStop(1,   '#020109');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Nebula clouds
  for (const [nx, ny, nr, nc] of [
    [W*0.15, H*0.12, 460, 'rgba(100,30,210,0.38)'],
    [W*0.85, H*0.28, 320, 'rgba(30,90,230,0.22)'],
    [W*0.5,  H*0.52, 400, 'rgba(6,182,212,0.14)'],
    [W*0.1,  H*0.75, 280, 'rgba(170,30,230,0.18)'],
    [W*0.9,  H*0.82, 340, 'rgba(70,10,190,0.24)'],
    [W*0.6,  H*0.95, 300, 'rgba(124,58,237,0.15)'],
  ]) {
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    g.addColorStop(0, nc); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Starfield – varied sizes
  for (let i = 0; i < 220; i++) {
    const x = rand()*W, y = rand()*H, r = rand()*2.8+0.25, a = rand()*0.65+0.07;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }

  // 4-point sparkles
  const _sparkle = (x, y, sz, a) => {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(sz*0.22, sz*0.22, 0, sz);
      ctx.quadraticCurveTo(-sz*0.22, sz*0.22, 0, 0); ctx.fill();
    }
    ctx.restore();
  };
  for (const [sx,sy,ss,sa] of [[115,210,20,0.75],[940,260,15,0.65],[68,500,24,0.55],[990,680,17,0.60],[145,1380,22,0.60],[930,1280,13,0.52],[48,1120,18,0.42],[1030,1050,15,0.58],[820,140,12,0.5]]) _sparkle(sx,sy,ss,sa);

  // Shooting star
  ctx.save();
  const ssG = ctx.createLinearGradient(820,110, 600,290);
  ssG.addColorStop(0,'rgba(255,255,255,0)'); ssG.addColorStop(0.7,'rgba(255,255,255,0.55)'); ssG.addColorStop(1,'rgba(255,255,255,0)');
  ctx.strokeStyle = ssG; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(820,110); ctx.lineTo(600,290); ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ── Top banner pill ─────────────────────────────────────────
  const banH = 78, banW = 700, banX = (W-banW)/2, banY = 94;
  _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.55)'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.save(); _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2); ctx.clip();
  const banShine = ctx.createLinearGradient(banX, banY-banH/2, banX, banY);
  banShine.addColorStop(0,'rgba(255,255,255,0.14)'); banShine.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = banShine; ctx.fillRect(banX, banY-banH/2, banW, banH/2); ctx.restore();
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.shadowColor='rgba(167,139,250,0.6)'; ctx.shadowBlur=8;
  ctx.fillText('⭐  NOVA SUPPORT POOL  ⭐', W/2, banY);
  ctx.shadowBlur = 0;

  // ── Rocket ─────────────────────────────────────────────────
  const _rocket = (rx, ry, sc) => {
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(-Math.PI/5); ctx.scale(sc, sc);
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 70, 0, 0, Math.PI*2);
    const bG = ctx.createLinearGradient(-28,-70,28,70);
    bG.addColorStop(0,'#c4b5fd'); bG.addColorStop(1,'#6d28d9');
    ctx.fillStyle=bG; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=2.5; ctx.stroke();
    // nose
    ctx.beginPath(); ctx.moveTo(0,-70); ctx.lineTo(-28,-18); ctx.lineTo(28,-18); ctx.closePath();
    const nG=ctx.createLinearGradient(-28,-70,28,-18); nG.addColorStop(0,'#ddd6fe'); nG.addColorStop(1,'#7c3aed');
    ctx.fillStyle=nG; ctx.fill();
    // window
    ctx.beginPath(); ctx.arc(0,-6,15,0,Math.PI*2);
    ctx.fillStyle='rgba(6,182,212,0.85)'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2.5; ctx.stroke();
    // fins
    for (const s of [-1,1]) {
      ctx.beginPath(); ctx.moveTo(s*28,38); ctx.lineTo(s*64,82); ctx.lineTo(s*28,58); ctx.closePath();
      ctx.fillStyle='#9f60ff'; ctx.fill();
    }
    // flame
    const fG=ctx.createRadialGradient(0,88,0,0,115,48);
    fG.addColorStop(0,'rgba(255,210,50,0.95)'); fG.addColorStop(0.4,'rgba(255,90,10,0.70)'); fG.addColorStop(1,'rgba(255,40,0,0)');
    ctx.fillStyle=fG; ctx.beginPath(); ctx.ellipse(0,102,20,44,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  };
  _rocket(108, 830, 1.45);

  // ── Avatar ─────────────────────────────────────────────────
  const cx = W/2, cy = H*0.30;
  const avR = 162;

  // Outer halo
  const hG = ctx.createRadialGradient(cx,cy,avR-20,cx,cy,avR+90);
  hG.addColorStop(0,'rgba(124,58,237,0.48)'); hG.addColorStop(1,'rgba(124,58,237,0)');
  ctx.fillStyle=hG; ctx.beginPath(); ctx.arc(cx,cy,avR+90,0,Math.PI*2); ctx.fill();

  // Ripple rings
  for (const [rr,ra] of [[avR+14,0.28],[avR+32,0.13]]) {
    ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2);
    ctx.strokeStyle=`rgba(124,58,237,${ra})`; ctx.lineWidth=2; ctx.stroke();
  }

  // Avatar fill
  ctx.beginPath(); ctx.arc(cx,cy,avR,0,Math.PI*2);
  const avG = ctx.createLinearGradient(cx-avR,cy-avR,cx+avR,cy+avR);
  avG.addColorStop(0,'#9f60ff'); avG.addColorStop(1,'#06b6d4');
  ctx.fillStyle=avG; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=4; ctx.stroke();

  // Glossy highlight
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,avR,0,Math.PI*2); ctx.clip();
  const gloss=ctx.createLinearGradient(cx-avR,cy-avR,cx+avR*0.35,cy+avR*0.4);
  gloss.addColorStop(0,'rgba(255,255,255,0.28)'); gloss.addColorStop(0.5,'rgba(255,255,255,0.05)'); gloss.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gloss; ctx.fillRect(cx-avR,cy-avR,avR*2,avR*2); ctx.restore();

  // Initials
  ctx.font='bold 108px Inter, Arial, sans-serif';
  ctx.fillStyle='#ffffff'; ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=18;
  ctx.fillText((cu||'?').slice(0,2).toUpperCase(), cx, cy);
  ctx.shadowBlur=0;

  // Crown for verified
  if (verified) {
    ctx.font='82px serif';
    ctx.fillText('👑', cx, cy-avR-36);
  }

  // ── Username ───────────────────────────────────────────────
  const nameY = cy + avR + 72;
  ctx.font = 'bold 64px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  const uname = '@' + (u.name || cu || '');
  ctx.fillText(uname, cx, nameY);

  // Verified badge on canvas
  if (verified) {
    const tw = ctx.measureText(uname).width;
    const bx = cx + tw/2 + 36, by = nameY;
    ctx.beginPath(); ctx.arc(bx, by, 24, 0, Math.PI*2);
    ctx.fillStyle='#3b82f6'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(bx-11,by+1); ctx.lineTo(bx-2,by+11); ctx.lineTo(bx+13,by-8);
    ctx.stroke();
  }

  // Subtitle
  ctx.font='500 34px Inter, Arial, sans-serif';
  ctx.fillStyle='rgba(167,139,250,0.92)';
  ctx.fillText('NOVA Support Pool', cx, nameY+70);

  // novapool.official
  ctx.font='400 26px Inter, Arial, sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.30)';
  ctx.fillText('novapool.official · TikTok Community', cx, nameY+118);

  // Divider
  const divY = nameY + 164;
  const divG2 = ctx.createLinearGradient(W/2-360,divY,W/2+360,divY);
  divG2.addColorStop(0,'rgba(124,58,237,0)'); divG2.addColorStop(0.5,'rgba(167,139,250,0.7)'); divG2.addColorStop(1,'rgba(124,58,237,0)');
  ctx.strokeStyle=divG2; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(W/2-360,divY); ctx.lineTo(W/2+360,divY); ctx.stroke();

  // ── Stats Grid ─────────────────────────────────────────────
  const statsData = [
    { v: String(given),                        l: t('given')      || 'Gegeben'     },
    { v: (bal >= 0 ? '+' : '') + String(bal),  l: t('balance')    || 'Guthaben'    },
    { v: String(memberDays),                   l: t('daysInPool') || 'daysInPool'  },
    { v: activeLast7 + '/7',                   l: t('activeDays') || 'activeDays'  },
  ];

  const cW=448, cH=242, gX=44, gY=40;
  const startX=(W-(2*cW+gX))/2;
  const startY=divY+58;

  statsData.forEach((s, i) => {
    const col=i%2, row=Math.floor(i/2);
    const bx=startX+col*(cW+gX), by=startY+row*(cH+gY);
    const bcx=bx+cW/2, bcy=by+cH/2;

    // 3D drop shadow
    ctx.save();
    ctx.shadowColor='rgba(124,58,237,0.35)'; ctx.shadowBlur=28; ctx.shadowOffsetY=10;
    _rrect(ctx, bx+5, by+10, cW, cH, 30);
    ctx.fillStyle='rgba(70,20,150,0.30)'; ctx.fill();
    ctx.restore();

    // Glass card fill
    _rrect(ctx, bx, by, cW, cH, 30);
    const cardFill = ctx.createLinearGradient(bx, by, bx+cW, by+cH);
    cardFill.addColorStop(0,'rgba(255,255,255,0.09)');
    cardFill.addColorStop(1,'rgba(255,255,255,0.04)');
    ctx.fillStyle=cardFill; ctx.fill();

    // Gradient border
    const bord=ctx.createLinearGradient(bx,by,bx+cW,by+cH);
    bord.addColorStop(0,'rgba(167,139,250,0.6)'); bord.addColorStop(0.5,'rgba(34,211,238,0.35)'); bord.addColorStop(1,'rgba(167,139,250,0.2)');
    ctx.strokeStyle=bord; ctx.lineWidth=1.8; ctx.stroke();

    // Inner top shine
    ctx.save(); _rrect(ctx, bx, by, cW, cH, 30); ctx.clip();
    const shine=ctx.createLinearGradient(bx,by,bx,by+70);
    shine.addColorStop(0,'rgba(255,255,255,0.14)'); shine.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=shine; ctx.fillRect(bx,by,cW,70); ctx.restore();

    // Value
    const valG=ctx.createLinearGradient(bx,by,bx+cW,by+cH);
    valG.addColorStop(0,'#c4b5fd'); valG.addColorStop(0.5,'#60a5fa'); valG.addColorStop(1,'#22d3ee');
    ctx.font='bold 90px Inter, Arial, sans-serif';
    ctx.fillStyle=valG;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(s.v, bcx, bcy-18);

    // Label
    ctx.font='400 28px Inter, Arial, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.50)';
    ctx.fillText(s.l, bcx, bcy+58);
  });

  // ── Bottom footer ───────────────────────────────────────────
  const footY = H - 82;
  ctx.font='400 25px Inter, Arial, sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.22)';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('✦  novapool.official  ·  TikTok Community  ✦', W/2, footY);
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
