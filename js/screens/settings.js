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

const HOMESCREEN = {
  de: {
    ios: [
      'Seite in <strong>Safari</strong> öffnen',
      'Teilen-Symbol <strong>□↑</strong> antippen',
      '→ <strong>„Zum Home-Bildschirm"</strong> wählen',
      '→ <strong>„Hinzufügen"</strong> bestätigen',
    ],
    and: [
      'Seite in <strong>Chrome</strong> öffnen',
      'Menü <strong>⋮</strong> oben rechts antippen',
      '→ <strong>„App installieren"</strong> oder <strong>„Zum Startbildschirm"</strong>',
      '→ <strong>„Hinzufügen"</strong> bestätigen',
    ],
  },
  en: {
    ios: [
      'Open page in <strong>Safari</strong>',
      'Tap the share icon <strong>□↑</strong>',
      '→ Select <strong>"Add to Home Screen"</strong>',
      '→ Confirm <strong>"Add"</strong>',
    ],
    and: [
      'Open page in <strong>Chrome</strong>',
      'Tap the menu <strong>⋮</strong> top right',
      '→ Select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>',
      '→ Confirm <strong>"Add"</strong>',
    ],
  },
};

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
  const bal    = given - recv;

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
            <div class="settings-user-card__stat-label">${(t('pGiven') || 'Gegeben').toLowerCase()}</div>
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
        <div class="settings-group__label">${t('settingsDesign')}</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">🎨</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('themeLabel') || 'Theme'}</div>
            </div>
            <div class="settings-theme-seg">
              <button class="seg-btn seg-btn--lbl ${theme==='light'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="light">${t('themeLight')}</button>
              <button class="seg-btn seg-btn--lbl ${theme==='dark'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="dark">${t('themeDark')}</button>
              <button class="seg-btn seg-btn--lbl ${theme==='auto'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="auto">${t('themeAuto')}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Sprache ─────────────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">${t('settingsLangLabel')}</div>
        <div class="settings-group__card">
          <div class="settings-row-item settings-row-item--tap" data-action="settings:lang-toggle">
            <div class="settings-row-item__icon">🌍</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('settingsLangChoose')}</div>
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

      <!-- ── Ankündigungen ─────────────────────────────────── -->
      ${_renderBroadcastSection(cu)}

      <!-- ── Benachrichtigungen ──────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">${t('setSecNotif') || 'Benachrichtigungen'}</div>
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
        <div class="settings-group__label">${t('settingsAccount')}</div>
        <div class="settings-group__card">
          <div class="settings-row-item">
            <div class="settings-row-item__icon">👤</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('settingsLoggedAs')}</div>
              <div class="settings-row-item__sub">@${esc(cu || '–')}</div>
            </div>
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap" data-action="settings:pin">
            <div class="settings-row-item__icon">🔑</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('pinProtect') || 'PIN-Schutz'}</div>
              <div class="settings-row-item__sub">${u.memberPin ? t('pinActiveSub') : t('pinSetupHint')}</div>
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

      <!-- ── Freunde werben ─────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">${t('referSection') || 'Empfehlen'}</div>
        <div class="settings-group__card">
          <div class="settings-row-item settings-row-item--tap" data-action="settings:refer">
            <div class="settings-row-item__icon">🎉</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('referTitle') || 'Freunde einladen'}</div>
              <div class="settings-row-item__sub">${t('referSub') || 'Text & Link teilen — Pool stärken'}</div>
            </div>
            ${_chevSVG}
          </div>
        </div>
      </div>

      <!-- ── FAQ Accordion ───────────────────────────────── -->
      <div class="settings-group">
        <div class="settings-group__label">${t('settingsHelp')}</div>
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
              <div class="settings-row-item__label">${t('hsTitle')}</div>
              <div class="settings-row-item__sub">${t('hsSub')}</div>
            </div>
            ${_chevSVG}
          </div>
          <div class="settings-group__divider"></div>
          <div class="settings-row-item settings-row-item--tap" data-action="settings:privacy">
            <div class="settings-row-item__icon">🔒</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('privTitle')}</div>
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
const _FAQ_DE = [
  { q: 'Was ist der NOVA Support Pool?',
    a: 'Eine gegenseitige TikTok-Community. Du kommentierst auf Videos anderer — sie auf deinen. Kein Algorithmus, nur echte Menschen.' },
  { q: 'Wie berechnet sich das Guthaben?',
    a: 'Guthaben = Gegeben minus Erhalten (max. +20). Support geben = +1, Video erhalten = −1. Negatives Guthaben sperrt neue Posts.' },
  { q: 'Wie oft kann ich ein Video posten?',
    a: 'Einmal alle 12 Stunden. Der Cooldown startet beim letzten Post.' },
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
function _getFAQ() { return t('faqItems') || _FAQ_DE; }

function _renderBroadcastSection(cu) {
  const settings = state.db.settings || {};
  const text = settings.broadcast || '';
  const active = settings.broadcastActive;
  const isAdmin = state.db.members?.[cu]?.role === 'admin';
  const memberCount = Object.values(state.db.members || {}).filter(m => m.status === 'active').length;

  return `
    <div class="settings-group">
      <div class="settings-group__label">${t('broadcastLabel') || 'Ankündigungen'}</div>
      <div class="settings-group__card">
        ${text && active ? `
          <div class="settings-broadcast-box">
            <span class="settings-broadcast-box__icon">📢</span>
            <span class="settings-broadcast-box__text">${text.replace(/</g,'&lt;')}</span>
            <button class="btn btn--sm btn--ghost" data-action="settings:bc:copy" data-text="${text.replace(/"/g,'&quot;')}">
              ${t('broadcastCopy') || 'Kopieren'}
            </button>
          </div>
          ${isAdmin ? `<div class="settings-broadcast-box__meta">${(t('bcVisibleFor') || 'Sichtbar für {n} Mitglieder').replace('{n}', memberCount)}</div>` : ''}
        ` : `
          <div class="settings-row-item">
            <div class="settings-row-item__icon">📢</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('broadcastLabel') || 'Ankündigungen'}</div>
              <div class="settings-row-item__sub" style="color:var(--text-tertiary)">${t('bcNoActive') || 'Keine aktive Ankündigung'}</div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function _faqHTML() {
  return _getFAQ().map((item, i) => `
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

  on('settings:bc:copy', (el) => {
    const text = el.dataset.text || '';
    import('../utils.js').then(({ copyToClipboard }) =>
      copyToClipboard(text).then(() =>
        import('../components/toast.js').then(m => m.toast(t('capCopied') || 'Kopiert! 📋', 'success', 1500))
      )
    );
  });

  on('settings:push', () => {
    if (!('Notification' in window)) {
      import('../components/toast.js').then(m => m.toast(t('pushNotAvail'), 'warning'));
      return;
    }
    Notification.requestPermission().then(perm => {
      import('../components/toast.js').then(({ toast }) => {
        if (perm === 'granted') toast(t('pushEnabled'), 'success');
        else toast(t('pushDenied'), 'warning');
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
        body: `<p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:16px">${t('pinChooseSub')}</p>`,
        actions: [
          { label: t('pinChangeLbl'), cmd: 'change', class: 'btn--primary' },
          { label: t('pinDisableLbl'), cmd: 'disable', class: 'btn--danger' },
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

  on('settings:refer', () => _openReferModal());
  on('refer:copy:text', (el) => {
    const text = el.dataset.copy || '';
    import('../utils.js').then(({ copyToClipboard }) =>
      copyToClipboard(text).then(() => toast(t('capCopied') || 'Kopiert! 📋', 'success', 1500))
    );
  });
  on('refer:copy:link', (el) => {
    const link = el.dataset.copy || '';
    import('../utils.js').then(({ copyToClipboard }) =>
      copyToClipboard(link).then(() => toast(t('capCopied') || 'Kopiert! 📋', 'success', 1500))
    );
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
    set:     { title: t('pinSetupTitle'),   sub: t('pinNewSub') },
    change:  { title: t('pinChangeTitle'),  sub: t('pinNewSub') },
    disable: { title: t('pinDisableTitle'), sub: t('pinCurrentSub') },
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
      toast(t('pinDeactivated'), 'success');
      render();
    } else {
      _setPinErr(t('pinWrongErr')); _pinBuf = ''; _updatePinDots();
    }
    return;
  }

  if (_pinStep === 'new') {
    _pinFirst = _pinBuf; _pinBuf = ''; _pinStep = 'confirm';
    _updatePinDots();
    const sub = document.getElementById('pin-modal-sub');
    if (sub) sub.textContent = t('pinConfirmSub');
    _setPinErr('');
  } else {
    if (_pinBuf === _pinFirst) {
      writeDB(`members/${cu}/memberPin`, btoa(_pinBuf));
      closeModal('settings-pin');
      toast(t('pinSaved'), 'success');
      render();
    } else {
      _setPinErr(t('pinMismatch'));
      _pinBuf = ''; _pinFirst = ''; _pinStep = 'new';
      _updatePinDots();
      const sub = document.getElementById('pin-modal-sub');
      if (sub) sub.textContent = t('pinNewSub');
    }
  }
}

// ── Refer Modal ───────────────────────────────────────────

function _openReferModal() {
  const link      = document.querySelector('base')?.href || window.location.origin;
  const text      = t('referText') || 'Hey! 👋 Ich bin im NOVA Support Pool – einer TikTok-Community, in der wir uns gegenseitig unterstützen. Komm dazu und lass uns zusammen wachsen! 🚀';
  const instr     = t('referInstr')     || 'Kopiere den Text und schick ihn an Freunde — oder teile direkt den Link zur App.';
  const textLabel = t('referTextLabel') || 'Einladungstext';
  const linkLabel = t('referLinkLabel') || 'App-Link';
  const copyLbl   = t('broadcastCopy')  || 'Kopieren';

  openModal({
    id: 'refer-modal',
    title: `🎉 ${t('referTitle') || 'Freunde einladen'}`,
    body: `
      <p class="refer-instr">${esc(instr)}</p>
      <div class="refer-block">
        <div class="refer-block__label">${esc(textLabel)}</div>
        <div class="refer-block__text">${esc(text)}</div>
        <button class="btn btn--sm btn--primary refer-copy-btn"
          data-action="refer:copy:text"
          data-copy="${text.replace(/"/g, '&quot;')}">
          📋 ${copyLbl}
        </button>
      </div>
      <div class="refer-block">
        <div class="refer-block__label">${esc(linkLabel)}</div>
        <div class="refer-block__text refer-block__text--link">${esc(link)}</div>
        <button class="btn btn--sm btn--ghost refer-copy-btn"
          data-action="refer:copy:link"
          data-copy="${link}">
          🔗 ${copyLbl}
        </button>
      </div>
    `,
  });
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
  const lang = state.lang || 'de';
  const hs   = HOMESCREEN[lang] || HOMESCREEN.de;
  const block = (emoji, title, steps) =>
    `<div class="hs-block">
      <div class="hs-block__title">${emoji} ${title}</div>
      <ol class="hs-block__steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    </div>`;

  openModal({
    id: 'homescreen-modal',
    title: `📱 ${t('hsTitle')}`,
    body: block('🍎', 'iPhone / iPad (Safari)', hs.ios) + block('🤖', 'Android (Chrome)', hs.and),
  });
}
