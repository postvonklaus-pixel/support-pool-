/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Login Screen · Obsidian Minimal
   ═══════════════════════════════════════════════════════ */

import { state, subscribe }   from '../state.js';
import { t, setLang }         from '../i18n.js';
import { on }                 from '../events.js';
import { ge, haptic, fbEnc, fbDec, copyToClipboard } from '../utils.js';
import { toast }              from '../components/toast.js';
import { writeDB }            from '../firebase.js';
import { handlePinKey, handlePinDel, initPinPad, resetPin, shakePin } from '../components/pinpad.js';
import { addNotif } from '../features/notifications.js';

const LANG_LIST = ['de','en','id','it','es','tr','ar','zh','ja','pl'];

const _LANG_META = {
  de: { flag: '🇩🇪', name: 'Deutsch' },
  en: { flag: '🇬🇧', name: 'English' },
  id: { flag: '🇮🇩', name: 'Bahasa Indonesia' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  es: { flag: '🇪🇸', name: 'Español' },
  tr: { flag: '🇹🇷', name: 'Türkçe' },
  ar: { flag: '🇸🇦', name: 'العربية' },
  zh: { flag: '🇨🇳', name: '中文' },
  ja: { flag: '🇯🇵', name: '日本語' },
  pl: { flag: '🇵🇱', name: 'Polski' },
};

let _step       = 'name';
let _username   = '';
let _pendingVal = null;
let _unsubDB    = null;
let _timeoutId  = null;

// ── Main render ───────────────────────────────────────
export function render() {
  _cleanup();
  _updateLangBtn();
  _updateTexts();
  _renderLoginBroadcast();
  _setupHandlers();
  _reset();
  _watchDB();
}

// ── DB-ready gate ─────────────────────────────────────
function _isDBReady() {
  return Object.keys(state.db.members || {}).length > 0;
}

function _watchDB() {
  _setLoginReady('loading');

  if (_isDBReady()) {
    _renderStats();
    _renderLoginBroadcast();
    setTimeout(() => _setLoginReady(true), 750);
    return;
  }

  _unsubDB = subscribe((change) => {
    if (change.path === 'db' && _isDBReady()) {
      const queued = _pendingVal;
      _cleanup();
      _setLoginReady(true);
      _renderStats();
      _renderLoginBroadcast();
      if (queued) {
        const input = ge('login-name-input');
        if (input) input.value = queued;
        _pendingVal = queued;
        _handleNameSubmit();
      }
    }
  });

  _timeoutId = setTimeout(() => {
    if (!_isDBReady()) {
      _cleanup();
      _setLoginReady('error');
    }
  }, 12000);
}

function _setLoginReady(s) {
  const btn    = ge('login-btn');
  const label  = ge('login-btn-label');
  const loader = ge('login-loader');
  if (!btn) return;

  if (loader) loader.classList.toggle('hidden', s !== 'loading');

  if (s === true) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.background = '';
    btn.style.color = '';
    if (label) label.textContent = t('loginBtnEnter') || t('loginBtn') || 'Pool betreten';
  } else if (s === 'loading') {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    if (label) label.textContent = t('loginLoading') || '⟳ Verbinde...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.background = 'var(--login-danger)';
    btn.style.color = '#fff';
    if (label) label.textContent = t('loginNoConn') || 'Keine Verbindung — Reload';
    btn.onclick = () => location.reload();
  }
}

function _cleanup() {
  if (_unsubDB)   { _unsubDB(); _unsubDB = null; }
  if (_timeoutId) { clearTimeout(_timeoutId); _timeoutId = null; }
  _pendingVal = null;
}

// ── Live stats (three stat tiles) ────────────────────
function _renderStats() {
  const members = state.db.members || {};
  const groups  = state.db.groups  || {};
  const videos  = state.db.videos  || {};

  const groupCount    = Object.keys(groups).length;
  const totalSupports = Object.values(members).reduce(
    (sum, m) => sum + (m.stats?.given || 0), 0
  );
  const openVideos = Object.values(videos).filter(v => v.status === 'open').length;

  const _fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

  const gs = ge('login-stat-groups');   if (gs) gs.textContent = _fmt(groupCount);
  const ss = ge('login-stat-supports'); if (ss) ss.textContent = _fmt(totalSupports);
  const vs = ge('login-stat-videos');   if (vs) vs.textContent = _fmt(openVideos);

  const memberCount = Object.keys(members).length;
  const eyebrow = ge('login-eyebrow');
  if (eyebrow) {
    eyebrow.textContent = memberCount >= 3
      ? t('loginEyebrowLive') || 'DEIN POOL · LIVE'
      : t('loginEyebrowStart') || 'Dein Pool startet';
  }
}

