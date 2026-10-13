/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Settings Screen  (Part K Redesign)
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { esc, avatarGradient } from '../utils.js';
import { on }          from '../events.js';
import { setTheme, getTheme } from '../features/theme.js';
import { trustLevel }  from '../features/trust.js';

const LANG_FLAGS = { de:'🇩🇪',en:'🇬🇧',id:'🇮🇩',it:'🇮🇹',es:'🇪🇸',tr:'🇹🇷',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',pl:'🇵🇱' };
const LANG_NAMES = { de:'Deutsch',en:'English',id:'Bahasa',it:'Italiano',es:'Español',tr:'Türkçe',ar:'العربية',zh:'中文',ja:'日本語',pl:'Polski' };

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
              <button class="seg-btn ${theme==='auto'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="auto" aria-label="Auto">🌗</button>
              <button class="seg-btn ${theme==='light'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="light" aria-label="Hell">☀️</button>
              <button class="seg-btn ${theme==='dark'?'seg-btn--active':''}"
                data-action="settings:theme" data-theme="dark" aria-label="Dunkel">🌙</button>
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
          <div class="settings-row-item settings-row-item--tap settings-row-item--danger" data-action="settings:logout">
            <div class="settings-row-item__icon">🚪</div>
            <div class="settings-row-item__body">
              <div class="settings-row-item__label">${t('logout') || 'Abmelden'}</div>
            </div>
            <svg class="settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
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
              <div class="settings-row-item__sub">v2.0 — Phase 2</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  _registerHandlers();
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
    const open = panel.classList.toggle('hidden');
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
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
}
