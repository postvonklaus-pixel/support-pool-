/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Login Screen
   ═══════════════════════════════════════════════════════ */

import { state, subscribe }   from '../state.js';
import { t, setLang }         from '../i18n.js';
import { on }                 from '../events.js';
import { ge, haptic }         from '../utils.js';
import { toast }              from '../components/toast.js';
import { handlePinKey, handlePinDel, initPinPad, resetPin, shakePin } from '../components/pinpad.js';

const LANG_LIST = ['de','en','id','it','es','tr','ar','zh','ja','pl'];

let _step      = 'name';
let _username  = '';
let _pendingVal = null;  // username queued while DB loads
let _unsubDB   = null;   // DB-ready watcher cleanup fn

export function render() {
  _cleanup();
  _applyTranslations();
  _renderLangRow();
  _setupHandlers();
  _reset();
  _watchDB();  // disable submit until Firebase data arrives
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
  _setLoginReady(false);
  _unsubDB = subscribe((change) => {
    if (change.path === 'db' && _isDBReady()) {
      _cleanup();
      _setLoginReady(true);
      // Auto-retry if user already typed and hit submit
      if (_pendingVal) {
        const val = _pendingVal;
        _pendingVal = null;
        const input = ge('login-name-input');
        if (input) input.value = val;
        _handleNameSubmit();
      }
    }
  });
}

function _setLoginReady(ready) {
  const btn = ge('login-btn');
  if (!btn) return;
  if (ready) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.textContent = t('loginBtn') || 'Einloggen';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.textContent = '⟳ Verbinde...';
  }
}

function _cleanup() {
  if (_unsubDB) { _unsubDB(); _unsubDB = null; }
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
  on('login:submit', _handleNameSubmit);
  on('pin:key',      (el) => _handlePinKey(el));
  on('pin:del',      () => _handlePinDel());
  on('pin:forgot',   _handleForgot);
  on('lang:set',     (el) => { setLang(el.dataset.lang); _renderLangRow(); _applyTranslations(); });
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
    toast(t('loginNotFound') || 'Nutzer nicht gefunden', 'error');
    haptic('error');
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
  if (nameStep) nameStep.classList.remove('hidden');
  if (pinStep)  pinStep.classList.add('hidden');

  const input = ge('login-name-input');
  if (input) input.value = '';

  resetPin(4);
}
