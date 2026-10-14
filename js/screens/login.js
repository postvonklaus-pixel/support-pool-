/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Login Screen
   ═══════════════════════════════════════════════════════ */

import { state, subscribe }   from '../state.js';
import { t, setLang }         from '../i18n.js';
import { on }                 from '../events.js';
import { ge, haptic }         from '../utils.js';
import { toast }              from '../components/toast.js';
import { writeDB }            from '../firebase.js';
import { handlePinKey, handlePinDel, initPinPad, resetPin, shakePin } from '../components/pinpad.js';

const LANG_LIST = ['de','en','id','it','es','tr','ar','zh','ja','pl'];

let _step      = 'name';   // 'name' | 'pin' | 'register'
let _username  = '';
let _pendingVal = null;   // username queued while DB loads
let _unsubDB   = null;    // DB-ready subscriber cleanup
let _timeoutId = null;    // fallback timeout handle

export function render() {
  _cleanup();
  _applyTranslations();
  _renderLangRow();
  _setupHandlers();
  _reset();
  _watchDB();  // gate submit until Firebase data arrives
}

// ── DB-ready gate ─────────────────────────────────────────
function _isDBReady() {
  return Object.keys(state.db.members || {}).length > 0;
}

function _watchDB() {
  if (_isDBReady()) {
    _setLoginReady(true);
    return;
  }
  _setLoginReady('loading');

  // Subscribe for when Firebase populates members
  _unsubDB = subscribe((change) => {
    if (change.path === 'db' && _isDBReady()) {
      // Save pending value BEFORE _cleanup() nulls it
      const queued = _pendingVal;
      _cleanup();
      _setLoginReady(true);
      if (queued) {
        const input = ge('login-name-input');
        if (input) input.value = queued;
        _pendingVal = queued;  // restore so _handleNameSubmit can read it
        _handleNameSubmit();
      }
    }
  });

  // Hard timeout — show error state after 12 s so user isn't stuck forever
  _timeoutId = setTimeout(() => {
    if (!_isDBReady()) {
      _cleanup();
      _setLoginReady('error');
    }
  }, 12000);
}

function _setLoginReady(state) {
  const btn = ge('login-btn');
  if (!btn) return;
  if (state === true) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.background = '';
    btn.textContent = t('loginBtn') || 'Einloggen';
  } else if (state === 'loading') {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.textContent = '⟳ Verbinde...';
  } else {
    // error — let user trigger a hard reload
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

// ── Translations ──────────────────────────────────────────
function _applyTranslations() {
  const sub = ge('login-sub');
  if (sub) sub.textContent = t('loginSub');

  const btn = ge('login-btn');
  if (btn) btn.textContent = t('loginBtn');

  const pinLabel = ge('pin-label');
  if (pinLabel) pinLabel.textContent = t('pinLabel');

  const pinForgot = ge('pin-forgot-link');
  if (pinForgot) pinForgot.textContent = t('pinForgot');

  const nameInput = ge('login-name-input');
  if (nameInput) nameInput.placeholder = '@username';
}

// ── Language row ──────────────────────────────────────────
function _renderLangRow() {
  const row = ge('login-lang-row');
  if (!row) return;
  row.innerHTML = LANG_LIST.map(l => {
    const flags = { de:'🇩🇪',en:'🇬🇧',id:'🇮🇩',it:'🇮🇹',es:'🇪🇸',tr:'🇹🇷',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',pl:'🇵🇱' };
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
  });
}

// ── Name step ─────────────────────────────────────────────
function _handleNameSubmit() {
  if (_step !== 'name') return;
  const input = ge('login-name-input');
  const val = (input?.value || '').trim();
  if (!val) { toast(t('loginNameRequired') || 'Benutzername eingeben', 'warning'); return; }

  // Firebase hasn't loaded yet — queue retry
  if (!_isDBReady()) {
    _pendingVal = val;
    toast(t('loginConnecting') || 'Verbinde mit Server... bitte warten', 'info', 5000);
    // Ensure watcher is running
    if (!_unsubDB) _watchDB();
    return;
  }

  const members = state.db.members || {};
  const found = Object.keys(members).find(k => k.toLowerCase() === val.toLowerCase());
  if (!found) {
    // Unknown username → offer registration instead of just showing an error
    _username = val;
    _showRegisterStep(val);
    return;
  }

  _username = found;
  const u = members[found];

  // No PIN → log in directly
  if (!u.pin) {
    import('../main.js').then(m => m.loginAs(_username));
    return;
  }

  // Switch to PIN step
  _step = 'pin';
  _showPinStep(found, u);
}

function _showPinStep(username, u) {
  const nameStep = ge('login-name-step');
  const pinStep  = ge('login-pin-step');
  if (nameStep) nameStep.classList.add('hidden');
  if (pinStep)  pinStep.classList.remove('hidden');

  const greet = ge('pin-greet');
  if (greet) greet.textContent = `Hey ${username} 👋`;

  initPinPad({
    maxLen: 4,
    onSubmit: (pin) => _checkPin(pin, u.pin),
  });
}

// ── Register step ─────────────────────────────────────────
function _showRegisterStep(username) {
  _step = 'register';
  const nameStep = ge('login-name-step');
  const regStep  = ge('login-register-step');
  if (nameStep) nameStep.classList.add('hidden');
  if (regStep)  {
    regStep.classList.remove('hidden');
    const label = regStep.querySelector('.login-reg__name');
    if (label) label.textContent = `@${username}`;
  }
}

function _handleRegisterConfirm() {
  if (_step !== 'register') return;
  const username = _username;
  if (!username) return;

  // Validate: letters, numbers, underscore only; 2-24 chars
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
  // Give Firebase a moment to write, then log in
  setTimeout(() => {
    import('../main.js').then(m => m.loginAs(username));
  }, 800);
}

function _handleRegisterCancel() {
  _step = 'name';
  _username = '';
  const nameStep = ge('login-name-step');
  const regStep  = ge('login-register-step');
  if (regStep)  regStep.classList.add('hidden');
  if (nameStep) nameStep.classList.remove('hidden');
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
  const nameStep = ge('login-name-step');
  const pinStep  = ge('login-pin-step');
  const regStep  = ge('login-register-step');
  if (nameStep) nameStep.classList.remove('hidden');
  if (pinStep)  pinStep.classList.add('hidden');
  if (regStep)  regStep.classList.add('hidden');

  const input = ge('login-name-input');
  if (input) input.value = '';

  resetPin(4);
}
