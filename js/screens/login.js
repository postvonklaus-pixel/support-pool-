/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Login Screen
   ═══════════════════════════════════════════════════════ */

import { state, subscribe }   from '../state.js';
import { t, setLang }         from '../i18n.js';
import { on }                 from '../events.js';
import { ge, haptic }         from '../utils.js';
import { toast }              from '../components/toast.js';
import { writeDB }            from '../firebase.js';
import { avatarGradient }     from '../utils.js';
import { handlePinKey, handlePinDel, initPinPad, resetPin, shakePin } from '../components/pinpad.js';

const LANG_LIST = ['de','en','id','it','es','tr','ar','zh','ja','pl'];

let _step      = 'name';   // 'name' | 'pin' | 'register'
let _username  = '';
let _pendingVal = null;
let _unsubDB   = null;
let _timeoutId = null;

export function render() {
  _cleanup();
  _applyTranslations();
  _renderLangRow();
  _renderStats();
  _renderSocialProof();
  _setupHandlers();
  _reset();
  _watchDB();
}

// ── DB-ready gate ─────────────────────────────────────────
function _isDBReady() {
  return Object.keys(state.db.members || {}).length > 0;
}

function _watchDB() {
  if (_isDBReady()) {
    _setLoginReady(true);
    _renderStats();
    _renderSocialProof();
    return;
  }
  _setLoginReady('loading');

  _unsubDB = subscribe((change) => {
    if (change.path === 'db' && _isDBReady()) {
      const queued = _pendingVal;
      _cleanup();
      _setLoginReady(true);
      _renderStats();
      _renderSocialProof();
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
  const btn = ge('login-btn');
  if (!btn) return;
  if (s === true) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.background = '';
    btn.textContent = `${t('loginBtn') || 'Einloggen'} →`;
  } else if (s === 'loading') {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.textContent = '⟳ Verbinde...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.background = 'var(--accent-error, #ef4444)';
    btn.textContent = t('loginNoConn');
    btn.onclick = () => location.reload();
  }
}

function _cleanup() {
  if (_unsubDB)   { _unsubDB(); _unsubDB = null; }
  if (_timeoutId) { clearTimeout(_timeoutId); _timeoutId = null; }
  _pendingVal = null;
}

// ── Live stats from Firebase ──────────────────────────────
function _renderStats() {
  const members  = state.db.members  || {};
  const videos   = state.db.videos   || {};
  const settings = state.db.settings || {};

  const memberCount   = Object.keys(members).length;
  const liveVideos    = Object.values(videos).filter(v => v.status === 'open').length;
  const totalSupports = settings.totalSupports || 0;

  // Stats row
  const row = ge('login-stat-row');
  if (row && memberCount > 0) {
    row.innerHTML =
      `<strong>${totalSupports || 0}</strong> ${t('statPool') || 'Supports'} · ` +
      `<strong>${memberCount}</strong> ${t('navProfile') === 'Profil' ? 'Mitglieder' : 'Members'} · ` +
      `<strong>${liveVideos}</strong> Live`;
  }

  // Live pill text
  const pillText = ge('login-live-text');
  if (pillText) {
    if (memberCount <= 2) {
      pillText.textContent = '🚀 NOVA POOL STARTET';
    } else if (memberCount < 10) {
      pillText.textContent = `${memberCount} CREATORS · JOIN`;
    } else {
      pillText.textContent = `${memberCount} CREATORS · LIVE`;
    }
  }
}

// ── Social proof ──────────────────────────────────────────
function _renderSocialProof() {
  const members  = state.db.members || {};
  const keys     = Object.keys(members);
  const count    = keys.length;

  const avatarsEl = ge('login-social-avatars');
  const textEl    = ge('login-social-text');
  if (!avatarsEl || !textEl) return;

  const shown = keys.slice(0, 3);
  avatarsEl.innerHTML = shown.map(m => {
    const hue = (m.charCodeAt(0) * 7 + m.charCodeAt(1 % m.length) * 13) % 360;
    return `<div class="login-social__avatar" style="background:hsl(${hue},65%,42%)">${m.slice(0,2).toUpperCase()}</div>`;
  }).join('');

  textEl.textContent = count < 5
    ? (t('beOneOfFirst') || 'Sei einer der Ersten')
    : (t('nowPushing') || '{n} pushen gerade').replace('{n}', count);
}

// ── Translations ──────────────────────────────────────────
function _applyTranslations() {
  const tagline = ge('login-tagline');
  if (tagline) tagline.textContent = t('loginSub') || 'Das Premium TikTok Support-Netzwerk';

  const hint = ge('login-sub');
  if (hint) hint.textContent = `${t('free') || '100% kostenlos'} · ${t('instantAccess') || 'Sofort starten'}`;

  const nameInput = ge('login-name-input');
  if (nameInput) nameInput.placeholder = t('loginPH') || 'TikTok @username';

  const pinLabel = ge('pin-label');
  if (pinLabel) pinLabel.textContent = t('pinLabel');

  const pinForgot = ge('pin-forgot-link');
  if (pinForgot) pinForgot.textContent = t('pinForgot');
}

// ── Language row ──────────────────────────────────────────
function _renderLangRow() {
  const row = ge('login-lang-row');
  if (!row) return;
  const flags = { de:'🇩🇪',en:'🇬🇧',id:'🇮🇩',it:'🇮🇹',es:'🇪🇸',tr:'🇹🇷',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',pl:'🇵🇱' };
  row.innerHTML = LANG_LIST.map(l => {
    const active = l === state.lang ? ' active' : '';
    return `<button class="lang-pill${active}" data-action="lang:set" data-lang="${l}" aria-label="${l}">${flags[l]}</button>`;
  }).join('');
}

// ── Wire handlers ─────────────────────────────────────────
function _setupHandlers() {
  on('login:submit',      _handleNameSubmit);
  on('login:register',    _handleRegisterConfirm);
  on('login:reg:cancel',  _handleRegisterCancel);
  on('pin:key',           (el) => _handlePinKey(el));
  on('pin:del',           () => _handlePinDel());
  on('pin:forgot',        _handleForgot);
  on('lang:set',          (el) => {
    const lang = el.dataset.lang;
    setLang(lang);
    import('../state.js').then(({ setState }) => setState('userSelectedLang', lang));
    _renderLangRow();
    _applyTranslations();
    _renderStats();
    _renderSocialProof();
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

  // Autocomplete on input
  const input = ge('login-name-input');
  if (input) {
    input.addEventListener('input', (e) => _renderAutocomplete(e.target.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _handleNameSubmit(); }
      if (e.key === 'Escape') ge('login-autocomplete')?.classList.remove('open');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => ge('login-autocomplete')?.classList.remove('open'), 160);
    });
  }
}

// ── Autocomplete ──────────────────────────────────────────
function _renderAutocomplete(query) {
  const ac = ge('login-autocomplete');
  if (!ac) return;
  const q = (query || '').toLowerCase().replace('@', '').trim();
  if (!q) { ac.classList.remove('open'); return; }

  const members = state.db.members || {};
  const matches = Object.keys(members).filter(k => k.toLowerCase().includes(q)).slice(0, 5);
  if (!matches.length) { ac.classList.remove('open'); return; }

  ac.innerHTML = matches.map(m => {
    const hue = (m.charCodeAt(0) * 7 + (m.charCodeAt(1) || 0) * 13) % 360;
    return `<div class="login-ac-item" data-action="login:ac-select" data-username="${m}">
      <div class="login-ac-item__avatar" style="background:hsl(${hue},65%,42%)">${m.slice(0,2).toUpperCase()}</div>
      <span>@${m}</span>
    </div>`;
  }).join('');
  ac.classList.add('open');
}

// ── Name step ─────────────────────────────────────────────
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
  const found = Object.keys(members).find(k => k.toLowerCase() === val.toLowerCase());
  if (!found) {
    _username = val;
    _showRegisterStep(val);
    return;
  }

  _username = found;
  const u = members[found];

  if (!u.pin) {
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

  initPinPad({ maxLen: 4, onSubmit: (pin) => _checkPin(pin, u.pin) });
}

// ── Register step ─────────────────────────────────────────
function _showRegisterStep(username) {
  _step = 'register';
  ge('login-name-step')?.classList.add('hidden');
  const regStep = ge('login-register-step');
  if (regStep) {
    regStep.classList.remove('hidden');
    const label = regStep.querySelector('.login-reg__name');
    if (label) label.textContent = `@${username}`;
  }
}

function _handleRegisterConfirm() {
  if (_step !== 'register') return;
  const username = _username;
  if (!username) return;

  if (!/^[a-zA-Z0-9_]{2,24}$/.test(username)) {
    toast('Nur Buchstaben, Zahlen und _ (2–24 Zeichen)', 'error');
    return;
  }

  const now = Date.now();
  writeDB(`members/${username}`, {
    name:       username,
    role:       'member',
    status:     'active',
    lang:       state.lang || 'de',
    joinedAt:   now,
    online:     true,
    stats:      { given: 0, received: 0 },
    postsTotal: 0,
  });

  toast(`Willkommen, @${username}! 🎉`, 'success', 3000);
  setTimeout(() => {
    import('../main.js').then(m => m.loginAs(username));
  }, 800);
}

function _handleRegisterCancel() {
  _step = 'name';
  _username = '';
  ge('login-register-step')?.classList.add('hidden');
  ge('login-name-step')?.classList.remove('hidden');
  const input = ge('login-name-input');
  if (input) { input.value = ''; input.focus(); }
}

// ── PIN step ──────────────────────────────────────────────
function _handlePinKey(el) {
  if (_step !== 'pin') return;
  handlePinKey(el, 4);
}
function _handlePinDel() {
  if (_step !== 'pin') return;
  handlePinDel(4);
}
function _checkPin(entered, stored) {
  if (entered === String(stored)) {
    haptic('success');
    import('../main.js').then(m => m.loginAs(_username));
  } else {
    shakePin();
    resetPin(4);
    toast(t('pinWrong') || 'Falscher PIN', 'error');
  }
}
function _handleForgot() {
  toast(t('pinForgotMsg') || 'Bitte Admin kontaktieren 👋', 'info', 4000);
}

// ── Reset ─────────────────────────────────────────────────
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
