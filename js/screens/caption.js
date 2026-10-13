/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Caption Generator Screen
   ═══════════════════════════════════════════════════════ */

import { state }    from '../state.js';
import { t }        from '../i18n.js';
import { esc }      from '../utils.js';
import { on }       from '../events.js';
import { callFn }   from '../firebase.js';
import { toast }    from '../components/toast.js';

const NICHES = ['Lifestyle','Fitness','Food','Tech','Business','Comedy','Beauty','Gaming','Music','Art'];
const HOOKS  = ['Frage','Überraschung','Liste','Story','Provokation','How-To'];

let _niche = '';
let _hook  = '';

export function render() {
  const el = document.getElementById('screen-caption');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header__title">${t('capTileLabel') || 'Caption Generator'}</div>
      <div class="page-header__sub">${t('capTileSub') || 'Hashtags & Hook-Formeln'}</div>
    </div>
    <div class="caption-scroll">
      <div class="card card--glass" style="padding:20px;margin-bottom:16px">
        <!-- Niche -->
        <label class="input-label">${t('capNiche') || 'Nische wählen'}</label>
        <div class="chip-row" style="margin-bottom:16px">
          ${NICHES.map(n => `
            <button class="chip ${_niche===n?'chip--active':''}" data-action="cap:niche" data-val="${n}">${n}</button>
          `).join('')}
        </div>

        <!-- Hook -->
        <label class="input-label">${t('capHook') || 'Hook-Stil'}</label>
        <div class="chip-row" style="margin-bottom:20px">
          ${HOOKS.map(h => `
            <button class="chip ${_hook===h?'chip--active':''}" data-action="cap:hook" data-val="${h}">${h}</button>
          `).join('')}
        </div>

        <button class="btn btn--primary btn--full" data-action="caption:generate">
          ✨ ${t('capGenerate') || 'Caption generieren'}
        </button>
      </div>

      <!-- Results -->
      <div id="caption-results"></div>
    </div>
  `;

  _registerHandlers();
}

export async function generate() {
  const res = document.getElementById('caption-results');
  if (!res) return;

  if (!_niche || !_hook) {
    toast('Nische und Hook-Stil wählen', 'warning');
    return;
  }

  res.innerHTML = `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:8px"></div>
    <div class="skeleton" style="height:80px;border-radius:12px"></div>`;

  try {
    const data = await callFn('generateCaption', { niche: _niche, hookStyle: _hook, lang: state.lang });
    const captions = data?.captions || [];

    if (!captions.length) {
      res.innerHTML = `<div class="empty-state"><div class="empty-state__sub">Keine Ergebnisse</div></div>`;
      return;
    }

    res.innerHTML = captions.map(c => `
      <div class="card card--glass" style="padding:16px;margin-bottom:12px">
        <div style="font-size:14px;line-height:1.6;color:var(--text-primary);white-space:pre-wrap">${esc(c)}</div>
        <button class="btn btn--ghost btn--sm" data-action="cap:copy" data-text="${esc(c)}" style="margin-top:10px">
          📋 ${t('capCopy') || 'Kopieren'}
        </button>
      </div>
    `).join('');
  } catch (err) {
    toast('Fehler beim Generieren', 'error');
    res.innerHTML = '';
  }
}

function _registerHandlers() {
  on('cap:niche', (el) => {
    _niche = el.dataset.val;
    render();
  });
  on('cap:hook', (el) => {
    _hook = el.dataset.val;
    render();
  });
  on('cap:copy', async (el) => {
    const text = el.dataset.text || '';
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert! 📋', 'success', 1800);
    } catch {
      toast(text, 'info', 6000);
    }
  });
}
