/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Settings Screen  (Part K Redesign)
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { esc, avatarGradient } from '../utils.js';
import { on }          from '../events.js';
import { writeDB }     from '../firebase.js';
import { setTheme, getTheme } from '../features/theme.js';
import { trustLevel }  from '../features/trust.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast }       from '../components/toast.js';

const LANG_FLAGS = { de:'🇩🇪',en:'🇬🇧',id:'🇮🇩',it:'🇮🇹',es:'🇪🇸',tr:'🇹🇷',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',pl:'🇵🇱' };
const LANG_NAMES = { de:'Deutsch',en:'English',id:'Bahasa',it:'Italiano',es:'Español',tr:'Türkçe',ar:'العربية',zh:'中文',ja:'日本語',pl:'Polski' };

// Persist open/close state across DB-triggered re-renders
let _langOpen   = false;
let _openFaqIds = new Set();

// PIN flow state
let _pinBuf   = '';
let _pinStep  = 'new';   // 'new' | 'confirm'
let _pinFirst = '';
let _pinFlow  = 'set';   // 'set' | 'change' | 'disable'
const PIN_LEN = 4;

// ── Privacy content ────────────────────────────────────────
const PRIVACY = {
  de: { title: '🔒 Datenschutz', sections: [
    ['Verantwortlicher',        'Diese App wird privat betrieben. Es gibt keinen kommerziellen Hintergrund.'],
    ['Gespeicherte Daten',      'Dein TikTok-Nutzername, Support-Statistiken (gegeben/erhalten), Gruppenname und Aktivitätsdaten werden in einer Firebase-Datenbank gespeichert.'],
    ['Datenspeicherung',        'Alle Daten liegen in Google Firebase. Es gibt keine Weitergabe an Dritte.'],
    ['Lokale Speicherung',      'Anmeldung, Spracheinstellung und Theme werden im localStorage deines Browsers gespeichert.'],
    ['Deine Rechte',            'Du kannst jederzeit die Löschung deines Accounts beantragen — wende dich an den Admin.'],
    ['Push-Benachrichtigungen', 'Push-Benachrichtigungen sind freiwillig. Du kannst sie im Browser jederzeit deaktivieren.'],
    ['Haftungsausschluss',      'Diese App ist kein offizielles TikTok-Produkt und steht in keiner Verbindung zu TikTok Ltd.'],
  ]},
  en: { title: '🔒 Privacy Policy', sections: [
    ['Responsible Party',    'This app is privately operated with no commercial background.'],
    ['Stored Data',          'Your TikTok username, support stats (given/received), group and activity data are stored in Firebase.'],
    ['Data Storage',         'All data is stored in Google Firebase. No third parties have access.'],
    ['Local Storage',        'Your login session, language and theme are stored in browser localStorage.'],
    ['Your Rights',          'You can request deletion of your account at any time — contact the admin.'],
    ['Push Notifications',   'Push notifications are optional and can be disabled in your browser at any time.'],
    ['Disclaimer',           'This app is not an official TikTok product and has no connection to TikTok Ltd.'],
  ]},
};

const _chevSVG = `<svg class="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

export function render() {
  const el = document.getElementById('screen-settings');
  if (!el) return;

  const cu    = state.currentUser;
  const u     = state.db.members?.[cu] || {};
  const theme = getTheme();
  const tl    = cu ? trustLevel(cu) : null;
  const initial = (cu || '?').slice(0, 2).toUpperCase();
  const gradient = cu ? avatarGradient(cu) : 'var(--gradient-primary)';
  const given  = u.stats?.given || 0;
  const recv   = u.stats?.received || 0;
  const bal    = Math.min(given - recv, 20);

  el.innerHTML = `
    <div class="settings-page">

      <!-- ── User card ─────────────────────────────────── -->
      <div class="settings-user-card card--glass">
        <div class="settings-user-card__avatar" style="background:${gradient}">${initial}</div>
        <div class="settings-user-card__info">
          <div class="settings-user-card__name">${esc(u.name || cu || '–')}</div>
          <div class="settings-user-card__handle">@${esc(cu || '–')}</div>
          ${tl ? `<div class="settings-user-card__trust" style="color:${tl.color}">${tl.icon} ${tl.label}</div>` : ''}
        </div>
        <div class="settings-user-card__stats">
          <div class="settings-user-card__stat">
            <div class="settings-user-card__stat-val">${given}</div>
            <div class="settings-user-card__stat-label">gegeben</div>
          </div>
          <div class="settings-user-card__stat-div"></div>
          <div class="settings-user-card__stat">
            <div class="settings-user-card__stat-val ${bal >= 0 ? 'pos' : 'neg'}">${bal >= 0 ? '+' : ''}${bal}</div>
            <div class="settings-user-card__stat-label">Balance</div>
          </div>
        </div>
      </div>

      <!-- ── Design ──────────────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">Design</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">🎨</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">Theme</div>
            </div>
            <div class="settings-theme-seg">
              <button class="seg-btn seg-btn--lbl ${theme==='light'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="light" aria-label="Hell">☀️ Hell</button>
              <button class="seg-btn seg-btn--lbl ${theme==='dark'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="dark" aria-label="Dunkel">🌙 Dunkel</button>
              <button class="seg-btn seg-btn--lbl ${theme==='auto'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="auto" aria-label="Auto">🔄 Auto</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Sprache ─────────────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">Sprache</div>
        <div class="settings-group__card">
          <div class="settings-row-item settings-row-item--tap" data-action="settings:lang-toggle">
            <div class="settings-row-item__icon">🌍</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">Sprache wählen</div>
              <div class="settings-row-item__sub">${LANG_FLAGS[state.lang] || '🌍'} ${LANG_NAMES[state.lang] || state.lang}</div>
            </div>
            <svg class="settings-chevron" id="lang-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="settings-lang-panel hidden" id="settings-lang-panel">
            <div class="settings-lang-grid">
              ${Object.entries(LANG_FLAGS).map(([code, flag]) => `
                <button class="lang-chip ${state.lang === code ? 'lang-chip--active' : ''}"
                  data-action="lang:set" data-lang="${code}" aria-label="${LANG_NAMES[code]}">
                  ${flag} ${LANG_NAMES[code]}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- ── Benachrichtigungen ──────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">Benachrichtigungen</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">🔔</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('pushTitle') || 'Push-Nachrichten'}</div>
              <div class="settings-row-item__sub">${t('pushDesc') || 'Werde benachrichtigt bei neuen Supports'}</div>
            </div>
            <button class="btn btn--sm btn--ghost" data-action="settings:push">
              ${t('pushActivate') || 'Aktivieren'}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Account ─────────────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">Account</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">👤</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">Angemeldet als</div>
              <div class="settings-row-item__sub">@${esc(cu || '–')}</div>
            </div>
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap" data-action="settings:pin">
            <div class="settings-row-item__icon">🔑</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">PIN-Schutz</div>
              <div class="settings-row-item__sub">${u.memberPin ? '● Aktiv — Tap zum Ändern/Deaktivieren' : 'Tap zum Einrichten'}</div>
            </div>
            ${_chevSVG}
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap settings-row-item--danger" data-action="settings:logout">
            <div class="settings-row-item__icon">🚪</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('logout') || 'Abmelden'}</div>
            </div>
            ${_chevSVG}
          </div>
        </div>
      </div>

      <!-- ── FAQ Accordion ───────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">Hilfe & FAQ</div>
        <div class="settings-group__card">
          ${_faqHTML()}
        </div>
      </div>

      <!-- ── App Info ────────────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">App</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">✨</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">NOVA Support Pool</div>
              <div class="settings-row-item__sub">v2.5 — Phase 2.5</div>
            </div>
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap" data-action="settings:homescreen">
            <div class="settings-row-item__icon">📱</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">Zum Homescreen</div>
              <div class="settings-row-item__sub">Als App installieren</div>
            </div>
            ${_chevSVG}
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap" data-action="settings:privacy">
            <div class="settings-row-item__icon">🔒</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">Datenschutz</div>
            </div>
            ${_chevSVG}
          </div>
        </div>
      </div>

    </div>
  `;

  _restoreState();
  _registerHandlers();
}

function _restoreState() {
  if (_langOpen) {
    const panel = document.getElementById('settings-lang-panel');
    const chev  = document.getElementById('lang-chevron');
    if (panel) panel.classList.remove('hidden');
    if (chev)  chev.style.transform = 'rotate(180deg)';
  }
  _openFaqIds.forEach(id => {
    const item = document.getElementById(id);
    if (!item) return;
    item.classList.add('faq-item--open');
    const ans  = item.querySelector('.faq-item__a');
    const chev = item.querySelector('.faq-item__chevron');
    if (ans)  ans.classList.remove('hidden');
    if (chev) chev.style.transform = 'rotate(180deg)';
  });
}

// ── FAQ Data ───────────────────────────────────────────────
const FAQ = [
  { q: 'Was ist der NOVA Support Pool?',
    a: 'Eine gegenseitige TikTok-Community. Du kommentierst auf Videos anderer — sie auf deinen. Kein Algorithmus, nur echte Menschen.' },
  { q: 'Wie berechnet sich das Guthaben?',
    a: 'Guthaben = Gegeben − Erhalten (max. +20). Support geben = +1, Video erhalten = −1. Negatives Guthaben sperrt neue Posts.' },
  { q: 'Wie oft kann ich ein Video posten?',
    a: 'Einmal alle 24 Stunden. Der Cooldown startet beim letzten Post.' },
  { q: 'Was sind Runden (R1/R2)?',
    a: 'Jedes Video startet in Runde 1. Wenn alle Slots voll sind, geht es in Runde 2 für weitere Supports.' },
  { q: 'Wie funktioniert das Rang-System?',
    a: '🌱 Neuling (0–4) · ⚡ Aufsteiger (5–19) · 🔥 Aktiv (20–49) · 🏆 Veteran (50–99) · 👑 Elite (100+)' },
  { q: 'Was sind Achievements?',
    a: 'Meilensteine die du beim Supporten, Posten und Streak-Aufbauen freischaltest. Sichtbar in deinem Profil.' },
  { q: 'Wie funktioniert der Chat?',
    a: 'Pool-Chat (alle Mitglieder) + DMs (private Nachrichten) — zugänglich über den Chat-Tab.' },
  { q: 'Wie melde ich mich ab?',
    a: 'Account → Abmelden (oben). Deine Daten im Pool bleiben erhalten.' },
];

function _faqHTML() {
  return FAQ.map((item, i) => `
    <div class="faq-item${i > 0 ? '' : ''}" id="faq-k-${i}">
      ${i > 0 ? '<div class="settings-group__divider"></div>' : ''}
      <button class="faq-item__q" data-action="faq:toggle" data-id="faq-k-${i}">
        <span>${item.q}</span>
        <svg class="faq-item__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-item__a hidden">${item.a}</div>
    </div>
  `).join('');
}

// ── Handlers ───────────────────────────────────────────────
function _registerHandlers() {
  on('settings:lang-toggle', () => {
    const panel = document.getElementById('settings-lang-panel');
    const chev  = document.getElementById('lang-chevron');
    if (!panel) return;
    const isHidden = panel.classList.toggle('hidden');
    _langOpen = !isHidden;
    if (chev) chev.style.transform = _langOpen ? 'rotate(180deg)' : '';
  });

  on('faq:toggle', (el) => {
    const id   = el.dataset.id;
    const item = document.getElementById(id);
    if (!item) return;
    const ans  = item.querySelector('.faq-item__a');
    const chev = item.querySelector('.faq-item__chevron');
    const open = item.classList.toggle('faq-item--open');
    if (ans)  ans.classList.toggle('hidden', !open);
    if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    if (open) _openFaqIds.add(id); else _openFaqIds.delete(id);
  });

  on('settings:push', () => {
    if (!('Notification' in window)) {
      import('../components/toast.js').then(m => m.toast('Push nicht verfügbar', 'warning'));
      return;
    }
    Notification.requestPermission().then(perm => {
      import('../components/toast.js').then(({ toast }) => {
        if (perm === 'granted') toast('Push aktiviert! 🔔', 'success');
        else toast('Push nicht erlaubt', 'warning');
      });
    });
  });

  on('settings:theme', (el) => {
    const mode = el.dataset.theme;
    if (['auto','light','dark'].includes(mode)) { setTheme(mode); render(); }
  });

  on('settings:logout', () => {
    import('../main.js').then(m => m.logout());
  });

  on('settings:pin', () => {
    const u = state.db.members?.[state.currentUser] || {};
    if (u.memberPin) {
      // Already has PIN — offer change or disable
      openModal({
        id: 'pin-choose-modal',
        title: '🔑 PIN-Schutz',
        body: `<p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:16px">Was möchtest du tun?</p>`,
        actions: [
          { label: 'PIN ändern', cmd: 'change', class: 'btn--primary' },
          { label: 'PIN deaktivieren', cmd: 'disable', class: 'btn--danger' },
        ],
      });
      on('modal:action', (el) => {
        if (el.dataset.modal !== 'pin-choose-modal') return;
        closeModal('pin-choose-modal');
        _openPinModal(el.dataset.cmd === 'disable' ? 'disable' : 'change');
      });
    } else {
      _openPinModal('set');
    }
  });

  on('settings:privacy', () => _openPrivacyModal());
  on('settings:homescreen', () => _openHomescreenModal());
  on('pin:key', (el) => _handlePinKey(el));
  on('pin:del', () => _handlePinDel());
}

// ── PIN Flow ──────────────────────────────────────────────

function _openPinModal(flow) {
  _pinBuf = ''; _pinStep = 'new'; _pinFirst = ''; _pinFlow = flow;
  const labels = {
    set:     { title: 'PIN einrichten',   sub: 'Neuen 4-stelligen PIN wählen' },
    change:  { title: 'PIN ändern',       sub: 'Neuen 4-stelligen PIN wählen' },
    disable: { title: 'PIN deaktivieren', sub: 'Aktuellen PIN eingeben' },
  };
  const { title, sub } = labels[flow] || labels.set;
  openModal({ id: 'settings-pin', title: `🔑 ${title}`, body: _pinBody(sub) });
}

function _pinBody(sub) {
  const keys = [1,2,3,4,5,6,7,8,9];
  return `
    <div class="pin-modal">
      <div class="pin-modal__sub" id="pin-modal-sub">${esc(sub)}</div>
      <div class="pin-modal__dots" id="pin-dots">
        ${Array.from({length: PIN_LEN}, () => '<span class="pin-dot"></span>').join('')}
      </div>
      <div class="pin-modal__err" id="pin-err"></div>
      <div class="pin-modal__grid">
        ${keys.map(n => `<button class="btn pin-key" data-action="pin:key" data-key="${n}">${n}</button>`).join('')}
        <button class="btn pin-key pin-key--ghost" data-action="pin:del">⌫</button>
        <button class="btn pin-key" data-action="pin:key" data-key="0">0</button>
        <div></div>
      </div>
    </div>
  `;
}

function _updatePinDots() {
  const c = document.getElementById('pin-dots');
  if (!c) return;
  c.innerHTML = Array.from({length: PIN_LEN}, (_, i) =>
    `<span class="pin-dot${i < _pinBuf.length ? ' pin-dot--filled' : ''}"></span>`
  ).join('');
}

function _setPinErr(msg) {
  const e = document.getElementById('pin-err');
  if (e) e.textContent = msg;
}

function _handlePinKey(el) {
  const key = el.dataset.key;
  if (!key || _pinBuf.length >= PIN_LEN) return;
  _pinBuf += key;
  _updatePinDots();
  _setPinErr('');
  if (_pinBuf.length === PIN_LEN) setTimeout(_confirmPin, 150);
}

function _handlePinDel() {
  _pinBuf = _pinBuf.slice(0, -1);
  _updatePinDots();
}

function _confirmPin() {
  if (_pinBuf.length < PIN_LEN) return;
  const cu = state.currentUser;
  const u  = state.db.members?.[cu] || {};

  if (_pinFlow === 'disable') {
    if (btoa(_pinBuf) === (u.memberPin || '')) {
      writeDB(`members/${cu}/memberPin`, null);
      closeModal('settings-pin');
      toast('🔓 PIN deaktiviert', 'success');
      render();
    } else {
      _setPinErr('❌ Falscher PIN'); _pinBuf = ''; _updatePinDots();
    }
    return;
  }

  if (_pinStep === 'new') {
    _pinFirst = _pinBuf; _pinBuf = ''; _pinStep = 'confirm';
    _updatePinDots();
    const sub = document.getElementById('pin-modal-sub');
    if (sub) sub.textContent = 'PIN bestätigen';
    _setPinErr('');
  } else {
    if (_pinBuf === _pinFirst) {
      writeDB(`members/${cu}/memberPin`, btoa(_pinBuf));
      closeModal('settings-pin');
      toast('✅ PIN gespeichert', 'success');
      render();
    } else {
      _setPinErr('❌ Nicht übereinstimmend');
      _pinBuf = ''; _pinFirst = ''; _pinStep = 'new';
      _updatePinDots();
      const sub = document.getElementById('pin-modal-sub');
      if (sub) sub.textContent = 'Neuen 4-stelligen PIN wählen';
    }
  }
}

// ── Privacy Modal ─────────────────────────────────────────

function _openPrivacyModal() {
  const lang = state.lang || 'de';
  const p    = PRIVACY[lang] || PRIVACY.de;
  const body = p.sections.map(([h, t]) =>
    `<div class="priv-section"><div class="priv-section__h">${esc(h)}</div><div class="priv-section__p">${esc(t)}</div></div>`
  ).join('');
  openModal({ id: 'privacy-modal', title: p.title, body: `<div class="priv-body">${body}</div>` });
}

// ── Homescreen Guide Modal ────────────────────────────────

function _openHomescreenModal() {
  const ios = [
    'Seite in <strong>Safari</strong> öffnen',
    'Teilen-Symbol <strong>□↑</strong> antippen',
    '→ <strong>„Zum Home-Bildschirm"</strong> wählen',
    '→ <strong>„Hinzufügen"</strong> bestätigen',
  ];
  const and_ = [
    'Seite in <strong>Chrome</strong> öffnen',
    'Menü <strong>⋮</strong> oben rechts antippen',
    '→ <strong>„App installieren"</strong> oder <strong>„Zum Startbildschirm"</strong>',
    '→ <strong>„Hinzufügen"</strong> bestätigen',
  ];
  const block = (emoji, title, steps) =>
    `<div class="hs-block">
      <div class="hs-block__title">${emoji} ${title}</div>
      <ol class="hs-block__steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>`;

  openModal({
    id: 'homescreen-modal',
    title: '📱 Zum Homescreen',
    body: block('🍎', 'iPhone / iPad (Safari)', ios) + block('🤖', 'Android (Chrome)', and_),
  });
}
