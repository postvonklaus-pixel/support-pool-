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

      <!-- FAQ Accordion -->
      <div class="settings-section">
        <div class="settings-section__title">Hilfe & FAQ</div>
        ${_faqHTML()}
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

const FAQ = [
  {
    cat: '🎯 Grundlagen',
    items: [
      {
        q: 'Was ist der NOVA Support Pool?',
        a: 'Eine gegenseitige TikTok-Community. Du kommentierst auf Videos anderer Mitglieder — sie kommentieren auf deinen. Kein Algorithmus, nur echte Menschen.',
      },
      {
        q: 'Wie nehme ich am Pool teil?',
        a: 'Öffne den Feed-Tab und tippe auf „Supporten". Folge dem 3-Schritt-Prozess: Video öffnen, Kommentar kopieren & posten, dann bestätigen.',
      },
      {
        q: 'Muss ich jeden Tag aktiv sein?',
        a: 'Nein — aber je aktiver du bist, desto mehr Guthaben sammelst du und desto schneller steigst du im Rang auf.',
      },
    ],
  },
  {
    cat: '💰 Guthaben',
    items: [
      {
        q: 'Wie berechnet sich das Guthaben?',
        a: 'Guthaben = Gegeben − Erhalten. Maximum +20. Jeder Support den du gibst +1, jeder den dein Video erhält −1.',
      },
      {
        q: 'Was passiert bei negativem Guthaben?',
        a: 'Du kannst keine neuen Videos posten, bis dein Guthaben wieder positiv ist. Supporten hilft direkt!',
      },
      {
        q: 'Warum ist das Guthaben bei +20 gedeckelt?',
        a: 'Damit niemand Guthaben horten kann — der Pool soll aktiv und ausgeglichen bleiben.',
      },
    ],
  },
  {
    cat: '🎬 Videos posten',
    items: [
      {
        q: 'Wie poste ich ein Video?',
        a: 'Tippe auf das + in der Mitte der Navigation oder auf „Video posten" im Dashboard. Füge deinen TikTok-Link ein.',
      },
      {
        q: 'Wie oft kann ich posten?',
        a: 'Einmal alle 24 Stunden. Der Timer läuft ab dem letzten Post.',
      },
      {
        q: 'Was sind Runden (R1/R2)?',
        a: 'Jedes Video startet in Runde 1 (R1). Wenn alle Slots voll sind, kommt es in Runde 2 für weitere Supports.',
      },
    ],
  },
  {
    cat: '🏆 Ränge',
    items: [
      {
        q: 'Wie funktioniert das Rang-System?',
        a: `Dein Rang basiert auf der Gesamtzahl gegebener Supports:\n🌱 Neuling (0–4) · ⚡ Aufsteiger (5–19) · 🔥 Aktiv (20–49) · 🏆 Veteran (50–99) · 👑 Elite (100+)`,
      },
      {
        q: 'Was bringt mir ein höherer Rang?',
        a: 'Sichtbarkeit in der Community, Trust-Badge auf deinen Videos und Zugang zu zukünftigen Rang-Vorteilen.',
      },
    ],
  },
  {
    cat: '⚙️ Technisches',
    items: [
      {
        q: 'Kann ich den Chat nutzen?',
        a: 'Ja! Im Chat-Tab findest du den Pool-Chat (alle) und private DMs mit einzelnen Mitgliedern.',
      },
      {
        q: 'Was sind Achievements?',
        a: 'Meilensteine, die du beim Supporten, Posten und Streak-Aufbauen automatisch freischaltest. Sichtbar in deinem Profil.',
      },
      {
        q: 'Wie melde ich mich ab?',
        a: 'Geh zu Einstellungen → Account → Abmelden. Deine Daten bleiben im Pool erhalten.',
      },
    ],
  },
];

function _faqHTML() {
  return FAQ.map((cat, ci) => `
    <div class="faq-category">
      <div class="faq-category__title">${cat.cat}</div>
      ${cat.items.map((item, ii) => {
        const id = `faq-${ci}-${ii}`;
        return `
          <div class="faq-item" id="${id}">
            <button class="faq-item__q" data-action="faq:toggle" data-id="${id}">
              <span>${item.q}</span>
              <svg class="faq-item__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="faq-item__a hidden">${item.a.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function _registerHandlers() {
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