// ── Update all i18n texts on the login screen ────────
function _updateTexts() {
  const set = (id, val) => { const e = ge(id); if (e) e.textContent = val; };

  set('login-subtitle',     t('loginSubtitle')     || 'SUPPORT POOL');
  set('login-h1',           t('loginH1')           || 'Willkommen, Creator');
  set('login-h2',           t('loginH2')           || 'Dein TikTok-Wachstum beginnt hier.');
  set('login-micro-instant',t('loginMicroInstant') || 'Sofort');
  set('login-micro-free',   t('loginMicroFree')    || 'Kostenlos');
  set('login-micro-secure', t('loginMicroSecure')  || 'Sicher');
  set('login-footer-privacy',t('loginFooterPrivacy')|| 'Datenschutz');

  const input = ge('login-name-input');
  if (input) input.placeholder = t('loginInputPlaceholder') || 'TikTok Username';

  const btnLabel = ge('login-btn-label');
  const btn      = ge('login-btn');
  if (btnLabel && btn && !btn.disabled) {
    btnLabel.textContent = t('loginBtnEnter') || t('loginBtn') || 'Pool betreten';
  }

  set('pin-label', t('pinLabel') || 'PIN eingeben');
  const pf = ge('pin-forgot-link');
  if (pf) pf.textContent = t('pinForgot') || 'PIN vergessen?';

  _renderStats();
}

// ── Broadcast banner ──────────────────────────────────
function _renderLoginBroadcast() {
  const el = ge('login-broadcast');
  if (!el) return;
  const settings = state.db.settings || {};
  const text   = settings.broadcast || '';
  const active = settings.broadcastActive;
  if (!text || !active) { el.classList.add('hidden'); return; }

  try {
    const hash = btoa(text).slice(0, 16);
    if (localStorage.getItem('sp_bc_dim') === hash) { el.classList.add('hidden'); return; }
  } catch {}

  el.classList.remove('hidden');
  el.innerHTML = `
    <span class="login-bc__icon">📢</span>
    <span class="login-bc__text">${text.replace(/</g,'&lt;')}</span>
    <button class="login-bc__btn" id="login-bc-copy" aria-label="${t('broadcastCopy')}">📋</button>
    <button class="login-bc__btn login-bc__btn--close" id="login-bc-close" aria-label="✕">✕</button>
  `;

  ge('login-bc-copy')?.addEventListener('click', async () => {
    await copyToClipboard(text);
    import('../components/toast.js').then(m => m.toast(t('broadcastCopy'), 'success', 1500));
  });
  ge('login-bc-close')?.addEventListener('click', () => {
    try { localStorage.setItem('sp_bc_dim', btoa(text).slice(0, 16)); } catch {}
    el.classList.add('hidden');
    import('../components/toast.js').then(m => m.toast(t('broadcastDismissed'), 'info', 1800));
  });
}

// ── Language button & modal ───────────────────────────
function _updateLangBtn() {
  const btn = ge('login-lang-btn');
  if (!btn) return;
  const meta = _LANG_META[state.lang] || _LANG_META['de'];
  btn.textContent = `${meta.flag} ${state.lang.toUpperCase()} ▾`;
}

