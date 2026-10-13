/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Central Event Delegation
   All data-action handlers live here.
   ═══════════════════════════════════════════════════════ */

import { goScreen } from './router.js';
import { addRipple } from './utils.js';

// Handler map: 'action-name' → fn(element, event)
const _handlers = {};

export function initEvents() {
  document.addEventListener('click', handleClick, { passive: false });
  document.addEventListener('input', handleInput, { passive: true });
  document.addEventListener('change', handleChange, { passive: true });
  document.addEventListener('keydown', handleKeydown, { passive: false });
}

// ── Click delegation ──────────────────────────────────────
function handleClick(e) {
  // Ripple on .btn elements
  const btn = e.target.closest('.btn');
  if (btn) addRipple(btn, e);

  // Action dispatch
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const handler = _handlers[action];
  if (handler) {
    e.preventDefault();
    handler(target, e);
  }
}

// ── Input delegation ──────────────────────────────────────
function handleInput(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const handler = _handlers[action + ':input'] || _handlers[action];
  if (handler) handler(target, e);
}

// ── Change delegation ─────────────────────────────────────
function handleChange(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const handler = _handlers[action + ':change'];
  if (handler) handler(target, e);
}

// ── Keydown ───────────────────────────────────────────────
function handleKeydown(e) {
  if (e.key === 'Escape') {
    import('./components/modal.js').then(m => m.closeTopModal());
  }
  if (e.key === 'Enter') {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'login:input') {
      e.preventDefault();
      dispatchAction('login:submit', target, e);
    } else if (action === 'chat:pool:input' || action === 'chat:dm:input') {
      e.preventDefault();
      dispatchAction(action, target, e);
    }
  }
}

// ── Register handlers ─────────────────────────────────────
export function on(action, fn) {
  _handlers[action] = fn;
}

export function off(action) {
  delete _handlers[action];
}

function dispatchAction(action, el, e) {
  const h = _handlers[action];
  if (h) h(el, e);
}

// ── Built-in nav handler ──────────────────────────────────
on('nav:goto', (el) => {
  const screen = el.dataset.screen;
  if (screen) goScreen(screen);
});

on('nav:profile', () => goScreen('profile'));

// ── Modal handlers (loaded lazily) ───────────────────────
on('modal:close', (el) => {
  const id = el.dataset.modal || el.closest('.modal-backdrop')?.dataset.modal;
  import('./components/modal.js').then(m => m.closeModal(id));
});

on('modal:settings', () => goScreen('settings'));

// ── Login actions (wired in login.js init) ───────────────
// Stubs — overridden by screens/login.js on load
on('login:input', () => {});
on('login:submit', () => {});
on('pin:key', () => {});
on('pin:del', () => {});
on('pin:forgot', () => {});

// ── Post video ────────────────────────────────────────────
on('post:open', () => {
  import('./features/posting.js').then(m => m.openPostModal());
});

// ── Support actions ───────────────────────────────────────
on('support:open', (el) => {
  import('./features/support.js').then(m => m.handleSupport(el.dataset.vid));
});

on('support:copy', (el) => {
  import('./features/support.js').then(m => m.copyComment(el.dataset.comment));
});

on('support:video-opened', () => {});  // overridden by support.js after load

// ── Notification actions ──────────────────────────────────
on('notif:del', (el) => {
  import('./features/notifications.js').then(m => m.delNotif(el.dataset.id));
});

on('notif:reply', (el) => {
  import('./features/notifications.js').then(m => m.openReply(el.dataset.from));
});

// ── Profile check ─────────────────────────────────────────
on('profile:check', () => {
  import('./features/profileCheck.js').then(m => m.openProfileCheck());
});

on('profile:tab', (el) => {
  import('./features/profileCheck.js').then(m => m.switchTab(el.dataset.tab));
});

on('story:save', () => {
  import('./features/profileCheck.js').then(m => m.downloadStoryCard());
});

// ── Lang picker ───────────────────────────────────────────
on('lang:set', (el) => {
  const lang = el.dataset.lang;
  if (lang) import('./i18n.js').then(m => m.setLang(lang));
});

// ── Admin actions ─────────────────────────────────────────
on('admin:tab', (el) => {
  import('./screens/admin.js').then(m => m.switchAdminTab(el.dataset.tab));
});

on('admin:group:toggle', (el) => {
  import('./screens/admin.js').then(m => m.toggleGroupAccordion(el.dataset.group));
});

// ── Guide → Settings/FAQ ───────────────────────────────────
on('guide:open', () => {
  import('./router.js').then(m => m.goScreen('settings'));
});

// ── FAQ accordion (wired in settings.js) ──────────────────
on('faq:toggle', () => {});

// ── Caption ───────────────────────────────────────────────
on('caption:generate', () => {
  import('./screens/caption.js').then(m => m.generate());
});

// ── Settings ──────────────────────────────────────────────
on('settings:theme', (el) => {
  import('./features/theme.js').then(({ setTheme }) => setTheme(el.dataset.theme));
});

on('settings:logout', () => {
  import('./main.js').then(m => m.logout());
});
