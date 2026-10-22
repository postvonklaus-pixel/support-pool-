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
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const rng = (seed) => { let s = seed|0 || 1; return () => { s = Math.imul(s, 48271) >>> 0 || 1; return s / 4294967296; }; };

  // ═══════════════════════════════════════════════════════════
  //  LAYER 1 — DEEP SPACE BACKGROUND
  // ═══════════════════════════════════════════════════════════
  ctx.fillStyle = '#010008';
  ctx.fillRect(0, 0, W, H);

  const bgG = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.3, H*0.8);
  bgG.addColorStop(0, 'rgba(30,10,80,0.9)');
  bgG.addColorStop(0.5, 'rgba(10,3,40,0.7)');
  bgG.addColorStop(1, 'rgba(0,0,8,0)');
  ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

  for (const [nx,ny,nr,nc] of [
    [W*0.75, H*0.12, 480, 'rgba(90,20,200,0.45)'],
    [W*0.88, H*0.28, 360, 'rgba(20,60,220,0.30)'],
    [W*0.60, H*0.38, 550, 'rgba(124,58,237,0.22)'],
    [W*0.80, H*0.60, 400, 'rgba(160,20,240,0.25)'],
    [W*0.92, H*0.75, 380, 'rgba(40,10,180,0.28)'],
    [W*0.55, H*0.85, 440, 'rgba(6,182,212,0.14)'],
    [W*0.70, H*0.50, 280, 'rgba(200,50,240,0.10)'],
  ]) {
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    g.addColorStop(0, nc); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 2 — 300 STARS with cross-flares + shooting stars
  // ═══════════════════════════════════════════════════════════
  const rand = rng(7919);
  for (let i = 0; i < 300; i++) {
    const x = rand()*W, y = rand()*H;
    const r = rand() < 0.08 ? rand()*2.8+2.0 : rand()*1.4+0.2;
    const a = rand()*0.7+0.1;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    if (r > 2.5) {
      ctx.strokeStyle = `rgba(255,255,255,${(a*0.35).toFixed(2)})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x-r*3.5,y); ctx.lineTo(x+r*3.5,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y-r*3.5); ctx.lineTo(x,y+r*3.5); ctx.stroke();
    }
  }
  for (const [x1,y1,x2,y2,op] of [[820,95,590,295,0.6],[260,340,440,180,0.4]]) {
    const sg = ctx.createLinearGradient(x1,y1,x2,y2);
    sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(0.6,`rgba(255,255,255,${op})`); sg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.save(); ctx.strokeStyle=sg; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 3 — GIANT ROCKET (hero element, upper-left)
  // ═══════════════════════════════════════════════════════════
  const _rocket = (rx, ry, sc, rot) => {
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(rot); ctx.scale(sc, sc);
    const fhG = ctx.createRadialGradient(0,110,0,0,110,120);
    fhG.addColorStop(0,'rgba(255,160,0,0.70)');
    fhG.addColorStop(0.4,'rgba(255,80,0,0.40)');
    fhG.addColorStop(1,'rgba(255,30,0,0)');
    ctx.fillStyle=fhG; ctx.fillRect(-120,30,240,200);
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 82, 0, 0, Math.PI*2);
    const bG=ctx.createLinearGradient(-34,-82,34,82);
    bG.addColorStop(0,'#ede9fe'); bG.addColorStop(0.3,'#a78bfa'); bG.addColorStop(0.7,'#7c3aed'); bG.addColorStop(1,'#4c1d95');
    ctx.fillStyle=bG; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.40)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0,0,34,82,0,0,Math.PI*2); ctx.clip();
    const bgl=ctx.createLinearGradient(-34,-60,14,60);
    bgl.addColorStop(0,'rgba(255,255,255,0.42)'); bgl.addColorStop(0.5,'rgba(255,255,255,0.06)'); bgl.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=bgl; ctx.fillRect(-34,-82,68,164); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0,0,34,82,0,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(-34,22,68,14); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0,-82); ctx.lineTo(-34,-22); ctx.lineTo(34,-22); ctx.closePath();
    const nG=ctx.createLinearGradient(-34,-82,34,-22);
    nG.addColorStop(0,'#f5f3ff'); nG.addColorStop(1,'#7c3aed');
    ctx.fillStyle=nG; ctx.fill();
    ctx.beginPath(); ctx.arc(0,-8,18,0,Math.PI*2);
    const wG=ctx.createRadialGradient(-5,-13,2,-5,-13,18);
    wG.addColorStop(0,'rgba(186,230,253,1)'); wG.addColorStop(0.5,'rgba(6,182,212,0.9)'); wG.addColorStop(1,'rgba(2,100,150,0.8)');
    ctx.fillStyle=wG; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(-6,-14,5,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fill();
    for (const s of [-1,1]) {
      ctx.beginPath(); ctx.moveTo(s*34,44); ctx.lineTo(s*78,96); ctx.lineTo(s*34,70); ctx.closePath();
      const fG2=ctx.createLinearGradient(0,44,s*80,96);
      fG2.addColorStop(0,'#c4b5fd'); fG2.addColorStop(1,'#5b21b6');
      ctx.fillStyle=fG2; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1.5; ctx.stroke();
    }
    const flCoreG=ctx.createRadialGradient(0,100,0,0,100,28);
    flCoreG.addColorStop(0,'rgba(255,255,220,1)'); flCoreG.addColorStop(0.4,'rgba(255,200,60,0.9)'); flCoreG.addColorStop(1,'rgba(255,120,0,0)');
    ctx.fillStyle=flCoreG; ctx.beginPath(); ctx.ellipse(0,100,16,34,0,0,Math.PI*2); ctx.fill();
    const flG=ctx.createRadialGradient(0,110,0,0,145,60);
    flG.addColorStop(0,'rgba(255,160,10,0.90)'); flG.addColorStop(0.35,'rgba(255,80,0,0.65)'); flG.addColorStop(0.7,'rgba(255,40,0,0.30)'); flG.addColorStop(1,'rgba(255,20,0,0)');
    ctx.fillStyle=flG; ctx.beginPath(); ctx.ellipse(0,118,26,56,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  };
  _rocket(142, 700, 2.6, -Math.PI/16);

  // ═══════════════════════════════════════════════════════════
  //  LAYER 4 — SMOKE CLOUDS behind rocket exhaust
  // ═══════════════════════════════════════════════════════════
  const randSmk = rng(11111);
  for (let i = 0; i < 9; i++) {
    const sx = 60 + randSmk()*320;
    const sy = 1000 + i*38 + randSmk()*20;
    const sr = 80 + randSmk()*130;
    const sa = 0.08 + randSmk()*0.14;
    const scG = ctx.createRadialGradient(sx,sy,0,sx,sy,sr);
    scG.addColorStop(0,`rgba(200,180,160,${sa})`);
    scG.addColorStop(0.5,`rgba(160,140,120,${sa*0.5})`);
    scG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=scG; ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 5 — FIRE EMBERS
  // ═══════════════════════════════════════════════════════════
  const randEmb = rng(23456);
  for (let i = 0; i < 55; i++) {
    const ex = 60 + randEmb()*400, ey = 920 + randEmb()*520;
    const er = 1.5 + randEmb()*4;
    const ea = 0.4 + randEmb()*0.6;
    const ec = randEmb() < 0.5
      ? `rgba(255,${Math.floor(80+randEmb()*140)},0,${ea})`
      : `rgba(255,${Math.floor(180+randEmb()*75)},20,${ea})`;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI*2);
    ctx.fillStyle = ec; ctx.fill();
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 6 — EXPLOSION BURST behind avatar
  // ═══════════════════════════════════════════════════════════
  const cx = W/2, cy = H * 0.295;

  const expG = ctx.createRadialGradient(cx,cy,0,cx,cy,430);
  expG.addColorStop(0,   'rgba(255,220,60,0.75)');
  expG.addColorStop(0.22,'rgba(255,160,20,0.55)');
  expG.addColorStop(0.42,'rgba(200,60,10,0.38)');
  expG.addColorStop(0.65,'rgba(100,20,160,0.28)');
  expG.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle=expG; ctx.beginPath(); ctx.arc(cx,cy,430,0,Math.PI*2); ctx.fill();

  // ═══════════════════════════════════════════════════════════
  //  LAYER 7 — 24-WEDGE SUNBURST (screen blend for additive glow)
  // ═══════════════════════════════════════════════════════════
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';
  const rayLen = H * 1.6;
  for (let k = 0; k < 24; k++) {
    const angle = (k / 24) * Math.PI * 2;
    const isGold = k % 3 === 0, isPurple = k % 3 === 2;
    const col = isGold ? 'rgba(255,200,50,' : (isPurple ? 'rgba(120,40,220,' : 'rgba(255,255,255,');
    const alpha0 = isGold ? 0.12 : (isPurple ? 0.08 : 0.07);
    ctx.save();
    ctx.rotate(angle);
    const rayG = ctx.createLinearGradient(0,0,0,-rayLen);
    rayG.addColorStop(0,   col+alpha0+')');
    rayG.addColorStop(0.15,col+(alpha0*0.6)+')');
    rayG.addColorStop(1,   col+'0)');
    ctx.fillStyle = rayG;
    const hw = 0.04 * rayLen;
    ctx.beginPath();
    ctx.moveTo(-hw*0.15,0); ctx.lineTo(hw*0.15,0);
    ctx.lineTo(hw,-rayLen); ctx.lineTo(-hw,-rayLen);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // ═══════════════════════════════════════════════════════════
  //  LAYER 8 — TOP BANNER (glassmorphic pill)
  // ═══════════════════════════════════════════════════════════
  const banH = 82, banW = 740, banX = (W-banW)/2, banY = 96;
  ctx.save(); ctx.shadowColor='rgba(167,139,250,0.5)'; ctx.shadowBlur=30;
  _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2);
  ctx.fillStyle='rgba(0,0,0,0)'; ctx.fill(); ctx.restore();
  _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2);
  ctx.fillStyle='rgba(12,4,38,0.82)'; ctx.fill();
  _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2);
  const banBord = ctx.createLinearGradient(banX, banY-banH/2, banX, banY+banH/2);
  banBord.addColorStop(0,'rgba(255,255,255,0.65)');
  banBord.addColorStop(0.4,'rgba(167,139,250,0.55)');
  banBord.addColorStop(1,'rgba(124,58,237,0.12)');
  ctx.strokeStyle=banBord; ctx.lineWidth=2; ctx.stroke();
  ctx.save(); _rrect(ctx, banX, banY-banH/2, banW, banH, banH/2); ctx.clip();
  const bSh = ctx.createLinearGradient(banX, banY-banH/2, banX, banY);
  bSh.addColorStop(0,'rgba(255,255,255,0.25)'); bSh.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=bSh; ctx.fillRect(banX, banY-banH/2, banW, banH/2); ctx.restore();
  ctx.font = 'bold 34px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(200,170,255,0.9)'; ctx.shadowBlur = 12;
  ctx.fillText('⭐  NOVA SUPPORT POOL  ⭐', W/2, banY);
  ctx.shadowBlur = 0;

  // ═══════════════════════════════════════════════════════════
  //  LAYER 9 — AVATAR (large glass orb with gold explosion ring)
  // ═══════════════════════════════════════════════════════════
  const avR = 178;

  const atmoG = ctx.createRadialGradient(cx,cy,avR,cx,cy,avR+220);
  atmoG.addColorStop(0,'rgba(124,58,237,0.42)'); atmoG.addColorStop(0.5,'rgba(90,30,200,0.14)'); atmoG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=atmoG; ctx.beginPath(); ctx.arc(cx,cy,avR+220,0,Math.PI*2); ctx.fill();

  for (const [rr,rw,ra,rc] of [
    [avR+6,  3,   0.60, 'rgba(255,200,50,'],
    [avR+22, 1.8, 0.32, 'rgba(167,139,250,'],
    [avR+42, 1.2, 0.16, 'rgba(124,58,237,'],
  ]) {
    ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2);
    ctx.strokeStyle=`${rc}${ra})`; ctx.lineWidth=rw; ctx.stroke();
  }

  ctx.beginPath(); ctx.arc(cx,cy,avR,0,Math.PI*2);
  const avG = ctx.createLinearGradient(cx-avR,cy-avR,cx+avR,cy+avR);
  avG.addColorStop(0,'#b4a4ff'); avG.addColorStop(0.35,'#7c3aed'); avG.addColorStop(0.7,'#2563eb'); avG.addColorStop(1,'#06b6d4');
  ctx.fillStyle=avG; ctx.fill();
  ctx.strokeStyle='rgba(255,230,100,0.50)'; ctx.lineWidth=4; ctx.stroke();

  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,avR,0,Math.PI*2); ctx.clip();
  const sphHi = ctx.createRadialGradient(cx-avR*0.38, cy-avR*0.44, 0, cx-avR*0.38, cy-avR*0.44, avR*1.1);
  sphHi.addColorStop(0,'rgba(255,255,255,0.60)'); sphHi.addColorStop(0.35,'rgba(255,255,255,0.20)'); sphHi.addColorStop(0.7,'rgba(255,255,255,0.04)'); sphHi.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sphHi; ctx.fillRect(cx-avR,cy-avR,avR*2,avR*2);
  const sphSh = ctx.createRadialGradient(cx+avR*0.42, cy+avR*0.40, 0, cx+avR*0.42, cy+avR*0.40, avR);
  sphSh.addColorStop(0,'rgba(0,0,30,0.55)'); sphSh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sphSh; ctx.fillRect(cx-avR,cy-avR,avR*2,avR*2); ctx.restore();

  ctx.font = 'bold 118px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=22;
  ctx.fillText((cu||'?').slice(0,2).toUpperCase(), cx, cy);
  ctx.shadowBlur=0;

  if (verified) {
    ctx.font='90px serif';
    ctx.textBaseline='middle';
    ctx.fillText('👑', cx, cy-avR-42);
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 10 — USERNAME + TITLES
  // ═══════════════════════════════════════════════════════════
  const nameY = cy + avR + 78;

  ctx.font = 'bold 70px Inter, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(200,180,255,0.7)'; ctx.shadowBlur = 16;
  const uname = '@' + (u.name || cu || '');
  ctx.fillText(uname, cx, nameY);
  ctx.shadowBlur = 0;

  if (verified) {
    const tw = ctx.measureText(uname).width;
    const bx = cx + tw/2 + 40, by2 = nameY;
    ctx.save();
    ctx.shadowColor='rgba(59,130,246,0.8)'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(bx,by2,26,0,Math.PI*2);
    ctx.fillStyle='#3b82f6'; ctx.fill(); ctx.restore();
    ctx.strokeStyle='rgba(255,255,255,0.90)'; ctx.lineWidth=3.5;
    ctx.beginPath();
    ctx.moveTo(bx-12,by2+2); ctx.lineTo(bx-3,by2+12); ctx.lineTo(bx+14,by2-9);
    ctx.stroke();
  }

  ctx.font = '600 38px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(196,181,253,0.95)';
  ctx.shadowColor='rgba(124,58,237,0.6)'; ctx.shadowBlur=10;
  ctx.fillText('NOVA Support Pool', cx, nameY + 76);
  ctx.shadowBlur = 0;

  ctx.font = '400 28px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText('novapool.official · TikTok Community', cx, nameY + 128);

  const divY = nameY + 180;
  const divG2 = ctx.createLinearGradient(W/2-400,divY,W/2+400,divY);
  divG2.addColorStop(0,'rgba(124,58,237,0)'); divG2.addColorStop(0.5,'rgba(196,181,253,0.80)'); divG2.addColorStop(1,'rgba(124,58,237,0)');
  ctx.strokeStyle=divG2; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(W/2-400,divY); ctx.lineTo(W/2+400,divY); ctx.stroke();

  // ═══════════════════════════════════════════════════════════
  //  LAYER 11 — STAT CARDS (dark glassmorphism)
  // ═══════════════════════════════════════════════════════════
  const statsData = [
    { v: String(given),                        l: t('given')      || 'Gegeben'    },
    { v: (bal >= 0 ? '+' : '') + String(bal),  l: t('balance')    || 'Guthaben'   },
    { v: String(memberDays),                   l: t('daysInPool') || 'daysInPool' },
    { v: activeLast7 + '/7',                   l: t('activeDays') || 'activeDays' },
  ];

  const cW = 474, cH = 270, gX = 48, gY = 46;
  const startX = (W - (2*cW+gX)) / 2;
  const startY = divY + 62;

  statsData.forEach((s, i) => {
    const col=i%2, row=Math.floor(i/2);
    const bx=startX+col*(cW+gX), by=startY+row*(cH+gY);
    const bcx=bx+cW/2, bcy=by+cH/2;

    ctx.save();
    ctx.shadowColor='rgba(124,58,237,0.55)'; ctx.shadowBlur=40; ctx.shadowOffsetX=0; ctx.shadowOffsetY=16;
    _rrect(ctx, bx, by+14, cW, cH, 32);
    ctx.fillStyle='rgba(60,15,130,0.01)'; ctx.fill();
    ctx.restore();

    _rrect(ctx, bx, by, cW, cH, 32);
    ctx.fillStyle='rgba(72,22,150,0.78)'; ctx.fill();

    _rrect(ctx, bx, by, cW, cH, 32);
    const bord = ctx.createLinearGradient(bx,by,bx+cW,by+cH);
    bord.addColorStop(0,   'rgba(255,255,255,0.75)');
    bord.addColorStop(0.25,'rgba(196,181,253,0.88)');
    bord.addColorStop(0.55,'rgba(34,211,238,0.50)');
    bord.addColorStop(1,   'rgba(80,30,160,0.12)');
    ctx.strokeStyle=bord; ctx.lineWidth=2.2; ctx.stroke();

    ctx.save(); _rrect(ctx,bx,by,cW,cH,32); ctx.clip();
    const rim = ctx.createLinearGradient(bx,by,bx,by+60);
    rim.addColorStop(0,'rgba(255,255,255,0.28)'); rim.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=rim; ctx.fillRect(bx,by,cW,60); ctx.restore();

    ctx.save();
    ctx.shadowColor='rgba(167,139,250,0.85)'; ctx.shadowBlur=28;
    const valG = ctx.createLinearGradient(bx,by,bx+cW,by+cH);
    valG.addColorStop(0,'#ffffff'); valG.addColorStop(0.35,'#c4b5fd'); valG.addColorStop(0.7,'#60a5fa'); valG.addColorStop(1,'#22d3ee');
    ctx.font='bold 104px Inter, Arial, sans-serif';
    ctx.fillStyle=valG;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(s.v, bcx, bcy-16);
    ctx.restore();

    ctx.font='600 32px Inter, Arial, sans-serif';
    ctx.fillStyle='rgba(255,255,255,0.78)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(s.l, bcx, bcy+64);
  });

  // ═══════════════════════════════════════════════════════════
  //  LAYER 12 — 4-POINT SPARKLES
  // ═══════════════════════════════════════════════════════════
  const _sparkle = (x, y, sz, a) => {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(sz*0.2, sz*0.2, 0, sz);
      ctx.quadraticCurveTo(-sz*0.2, sz*0.2, 0, 0); ctx.fill();
    }
    ctx.restore();
  };
  for (const [sx,sy,ss,sa] of [
    [108,215,26,0.85],[956,288,18,0.70],[60,510,28,0.65],[1002,660,21,0.70],
    [1040,1080,18,0.60],[980,1340,17,0.55],[42,1160,22,0.50],[130,1440,24,0.65],
    [880,1560,15,0.55],[200,1650,18,0.50],[820,130,14,0.60],[38,370,16,0.45],
    [930,480,20,0.55],[700,1720,15,0.45],[340,1800,18,0.50],
  ]) _sparkle(sx, sy, ss, sa);

  // ═══════════════════════════════════════════════════════════
  //  LAYER 13 — ASTEROIDS (right side, irregular polygons)
  // ═══════════════════════════════════════════════════════════
  const randAst = rng(54321);
  for (let i = 0; i < 12; i++) {
    const ax = 660 + randAst()*360, ay = 300 + randAst()*1300;
    const ar = 14 + randAst()*38;
    const aAlpha = 0.25 + randAst()*0.35;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(randAst()*Math.PI*2);
    ctx.beginPath();
    for (let v = 0; v < 8; v++) {
      const ang = (v/8)*Math.PI*2;
      const rr2 = ar*(0.65+randAst()*0.55);
      const vx = Math.cos(ang)*rr2, vy = Math.sin(ang)*rr2;
      v===0 ? ctx.moveTo(vx,vy) : ctx.lineTo(vx,vy);
    }
    ctx.closePath();
    const astG = ctx.createLinearGradient(-ar,-ar,ar,ar);
    astG.addColorStop(0,`rgba(180,160,140,${aAlpha})`);
    astG.addColorStop(1,`rgba(80,70,60,${aAlpha*0.5})`);
    ctx.fillStyle=astG; ctx.fill();
    ctx.strokeStyle=`rgba(220,200,180,${aAlpha*0.6})`; ctx.lineWidth=1.2; ctx.stroke();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 14 — BOKEH DOTS (corners)
  // ═══════════════════════════════════════════════════════════
  for (const [bkx,bky,bkr,bka] of [
    [90,  200, 28, 0.18],
    [980, 180, 22, 0.14],
    [60,  1700,32, 0.16],
    [1010,1680,24, 0.13],
    [200, 1100,18, 0.12],
    [900, 1200,20, 0.14],
  ]) {
    const bkG = ctx.createRadialGradient(bkx,bky,0,bkx,bky,bkr);
    bkG.addColorStop(0,`rgba(200,180,255,${bka})`);
    bkG.addColorStop(0.6,`rgba(120,80,220,${bka*0.4})`);
    bkG.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bkG; ctx.beginPath(); ctx.arc(bkx,bky,bkr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(220,200,255,${bka*1.2})`; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(bkx,bky,bkr*0.7,0,Math.PI*2); ctx.stroke();
  }

  // ═══════════════════════════════════════════════════════════
  //  LAYER 15 — FOOTER
  // ═══════════════════════════════════════════════════════════
  ctx.font = '400 27px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦  novapool.official  ·  TikTok Community  ✦', W/2, H - 90);
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