function _toggleLangModal(open) {
  const modal = ge('login-lang-modal');
  if (!modal) return;
  if (open === undefined) open = modal.style.display === 'none' || modal.style.display === '';
  if (open) {
    _renderLangModal();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function _renderLangModal() {
  const list = ge('login-lang-modal-list');
  if (!list) return;
  list.innerHTML = LANG_LIST.map(l => {
    const meta    = _LANG_META[l];
    const isActive = l === state.lang;
    return `<button class="login-lang-item${isActive ? ' active' : ''}"
              data-action="login:lang-select" data-lang="${l}">
      <span class="login-lang-item__flag">${meta.flag}</span>
      <span>${meta.name}</span>
      ${isActive ? '<span class="login-lang-item__check">✓</span>' : ''}
    </button>`;
  }).join('');
}

// ── Wire handlers ─────────────────────────────────────
function _setupHandlers() {
  on('login:submit',      _handleNameSubmit);
  on('login:register',    _handleRegisterConfirm);
  on('login:reg:cancel',  _handleRegisterCancel);
  on('pin:key',           (el) => _handlePinKey(el));
  on('pin:del',           ()   => _handlePinDel());
  on('pin:forgot',        _handleForgot);

  on('login:lang-open',  ()   => _toggleLangModal(true));
  on('login:lang-close', ()   => _toggleLangModal(false));

  on('login:lang-select', (el) => {
    const lang = el.dataset.lang;
    if (!lang) return;
    setLang(lang);
    import('../state.js').then(({ setState }) => setState('userSelectedLang', lang));
    _toggleLangModal(false);
    _updateLangBtn();
    _updateTexts();
  });

  on('login:ac-select', (el) => {
    const username = el.dataset.username;
    if (!username) return;
    const input = ge('login-name-input');
    if (input) input.value = username;
    ge('login-autocomplete')?.classList.remove('open');
    _username = username;
    _handleNameSubmit();
  });

  // Close modal when clicking backdrop
  const modal = ge('login-lang-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) _toggleLangModal(false);
    });
  }

  // Autocomplete + keyboard-scroll fix
  const input = ge('login-name-input');
  if (input) {
    input.addEventListener('input',   (e) => _renderAutocomplete(e.target.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); _handleNameSubmit(); }
      if (e.key === 'Escape') ge('login-autocomplete')?.classList.remove('open');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => ge('login-autocomplete')?.classList.remove('open'), 160);
    });

    // When keyboard opens, scroll login screen so h1 stays visible below the topbar
    input.addEventListener('focus', () => {
      setTimeout(() => {
        const screen = document.getElementById('screen-login');
        const h1     = ge('login-h1');
        if (!screen || !h1) return;
        const screenTop = screen.getBoundingClientRect().top;
        const h1Top     = h1.getBoundingClientRect().top;
        // h1's absolute position within the scroll container
        const h1InContainer = h1Top - screenTop + screen.scrollTop;
        // Topbar is 56px + safe-area; target: h1 just below it with 8px gap
        const topbarH = 56 + (window.visualViewport?.offsetTop || 0);
        screen.scrollTo({ top: Math.max(0, h1InContainer - topbarH - 8), behavior: 'smooth' });
      }, 420);
    });
  }
}

// ── Autocomplete ──────────────────────────────────────
function _renderAutocomplete(query) {
  const ac = ge('login-autocomplete');
  if (!ac) return;
  const q = (query || '').toLowerCase().replace('@', '').trim();
  if (!q) { ac.classList.remove('open'); return; }

  const members = state.db.members || {};
  const matches = Object.keys(members).filter(k => k.toLowerCase().includes(q)).slice(0, 5);
  if (!matches.length) { ac.classList.remove('open'); return; }

  ac.innerHTML = matches.map(m => {
    const display = fbDec(m);
    const hue = (m.charCodeAt(0) * 7 + (m.charCodeAt(1) || 0) * 13) % 360;
    return `<div class="login-ac-item" data-action="login:ac-select" data-username="${m}">
      <div class="login-ac-item__avatar" style="background:hsl(${hue},65%,42%)">${display.slice(0,2).toUpperCase()}</div>
      <span>@${display}</span>
    </div>`;
  }).join('');
  ac.classList.add('open');
}

// ── Name step ─────────────────────────────────────────
function _handleNameSubmit() {
  if (_step !== 'name') return;
  const input = ge('login-name-input');
  const val = (input?.value || '').trim();
  if (!val) { toast(t('loginNameRequired') || 'Benutzername eingeben', 'warning'); return; }

  if (!_isDBReady()) {
    _pendingVal = val;
    toast(t('loginConnecting') || 'Verbinde mit Server... bitte warten', 'info', 5000);
    if (!_unsubDB) _watchDB();
    return;
  }

  const members = state.db.members || {};
  const valEnc  = fbEnc(val);
  const found   = Object.keys(members).find(k =>
    k.toLowerCase() === val.toLowerCase() || k.toLowerCase() === valEnc.toLowerCase()
  );

  if (!found) {
    _username = val;
    _showRegisterStep(val);
    return;
  }

  _username = found;
  const u = members[found];

  if (u.status && u.status !== 'active' && u.role !== 'admin') {
    toast(t('loginDenied') || 'Zugriff verweigert', 'error');
    return;
  }

  if (!u.memberPin) {
    import('../main.js').then(m => m.loginAs(_username));
    return;
  }

  _step = 'pin';
  _showPinStep(found, u);
}

function _showPinStep(username, u) {
  ge('login-name-step')?.classList.add('hidden');
  const pinStep = ge('login-pin-step');
  if (pinStep) pinStep.classList.remove('hidden');

  const greet = ge('pin-greet');
  if (greet) greet.textContent = `Hey ${username} 👋`;

  initPinPad({ maxLen: 4, onSubmit: (pin) => _checkPin(pin, u.memberPin) });
}

