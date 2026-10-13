/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Settings Screen
   ═══════════════════════════════════════════════════════ */

import { state }       from '../state.js';
import { t }           from '../i18n.js';
import { on }          from '../events.js';
import { storage }     from '../storage.js';
import { setTheme, getTheme } from '../features/theme.js';

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
            <div class="settings-row__label">Theme</div>
          </div>
          <div class="settings-row__right">
            <div class="theme-toggle-row">
              <button class="btn btn--sm ${theme === 'auto' ? 'btn--primary' : 'btn--ghost'}"
                data-action="settings:theme" data-theme="auto">🌗 Auto</button>
              <button class="btn btn--sm ${theme === 'light' ? 'btn--primary' : 'btn--ghost'}"
                data-action="settings:theme" data-theme="light">☀️ Light</button>
              <button class="btn btn--sm ${theme === 'dark' ? 'btn--primary' : 'btn--ghost'}"
                data-action="settings:theme" data-theme="dark">🌙 Dark</button>
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

      <!-- Guide / FAQ -->
      <div class="settings-section">
        <div class="settings-section__title">Hilfe</div>
        <div class="settings-guide-card" data-action="guide:inline">
          <div class="settings-guide-card__icon">📖</div>
          <div class="settings-guide-card__body">
            <div class="settings-guide-card__title">NOVA Support Pool — Guide</div>
            <div class="settings-guide-card__sub">Wie funktioniert der Pool? Regeln, Ränge, Guthaben</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-guide-content hidden" id="settings-guide-content">
          ${_guideHTML()}
        </div>
      </div>

      <!-- App info -->
      <div class="settings-section">
        <div class="settings-section__title">${t('setSecApp') || 'App'}</div>
        <div class="settings-row">
          <div class="settings-row__left">
            <div class="settings-row__label">NOVA Support Pool</div>
            <div class="settings-row__sub">v2.0 — Phase 2</div>
          </div>
        </div>
      </div>

    </div>
  `;

  _registerHandlers();
}

function _guideHTML() {
  return `
    <div class="settings-guide-body">
      <div class="settings-guide-block">
        <div class="settings-guide-block__title">🎯 Wie funktioniert's?</div>
        <p>Der NOVA Support Pool ist eine gegenseitige TikTok-Support-Community. Du kommentierst auf anderen Videos — andere kommentieren auf deinen.</p>
      </div>
      <div class="settings-guide-block">
        <div class="settings-guide-block__title">💰 Guthaben (Balance)</div>
        <p>Jeder Support den du gibst = +1. Jeder den du bekommst = −1.<br>Balance = Gegeben − Erhalten (max. +20). Negatives Guthaben blockiert neue Posts.</p>
      </div>
      <div class="settings-guide-block">
        <div class="settings-guide-block__title">🎬 Video posten</div>
        <p>Drücke das <strong>+</strong>-FAB oder "Video posten" und füge deinen TikTok-Link ein. Nach 24h kann ein neues Video gepostet werden.</p>
      </div>
      <div class="settings-guide-block">
        <div class="settings-guide-block__title">🏆 Rang-System</div>
        <div class="settings-guide-ranks">
          <div class="settings-guide-rank"><span>🌱 Neuling</span><span>0–4</span></div>
          <div class="settings-guide-rank"><span>⚡ Aufsteiger</span><span>5–19</span></div>
          <div class="settings-guide-rank"><span>🔥 Aktiv</span><span>20–49</span></div>
          <div class="settings-guide-rank"><span>🏆 Veteran</span><span>50–99</span></div>
          <div class="settings-guide-rank"><span>👑 Elite</span><span>100+</span></div>
        </div>
      </div>
    </div>
  `;
}

function _registerHandlers() {
  on('guide:inline', () => {
    const content = document.getElementById('settings-guide-content');
    if (content) content.classList.toggle('hidden');
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
