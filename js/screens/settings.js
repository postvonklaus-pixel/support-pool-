/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Settings Screen
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { on }          from '../events.js';
import { storage, setTheme, getTheme } from '../storage.js';

const LANG_FLAGS = { de:'🇩🇪',en:'🇬🇧',id:'🇮🇩',it:'🇮🇹',es:'🇪🇸',tr:'🇹🇷',ar:'🇸🇦',zh:'🇨🇳',ja:'🇯🇵',pl:'🇵🇱' };
const LANG_NAMES = { de:'Deutsch',en:'English',id:'Bahasa',it:'Italiano',es:'Español',tr:'Türkçe',ar:'العربية',zh:'中文',ja:'日本語',pl:'Polski' };

export function render() {
  const el = document.getElementById('screen-settings');
  if (!el) return;

  const cu   = state.currentUser;
  const u    = state.db.members?.[cu] || {};
  const theme = getTheme();

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('settings') || 'Einstellungen'}</div>
    </div>
    <div class="settings-scroll">

      <!-- Language section -->
      <div class="settings-section">
        <div class="settings-section__title">${t('setSecLang') || 'Sprache'}</div>
        <div class="settings-lang-grid">
          ${Object.entries(LANG_FLAGS).map(([code, flag]) => `
            <button class="lang-chip ${state.lang === code ? 'lang-chip--active' : ''}"
              data-action="lang:set" data-lang="${code}" aria-label="${LANG_NAMES[code]}">
              ${flag} ${LANG_NAMES[code]}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Theme section -->
      <div class="settings-section">
        <div class="settings-section__title">Design</div>
        <div class="settings-row">
          <div class="settings-row__left">
            <div class="settings-row__label">Dark Mode</div>
          </div>
          <div class="settings-row__right">
            <div class="theme-toggle-row">
              <button class="btn btn--sm ${theme === 'dark' ? 'btn--primary' : 'btn--ghost'}"
                data-action="settings:theme" data-theme="dark">🌙 Dark</button>
              <button class="btn btn--sm ${theme === 'light' ? 'btn--primary' : 'btn--ghost'}"
                data-action="settings:theme" data-theme="light">☀️ Light</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Push notifications -->
      <div class="settings-section">
        <div class="settings-section__title">${t('setSecNotif') || 'Benachrichtigungen'}</div>
        <div class="settings-row">
          <div class="settings-row__left">
            <div class="settings-row__label">${t('pushTitle') || 'Push-Nachrichten'}</div>
            <div class="settings-row__sub">${t('pushDesc') || 'Werde benachrichtigt bei neuen Supports'}</div>
          </div>
          <div class="settings-row__right">
            <button class="btn btn--sm btn--secondary" id="settings-push-btn" data-action="settings:push">
              ${t('pushActivate') || 'Aktivieren'}
            </button>
          </div>
        </div>
      </div>

      <!-- Account -->
      <div class="settings-section">
        <div class="settings-section__title">Account</div>
        ${cu ? `<div class="settings-row">
          <div class="settings-row__left">
            <div class="settings-row__label">Angemeldet als</div>
            <div class="settings-row__sub">@${cu}</div>
          </div>
        </div>` : ''}
        <button class="btn btn--danger btn--full" data-action="settings:logout" style="margin-top:12px">
          ${t('logout') || 'Abmelden'}
        </button>
      </div>

      <!-- App info -->
      <div class="settings-section">
        <div class="settings-section__title">${t('setSecApp') || 'App'}</div>
        <div class="settings-row">
          <div class="settings-row__left">
            <div class="settings-row__label">NOVA Support Pool</div>
            <div class="settings-row__sub">v2.0 — Dark Premium Glass</div>
          </div>
        </div>
      </div>

    </div>
  `;

  _registerHandlers();
}

function _registerHandlers() {
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
    setTheme(el.dataset.theme);
    render();
  });

  on('settings:logout', () => {
    import('../main.js').then(m => m.logout());
  });
}