// ── Register step ─────────────────────────────────────
function _showRegisterStep(username) {
  _step = 'register';
  ge('login-name-step')?.classList.add('hidden');
  const regStep = ge('login-register-step');
  if (!regStep) return;
  regStep.classList.remove('hidden');

  const titleEl = regStep.querySelector('.login-reg__title');
  if (titleEl) titleEl.textContent = t('regTitle') || 'Neu hier?';

  const subEl = regStep.querySelector('.login-reg__sub');
  if (subEl) subEl.innerHTML =
    `<span style="color:var(--login-accent);font-weight:700">@${username}</span> ` +
    (t('regSub') || 'ist noch nicht registriert. Konto jetzt erstellen?');

  const confirmBtn = regStep.querySelector('[data-action="login:register"]');
  if (confirmBtn) confirmBtn.textContent = t('regConfirm') || '✓ Konto erstellen & einloggen';

  const backBtn = regStep.querySelector('[data-action="login:reg:cancel"]');
  if (backBtn) backBtn.textContent = t('regBack') || '← Zurück';
}

function _handleRegisterConfirm() {
  if (_step !== 'register') return;
  const username = _username;
  if (!username) return;

  if (!/^[a-zA-Z0-9_.]{2,24}$/.test(username)) {
    toast(t('loginUsernameFormat') || 'Nur Buchstaben, Zahlen, _ und . (2–24 Zeichen)', 'error');
    return;
  }

  const now = Date.now();
  const key = fbEnc(username);
  const newMember = {
    name:       username,
    role:       'member',
    status:     'active',
    lang:       state.lang || 'de',
    joinedAt:   now,
    online:     true,
    stats:      { given: 0, received: 0 },
    postsTotal: 0,
  };
  writeDB(`members/${key}`, newMember);

  // Optimistic local state update so loginAs() finds the member immediately
  if (!state.db.members) state.db.members = {};
  state.db.members[key] = newMember;

  const welcomeMsg = (t('loginWelcome') || 'Willkommen, @{name}! 🎉').replace('{name}', username);
  toast(welcomeMsg, 'success', 3000);
  // Pass isNew=true so loginAs does group assignment + notifications after Firebase is ready
  setTimeout(() => import('../main.js').then(m => m.loginAs(key, { isNew: true })), 800);
}

function _handleRegisterCancel() {
  _step = 'name';
  _username = '';
  ge('login-register-step')?.classList.add('hidden');
  ge('login-name-step')?.classList.remove('hidden');
  const input = ge('login-name-input');
  if (input) { input.value = ''; input.focus(); }
}

// ── PIN step ──────────────────────────────────────────
function _handlePinKey(el) {
  if (_step !== 'pin') return;
  handlePinKey(el, 4);
}
function _handlePinDel() {
  if (_step !== 'pin') return;
  handlePinDel(4);
}
function _checkPin(entered, stored) {
  if (btoa(entered) === stored) {
    haptic('success');
    import('../main.js').then(m => m.loginAs(_username));
  } else {
    shakePin();
    resetPin(4);
    toast(t('pinWrong') || 'Falscher PIN', 'error');
  }
}
function _handleForgot() {
  const pinStep = ge('login-pin-step');
  if (!pinStep) return;
  pinStep.innerHTML = `
    <div class="pin-forgot-card">
      <div class="pin-forgot-card__icon">🔑</div>
      <div class="pin-forgot-card__title">${t('pinResetTitle')}</div>
      <div class="pin-forgot-card__sub">
        <strong>@${_username}</strong><br>${t('pinResetSub')}
      </div>
      <button class="btn btn--danger btn--full" id="pin-reset-confirm">
        ${t('pinResetConfirmBtn')}
      </button>
      <button class="btn btn--ghost btn--full" id="pin-reset-cancel" style="margin-top:8px">
        ${t('cancel')}
      </button>
    </div>
  `;
  ge('pin-reset-confirm')?.addEventListener('click', () => {
    import('../firebase.js').then(({ writeDB }) => {
      writeDB(`members/${_username}/memberPin`, null);
      import('../main.js').then(m => m.loginAs(_username));
    });
  });
  ge('pin-reset-cancel')?.addEventListener('click', () => {
    const u = state.db.members?.[_username] || {};
    _showPinStep(_username, u);
  });
}

// ── Reset ─────────────────────────────────────────────
function _reset() {
  _step = 'name';
  _username = '';
  ge('login-name-step')?.classList.remove('hidden');
  ge('login-pin-step')?.classList.add('hidden');
  ge('login-register-step')?.classList.add('hidden');
  const input = ge('login-name-input');
  if (input) input.value = '';
  resetPin(4);
}
